import "server-only";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Rule, Store } from "./types";

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
  return { version: 1, briefs: [], rules: presetRules(), reviews: [] };
}

export function readStore(): Store {
  try {
    const parsed = JSON.parse(fs.readFileSync(storeFile(), "utf8")) as Store;
    return { ...emptyStore(), ...parsed };
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
