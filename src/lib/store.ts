import "server-only";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { defaultRoles, steps, type Brief, type Rule, type Stage, type StepKey, type Store } from "./types";

export function dataDir() {
  return process.env.DESIGN_DESK_DATA_DIR || path.join(process.cwd(), "data");
}

export function dataPath(...segments: string[]) {
  return path.join(dataDir(), ...segments);
}

const storeFile = () => dataPath("design-desk.json");

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(5).toString("hex")}`;
}

export function now() {
  return new Date().toISOString();
}

// 预置规则都标为“待确认”：只是起点，需要按曦望的规范手册改写后再确认。
function presetRules(): Rule[] {
  const at = now();
  const rows: Array<[Rule["layer"], string]> = [
    ["feel", "科技感，但有温度（示例，按品牌手册改写）"],
    ["feel", "克制、干净，不堆砌元素（示例）"],
    ["principle", "Logo 只用官方文件，保留安全区，不变形、不改色"],
    ["principle", "只用品牌标准色，辅助色不超过两种"],
    ["principle", "字号层级不超过三级，主标题一眼可读"],
    ["guide", "标准色色值：待补充（主色、辅助色的 HEX / CMYK）"],
    ["guide", "品牌名写作“曦望Sunrise”，中英文之间不加空格"],
    ["guide", "AI 生成的图里不含文字、Logo 和二维码，这些由人在设计软件里排"],
    ["guide", "印刷物料四边留 3mm 出血，图片 300dpi，CMYK 色彩模式"],
  ];
  return rows.map(([layer, text]) => ({ id: newId("R"), layer, text, confirmed: false, source: "preset", createdAt: at }));
}

function emptyStore(): Store {
  return { version: 2, briefs: [], rules: presetRules(), reviews: [], drafts: [], assets: [], roles: defaultRoles.map((role) => ({ ...role })) };
}

// 旧版数据（只有需求卡和评审）补齐新字段；旧评审里的稿件转成“出稿”里的版本。
function migrate(raw: Partial<Store> & { version?: number }): Store {
  const store = { ...emptyStore(), ...raw, version: 2 as const };
  store.briefs = (store.briefs || []).map((brief) => normalizeBrief(brief));
  if (!raw.drafts) {
    store.drafts = store.reviews.map((review) => ({
      id: newId("D"), briefId: review.briefId, version: review.version, image: review.image,
      imageName: review.imageName, note: review.note, createdAt: review.createdAt,
    }));
    for (const review of store.reviews) review.draftId = store.drafts.find((draft) => draft.image === review.image)?.id;
  }
  if (!raw.roles?.length) store.roles = defaultRoles.map((role) => ({ ...role }));
  return store;
}

// 旧版只有手动阶段：升级时按原阶段把前面的步骤标成已完成，进度不丢。
function stepsFromStage(stage: string | undefined): Brief["stepsDone"] {
  const doneCount: Record<string, number> = { 需求: 0, 探索: 1, 精修: 3, 交付: 5, 完成: 6 };
  return Object.fromEntries(steps.slice(0, doneCount[stage || ""] ?? 0).map((step) => [step.key, true]));
}

export function normalizeBrief(brief: Partial<Brief> & Pick<Brief, "id">): Brief {
  return {
    title: "新需求", raw: "", stage: "需求", questions: "", source: "local", createdAt: now(), updatedAt: now(),
    ...brief,
    fields: brief.fields as Brief["fields"],
    stepsDone: brief.stepsDone || stepsFromStage(brief.stage),
    mindmap: brief.mindmap || [],
    styleRefs: brief.styleRefs || [],
    finalDraftId: brief.finalDraftId ?? null,
    deliveryChecks: brief.deliveryChecks || [],
    retro: brief.retro || "",
  };
}

export function currentStep(brief: Brief): StepKey {
  return steps.find((step) => !brief.stepsDone[step.key])?.key || "delivery";
}

// 看板阶段从步骤推导：做到哪一步，项目就在哪一列。
export function stageOf(brief: Brief): Stage {
  if (steps.every((step) => brief.stepsDone[step.key])) return "完成";
  const step = currentStep(brief);
  if (step === "brief") return "需求";
  if (step === "ideas" || step === "style") return "探索";
  if (step === "draft" || step === "review") return "精修";
  return "交付";
}

export function readStore(): Store {
  try {
    const raw = JSON.parse(fs.readFileSync(storeFile(), "utf8"));
    const store = migrate(raw);
    // 旧版数据迁移后立即写回，保证新生成的编号在后续请求里不变。
    if (raw.version !== 2) writeFileAtomic(store);
    return store;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const fresh = emptyStore();
    writeFileAtomic(fresh);
    return fresh;
  }
}

function writeFileAtomic(store: Store) {
  fs.mkdirSync(dataDir(), { recursive: true });
  const target = storeFile();
  if (fs.existsSync(target)) fs.copyFileSync(target, `${target}.bak`);
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, target);
}

// 同一进程内的写操作排队执行，避免两次提交互相覆盖。
let queue: Promise<unknown> = Promise.resolve();

export function updateStore<T>(mutate: (store: Store) => T): Promise<T> {
  const run = queue.then(() => {
    const store = readStore();
    const result = mutate(store);
    writeFileAtomic(store);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}
