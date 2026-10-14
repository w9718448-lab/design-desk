import "server-only";

import fs from "node:fs";
import { dataPath, newId } from "./store";
import type { FileKind } from "./types";

// 图片可以预览、打标签、评审；其他设计文件（源文件、PDF 等）原样保存，可下载。
export const imageExt = ["png", "jpg", "jpeg", "webp", "gif"];
export const fileExt = ["pdf", "psd", "ai", "eps", "svg", "sketch", "fig", "xd", "indd", "tif", "tiff", "zip", "rar", "7z", "mp4", "mov", "pptx", "key", "docx"];

export const mime: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  pdf: "application/pdf", svg: "image/svg+xml", mp4: "video/mp4", mov: "video/quicktime",
};

export const storedName = /^(?:IMG|F)-[a-f0-9]+\.([a-z0-9]{1,6})$/;

const extOf = (name: string) => name.split(".").pop()!.toLowerCase();

export function kindOf(name: string): FileKind {
  return imageExt.includes(extOf(name)) ? "image" : "file";
}

export function fileError(file: unknown, imagesOnly = false) {
  if (!(file instanceof File) || !file.size) return imagesOnly ? "先选一张图片（PNG、JPG 或 WebP）。" : "先选择文件。";
  const ext = extOf(file.name);
  if (imagesOnly && !imageExt.includes(ext)) return "这里只能放图片（PNG、JPG、WebP）。";
  if (!imageExt.includes(ext) && !fileExt.includes(ext)) return `“${file.name}”的格式暂不支持。支持图片，以及 PDF、PSD、AI、SVG、Figma、Sketch、压缩包等设计文件。`;
  if (imageExt.includes(ext) && file.size > 20 * 1024 * 1024) return `“${file.name}”超过 20MB，请导出一张小一点的预览图。`;
  if (file.size > 200 * 1024 * 1024) return `“${file.name}”超过 200MB，太大了，建议压缩后再放。`;
  return "";
}

export async function saveFile(file: File, folder: "uploads" | "assets") {
  const ext = extOf(file.name);
  const name = `${kindOf(file.name) === "image" ? "IMG" : "F"}-${newId("x").slice(2)}.${ext}`;
  fs.mkdirSync(dataPath(folder), { recursive: true });
  fs.writeFileSync(dataPath(folder, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

// 生成的图片（没有原始文件名）直接按内容保存。
export async function saveBuffer(data: Buffer, ext: string, folder: "uploads" | "assets") {
  const name = `IMG-${newId("x").slice(2)}.${ext}`;
  fs.mkdirSync(dataPath(folder), { recursive: true });
  fs.writeFileSync(dataPath(folder, name), data);
  return name;
}

export function serveFile(folder: "uploads" | "assets", name: string, request: Request) {
  const match = name.match(storedName);
  if (!match) return new Response("Not found", { status: 404 });
  try {
    const body = fs.readFileSync(dataPath(folder, name));
    const download = new URL(request.url).searchParams.get("download");
    const headers: Record<string, string> = { "Content-Type": mime[match[1]] || "application/octet-stream", "Cache-Control": "private, max-age=31536000, immutable" };
    if (download !== null || !mime[match[1]]) headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(download || name)}`;
    return new Response(body, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
