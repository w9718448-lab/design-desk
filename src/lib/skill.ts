import { ruleLayers, type Rule } from "./types";

// 按通用的 Agent Skills 格式导出：一个 SKILL.md 文件，千问、万有无界、Claude Code 等支持 Skill 的工具都能读。
export function rulesToSkill(rules: Rule[]) {
  const date = new Date().toISOString().slice(0, 10);
  const sections = ruleLayers.map((layer) => {
    const items = rules.filter((rule) => rule.layer === layer.key);
    const lines = items.length ? items.map((rule) => `- ${rule.text}${rule.confirmed ? "" : "（待确认）"}`) : ["- （暂无）"];
    return `## ${layer.label}：${layer.hint}\n\n${lines.join("\n")}`;
  });
  return `---
name: sunrise-brand-rules
description: 曦望Sunrise 品牌设计规则（感觉、原则、指引三层）。做品牌物料、评审设计稿或检查交付文件时使用。
---

# 曦望Sunrise 品牌设计规则

由设计台导出，${date}。标“待确认”的条目还没经过品牌负责人确认，只能作为建议，不能作为“必须改”的依据。

${sections.join("\n\n")}

## 怎么使用

1. 发散方向时，先对齐“感觉”，方向卡不能违背“原则”。
2. 评审设计稿时，逐条对照“指引”，意见要写明依据的是哪一条。
3. 不要生成带 Logo、文字或二维码的终稿；这些由设计师在设计软件中排版。
4. 不要替设计师做最终决定，也不要代发任何对外消息。
`;
}
