import "server-only";

import { aiJson } from "./ai";
import { briefFields, type BriefField, type BriefFieldKey } from "./types";

type Extracted = { title: string; fields: Record<BriefFieldKey, BriefField>; questions: string; source: "ai" | "local" };

function emptyFields() {
  return Object.fromEntries(briefFields.map((field) => [field.key, { value: "", status: "ask" }])) as Record<BriefFieldKey, BriefField>;
}

function collect(text: string, pattern: RegExp) {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[0].trim()))];
}

const materialWords = "海报|长图|KV|主视觉|易拉宝|展架|X展架|背景板|桁架|门型展架|手提袋|包装|礼盒|贴纸|徽章|胸牌|工牌|邀请函|名片|折页|画册|手册|PPT|banner|Banner|头图|封面|大屏|电梯|地贴|T恤|帆布袋";

// 没有配置模型时的本地规则：只抽取原文里明确出现的信息，抽不到的一律标“待问”，绝不猜。
export function extractLocally(raw: string): Extracted {
  const text = raw.replace(/\r/g, "");
  const fields = emptyFields();
  const set = (key: BriefFieldKey, values: string[]) => {
    if (values.length) fields[key] = { value: values.join("；"), status: "inferred" };
  };

  const sizes = collect(text, /\d+(?:\.\d+)?\s*[x×X*]\s*\d+(?:\.\d+)?\s*(?:mm|cm|m|px|毫米|厘米|米)?|\bA[0-6]\b|\d+\s*[:：]\s*\d+(?=\s*(?:比例|竖|横|$))/g);
  const materials = collect(text, new RegExp(materialWords, "g"));
  set("deliverables", [...materials, ...sizes]);
  set("quantity", collect(text, /(?:\d+|[一二两三四五六七八九十]+)\s*(?:张|份|款|套|版|种|组|个尺寸)/g));
  set("deadline", collect(text, /\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?|\d{1,2}月\d{1,2}[日号]?(?:前|之前)?|\d{1,2}[/.]\d{1,2}(?=\s*(?:前|之前|交|出|定稿|上线))|(?:今天|明天|后天|本周|下周|这周)[一二三四五六日天]?(?:前|之前)?|周[一二三四五六日天](?:前|之前)?/g));
  set("delivery", collect(text, /印刷|打印|线上|发布|公众号|朋友圈|小红书|官网|大屏|PDF|PNG|JPG|源文件|AI文件|PSD|Figma|印厂/g));
  set("audience", collect(text, /候选人|应届生|校招生|实习生|求职者|客户|合作伙伴|嘉宾|观众|员工|同事|新员工|用户|投资人|学生|供应商/g));
  set("production", collect(text, /预算[^，。；\n]*|烫金|UV|击凸|压纹|覆膜|专色|铜版纸|特种纸|牛皮纸|亚克力|PVC|KT板/g));
  set("tone", collect(text, /[^，。；\n]*(?:风格|调性|感觉|氛围|参考)[^，。；\n]*/g));
  set("copy", collect(text, /[^，。；\n]*(?:文案|标题|slogan|Slogan)[^，。；\n]*/g));

  const firstLine = text.split(/\n|。|，|,/).map((line) => line.trim()).find(Boolean) || "新需求";
  if (/(?:为了|目的|目标|用于|希望)/.test(text)) {
    const goal = text.match(/(?:为了|目的是|目标是|用于|希望)[^，。；\n]*/);
    if (goal) fields.goal = { value: goal[0], status: "inferred" };
  }
  const title = firstLine.slice(0, 18) || "新需求";
  return { title, fields, questions: draftQuestions(fields), source: "local" };
}

export function draftQuestions(fields: Record<BriefFieldKey, BriefField>) {
  const ask: Record<BriefFieldKey, string> = {
    goal: "这次主要想达成什么效果？比如告知活动、吸引报名，还是做品牌形象？",
    audience: "主要给谁看？",
    deliverables: "需要做哪些物料？每个的尺寸或比例是多少？",
    quantity: "一共需要几张或几款？要不要延展其他尺寸？",
    deadline: "初稿和定稿分别需要在什么时候给到？",
    delivery: "最后是印刷还是线上发布？需要交什么格式的文件？",
    copy: "文案由谁提供？主标题和必须出现的信息（时间、地点、二维码等）有哪些？",
    tone: "有没有想要的感觉或参考图？有没有明确不想要的样子？",
    production: "如果要印刷，材质、工艺和预算大概是怎样的？",
    approver: "最后由谁确认定稿？",
  };
  const missing = briefFields.filter((field) => fields[field.key].status === "ask");
  if (!missing.length) return "";
  return ["你好，开工前想确认几个点：", ...missing.map((field, index) => `${index + 1}. ${ask[field.key]}`), "麻烦有空时回复一下，谢谢！"].join("\n");
}

const system = `你是品牌设计师的需求助理。把一段零散的需求整理成需求卡。
规则：
- 只写原文里明确出现或能直接推出的信息；原文没有的字段 value 留空、status 写 "ask"，绝不编造数量、尺寸、日期、预算。
- 原文明确写出的 status 写 "confirmed"；需要推断的写 "inferred"。
- 不要写任何人名、手机号、邮箱；approver 只写角色（如“市场负责人”）。
- questions：针对 status 为 ask 的字段，写一段可以直接发给需求方的追问，口吻礼貌简洁，按编号列出。
- title：12 个字以内的需求名称。
只输出 JSON：{"title":"","fields":{"goal":{"value":"","status":""},...},"questions":""}
字段 key：${briefFields.map((field) => `${field.key}(${field.label})`).join("、")}`;

export async function extractBrief(raw: string): Promise<Extracted> {
  try {
    const result = await aiJson<{ title?: string; fields?: Partial<Record<BriefFieldKey, Partial<BriefField>>>; questions?: string }>(system, raw);
    if (!result) return extractLocally(raw);
    const fields = emptyFields();
    for (const field of briefFields) {
      const item = result.data.fields?.[field.key];
      const value = (item?.value || "").trim();
      const status = item?.status === "confirmed" || item?.status === "inferred" ? item.status : "ask";
      fields[field.key] = value ? { value, status: status === "ask" ? "inferred" : status } : { value: "", status: "ask" };
    }
    return { title: (result.data.title || "").slice(0, 24) || extractLocally(raw).title, fields, questions: result.data.questions?.trim() || draftQuestions(fields), source: "ai" };
  } catch {
    return extractLocally(raw);
  }
}
