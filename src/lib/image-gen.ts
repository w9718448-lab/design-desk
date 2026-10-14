import "server-only";

import { getSecret, modelStatus } from "./ai";
import { imageProviders, type Aspect } from "./image-models";
import type { ImageProviderId } from "./types";

export type RefImage = { data: Buffer; mime: string; name: string };
export type GenRequest = { provider: ImageProviderId; model: string; prompt: string; aspect: Aspect; count: number; refs: RefImage[] };
export type GenResult = { images: Buffer[]; model: string };

// 各家对尺寸的要求不同：通义要求总像素在 1280² 到 1440² 之间，豆包 4.0 推荐 2K，GPT 只有三种尺寸。
const sizes: Record<ImageProviderId, Record<Aspect, string>> = {
  tongyi: { "1:1": "1280*1280", "3:4": "1140*1520", "9:16": "1008*1792", "4:3": "1520*1140", "16:9": "1792*1008" },
  doubao: { "1:1": "2048x2048", "3:4": "1728x2304", "9:16": "1440x2560", "4:3": "2304x1728", "16:9": "2560x1440" },
  openai: { "1:1": "1024x1024", "3:4": "1024x1536", "9:16": "1024x1536", "4:3": "1536x1024", "16:9": "1536x1024" },
};

// 测试时把三家都指到本机的假服务（tests/mock-ai.cjs）。
const base = (fallback: string) => process.env.DESIGN_DESK_IMAGE_BASE_URL || fallback;
const dataUri = (ref: RefImage) => `data:${ref.mime};base64,${ref.data.toString("base64")}`;

async function failText(response: Response, name: string) {
  const body = await response.text().catch(() => "");
  let detail = "";
  try {
    const json = JSON.parse(body) as { message?: string; error?: { message?: string } | string; code?: string };
    detail = (typeof json.error === "string" ? json.error : json.error?.message) || json.message || json.code || "";
  } catch {
    detail = body.slice(0, 120);
  }
  if (response.status === 401 || response.status === 403) return `${name} 拒绝了密钥（${response.status}），请到设置里检查 Key，或确认已在控制台开通这个模型。`;
  if (response.status === 429) return `${name} 说请求太频繁或额度用完了（429），稍后再试，或到控制台看看余额。`;
  return `${name} 返回 ${response.status}${detail ? `：${detail.slice(0, 160)}` : ""}`;
}

async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`下载生成的图片失败（${response.status}）`);
  return Buffer.from(await response.arrayBuffer());
}

async function tongyi(key: string, request: GenRequest): Promise<GenResult> {
  // 文生图用 wan2.6-t2i；带参考图要用能看图的 wan2.6-image（最多 4 张参考）。
  const refs = request.refs.slice(0, 4);
  const model = refs.length && request.model === imageProviders.tongyi.model ? "wan2.6-image" : request.model;
  const response = await fetch(`${base("https://dashscope.aliyuncs.com")}/api/v1/services/aigc/multimodal-generation/generation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      input: { messages: [{ role: "user", content: [{ text: request.prompt.slice(0, 2000) }, ...refs.map((ref) => ({ image: dataUri(ref) }))] }] },
      parameters: { size: sizes.tongyi[request.aspect], n: request.count, watermark: false, prompt_extend: true },
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!response.ok) throw new Error(await failText(response, "通义万相"));
  const result = await response.json() as { output?: { choices?: Array<{ message?: { content?: Array<{ type?: string; image?: string }> } }> }; code?: string; message?: string };
  const urls = (result.output?.choices || []).flatMap((choice) => choice.message?.content || []).filter((item) => item.image).map((item) => item.image!);
  if (!urls.length) throw new Error(`通义万相没有返回图片${result.message ? `：${result.message}` : ""}`);
  return { images: await Promise.all(urls.map(download)), model };
}

async function doubao(key: string, request: GenRequest): Promise<GenResult> {
  // 豆包一次请求出一张（不开组图），要几张就请求几次。
  const one = async () => {
    const response = await fetch(`${base("https://ark.cn-beijing.volces.com")}/api/v3/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        ...(request.refs.length ? { image: request.refs.slice(0, 10).map(dataUri) } : {}),
        size: sizes.doubao[request.aspect],
        sequential_image_generation: "disabled",
        response_format: "b64_json",
        watermark: false,
      }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!response.ok) throw new Error(await failText(response, "豆包"));
    const result = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> };
    const item = result.data?.[0];
    if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
    if (item?.url) return download(item.url);
    throw new Error("豆包没有返回图片");
  };
  return { images: await Promise.all(Array.from({ length: request.count }, one)), model: request.model };
}

async function openai(key: string, request: GenRequest): Promise<GenResult> {
  const url = base("https://api.openai.com");
  const size = sizes.openai[request.aspect];
  let response: Response;
  if (request.refs.length) {
    // 有参考图走 edits 接口，图片按文件上传。
    const form = new FormData();
    form.append("model", request.model);
    form.append("prompt", request.prompt);
    form.append("size", size);
    form.append("n", String(request.count));
    for (const ref of request.refs.slice(0, 10)) form.append("image[]", new Blob([new Uint8Array(ref.data)], { type: ref.mime }), ref.name);
    response = await fetch(`${url}/v1/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(240_000) });
  } else {
    response = await fetch(`${url}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: request.model, prompt: request.prompt, size, n: request.count }),
      signal: AbortSignal.timeout(240_000),
    });
  }
  if (!response.ok) throw new Error(await failText(response, "OpenAI"));
  const result = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> };
  const images: Array<Buffer | null> = await Promise.all((result.data || []).map((item) => (item.b64_json ? Buffer.from(item.b64_json, "base64") : item.url ? download(item.url) : null)));
  const ok = images.filter((item): item is Buffer => item !== null);
  if (!ok.length) throw new Error("OpenAI 没有返回图片");
  return { images: ok, model: request.model };
}

export async function generateImages(request: GenRequest): Promise<GenResult> {
  const provider = imageProviders[request.provider];
  const key = await getSecret(provider.secret);
  if (!key) throw new Error(`还没配置${provider.name}的 Key，到“设置 → 模型”里填上。`);
  if (request.provider === "tongyi") return tongyi(key, request);
  if (request.provider === "doubao") return doubao(key, request);
  return openai(key, request);
}

// 哪几家已经配好 Key，出稿页的模型下拉框据此禁用未配置的选项。
export async function imageReady(): Promise<Record<ImageProviderId, boolean>> {
  const status = await modelStatus();
  return { tongyi: status.qwen, doubao: status.doubao, openai: status.openai };
}
