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

export const stages = ["需求", "探索", "精修", "交付", "完成"] as const;
export type Stage = typeof stages[number];

export type Brief = {
  id: string;
  title: string;
  raw: string;
  stage: Stage;
  fields: Record<BriefFieldKey, BriefField>;
  questions: string;
  source: "ai" | "local";
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

export const reviewRoles = [
  { key: "brand", label: "品牌守门人", basis: "品牌规则", focus: "Logo、标准色、字体、品牌名写法" },
  { key: "audience", label: "目标受众", basis: "需求卡里的受众", focus: "3 秒能否读懂，情绪对不对" },
  { key: "approver", label: "汇报对象", basis: "需求卡里的目标", focus: "是否回应目标，哪里会被追问" },
  { key: "production", label: "生产落地", basis: "物料、交付与工艺", focus: "尺寸、出血、分辨率、色彩模式、工艺" },
  { key: "copy", label: "文案编辑", basis: "文案与写法规则", focus: "错别字、标点、中英文混排、信息完整" },
] as const;

export type ReviewRole = typeof reviewRoles[number]["key"];
export type Severity = "must" | "should" | "minor" | "check";
export type Decision = "fix" | "keep" | null;

export type Finding = {
  id: string;
  role: ReviewRole;
  severity: Severity;
  text: string;
  basis: string;
  decision: Decision;
  reason: string;
  ruleAdded?: boolean;
};

export type Review = {
  id: string;
  briefId: string;
  version: string;
  image: string;
  imageName: string;
  note: string;
  mode: "ai" | "local";
  model?: string;
  roles: ReviewRole[];
  findings: Finding[];
  conflicts: string[];
  createdAt: string;
};

export type Store = {
  version: 1;
  briefs: Brief[];
  rules: Rule[];
  reviews: Review[];
};

export const severityLabel: Record<Severity, string> = {
  must: "必须改",
  should: "建议改",
  minor: "可忽略",
  check: "检查项",
};
