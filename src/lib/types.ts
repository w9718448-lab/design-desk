export const briefFields = [
  { key: "goal", label: "目标", hint: "这张图要达成什么：拉新、招聘、活动告知、品牌形象……" },
  { key: "audience", label: "受众", hint: "谁会看到：候选人、客户、员工、展会观众……" },
  { key: "deliverables", label: "物料与尺寸", hint: "做哪些物料，每个的尺寸或比例" },
  { key: "quantity", label: "数量", hint: "几张、几款、几个尺寸" },
  { key: "deadline", label: "截止时间", hint: "初稿和定稿分别什么时候" },
  { key: "delivery", label: "交付方式", hint: "印刷、线上发布、源文件格式" },
  { key: "copy", label: "文案", hint: "主标题、正文、必须出现的信息由谁提供" },
  { key: "tone", label: "调性与参考", hint: "想要的感觉，有没有参考或不要的样子" },
  { key: "production", label: "预算与工艺", hint: "印刷工艺、材质、预算上限" },
  { key: "approver", label: "谁来确认", hint: "由谁拍板定稿（写角色，不写联系方式）" },
] as const;

export type BriefFieldKey = typeof briefFields[number]["key"];
export type FieldStatus = "confirmed" | "inferred" | "ask";
export type BriefField = { value: string; status: FieldStatus };

// 一个项目里的六个步骤，顺序就是设计流程。
export const steps = [
  { key: "brief", label: "需求", hint: "问清楚再开工" },
  { key: "ideas", label: "创意发散", hint: "脑图里点选关键词" },
  { key: "style", label: "视觉风格", hint: "从资产库挑风格" },
  { key: "draft", label: "出稿", hint: "方向说明与稿件版本" },
  { key: "review", label: "评审", hint: "多角色挑问题" },
  { key: "delivery", label: "交付", hint: "核对、命名、复盘" },
] as const;

export type StepKey = typeof steps[number]["key"];

// 首页看板的阶段由步骤推导，不再手动切换。
export const stages = ["需求", "探索", "精修", "交付", "完成"] as const;
export type Stage = typeof stages[number];

export type MindNode = {
  id: string;
  parentId: string | null;
  label: string;
  picked: boolean;
  expanded: boolean;
};

export type Box = { x: number; y: number; w: number; h: number };

export type StyleRef = { assetId: string; note: string; box: Box | null };

export type Brief = {
  id: string;
  title: string;
  raw: string;
  stage: Stage;
  fields: Record<BriefFieldKey, BriefField>;
  questions: string;
  source: "ai" | "local";
  stepsDone: Partial<Record<StepKey, boolean>>;
  mindmap: MindNode[];
  mindmapSource?: "ai" | "local";
  styleRefs: StyleRef[];
  styleMatch?: { signature: string; source: "ai" | "local"; items: Array<{ assetId: string; score: number; reason: string }> };
  finalDraftId: string | null;
  deliveryChecks: string[];
  retro: string;
  createdAt: string;
  updatedAt: string;
};

export const ruleLayers = [
  { key: "feel", label: "感觉", hint: "想让人感受到什么" },
  { key: "principle", label: "原则", hint: "设计上遵守什么" },
  { key: "guide", label: "指引", hint: "落到具体做法，能逐条检查" },
] as const;

export type RuleLayer = typeof ruleLayers[number]["key"];

export type Rule = {
  id: string;
  layer: RuleLayer;
  text: string;
  confirmed: boolean;
  source: "preset" | "manual" | "review";
  createdAt: string;
};

// 评审角色：人物特质、关注点和依据都可以在“评审角色”页里改。
export type Role = {
  key: string;
  label: string;
  persona: string;
  focus: string;
  basis: string;
  enabled: boolean;
};

export const defaultRoles: Role[] = [
  { key: "brand", label: "品牌守门人", persona: "品牌部的老员工，严谨、较真，见不得 Logo 和标准色被乱用。", focus: "Logo、标准色、字体、品牌名写法", basis: "品牌规则", enabled: true },
  { key: "audience", label: "目标受众", persona: "需求卡里写的那群人，刷手机很快，只给一张图 3 秒。", focus: "3 秒能否读懂，情绪对不对", basis: "需求卡里的受众", enabled: true },
  { key: "approver", label: "汇报对象", persona: "拍板的负责人，关心这张图能不能达成业务目标，会追问“为什么这么做”。", focus: "是否回应目标，哪里会被追问", basis: "需求卡里的目标", enabled: true },
  { key: "production", label: "生产落地", persona: "跟了很多年印厂的制作，眼里只有尺寸、出血、色彩模式和工艺。", focus: "尺寸、出血、分辨率、色彩模式、工艺", basis: "物料、交付与工艺", enabled: true },
  { key: "copy", label: "文案编辑", persona: "细心的文字编辑，错一个标点都会圈出来。", focus: "错别字、标点、中英文混排、信息完整", basis: "文案与写法规则", enabled: true },
];

export type Severity = "must" | "should" | "minor" | "check";
export type Decision = "fix" | "keep" | null;

export type Finding = {
  id: string;
  role: string;
  severity: Severity;
  text: string;
  basis: string;
  decision: Decision;
  reason: string;
  ruleAdded?: boolean;
};

export type Draft = {
  id: string;
  briefId: string;
  version: string;
  image: string;
  imageName: string;
  note: string;
  createdAt: string;
};

export type Review = {
  id: string;
  briefId: string;
  draftId?: string;
  version: string;
  image: string;
  imageName: string;
  note: string;
  mode: "ai" | "local";
  model?: string;
  roles: string[];
  roleLabels?: Record<string, string>;
  findings: Finding[];
  conflicts: string[];
  createdAt: string;
};

export type Asset = {
  id: string;
  file: string;
  name: string;
  tags: string[];
  note: string;
  tagSource: "ai" | "manual";
  createdAt: string;
};

export type Store = {
  version: 2;
  briefs: Brief[];
  rules: Rule[];
  reviews: Review[];
  drafts: Draft[];
  assets: Asset[];
  roles: Role[];
};

export const severityLabel: Record<Severity, string> = {
  must: "必须改",
  should: "建议改",
  minor: "可忽略",
  check: "检查项",
};
