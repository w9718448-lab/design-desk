import { pickedPaths } from "./ideas";
import type { Brief, Store } from "./types";

// 把需求、创意组合和风格参考汇总成一段方向说明，可以直接贴给生图工具或发给同事。
export function directionText(brief: Brief, store: Store) {
  const f = brief.fields;
  const paths = pickedPaths(brief.mindmap);
  const refs = brief.styleRefs.map((ref) => {
    const asset = store.assets.find((item) => item.id === ref.assetId);
    return `- ${asset?.name || "参考图"}${ref.note ? `：${ref.note}` : ""}${ref.box ? "（只参考框选的局部）" : ""}`;
  });
  const feel = store.rules.filter((rule) => rule.layer === "feel").map((rule) => rule.text);
  const lines = [
    `【项目】${brief.title}`,
    f.goal.value && `【目标】${f.goal.value}`,
    f.audience.value && `【受众】${f.audience.value}`,
    f.deliverables.value && `【物料与尺寸】${f.deliverables.value}`,
    f.tone.value && `【调性】${f.tone.value}`,
    feel.length ? `【品牌感觉】${feel.join("；")}` : "",
    paths.length ? `【创意方向】\n${paths.map((path) => `- ${path.join(" → ")}`).join("\n")}` : "",
    refs.length ? `【风格参考】\n${refs.join("\n")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function promptText(brief: Brief, store: Store) {
  const leaves = pickedPaths(brief.mindmap).map((path) => path[path.length - 1]);
  const style = brief.styleRefs.map((ref) => {
    const asset = store.assets.find((item) => item.id === ref.assetId);
    // 检索关键词是内部用的，不写进提示词；没写备注就提醒自己把参考图一起发给生图工具。
    return ref.note || (asset ? `参考图“${asset.name}”的风格` : "");
  }).filter(Boolean);
  const size = brief.fields.deliverables.value;
  return [
    leaves.length ? `画面关键词：${leaves.join("、")}` : `主题：${brief.title}`,
    style.length ? `风格：${style.join("；")}` : "",
    size ? `画幅：${size}` : "",
    "画面中不要出现任何文字、数字、Logo 和二维码，主体留出排版标题的空间。",
  ].filter(Boolean).join("\n");
}
