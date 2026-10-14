import "server-only";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { briefFields, defaultFolders, defaultRoles, steps, type Brief, type FileKind, type Stage, type StepKey, type Store } from "./types";

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

// 品牌规则先留空框架：个人项目没有规范，等有了再按“感觉 / 原则 / 指引”三层填。
function emptyStore(): Store {
  return { version: 3, folders: defaultFolders.map((folder) => ({ ...folder })), briefs: [], rules: [], reviews: [], drafts: [], assets: [], roles: defaultRoles.map((role) => ({ ...role })) };
}

const fileKind = (name: string): FileKind => (/\.(png|jpe?g|webp|gif)$/i.test(name) ? "image" : "file");

// 旧版数据补齐新字段：v1 的评审稿件转成“出稿”里的版本；v2 的示例规则（没改过、没确认）清掉，资产放进文件夹。
function migrate(raw: Partial<Store> & { version?: number }): Store {
  const store = { ...emptyStore(), ...raw, version: 3 as const };
  store.briefs = (store.briefs || []).map((brief) => normalizeBrief(brief));
  if (!raw.drafts) {
    store.drafts = store.reviews.map((review) => ({
      id: newId("D"), briefId: review.briefId, version: review.version, image: review.image,
      imageName: review.imageName, kind: "image" as const, note: review.note, createdAt: review.createdAt,
    }));
    for (const review of store.reviews) review.draftId = store.drafts.find((draft) => draft.image === review.image)?.id;
  }
  store.drafts = store.drafts.map((draft) => ({ ...draft, kind: draft.kind || fileKind(draft.image) }));
  if (!raw.roles?.length) store.roles = defaultRoles.map((role) => ({ ...role }));
  if (!raw.folders?.length) store.folders = defaultFolders.map((folder) => ({ ...folder }));
  store.assets = (store.assets || []).map((asset) => ({ ...asset, kind: asset.kind || fileKind(asset.file), folderId: asset.folderId ?? "collected", origin: asset.origin || "collected" }));
  if ((raw.version || 1) < 3) store.rules = (store.rules || []).filter((rule) => !(rule.source === "preset" && !rule.confirmed));
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
    // 新加的需求项（项目背景、项目性质）在旧项目里补成“待确定”。
    fields: Object.fromEntries(briefFields.map((field) => [field.key, brief.fields?.[field.key] || { value: "", status: "ask" }])) as Brief["fields"],
    stepsDone: brief.stepsDone || stepsFromStage(brief.stage),
    mindmap: brief.mindmap || [],
    styleRefs: brief.styleRefs || [],
    refs: brief.refs || [],
    cardAssetIds: brief.cardAssetIds || [],
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
    if (raw.version !== 3) {
      // 升级前先另存一份旧数据，万一有问题可以找回。
      fs.copyFileSync(storeFile(), dataPath(`design-desk.v${raw.version || 1}.backup.json`));
      writeFileAtomic(store);
    }
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
