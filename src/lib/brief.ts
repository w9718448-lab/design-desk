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

const materialWords = /海报|长图|kv|主视觉|易拉宝|展架|背景板|桁架|手提袋|包装|礼盒|贴纸|徽章|胸牌|工牌|邀请函|名片|折页|画册|手册|ppt|banner|头图|封面|大屏|电梯广告|地贴|t恤|帆布袋|logo|标志|vi|周边|插画|详情页|主图|视频封面/gi;
const ratio = /(?<![\d:：])(?:16|9|4|3|1|2|21)\s*[:：比]\s*(?:9|16|3|4|1|2)(?![\d:：])/g;

const sentencesOf = (text: string) => text.split(/[。！？!?\n；;]+/).map((line) => line.replace(/^【补充】/, "").trim()).filter(Boolean);
const clausesOf = (text: string) => text.split(/[，,。！？!?\n；;]+/).map((line) => line.trim()).filter(Boolean);
const join = (values: string[], limit = 400) => {
  const text = [...new Set(values)].join("；");
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
};

// 没有配置模型时的本地规则：按句子和关键词归类，抽到的标“大致”，抽不到的标“待确定”，绝不编造。
export function extractLocally(raw: string): Extracted {
  const text = raw.replace(/\r/g, "");
  const fields = emptyFields();
  const set = (key: BriefFieldKey, values: string[], limit?: number) => {
    const clean = values.map((value) => value.trim()).filter(Boolean);
    if (clean.length) fields[key] = { value: join(clean, limit), status: "inferred" };
  };
  const sentences = sentencesOf(text);
  const clauses = clausesOf(text);
  const pick = (pattern: RegExp, from = sentences) => from.filter((line) => pattern.test(line));

  // 品牌理念、背景这类长段落：整句保留，去掉“品牌理念：”这样的标签。
  set("background", pick(/品牌|理念|致力|着眼|观察到|定位|使命|愿景|原料|标准|主张|故事|背景/).map((line) => line.replace(/^.*?(?:品牌理念|品牌介绍|项目背景|背景)[:：]\s*/, "")).filter((line) => !/^(?:做|出|设计)一?[个张套份]/.test(line)), 600);
  set("nature", collect(text, /个人作品集|作品集|虚拟项目|比稿|商业项目|练习|概念设计|毕业设计|竞赛/g));
  set("goal", pick(/目的|目标|为了|旨在|用于|希望(?!感)/).map((line) => line.replace(/^.*?(?:目的|目标)[，,是为：:\s]*/, "")), 300);
  set("audience", collect(text, /(?:年轻一代|新一代|年轻|都市|职场|Z世代)?[一-龥]{0,3}?(?:养宠人|宠物主|铲屎官|消费者|候选人|应届生|校招生|实习生|求职者|客户|合作伙伴|嘉宾|观众|员工|新员工|用户|投资人|学生|家长|宝妈|白领)/g));
  const sizes = collect(text, /\d+(?:\.\d+)?\s*[x×X*]\s*\d+(?:\.\d+)?\s*(?:mm|cm|m|px|毫米|厘米|米)?|\bA[0-6]\b/g);
  set("deliverables", [...collect(text, materialWords).map((word) => (/^[a-z]+$/i.test(word) ? word.toUpperCase() : word)), ...sizes, ...collect(text, ratio).map((value) => value.replace(/\s|比|：/g, ":").replace("::", ":"))]);
  set("quantity", collect(text, /(?:\d+|[一二两三四五六七八九十]+)\s*(?:张|份|款|套|版|种|组|个尺寸|个口味|个系列)/g).filter((value) => !/^一[张份个]/.test(value) || /张|款|套/.test(value)));
  set("deadline", collect(text, /\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?|\d{1,2}月\d{1,2}[日号]?(?:前|之前)?|\d{1,2}[/.]\d{1,2}(?=\s*(?:前|之前|交|出|定稿|上线))|(?:今天|明天|后天|本周|下周|这周|月底|月初|年底)[一二三四五六日天]?(?:前|之前|左右)?|周[一二三四五六日天](?:前|之前)?/g));
  set("delivery", collect(text, /印刷|打印|线上|电商|公众号|朋友圈|小红书|抖音|官网|大屏|PDF|PNG|JPG|源文件|PSD|Figma|印厂/g));
  set("tone", pick(/设计语言|视觉|风格|调性|感觉|氛围|色彩|配色|饱和|图形|质感|插画感|极简|活力|时尚|温暖|科技|复古|清爽|参考/, clauses).filter((line) => !/^(?:做|出)一?[个张]/.test(line)), 300);
  set("production", collect(text, /预算[^，。；\n]*|烫金|UV|击凸|压纹|覆膜|专色|铜版纸|特种纸|牛皮纸|亚克力|PVC|KT板/g));
  set("copy", pick(/文案|标题|slogan|口号|广告语/i, clauses));

  const first = clauses[0] || "新项目";
  const brand = text.match(/([\u4e00-\u9fa5A-Za-z]{2,8})是一[个家款][^，。]{0,12}品牌/)?.[1];
  const material = fields.deliverables.value.split("；")[0];
  const title = brand && material ? `${brand} ${material}` : first.replace(/^(?:帮忙|麻烦|需要|想要|我们要|要)?(?:做|出|设计)(?:一个|一张|一套|一份|个|张|套)?/, "").slice(0, 18) || "新项目";
  return { title, fields, questions: "", source: "local" };
}

const system = `你是品牌设计师的需求助理。把一段零散的项目背景整理成需求卡。
需求一开始往往是模糊的，这很正常：
- 原文明确写出的，status 写 "confirmed"（已确定）。
- 原文只有大概方向、模糊描述的（如“年轻一点”“下周左右”“几张图”），照原意简短概括写进 value，status 写 "inferred"（大致）。
- 原文完全没提到的，value 留空、status 写 "ask"（待确定）。绝不编造数量、尺寸、日期、预算。
- 不要写任何人名、手机号、邮箱；approver 只写角色（如“市场负责人”）。
- background：用 100 到 200 字概括项目背景和品牌理念，保留品牌名、核心主张、原料或产品特点等关键信息，不要照抄全文。
- 一段话可能同时包含多项信息（例如品牌理念里提到“高饱和色彩与几何图形”，这同时属于 tone），每项都要填。
- title：12 个字以内的项目名称，优先用“品牌名 + 物料”，例如“宠味食刻 KV”。
只输出 JSON：{"title":"","fields":{"goal":{"value":"","status":""},...}}
字段 key：${briefFields.map((field) => `${field.key}(${field.label})`).join("、")}`;

export async function extractBrief(raw: string): Promise<Extracted> {
  try {
    const result = await aiJson<{ title?: string; fields?: Partial<Record<BriefFieldKey, Partial<BriefField>>>; }>(system, raw);
    if (!result) return extractLocally(raw);
    const fields = emptyFields();
    for (const field of briefFields) {
      const item = result.data.fields?.[field.key];
      const value = (item?.value || "").trim();
      const status = item?.status === "confirmed" || item?.status === "inferred" ? item.status : "ask";
      fields[field.key] = value ? { value, status: status === "ask" ? "inferred" : status } : { value: "", status: "ask" };
    }
    return { title: (result.data.title || "").slice(0, 24) || extractLocally(raw).title, fields, questions: "", source: "ai" };
  } catch {
    return extractLocally(raw);
  }
}

// 补充背景：只填还没定的项，或把“大致”升级成“已确定”；你手动确认过的内容不动。
export function mergeFields(current: Record<BriefFieldKey, BriefField>, incoming: Record<BriefFieldKey, BriefField>) {
  const merged = { ...current };
  for (const field of briefFields) {
    const now = current[field.key];
    const next = incoming[field.key];
    if (!next?.value) continue;
    if (now.status === "ask" || !now.value) merged[field.key] = next;
    else if (now.status === "inferred" && next.status === "confirmed") merged[field.key] = next;
  }
  return merged;
}
