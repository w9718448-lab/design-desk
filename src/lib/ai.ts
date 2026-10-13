import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import { dataPath } from "./store";

const execFileAsync = promisify(execFile);
// 与上等马共用同一个钥匙串条目：在上等马里配过的千问 / DeepSeek 密钥，这里直接可用。
const keychainService = "com.shangdengma.workbench.ai";

export const providers = {
  qwen: { name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", text: "qwen-plus", vision: "qwen-vl-max", env: "DASHSCOPE_API_KEY" },
  deepseek: { name: "DeepSeek", baseUrl: "https://api.deepseek.com", text: "deepseek-chat", vision: "", env: "DEEPSEEK_API_KEY" },
} as const;

export type ProviderId = keyof typeof providers;

// Windows 等非 Mac 电脑没有钥匙串：密钥存在本机数据文件夹里的 模型密钥.json，只在这台电脑上。
const secretFile = () => dataPath("模型密钥.json");

function readSecretFile(): Partial<Record<ProviderId, string>> {
  try {
    return JSON.parse(fs.readFileSync(secretFile(), "utf8"));
  } catch {
    return {};
  }
}

function writeSecretFile(secrets: Partial<Record<ProviderId, string>>) {
  fs.mkdirSync(dataPath(), { recursive: true });
  fs.writeFileSync(secretFile(), JSON.stringify(secrets, null, 2), { mode: 0o600 });
}

async function keychainSecret(id: ProviderId) {
  if (process.platform !== "darwin") return readSecretFile()[id]?.trim() || "";
  try {
    const { stdout } = await execFileAsync("/usr/bin/security", ["find-generic-password", "-a", id, "-s", keychainService, "-w"], { timeout: 3000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function getSecret(id: ProviderId) {
  return process.env[providers[id].env]?.trim() || keychainSecret(id);
}

export async function saveSecret(id: ProviderId, secret: string) {
  if (process.platform !== "darwin") {
    writeSecretFile({ ...readSecretFile(), [id]: secret.trim() });
    return;
  }
  await execFileAsync("/usr/bin/security", ["add-generic-password", "-U", "-a", id, "-s", keychainService, "-w", secret.trim()], { timeout: 5000 });
}

export async function removeSecret(id: ProviderId) {
  if (process.platform !== "darwin") {
    const secrets = readSecretFile();
    delete secrets[id];
    writeSecretFile(secrets);
    return;
  }
  await execFileAsync("/usr/bin/security", ["delete-generic-password", "-a", id, "-s", keychainService], { timeout: 5000 }).catch(() => undefined);
}

export async function modelStatus() {
  const [qwen, deepseek] = await Promise.all([getSecret("qwen"), getSecret("deepseek")]);
  return { qwen: Boolean(qwen), deepseek: Boolean(deepseek) };
}

type Content = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

async function chat(id: ProviderId, model: string, system: string, user: Content, maxTokens: number, json = true) {
  const key = await getSecret(id);
  const provider = providers[id];
  const baseUrl = (id === "qwen" && process.env.DESIGN_DESK_QWEN_BASE_URL) || provider.baseUrl;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`${provider.name} 返回 ${response.status}`);
  const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return { content: result.choices?.[0]?.message?.content?.trim() || "", model };
}

function parseJson<T>(content: string): T {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  return JSON.parse(content.slice(start, end + 1)) as T;
}

// 文字任务：优先千问，没有再用 DeepSeek。都没配置时返回 null，由调用方走本地规则。
export async function aiJson<T>(system: string, user: string, maxTokens = 1500) {
  const status = await modelStatus();
  const id: ProviderId | null = status.qwen ? "qwen" : status.deepseek ? "deepseek" : null;
  if (!id) return null;
  const result = await chat(id, providers[id].text, system, user, maxTokens);
  return { data: parseJson<T>(result.content), model: result.model };
}

// 看图任务只有千问视觉模型能做。
export async function aiVisionJson<T>(system: string, text: string, imageDataUrl: string, maxTokens = 2500) {
  const status = await modelStatus();
  if (!status.qwen) return null;
  const result = await chat("qwen", providers.qwen.vision, system, [
    { type: "image_url", image_url: { url: imageDataUrl } },
    { type: "text", text },
  ], maxTokens, false);
  return { data: parseJson<T>(result.content), model: result.model };
}
