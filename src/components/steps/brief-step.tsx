import { addBackground, deleteBrief } from "@/app/actions";
import { BriefCard } from "@/components/brief-card";
import { Submit } from "@/components/submit";
import { modelStatus } from "@/lib/ai";
import { briefFields, type Brief, type Store } from "@/lib/types";

export async function BriefStep({ brief }: { store: Store; brief: Brief }) {
  const status = await modelStatus();
  const known = briefFields.filter((field) => brief.fields[field.key].status !== "ask" && brief.fields[field.key].value).length;
  return (
    <>
      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <h2>需求卡</h2>
            <small className="muted">{known} 项已有内容 · {briefFields.length - known} 项待确定</small>
          </div>
          <BriefCard brief={brief} />
        </section>

        <div className="side">
          <section className="panel feature">
            <h2>补充项目背景</h2>
            <form key={brief.updatedAt} action={addBackground} className="stack">
              <input type="hidden" name="id" value={brief.id} />
              <textarea id="background" name="background" rows={6} required placeholder={"想到什么写什么，模糊的也没关系，例如：\n客户说想要年轻一点，可能还要出一版竖版，时间大概在月底。"} />
              <div className="form-actions">
                <Submit pendingText="识别中…">识别并补进需求卡</Submit>
              </div>
              <small className="muted">{status.qwen || status.deepseek ? "AI 会把新信息补进还没定的项；你已经确定的内容不会被改。" : "还没配置模型：按本地规则识别，识别不出的项保持“待确定”。"}</small>
            </form>
          </section>
          <details className="panel">
            <summary>原始背景（含补充）</summary>
            <pre className="draft">{brief.raw}</pre>
          </details>
        </div>
      </div>

      <details className="danger-zone">
        <summary>删除这个项目</summary>
        <form action={deleteBrief}>
          <input type="hidden" name="id" value={brief.id} />
          <p className="muted">需求卡、脑图、稿件和评审记录都会删除，不能恢复。已经存进资产库的终稿不受影响。</p>
          <Submit className="button danger">确认删除</Submit>
        </form>
      </details>
    </>
  );
}
