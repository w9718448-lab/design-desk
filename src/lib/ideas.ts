import "server-only";

import crypto from "node:crypto";
import { aiJson } from "./ai";
import { newId } from "./store";
import type { Brief, MindNode, Rule } from "./types";

// 没有模型时使用的本地词库：按六个发散维度各准备一组常用的视觉关键词。
const lexicon: Record<string, string[]> = {
  情绪: ["温暖", "期待", "松弛", "热烈", "安静", "坚定", "好奇", "自由", "治愈", "力量感", "浪漫", "克制", "怀旧", "雀跃", "笃定", "辽阔"],
  符号与意象: ["光", "门", "路径", "种子", "星轨", "窗", "桥", "地平线", "纸飞机", "灯塔", "涟漪", "折纸", "钥匙", "气泡", "晨曦", "年轮"],
  色彩: ["晨光橙", "雾霾蓝", "奶油白", "墨黑", "薄荷绿", "电光紫", "珊瑚粉", "暖灰", "极光渐变", "金属银", "莫兰迪色", "高对比撞色", "单色系", "夜空蓝", "琥珀黄", "青瓷"],
  材质与质感: ["磨砂", "玻璃", "纸张纹理", "金属拉丝", "颗粒噪点", "液态", "丝绸", "布料褶皱", "黏土", "亚克力", "毛玻璃", "胶片颗粒", "烫金", "水彩晕染", "3D 软胶", "镜面"],
  场景: ["清晨街道", "城市天际线", "校园草坪", "办公桌", "窗边", "山顶", "海边", "夜晚灯火", "地铁车厢", "展会现场", "屋顶天台", "雨天", "森林小径", "星空营地", "咖啡馆", "书架前"],
  构图: ["中心对称", "大留白", "对角线", "框中框", "俯视", "单点极简", "满版", "分屏对比", "重复阵列", "引导线", "低角度仰视", "黄金分割", "局部特写", "前后景层叠", "环绕", "网格"],
};

export const dimensions = Object.keys(lexicon);

function pathOf(nodes: MindNode[], id: string) {
  const chain: MindNode[] = [];
  let node = nodes.find((item) => item.id === id);
  while (node) {
    chain.unshift(node);
    node = node.parentId ? nodes.find((item) => item.id === node!.parentId) : undefined;
  }
  return chain;
}

export function pickedPaths(nodes: MindNode[]) {
  return nodes.filter((node) => node.picked && node.parentId).map((node) => pathOf(nodes, node.id).slice(1).map((item) => item.label));
}

function briefSummary(brief: Brief) {
  const fields = Object.entries(brief.fields).filter(([, value]) => value.value).map(([key, value]) => `${key}: ${value.value}`);
  return [`需求名称：${brief.title}`, ...fields].join("\n");
}

function rootLabel(brief: Brief) {
  return brief.title.replace(/[，,。].*$/, "").slice(0, 12) || "需求";
}

type Seed = { nodes: MindNode[]; source: "ai" | "local" };

export async function seedMindmap(brief: Brief, rules: Rule[]): Promise<Seed> {
  const feel = rules.filter((rule) => rule.layer === "feel").map((rule) => rule.text).join("；");
  try {
    const result = await aiJson<{ root?: string; branches?: string[] }>(
      `你是品牌设计师的创意发散助手。根据需求生成一张脑图的起点。
- root：最能代表这个需求的核心关键词，2 到 8 个字。
- branches：6 个发散方向，每个 2 到 6 个字，彼此差异大，要能落到画面上（情绪、意象、色彩、材质、场景、构图等角度都可以），不要写空泛的词。
只输出 JSON：{"root":"","branches":["",""]}`,
      `${briefSummary(brief)}\n品牌想传达的感觉：${feel || "未填写"}`,
      600,
    );
    const branches = (result?.data.branches || []).map((label) => label.trim()).filter(Boolean).slice(0, 8);
    if (result && branches.length >= 3) {
      const root: MindNode = { id: newId("N"), parentId: null, label: (result.data.root || rootLabel(brief)).trim().slice(0, 12), picked: false, expanded: true };
      return { source: "ai", nodes: [root, ...branches.map((label) => ({ id: newId("N"), parentId: root.id, label, picked: false, expanded: false }))] };
    }
  } catch {
    // 模型失败时退回本地词库
  }
  const root: MindNode = { id: newId("N"), parentId: null, label: rootLabel(brief), picked: false, expanded: true };
  return { source: "local", nodes: [root, ...dimensions.map((label) => ({ id: newId("N"), parentId: root.id, label, picked: false, expanded: false }))] };
}

function localExpand(nodes: MindNode[], nodeId: string, count: number) {
  const chain = pathOf(nodes, nodeId);
  const dimension = chain[1]?.label;
  const pool = lexicon[dimension] || Object.values(lexicon).flat();
  const used = new Set(nodes.map((node) => node.label));
  const offset = crypto.createHash("md5").update(nodeId).digest()[0] % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.filter((label) => !used.has(label)).slice(0, count);
}

// 点一个圆圈：结合从中心到这里的路径、已经收藏的词，再长出一圈新关键词。
export async function expandMindNode(brief: Brief, nodes: MindNode[], nodeId: string) {
  const chain = pathOf(nodes, nodeId);
  if (!chain.length) return { labels: [] as string[], source: "local" as const };
  const existing = nodes.map((node) => node.label);
  const picked = nodes.filter((node) => node.picked).map((node) => node.label);
  try {
    const result = await aiJson<{ keywords?: string[] }>(
      `你是品牌设计师的创意发散助手。设计师在脑图上点了一个关键词，请沿着这条路径继续发散。
- 给 5 个新关键词，每个 2 到 8 个字。
- 要具体、能画出来（物件、光线、色彩、材质、动作、场景、构图手法），避免“创新”“高端”这类空词。
- 和路径保持联系，但彼此之间要拉开差距；不要和已有关键词重复。
只输出 JSON：{"keywords":["",""]}`,
      `${briefSummary(brief)}\n路径：${chain.map((node) => node.label).join(" → ")}\n已收藏：${picked.join("、") || "无"}\n已有关键词：${existing.join("、")}`,
      400,
    );
    const seen = new Set(existing);
    const labels = (result?.data.keywords || []).map((label) => label.trim().slice(0, 12)).filter((label) => label && !seen.has(label)).slice(0, 6);
    if (result && labels.length) return { labels, source: "ai" as const };
  } catch {
    // 模型失败时退回本地词库
  }
  return { labels: localExpand(nodes, nodeId, 5), source: "local" as const };
}
