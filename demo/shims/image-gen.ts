// 展示版不调用真实生图接口：在浏览器里画一张示例图，演示“生成 → 放进稿件”的流程。
import type { ImageProviderId } from "@/lib/types";

export type RefImage = { data: Uint8Array; mime: string; name: string };

const palettes = [["#2b1055", "#7597de", "#f9d976"], ["#0f2027", "#2c5364", "#f8b500"], ["#42275a", "#734b6d", "#ffd3a5"], ["#134e5e", "#71b280", "#fdfbfb"]];

async function sample(index: number, aspect: string, prompt: string) {
  const [w, h] = aspect.split(":").map(Number);
  const width = 720, height = Math.round((720 * h) / w);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const [a, b, c] = palettes[index % palettes.length];
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, a); gradient.addColorStop(0.65, b); gradient.addColorStop(1, c);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 5; i++) {
    const r = width * (0.12 + ((i * 37 + index * 13) % 30) / 100);
    const glow = ctx.createRadialGradient(width * ((i * 0.23 + index * 0.17) % 1), height * ((i * 0.31 + 0.2) % 1), 0, width * ((i * 0.23 + index * 0.17) % 1), height * ((i * 0.31 + 0.2) % 1), r);
    glow.addColorStop(0, c); glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "600 26px -apple-system, 'PingFang SC', sans-serif";
  ctx.fillText("展示版示例图", 32, height - 64);
  ctx.font = "16px -apple-system, 'PingFang SC', sans-serif";
  ctx.fillText(prompt.split("\n")[0].slice(0, 30), 32, height - 34);
  const blob: Blob = await new Promise((resolve) => canvas.toBlob((value) => resolve(value!), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function generateImages(request: { provider: ImageProviderId; model: string; prompt: string; aspect: string; count: number; refs: RefImage[] }) {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const images = await Promise.all(Array.from({ length: request.count }, (_, index) => sample(index, request.aspect, request.prompt)));
  return { images, model: `${request.model}（展示版模拟）` };
}

export async function imageReady(): Promise<Record<ImageProviderId, boolean>> {
  return { tongyi: true, doubao: true, openai: true };
}
