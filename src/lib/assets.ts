import "server-only";

import fs from "node:fs";
import { aiJson, aiVisionJson } from "./ai";
import { dataPath } from "./store";
import type { Asset } from "./types";

export function imageDataUrl(folder: "uploads" | "assets", file: string) {
  const extension = file.split(".").pop()?.toLowerCase();
  const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${fs.readFileSync(dataPath(folder, file)).toString("base64")}`;
}

// 上传资产时让千问视觉模型给图片打风格标签；没配置时返回 null，由你手动填。
export async function tagAsset(file: string) {
  try {
    const result = await aiVisionJson<{ tags?: string[] }>(
      `你是品牌设计师的资产整理助手。看这张图，给出 6 到 10 个中文风格标签，用于以后按创意关键词检索。
标签覆盖：整体风格、主色调、光感、构图、材质质感、情绪、主要意象。每个标签 2 到 6 个字，不要写图里的文字内容。
只输出 JSON：{"tags":["",""]}`,
      "给这张图打风格标签。",
      imageDataUrl("assets", file),
      400,
    );
    const tags = (result?.data.tags || []).map((tag) => tag.trim()).filter(Boolean).slice(0, 12);
    return result && tags.length ? tags : null;
  } catch {
    return null;
  }
}

export type Match = { asset: Asset; score: number; reason: string };

function overlap(keywords: string[], tags: string[]) {
  const hits: string[] = [];
  for (const keyword of keywords) {
    for (const tag of tags) {
      if (tag.includes(keyword) || keyword.includes(tag) || [...keyword].filter((char) => tag.includes(char)).length >= 2) {
        hits.push(tag);
      }
    }
  }
  return [...new Set(hits)];
}

// 按创意组合给资产库排序：先用模型理解“意思接近”，没有模型就按标签字面重合。
export async function matchAssets(keywords: string[], assets: Asset[]): Promise<{ matches: Match[]; source: "ai" | "local" }> {
  const local = assets
    .map((asset) => {
      const hits = overlap(keywords, [...asset.tags, asset.name, asset.note].filter(Boolean));
      return { asset, score: hits.length, reason: hits.length ? `标签相近：${hits.slice(0, 4).join("、")}` : "" };
    })
    .sort((a, b) => b.score - a.score);
  if (!keywords.length || !assets.length) return { matches: local, source: "local" };
  try {
    const result = await aiJson<{ ranking?: Array<{ id?: string; score?: number; reason?: string }> }>(
      `你是品牌设计师的风格匹配助手。根据设计师选定的创意关键词，从资产库里挑出风格最合适的图。
- 对每张图给 0 到 10 分，并用一句话说明匹配在哪里（具体到色彩、光感、构图或材质）。
- 0 到 3 分的图 reason 写空字符串。
只输出 JSON：{"ranking":[{"id":"","score":0,"reason":""}]}`,
      `创意关键词：${keywords.join("、")}\n\n资产库：\n${assets.map((asset) => `- id=${asset.id}｜${asset.name}｜标签：${asset.tags.join("、") || "无"}｜备注：${asset.note || "无"}`).join("\n")}`,
      1500,
    );
    if (result?.data.ranking?.length) {
      const byId = new Map(result.data.ranking.map((item) => [item.id, item]));
      const matches = assets
        .map((asset) => {
          const item = byId.get(asset.id);
          return { asset, score: Math.max(0, Math.min(10, Number(item?.score) || 0)), reason: (item?.reason || "").trim() };
        })
        .sort((a, b) => b.score - a.score);
      return { matches, source: "ai" };
    }
  } catch {
    // 模型失败时退回本地匹配
  }
  return { matches: local, source: "local" };
}
