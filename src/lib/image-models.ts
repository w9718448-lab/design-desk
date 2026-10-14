import type { ImageProviderId, ImageSettings } from "./types";

// 生图服务商。模型名是默认值，在设置里可以改成各家的新模型。
export const imageProviders: Record<ImageProviderId, { name: string; secret: "qwen" | "doubao" | "openai"; model: string; note: string; keyHint: string }> = {
  tongyi: { name: "通义万相", secret: "qwen", model: "wan2.6-t2i", note: "阿里云百炼，和千问共用一把 Key。带参考图时自动换成 wan2.6-image。", keyHint: "用千问的 Key" },
  doubao: { name: "豆包 Seedream", secret: "doubao", model: "doubao-seedream-4-0-250828", note: "火山方舟。模型名填方舟“模型广场”里的模型 ID。", keyHint: "火山方舟 API Key" },
  openai: { name: "GPT 生图", secret: "openai", model: "gpt-image-1", note: "OpenAI。需要海外账号和网络，国内可能连不上。", keyHint: "OpenAI API Key" },
};

export const imageProviderIds = Object.keys(imageProviders) as ImageProviderId[];

export const aspects = [
  { key: "1:1", label: "方图 1:1" },
  { key: "3:4", label: "竖版 3:4" },
  { key: "9:16", label: "竖版 9:16" },
  { key: "4:3", label: "横版 4:3" },
  { key: "16:9", label: "横版 16:9" },
] as const;

export type Aspect = (typeof aspects)[number]["key"];

export function imageSettingsOf(settings?: ImageSettings): ImageSettings {
  return { provider: settings?.provider && imageProviders[settings.provider] ? settings.provider : "tongyi", models: settings?.models || {} };
}

export function modelOf(settings: ImageSettings, id: ImageProviderId) {
  return settings.models[id]?.trim() || imageProviders[id].model;
}

// 从需求的“物料与尺寸”里猜默认画幅，猜不到用竖版 3:4。
export function guessAspect(deliverables: string): Aspect {
  const match = deliverables.match(/(\d{3,5})\s*[×xX*＊]\s*(\d{3,5})/);
  if (match) {
    const ratio = Number(match[1]) / Number(match[2]);
    const best = aspects.map((item) => { const [w, h] = item.key.split(":").map(Number); return { key: item.key, diff: Math.abs(Math.log(ratio / (w / h))) }; }).sort((a, b) => a.diff - b.diff)[0];
    return best.key;
  }
  if (/横版|banner|横幅|封面/i.test(deliverables)) return "16:9";
  if (/方图|头像|1:1/.test(deliverables)) return "1:1";
  return "3:4";
}
