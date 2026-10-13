import { createBrief } from "@/app/actions";
import { Submit } from "@/components/submit";

export function NewProjectForm({ aiReady, autoFocus }: { aiReady: boolean; autoFocus?: boolean }) {
  return (
    <form action={createBrief} className="stack">
      <textarea id="new-brief" name="raw" rows={6} required autoFocus={autoFocus} placeholder={"写一段这个项目的背景就行，模糊的也没关系，例如：\n要做一个新茶饮的包装，大概三个口味，想要清爽一点，月底前要初稿。"} />
      <div className="form-actions">
        <Submit pendingText="识别中…">建项目</Submit>
        <small className="muted">{aiReady ? "AI 会把背景识别成需求卡，明确的标“已确定”，模糊的标“大致”，没提到的标“待确定”。" : "还没配置模型：按本地规则识别，没识别出的标“待确定”。"}</small>
      </div>
    </form>
  );
}
