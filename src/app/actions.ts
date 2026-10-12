"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractBrief, draftQuestions } from "@/lib/brief";
import { aiReview, localChecks } from "@/lib/review";
import { dataPath, newId, now, readStore, updateStore } from "@/lib/store";
import { removeSecret, saveSecret, type ProviderId } from "@/lib/ai";
import { briefFields, ruleLayers, reviewRoles, stages, type BriefFieldKey, type FieldStatus, type Review, type ReviewRole, type RuleLayer, type Stage } from "@/lib/types";

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();

export async function createBrief(form: FormData) {
  const raw = text(form, "raw");
  if (!raw) return;
  const extracted = await extractBrief(raw);
  const id = newId("B");
  await updateStore((store) => {
    store.briefs.unshift({ id, raw, stage: "需求", createdAt: now(), updatedAt: now(), ...extracted });
  });
  redirect(`/briefs/${id}`);
}

export async function saveBriefCard(form: FormData) {
  const id = text(form, "id");
  await updateStore((store) => {
    const brief = store.briefs.find((item) => item.id === id);
    if (!brief) return;
    brief.title = text(form, "title") || brief.title;
    for (const field of briefFields) {
      const value = text(form, `field-${field.key}`);
      const status = text(form, `status-${field.key}`) as FieldStatus;
      brief.fields[field.key as BriefFieldKey] = { value, status: value ? (status === "ask" ? "confirmed" : status) : "ask" };
    }
    brief.questions = draftQuestions(brief.fields);
    brief.updatedAt = now();
  });
  revalidatePath(`/briefs/${id}`);
  revalidatePath("/");
}

export async function confirmField(form: FormData) {
  const id = text(form, "id");
  const key = text(form, "key") as BriefFieldKey;
  await updateStore((store) => {
    const brief = store.briefs.find((item) => item.id === id);
    if (!brief?.fields[key]?.value) return;
    brief.fields[key].status = "confirmed";
    brief.updatedAt = now();
  });
  revalidatePath(`/briefs/${id}`);
}

export async function setStage(form: FormData) {
  const id = text(form, "id");
  const stage = text(form, "stage") as Stage;
  if (!stages.includes(stage)) return;
  await updateStore((store) => {
    const brief = store.briefs.find((item) => item.id === id);
    if (brief) { brief.stage = stage; brief.updatedAt = now(); }
  });
  revalidatePath(`/briefs/${id}`);
  revalidatePath("/");
}

export async function deleteBrief(form: FormData) {
  const id = text(form, "id");
  await updateStore((store) => {
    const reviews = store.reviews.filter((review) => review.briefId === id);
    for (const review of reviews) fs.rmSync(dataPath("uploads", review.image), { force: true });
    store.reviews = store.reviews.filter((review) => review.briefId !== id);
    store.briefs = store.briefs.filter((brief) => brief.id !== id);
  });
  redirect("/");
}

export async function addRule(form: FormData) {
  const layer = text(form, "layer") as RuleLayer;
  const value = text(form, "text");
  if (!value || !ruleLayers.some((item) => item.key === layer)) return;
  await updateStore((store) => {
    store.rules.push({ id: newId("R"), layer, text: value, confirmed: form.get("confirmed") === "on", source: "manual", createdAt: now() });
  });
  revalidatePath("/rules");
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
  revalidatePath("/rules");
}

const allowedImage = /\.(png|jpe?g|webp)$/i;

export type ReviewState = { error?: string };

export async function runReview(_: ReviewState, form: FormData): Promise<ReviewState> {
  const briefId = text(form, "briefId");
  const file = form.get("image");
  const roles = reviewRoles.map((role) => role.key).filter((key) => form.get(`role-${key}`) === "on") as ReviewRole[];
  if (!(file instanceof File) || !file.size) return { error: "先选一张稿件图片（PNG、JPG 或 WebP）。" };
  if (!allowedImage.test(file.name)) return { error: "只支持 PNG、JPG、WebP。PDF 或 AI 文件请先导出成图片。" };
  if (file.size > 10 * 1024 * 1024) return { error: "图片超过 10MB，请导出一张小一点的预览图（长边 2000 像素左右即可）。" };
  if (!roles.length) return { error: "至少选一个评审角色。" };

  const store = readStore();
  const brief = store.briefs.find((item) => item.id === briefId);
  if (!brief) return { error: "找不到这个需求。" };
  const extension = file.name.split(".").pop()!.toLowerCase();
  const image = `${newId("IMG")}.${extension}`;
  fs.mkdirSync(dataPath("uploads"), { recursive: true });
  fs.writeFileSync(dataPath("uploads", image), Buffer.from(await file.arrayBuffer()));

  const note = text(form, "note");
  let review: Review = {
    id: newId("V"), briefId, version: text(form, "version") || `第 ${store.reviews.filter((item) => item.briefId === briefId).length + 1} 版`,
    image, imageName: file.name, note, mode: "local", roles, findings: [], conflicts: [], createdAt: now(),
  };
  let error: string | undefined;
  try {
    const result = await aiReview(brief, store.rules, roles, image, note);
    if (result) review = { ...review, mode: "ai", model: result.model, findings: result.findings, conflicts: result.conflicts };
  } catch (cause) {
    error = `模型评审失败（${cause instanceof Error ? cause.message : "未知原因"}），已改用本地检查清单。`;
  }
  if (review.mode === "local") review.findings = localChecks(brief, store.rules, roles);

  await updateStore((current) => {
    current.reviews.unshift(review);
    const target = current.briefs.find((item) => item.id === briefId);
    // 进度从产物推导：第一次放进稿件，需求就进入“精修”。
    if (target && (target.stage === "需求" || target.stage === "探索")) target.stage = "精修";
    if (target) target.updatedAt = now();
  });
  revalidatePath(`/briefs/${briefId}`);
  revalidatePath("/");
  return error ? { error } : {};
}

export async function decideFinding(form: FormData) {
  const reviewId = text(form, "reviewId");
  const findingId = text(form, "findingId");
  const decision = text(form, "decision");
  let briefId = "";
  await updateStore((store) => {
    const review = store.reviews.find((item) => item.id === reviewId);
    const finding = review?.findings.find((item) => item.id === findingId);
    if (!review || !finding) return;
    briefId = review.briefId;
    finding.decision = decision === "fix" || decision === "keep" ? decision : null;
    finding.reason = text(form, "reason");
  });
  if (briefId) revalidatePath(`/briefs/${briefId}`);
}

// 评审里“不改”的理由回流成一条待确认的指引，下次评审就会用上。
export async function findingToRule(form: FormData) {
  const reviewId = text(form, "reviewId");
  const findingId = text(form, "findingId");
  let briefId = "";
  await updateStore((store) => {
    const review = store.reviews.find((item) => item.id === reviewId);
    const finding = review?.findings.find((item) => item.id === findingId);
    if (!review || !finding?.reason || finding.ruleAdded) return;
    briefId = review.briefId;
    store.rules.push({ id: newId("R"), layer: "guide", text: finding.reason, confirmed: false, source: "review", createdAt: now() });
    finding.ruleAdded = true;
  });
  revalidatePath("/rules");
  if (briefId) revalidatePath(`/briefs/${briefId}`);
}

export async function deleteReview(form: FormData) {
  const id = text(form, "id");
  let briefId = "";
  await updateStore((store) => {
    const review = store.reviews.find((item) => item.id === id);
    if (!review) return;
    briefId = review.briefId;
    fs.rmSync(dataPath("uploads", review.image), { force: true });
    store.reviews = store.reviews.filter((item) => item.id !== id);
  });
  if (briefId) revalidatePath(`/briefs/${briefId}`);
}

export async function saveKey(form: FormData) {
  const provider = text(form, "provider") as ProviderId;
  const key = text(form, "key");
  if (!["qwen", "deepseek"].includes(provider)) return;
  if (form.get("intent") === "remove") await removeSecret(provider);
  else if (key) await saveSecret(provider, key);
  revalidatePath("/settings");
}
