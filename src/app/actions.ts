"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractBrief, mergeFields } from "@/lib/brief";
import { fileError, kindOf, saveFile } from "@/lib/files";
import { aiReview, localChecks } from "@/lib/review";
import { expandMindNode, pickedPaths, seedMindmap } from "@/lib/ideas";
import { localTags, matchAssets, searchAssets, tagAsset } from "@/lib/assets";
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

// 随时补一段背景：AI（或本地规则）识别后补进需求卡，已确定的内容不会被覆盖。
export async function addBackground(form: FormData) {
  const id = text(form, "id");
  const extra = text(form, "background");
  if (!extra) return;
  const extracted = await extractBrief(extra);
  await updateStore((store) => {
    const brief = findBrief(store, id);
    if (!brief) return;
    brief.raw = brief.raw ? `${brief.raw}\n\n【补充】${extra}` : extra;
    brief.fields = mergeFields(brief.fields, extracted.fields);
    touch(brief);
  });
  refresh();
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
      brief.fields[field.key as BriefFieldKey] = { value, status: value ? (status === "ask" ? "inferred" : status) : "ask" };
    }
    touch(brief);
  });
  refresh();
}

export async function deleteBrief(form: FormData) {
  const id = text(form, "id");
  await updateStore((store) => {
    // 已经存进资产库的终稿保留在资产库里。
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
  const query = text(form, "query");
  const store = readStore();
  const brief = findBrief(store, id);
  if (!brief) return;
  const keywords = [...new Set(pickedPaths(brief.mindmap).flat())];
  // 自己输入了词就按输入的找；否则按创意组合，加上需求卡里写的调性。
  const tone = brief.fields.tone.value.split(/[，,、；;。\s]+/).map((word) => word.replace(/^(想要|有|要|的|一种)+|(的感觉|感觉|的|感)+$/g, "")).filter((word) => word.length >= 2);
  const { matches, source } = query
    ? await searchAssets(query, store.assets)
    : await matchAssets([...new Set([...keywords, ...tone])], store.assets);
  await updateStore((current) => {
    const target = findBrief(current, id);
    if (!target) return;
    target.styleMatch = { signature: query ? `q:${query}` : keywords.join("|"), query, source, items: matches.map((match) => ({ assetId: match.asset.id, score: match.score, reason: match.reason })) };
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
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return { error: "先选择文件，可以一次放多个。" };
  const bad = files.map((file) => fileError(file)).find(Boolean);
  if (bad) return { error: bad };
  const folderId = text(form, "folderId");
  for (const file of files) {
    const name = await saveFile(file, "assets");
    const tags = (await tagAsset(name, file.name)) || localTags(file.name);
    await updateStore((store) => {
      const folder = store.folders.some((item) => item.id === folderId) ? folderId : "collected";
      store.assets.unshift({ id: newId("A"), file: name, name: file.name.replace(/\.[^.]+$/, ""), kind: kindOf(file.name), folderId: folder, origin: folder === "own" ? "own" : "collected", tags, note: "", tagSource: "ai", createdAt: now() });
    });
  }
  refresh();
  return { message: `已放进 ${files.length} 个。` };
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
    asset.note = text(form, "note");
    const folderId = text(form, "folderId");
    if (folderId === "" || store.folders.some((item) => item.id === folderId)) asset.folderId = folderId;
    asset.origin = asset.folderId === "own" ? "own" : asset.origin;
  });
  refresh();
}

export async function saveFolder(form: FormData) {
  const id = text(form, "id");
  const intent = text(form, "intent");
  const name = text(form, "name").slice(0, 30);
  await updateStore((store) => {
    if (intent === "add" && name) store.folders.push({ id: newId("FD"), name });
    const folder = store.folders.find((item) => item.id === id);
    if (!folder) return;
    if (intent === "rename" && name) folder.name = name;
    // 删文件夹不删里面的东西，移到“未分类”。
    if (intent === "delete" && !["own", "collected"].includes(id)) {
      store.folders = store.folders.filter((item) => item.id !== id);
      for (const asset of store.assets) if (asset.folderId === id) asset.folderId = "";
    }
  });
  refresh();
}

/* ---------- 出稿 ---------- */

export async function uploadDraft(_: UploadState, form: FormData): Promise<UploadState> {
  const briefId = text(form, "briefId");
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return { error: "先选择文件。" };
  const bad = files.map((file) => fileError(file)).find(Boolean);
  if (bad) return { error: bad };
  const typed = text(form, "version");
  for (const [index, file] of files.entries()) {
    const image = await saveFile(file, "uploads");
    await updateStore((store) => {
      const brief = findBrief(store, briefId);
      if (!brief) return;
      const count = store.drafts.filter((item) => item.briefId === briefId).length;
      const version = typed ? (files.length > 1 ? `${typed}-${index + 1}` : typed) : `第 ${count + 1} 版`;
      store.drafts.unshift({ id: newId("D"), briefId, version, image, imageName: file.name, kind: kindOf(file.name), note: text(form, "note"), createdAt: now() });
      touch(brief);
    });
  }
  refresh();
  return { message: files.length > 1 ? `已放进 ${files.length} 个文件。` : "已放进稿件。" };
}

// 评审不一定全员满意：你可以直接把某一版定为终稿，跳到交付。
export async function chooseFinal(form: FormData) {
  const id = text(form, "id");
  const draftId = text(form, "draftId");
  await updateStore((store) => {
    const brief = findBrief(store, id);
    if (!brief || !store.drafts.some((draft) => draft.id === draftId)) return;
    brief.finalDraftId = draftId;
    brief.stepsDone.draft = true;
    brief.stepsDone.review = true;
    touch(brief);
  });
  refresh();
  redirect(`/briefs/${id}/delivery`);
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
    // 非图片稿件（PDF、源文件）模型看不了，直接生成检查清单。
    const result = draft.kind === "image" ? await aiReview(brief, store.rules, roles, draft.image, note, store.assets) : null;
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
  const store = readStore();
  const brief = findBrief(store, id);
  if (!brief) return;
  const finalDraftId = text(form, "finalDraftId") || null;
  const draft = store.drafts.find((item) => item.id === finalDraftId);
  // 交付完成时，终稿复制一份进资产库“我的作品”，以后的项目可以检索到它。
  let archived: { file: string; tags: string[] } | null = null;
  const existing = store.assets.find((asset) => asset.id === brief.finalAssetId);
  if (finish && draft && existing?.sourceBriefId !== `${id}:${draft.id}`) {
    const ext = draft.image.split(".").pop();
    const file = `${draft.kind === "image" ? "IMG" : "F"}-${newId("x").slice(2)}.${ext}`;
    fs.mkdirSync(dataPath("assets"), { recursive: true });
    fs.copyFileSync(dataPath("uploads", draft.image), dataPath("assets", file));
    const picks = [...new Set(pickedPaths(brief.mindmap).flat())];
    const tags = [...new Set([...picks, ...((await tagAsset(file, draft.imageName)) || []), brief.title])].slice(0, 16);
    archived = { file, tags };
  }
  await updateStore((current) => {
    const target = findBrief(current, id);
    if (!target) return;
    target.finalDraftId = finalDraftId;
    target.deliveryChecks = form.getAll("checks").map(String);
    target.retro = text(form, "retro");
    if (finish) target.stepsDone.delivery = true;
    if (archived && draft) {
      const assetId = newId("A");
      current.assets.unshift({ id: assetId, file: archived.file, name: `${target.title}_${draft.version}`, kind: draft.kind, folderId: "own", origin: "own", tags: archived.tags, note: target.retro, tagSource: "ai", sourceBriefId: `${id}:${draft.id}`, createdAt: now() });
      target.finalAssetId = assetId;
    }
    touch(target);
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
