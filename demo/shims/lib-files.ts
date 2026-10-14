// 替换 src/lib/files.ts：文件不落盘，只生成页面内地址。
import { newId } from "@/lib/store";
import type { FileKind } from "@/lib/types";
import { registerUrl } from "./files";

export const imageExt = ["png", "jpg", "jpeg", "webp", "gif"];
export const fileExt = ["pdf", "psd", "ai", "eps", "svg", "sketch", "fig", "xd", "indd", "tif", "tiff", "zip", "rar", "7z", "mp4", "mov", "pptx", "key", "docx"];
export const mime: Record<string, string> = {};
export const storedName = /^(?:IMG|F)-[a-f0-9]+\.([a-z0-9]{1,6})$/;
const extOf = (name: string) => name.split(".").pop()!.toLowerCase();

export function kindOf(name: string): FileKind {
  return imageExt.includes(extOf(name)) ? "image" : "file";
}

export function fileError(file: unknown, imagesOnly = false) {
  if (!(file instanceof File) || !file.size) return imagesOnly ? "先选一张图片（PNG、JPG 或 WebP）。" : "先选择文件。";
  const ext = extOf(file.name);
  if (imagesOnly && !imageExt.includes(ext)) return "这里只能放图片（PNG、JPG、WebP）。";
  if (!imageExt.includes(ext) && !fileExt.includes(ext)) return `“${file.name}”的格式暂不支持。`;
  if (file.size > 20 * 1024 * 1024) return `展示版只接受 20MB 以内的文件。`;
  return "";
}

export async function saveFile(file: File) {
  const name = `${kindOf(file.name) === "image" ? "IMG" : "F"}-${newId("x").slice(2)}.${extOf(file.name)}`;
  registerUrl(name, URL.createObjectURL(file));
  return name;
}

export async function saveBuffer(data: Uint8Array, ext: string) {
  const name = `IMG-${newId("x").slice(2)}.${ext}`;
  registerUrl(name, URL.createObjectURL(new Blob([data as BlobPart], { type: "image/png" })));
  return name;
}
