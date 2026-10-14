// 展示版不接模型：全部走本地规则，不会把任何内容发到外部。
export const providers = {
  qwen: { name: "通义千问", baseUrl: "", text: "qwen-plus", vision: "qwen-vl-max" },
  deepseek: { name: "DeepSeek", baseUrl: "", text: "deepseek-chat", vision: "" },
} as const;
export type ProviderId = keyof typeof providers;
export async function getSecret() { return null; }
export async function saveSecret() { window.alert("这是展示版，不保存密钥。下载设计台装到自己电脑上后，就能配置千问。"); }
export async function removeSecret() { return; }
export async function modelStatus() { return { qwen: false, deepseek: false }; }
export async function aiJson() { return null; }
export async function aiVisionJson() { return null; }
