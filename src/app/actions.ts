"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractBrief, draftQuestions } from "@/lib/brief";
import { aiReview, localChecks } from "@/lib/review";
import { expandMindNode, pickedPaths, seedMindmap } from "@/lib/ideas";
import { matchAssets, tagAsset } from "@/lib/assets";
import { dataPath, newId, normalizeBrief, now, readStore, stageOf, updateStore } from "@/lib/store";
import { removeSecret, saveSecret, type ProviderId } from "@/lib/ai";
import { briefFields, defaultRoles, ruleLayers, steps, type Box, type Brief, type BriefFieldKey, type FieldStatus, type MindNode, type Review, type RuleLayer, type StepKey, type Store } from "@/lib/types";

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();

// 侧栏的步骤状态也要跟着刷新，所以统一刷新整个布局。
function refresh() {
  revalidatePath("/", "layout");
}

function touch(brief: Brief) {
  brief.stage = stageOf(brief);
  brief.updatedAt = now();
}

function findBrief(store: Store, id: string) {
  return store.briefs.find((item) => item.id === id);
}

const allowedImage = /\.(png|jpe?g|webp)$/i;

async function saveImage(file: File, folder: "uploads" | "assets") {
  const extension = file.name.split(".").pop()!.toLowerCase();
  const name = `IMG-${newId("x").slice(2)}.${extension}`;
  fs.mkdirSync(dataPath(folder), { recursive: true });
  fs.writeFileSync(dataPath(folder, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

function imageError(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size) return "先选一张图片（PNG、JPG 或 WebP）。";
  if (!allowedImage.test(file.name)) return "只支持 PNG、JPG、WebP。PDF、AI、PSD 文件请先导出成图片。";
  if (file.size > 10 * 1024 * 1024) return "图片超过 10MB，请导出一张小一点的预览图（长边 2000 像素左右即可）。";
  return "";
}

/* ---------- 需求 ---------- */

export async function createBrief(form: FormData) {
  const raw = text(form, "raw");
  if (!raw) return;
  const extracted = await extractBrief(raw);
  const id = newId("B");
  await updateStore((store) => {
    store.briefs.unshift(normalizeBrief({ id, raw, stage: "需求", createdAt: now(), updatedAt: now(), ...extracted }));
  });
  refresh();
  redirect(`/briefs/${id}/brief`);
}

export async function saveBriefCard(form: FormData) {
  const id = text(form, "id");
  await updateStore((store) => {
    const brief = findBrief(store, id);
    if (!brief) return;
    brief.title = text(form, "title") || brief.title;
    for (const field of briefFields) {
      const value = text(form, `field-${field.key}`);
      const status = text(form, `status-${field.key}`) as FieldStatus;
      brief.fields[field.key as BriefFieldKey] = { value, status: value ? (status === "ask" ? "confirmed" : status) : "ask" };
    }
    brief.questions = draftQuestions(brief.fields);
    touch(brief);
  });
  refresh();
}

export async function deleteBrief(form: FormData) {
  const id = text(form, "id");
  await updateStore((store) => {
    for (const draft of store.drafts.filter((item) => item.briefId === id)) fs.rmSync(dataPath("uploads", draft.image), { force: true });
    store.drafts = store.drafts.filter((item) => item.briefId !== id);
    store.reviews = store.reviews.filter((review) => review.briefId !== id);
    store.briefs = store.briefs.filter((brief) => brief.id !== id);
  });
  refresh();
  redirect("/");
}

/* ---------- 步骤 ---------- */

export async function completeStep(form: FormData) {
  const id = text(form, "id");
  const step = text(form, "step") as StepKey;
  const index = steps.findIndex((item) => item.key === step);
  if (index < 0) return;
  await updateStore((store) => {
    const brief = findBrief(store, id);
    if (!brief) return;
    brief.stepsDone[step] = true;
    touch(brief);
  });
  refresh();
  const next = steps[index + 1];
  redirect(next ? `/briefs/${id}/${next.key}` : `/briefs/${id}/${step}`);
}

export async function reopenStep(form: FormData) {
  const id = text(form, "id");
  const step = text(form, "step") as StepKey;
  await updateStore((store) => {
    const brief = findBrief(store, id);
    if (!brief) return;
    brief.stepsDone[step] = false;
    touch(brief);
  });
  refresh();
}

/* ---------- 创意发散 ---------- */

export type MindResult = { nodes: MindNode[]; source?: "ai" | "local"; error?: string };

export async function seedIdeas(briefId: string): Promise<MindResult> {
  const store = readStore();
  const brief = findBrief(store, briefId);
  if (!brief) return { nodes: [], error: "找不到这个项目。" };
  const seed = await seedMindmap(brief, store.rules);
  await updateStore((current) => {
    const target = findBrief(current, briefId);
    if (!target) return;
    target.mindmap = seed.nodes;
    target.mindmapSource = seed.source;
    touch(target);
  });
  refresh();
  return { nodes: seed.nodes, source: seed.source };
}

export async function expandIdea(briefId: string, nodeId: string): Promise<MindResult> {
  const brief = findBrief(readStore(), briefId);
  if (!brief) return { nodes: [], error: "找不到这个项目。" };
  const { labels, source } = await expandMindNode(brief, brief.mindmap, nodeId);
  const nodes = await updateStore((store) => {
    const target = findBrief(store, briefId);
    if (!target) return [];
    const node = target.mindmap.find((item) => item.id === nodeId);
    if (node) node.expanded = true;
    target.mindmap.push(...labels.map((label) => ({ id: newId("N"), parentId: nodeId, label, picked: false, expanded: false })));
    touch(target);
    return target.mindmap;
  });
  refresh();
  return { nodes, source, error: labels.length ? undefined : "这一支暂时想不出新词了，换一个圆圈试试，或者自己加一个。" };
}

export async function editIdea(briefId: string, nodeId: string, intent: "pick" | "remove" | "add", label = ""): Promise<MindResult> {
  const nodes = await updateStore((store) => {
    const target = findBrief(store, briefId);
    if (!target) return [];
    const node = target.mindmap.find((item) => item.id === nodeId);
    if (!node) return target.mindmap;
    if (intent === "pick" && node.parentId) node.picked = !node.picked;
    if (intent === "add" && label.trim()) target.mindmap.push({ id: newId("N"), parentId: nodeId, label: label.trim().slice(0, 12), picked: true, expanded: false });
    if (intent === "remove" && node.parentId) {
      const removed = new Set([node.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const item of target.mindmap) if (item.parentId && removed.has(item.parentId) && !removed.has(item.id)) { removed.add(item.id); grew = true; }
      }
      target.mindmap = target.mindmap.filter((item) => !removed.has(item.id));
    }
    touch(target);
    return target.mindmap;
  });
  refresh();
  return { nodes };
}

/* ---------- 视觉风格 ---------- */

export async function runStyleMatch(form: FormData) {
  const id = text(form, "id");
  const store = readStore();
  const brief = findBrief(store, id);
  if (!brief) return;
  const keywords = [...new Set(pickedPaths(brief.mindmap).flat())];
  // 需求卡里写的调性也参与匹配，例如“希望感、星空”。
  const tone = brief.fields.tone.value.split(/[，,、；;。\s]+/).map((word) => word.replace(/^(想要|有|要|的|一种)+|(的感觉|感觉|的|感)+$/g, "")).filter((word) => word.length >= 2);
  const { matches, source } = await matchAssets([...new Set([...keywords, ...tone])], store.assets);
  await updateStore((current) => {
    const target = findBrief(current, id);
    if (!target) return;
    target.styleMatch = { signature: keywords.join("|"), source, items: matches.map((match) => ({ assetId: match.asset.id, score: match.score, reason: match.reason })) };
    touch(target);
  });
  refresh();
}

export async function toggleStyleRef(form: FormData) {
  const id = text(form, "id");
  const assetId = text(form, "assetId");
  await updateStore((store) => {
    const brief = findBrief(store, id);
    if (!brief) return;
    const exists = brief.styleRefs.some((ref) => ref.assetId === assetId);
    brief.styleRefs = exists ? brief.styleRefs.filter((ref) => ref.assetId !== assetId) : [...brief.styleRefs, { assetId, note: "", box: null }];
    touch(brief);
  });
  refresh();
}

export async function saveStyleRef(briefId: string, assetId: string, note: string, box: Box | null) {
  await updateStore((store) => {
    const brief = findBrief(store, briefId);
    const ref = brief?.styleRefs.find((item) => item.assetId === assetId);
    if (!brief || !ref) return;
    ref.note = note.trim().slice(0, 200);
    ref.box = box && box.w > 0.01 && box.h > 0.01 ? box : null;
    touch(brief);
  });
  refresh();
}

/* ---------- 资产库 ---------- */

export type UploadState = { error?: string; message?: string };

export async function uploadAssets(_: UploadState, form: FormData): Promise<UploadState> {
  const files = form.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return { error: "先选择图片，可以一次选多张。" };
  const bad = files.map((file) => imageError(file)).find(Boolean);
  if (bad) return { error: bad };
  let tagged = 0;
  for (const file of files) {
    const name = await saveImage(file, "assets");
    const tags = await tagAsset(name);
    if (tags) tagged += 1;
    await updateStore((store) => {
      store.assets.unshift({ id: newId("A"), file: name, name: file.name.replace(/\.[^.]+$/, ""), tags: tags || [], note: "", tagSource: tags ? "ai" : "manual", createdAt: now() });
    });
  }
  refresh();
  return { message: tagged ? `已上传 ${files.length} 张，${tagged} 张已自动打好风格标签。` : `已上传 ${files.length} 张。还没配置千问，请给每张图手动写几个风格标签，匹配时会用到。` };
}

export async function updateAsset(form: FormData) {
  const id = text(form, "id");
  const intent = text(form, "intent");
  await updateStore((store) => {
    const asset = store.assets.find((item) => item.id === id);
    if (!asset) return;
    if (intent === "delete") {
      fs.rmSync(dataPath("assets", asset.file), { force: true });
      store.assets = store.assets.filter((item) => item.id !== id);
      for (const brief of store.briefs) brief.styleRefs = brief.styleRefs.filter((ref) => ref.assetId !== id);
      return;
    }
    asset.name = text(form, "name") || asset.name;
    asset.tags = text(form, "tags").split(/[、，,\s]+/).map((tag) => tag.trim()).filter(Boolean).slice(0, 16);
    asset.note = text(form, "note");
    asset.tagSource = "manual";
  });
  refresh();
}

export async function retagAsset(form: FormData) {
  const id = text(form, "id");
  const asset = readStore().assets.find((item) => item.id === id);
  if (!asset) return;
  const tags = await tagAsset(asset.file);
  if (!tags) return;
  await updateStore((store) => {
    const target = store.assets.find((item) => item.id === id);
    if (target) { target.tags = tags; target.tagSource = "ai"; }
  });
  refresh();
}

/* ---------- 出稿 ---------- */

export async function uploadDraft(_: UploadState, form: FormData): Promise<UploadState> {
  const briefId = text(form, "briefId");
  const file = form.get("image");
  const error = imageError(file);
  if (error) return { error };
  const image = await saveImage(file as File, "uploads");
  await updateStore((store) => {
    const brief = findBrief(store, briefId);
    if (!brief) return;
    const count = store.drafts.filter((item) => item.briefId === briefId).length;
    store.drafts.unshift({ id: newId("D"), briefId, version: text(form, "version") || `第 ${count + 1} 版`, image, imageName: (file as File).name, note: text(form, "note"), createdAt: now() });
    touch(brief);
  });
  refresh();
  return { message: "已放进稿件版本。" };
}

export async function deleteDraft(form: FormData) {
  const id = text(form, "id");
  await updateStore((store) => {
    const draft = store.drafts.find((item) => item.id === id);
    if (!draft) return;
    fs.rmSync(dataPath("uploads", draft.image), { force: true });
    store.drafts = store.drafts.filter((item) => item.id !== id);
    store.reviews = store.reviews.filter((review) => review.draftId !== id);
    for (const brief of store.briefs) if (brief.finalDraftId === id) brief.finalDraftId = null;
  });
  refresh();
}

/* ---------- 评审 ---------- */

export type ReviewState = { error?: string };

export async function runReview(_: ReviewState, form: FormData): Promise<ReviewState> {
  const briefId = text(form, "briefId");
  const draftId = text(form, "draftId");
  const store = readStore();
  const brief = findBrief(store, briefId);
  const draft = store.drafts.find((item) => item.id === draftId && item.briefId === briefId);
  if (!brief) return { error: "找不到这个项目。" };
  if (!draft) return { error: "先选一版稿件。还没有稿件的话，到“出稿”这一步上传。" };
  const roles = store.roles.filter((role) => role.enabled && form.get(`role-${role.key}`) === "on");
  if (!roles.length) return { error: "至少选一个评审角色。" };

  const note = text(form, "note");
  let review: Review = {
    id: newId("V"), briefId, draftId, version: draft.version, image: draft.image, imageName: draft.imageName, note,
    mode: "local", roles: roles.map((role) => role.key), roleLabels: Object.fromEntries(roles.map((role) => [role.key, role.label])),
    findings: [], conflicts: [], createdAt: now(),
  };
  let error: string | undefined;
  try {
    const result = await aiReview(brief, store.rules, roles, draft.image, note, store.assets);
    if (result) review = { ...review, mode: "ai", model: result.model, findings: result.findings, conflicts: result.conflicts };
  } catch (cause) {
    error = `模型评审失败（${cause instanceof Error ? cause.message : "未知原因"}），已改用本地检查清单。`;
  }
  if (review.mode === "local") review.findings = localChecks(brief, store.rules, roles);

  await updateStore((current) => {
    current.reviews.unshift(review);
    const target = findBrief(current, briefId);
    if (target) touch(target);
  });
  refresh();
  return error ? { error } : {};
}

export async function decideFinding(form: FormData) {
  const reviewId = text(form, "reviewId");
  const findingId = text(form, "findingId");
  const decision = text(form, "decision");
  await updateStore((store) => {
    const finding = store.reviews.find((item) => item.id === reviewId)?.findings.find((item) => item.id === findingId);
    if (!finding) return;
    finding.decision = decision === "fix" || decision === "keep" ? decision : null;
    finding.reason = text(form, "reason");
  });
  refresh();
}

// 评审里“不改”的理由回流成一条待确认的指引，下次评审就会用上。
export async function findingToRule(form: FormData) {
  const reviewId = text(form, "reviewId");
  const findingId = text(form, "findingId");
  await updateStore((store) => {
    const finding = store.reviews.find((item) => item.id === reviewId)?.findings.find((item) => item.id === findingId);
    if (!finding?.reason || finding.ruleAdded) return;
    store.rules.push({ id: newId("R"), layer: "guide", text: finding.reason, confirmed: false, source: "review", createdAt: now() });
    finding.ruleAdded = true;
  });
  refresh();
}

export async function deleteReview(form: FormData) {
  const id = text(form, "id");
  await updateStore((store) => {
    store.reviews = store.reviews.filter((item) => item.id !== id);
  });
  refresh();
}

/* ---------- 评审角色 ---------- */

export async function saveRole(form: FormData) {
  const key = text(form, "key");
  const intent = text(form, "intent");
  await updateStore((store) => {
    if (intent === "reset") { store.roles = defaultRoles.map((role) => ({ ...role })); return; }
    if (intent === "add") {
      const label = text(form, "label");
      if (!label) return;
      store.roles.push({ key: newId("role"), label, persona: text(form, "persona"), focus: text(form, "focus"), basis: text(form, "basis"), enabled: true });
      return;
    }
    const role = store.roles.find((item) => item.key === key);
    if (!role) return;
    if (intent === "delete") { store.roles = store.roles.filter((item) => item.key !== key); return; }
    if (intent === "toggle") { role.enabled = !role.enabled; return; }
    role.label = text(form, "label") || role.label;
    role.persona = text(form, "persona");
    role.focus = text(form, "focus");
    role.basis = text(form, "basis");
  });
  refresh();
}

/* ---------- 交付 ---------- */

export async function saveDelivery(form: FormData) {
  const id = text(form, "id");
  const finish = text(form, "intent") === "finish";
  await updateStore((store) => {
    const brief = findBrief(store, id);
    if (!brief) return;
    brief.finalDraftId = text(form, "finalDraftId") || null;
    brief.deliveryChecks = form.getAll("checks").map(String);
    brief.retro = text(form, "retro");
    if (finish) brief.stepsDone.delivery = true;
    touch(brief);
  });
  refresh();
}

/* ---------- 品牌规则 ---------- */

export async function addRule(form: FormData) {
  const layer = text(form, "layer") as RuleLayer;
  const value = text(form, "text");
  if (!value || !ruleLayers.some((item) => item.key === layer)) return;
  await updateStore((store) => {
    store.rules.push({ id: newId("R"), layer, text: value, confirmed: form.get("confirmed") === "on", source: "manual", createdAt: now() });
  });
  refresh();
}

export async function updateRule(form: FormData) {
  const id = text(form, "id");
  const intent = text(form, "intent");
  await updateStore((store) => {
    const rule = store.rules.find((item) => item.id === id);
    if (!rule) return;
    if (intent === "delete") store.rules = store.rules.filter((item) => item.id !== id);
    else if (intent === "toggle") rule.confirmed = !rule.confirmed;
    else if (intent === "save") rule.text = text(form, "text") || rule.text;
  });
  refresh();
}

/* ---------- 设置 ---------- */

export async function saveKey(form: FormData) {
  const provider = text(form, "provider") as ProviderId;
  const key = text(form, "key");
  if (!["qwen", "deepseek"].includes(provider)) return;
  if (form.get("intent") === "remove") await removeSecret(provider);
  else if (key) await saveSecret(provider, key);
  refresh();
}
