import "server-only";

import fs from "node:fs";
import { aiVisionJson } from "./ai";
import { dataPath, newId } from "./store";
import { reviewRoles, type Brief, type Finding, type ReviewRole, type Rule, type Severity } from "./types";

const productionPattern = /出血|dpi|DPI|印刷|工艺|分辨率|材质/;
const copyPattern = /文案|写作|写法|标点|空格|错别字|品牌名|中英文/;

export function ruleRole(rule: Rule): ReviewRole {
  if (rule.layer === "feel") return "brand";
  if (productionPattern.test(rule.text)) return "production";
  if (copyPattern.test(rule.text)) return "copy";
  return "brand";
}

function ruleBasis(rule: Rule) {
  return `品牌规则${rule.confirmed ? "" : "（待确认）"}：${rule.text}`;
}

function field(brief: Brief, key: keyof Brief["fields"]) {
  return brief.fields[key]?.value || "";
}

// 没有模型时，按规则和需求卡生成逐条检查项，由你自己对照稿子判断。
export function localChecks(brief: Brief, rules: Rule[], roles: ReviewRole[]): Finding[] {
  const items: Array<{ role: ReviewRole; text: string; basis: string }> = [];
  for (const rule of rules) {
    const role = ruleRole(rule);
    const text = rule.layer === "feel" ? `整体感觉是否做到“${rule.text}”？` : `是否符合：${rule.text}`;
    items.push({ role, text, basis: ruleBasis(rule) });
  }
  const audience = field(brief, "audience");
  items.push({ role: "audience", text: audience ? `把自己当成“${audience}”，3 秒内能看懂主信息吗？` : "需求卡还没写受众：先补上，否则无法判断稿子是否对路。", basis: "需求卡：受众" });
  items.push({ role: "audience", text: "第一眼先看到的是不是最重要的信息？", basis: "需求卡：受众" });
  const tone = field(brief, "tone");
  if (tone) items.push({ role: "audience", text: `情绪是否接近“${tone}”？`, basis: "需求卡：调性与参考" });
  const goal = field(brief, "goal");
  items.push({ role: "approver", text: goal ? `稿子是否直接回应了目标“${goal}”？` : "需求卡还没写目标：汇报时会被问“这张图要达成什么”。", basis: "需求卡：目标" });
  items.push({ role: "approver", text: "准备好一句话说明“为什么选这个方向”了吗？", basis: "汇报准备" });
  const deliverables = field(brief, "deliverables");
  items.push({ role: "production", text: deliverables ? `画板尺寸和物料是否与“${deliverables}”一致？` : "需求卡还没写尺寸：开稿前先确认。", basis: "需求卡：物料与尺寸" });
  const delivery = field(brief, "delivery");
  if (delivery) items.push({ role: "production", text: `导出格式是否满足“${delivery}”？`, basis: "需求卡：交付方式" });
  const copy = field(brief, "copy");
  items.push({ role: "copy", text: copy ? `逐字核对文案：${copy}` : "文案来源还没确认：定稿前要拿到对方确认过的文字。", basis: "需求卡：文案" });
  items.push({ role: "copy", text: "时间、地点、报名方式等必要信息是否齐全、没有错？", basis: "通用检查" });
  items.push({ role: "copy", text: "中英文、数字混排的空格和标点是否统一？", basis: "通用检查" });

  return items
    .filter((item) => roles.includes(item.role))
    .map((item) => ({ id: newId("F"), role: item.role, severity: "check", text: item.text, basis: item.basis, decision: null, reason: "" }));
}

function imageDataUrl(file: string) {
  const extension = file.split(".").pop()?.toLowerCase();
  const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${fs.readFileSync(dataPath("uploads", file)).toString("base64")}`;
}

type AiFinding = { role?: string; severity?: string; text?: string; basis?: string };

export async function aiReview(brief: Brief, rules: Rule[], roles: ReviewRole[], image: string, note: string) {
  const roleText = reviewRoles.filter((role) => roles.includes(role.key)).map((role) => `- ${role.key}（${role.label}）：依据 ${role.basis}；关注 ${role.focus}`).join("\n");
  const ruleText = rules.map((rule) => `- [${rule.layer === "feel" ? "感觉" : rule.layer === "principle" ? "原则" : "指引"}${rule.confirmed ? "" : "·待确认"}] ${rule.text}`).join("\n");
  const briefText = Object.entries(brief.fields).map(([key, value]) => `${key}: ${value.value || "（待问）"}`).join("\n");
  const system = `你是一个品牌设计评审小组，按指定角色分别评审一张设计稿。
要求：
- 每个角色给 2 到 4 条意见，必须具体到画面里的位置或元素，并写明依据（引用某条品牌规则或需求卡字段）。
- severity 只能是 must（违反已确认规则或会导致无法交付）、should（明显影响效果）、minor（个人偏好、可忽略）。依据是“待确认”规则的意见最多给 should。
- 看不出来的东西（印刷出血、分辨率、色值是否精确）不要下结论，写成“请核对……”，severity 用 should。
- 不要替设计师改稿，也不要输出改好的文案全文。
- conflicts：列出角色之间相互矛盾的意见（例如受众要更醒目、品牌要克制），每条一句话，没有就给空数组。
只输出 JSON：{"findings":[{"role":"brand","severity":"must","text":"","basis":""}],"conflicts":[]}`;
  const text = `参与角色：\n${roleText}\n\n品牌规则：\n${ruleText || "（还没有规则）"}\n\n需求卡：\n${briefText}\n\n设计师补充说明：${note || "无"}`;
  const result = await aiVisionJson<{ findings?: AiFinding[]; conflicts?: string[] }>(system, text, imageDataUrl(image));
  if (!result) return null;
  const allowed = new Set<string>(roles);
  const findings: Finding[] = (result.data.findings || [])
    .filter((item) => item.text && item.role && allowed.has(item.role))
    .map((item) => ({
      id: newId("F"),
      role: item.role as ReviewRole,
      severity: (["must", "should", "minor"].includes(item.severity || "") ? item.severity : "should") as Severity,
      text: item.text!.trim(),
      basis: (item.basis || "").trim(),
      decision: null,
      reason: "",
    }));
  return { findings, conflicts: (result.data.conflicts || []).filter(Boolean).slice(0, 6), model: result.model };
}
