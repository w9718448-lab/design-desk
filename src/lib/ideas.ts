import "server-only";

import crypto from "node:crypto";
import { aiJson } from "./ai";
import { newId } from "./store";
import type { Brief, MindNode, Rule } from "./types";

// 没有模型时使用的本地词库（只是兜底：真正贴合需求的发散要靠模型）：按六个发散维度各准备一组常用的视觉关键词。
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
  return brief.title.replace(/[，,。].*$/, "").split(/\s+/)[0].slice(0, 12) || "需求";
}

const stopwords = new Set("设计语言 识别体系 视觉系统 设计系统 消费预期 品牌观察 品牌 因此 一个 正在 变化 转向 诉求 基本 致力于 自然 每日 坚持 不必要 构成 适应 需求 展示 目的 每一次 原本 那些 更清晰 一代 日常中 开袋 瞬间 做一个 设计 项目 宣传 需要 想要 我们 可以 进行 通过 已经 就是 采用 一种 这个 体系 系统 标准 方面 相关 以及".split(" "));

// 没有模型时，从需求卡里拆出有画面感的短语，作为脑图的分支和联想素材。
export function briefKeywords(brief: Brief) {
  const sources: Array<[string, number]> = [
    [brief.fields.tone.value, 3], [brief.fields.goal.value, 2.5], [brief.fields.background.value, 2], [brief.fields.audience.value, 1.5], [brief.raw, 1],
  ];
  const score = new Map<string, number>();
  for (const [text, weight] of sources) {
    // 先把“饱和”“中心”这类含连接字的词保护起来，再按标点和虚词切开。
    const guarded = text.replace(/饱和|和谐|温和|中心|中国|对比|对称|为主|是否/g, (word) => `〔${word}〕`);
    for (const piece of guarded.split(/[，,。；;：:、\s的与和及把将从对在为是以并让使中于被向等或也而且其这那些了着过更]+(?![^〔]*〕)/)) {
      const word = piece.replace(/[〔〕]/g, "").replace(/^(?:很|最|非常|一种|所有|原本|承载)/, "").trim();
      if (word.length < 2 || word.length > 5 || stopwords.has(word) || /[0-9a-zA-Z]/.test(word) || /[正着地得]$/.test(word)) continue;
      score.set(word, (score.get(word) || 0) + weight + (word.length === 4 ? 0.5 : 0));
    }
  }
  const title = rootLabel(brief);
  return [...score.entries()].filter(([word]) => !title.includes(word)).sort((a, b) => b[1] - a[1]).map(([word]) => word);
}

type Seed = { nodes: MindNode[]; source: "ai" | "local" };

export async function seedMindmap(brief: Brief, rules: Rule[]): Promise<Seed> {
  const feel = rules.filter((rule) => rule.layer === "feel").map((rule) => rule.text).join("；");
  try {
    const result = await aiJson<{ root?: string; branches?: string[] }>(
      `你是一位资深品牌创意总监，正在带设计师做头脑风暴。根据需求卡，生成一张创意脑图的起点。
- root：这次创意的核心概念，2 到 8 个字，要从需求里提炼，不要直接用项目名。
- branches：6 个发散方向。必须紧扣这个需求的品牌、产品和受众，每个方向切入点不同，例如：核心情绪、关键场景、品牌符号或隐喻、产品本身的感官特征、受众的生活细节、一个跨界的意外联想。
- 每个 2 到 8 个字，具体、有画面，不要写“情绪”“色彩”“构图”这类分类名，也不要写“创新”“高端”这类空词。
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
    // 模型失败时退回本地规则
  }
  const root: MindNode = { id: newId("N"), parentId: null, label: rootLabel(brief), picked: false, expanded: true };
  const words = briefKeywords(brief).slice(0, 6);
  // 需求里的词不够时，用通用的发散维度补齐。
  const branches = [...words, ...dimensions.filter((dimension) => !words.includes(dimension))].slice(0, 6);
  return { source: "local", nodes: [root, ...branches.map((label) => ({ id: newId("N"), parentId: root.id, label, picked: false, expanded: false }))] };
}

function localExpand(brief: Brief, nodes: MindNode[], nodeId: string, count: number) {
  const chain = pathOf(nodes, nodeId);
  const used = new Set(nodes.map((node) => node.label));
  const seed = crypto.createHash("md5").update(nodeId).digest();
  const dimension = chain.map((node) => node.label).find((label) => lexicon[label]);
  if (dimension) {
    const pool = lexicon[dimension];
    const offset = seed[0] % pool.length;
    return [...pool.slice(offset), ...pool.slice(0, offset)].filter((label) => !used.has(label)).slice(0, count);
  }
  // 需求里的词：先接两个需求里还没用过的词，再从不同维度各借一个画面词，拉开联想。
  const fromBrief = briefKeywords(brief).filter((word) => !used.has(word)).slice(seed[1] % 3, (seed[1] % 3) + 2);
  const fromLexicon = dimensions.map((name, index) => {
    const pool = lexicon[name].filter((label) => !used.has(label));
    return pool[(seed[index + 2] || 0) % Math.max(1, pool.length)];
  }).filter(Boolean);
  return [...fromBrief, ...fromLexicon].filter((label, index, list) => list.indexOf(label) === index).slice(0, count);
}

// 点一个圆圈：结合从中心到这里的路径、已经收藏的词，再长出一圈新关键词。
export async function expandMindNode(brief: Brief, nodes: MindNode[], nodeId: string) {
  const chain = pathOf(nodes, nodeId);
  if (!chain.length) return { labels: [] as string[], source: "local" as const };
  const existing = nodes.map((node) => node.label);
  const picked = nodes.filter((node) => node.picked).map((node) => node.label);
  try {
    const result = await aiJson<{ keywords?: string[] }>(
      `你是一位资深品牌创意总监，正在带设计师做头脑风暴。设计师在脑图上点了一个关键词，请沿着这条路径继续联想。
- 给 5 个新关键词，每个 2 到 8 个字。
- 联想要跳跃：可以是具体物件、动作瞬间、光线色彩、材质质感、场景细节、比喻或跨界意象，至少有 1 个让人意外但说得通的。
- 必须同时扣住这条路径和需求卡里的品牌、产品与受众；不要写分类名和“创新”“高端”这类空词；不要和已有关键词重复。
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
  return { labels: localExpand(brief, nodes, nodeId, 5), source: "local" as const };
}
