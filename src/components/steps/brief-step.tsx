import { deleteBrief, saveBriefCard } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { Submit } from "@/components/submit";
import { briefFields, type Brief, type Store } from "@/lib/types";

const statusLabel = { confirmed: "已确认", inferred: "推断，待核对", ask: "待问" } as const;

export function BriefStep({ brief }: { store: Store; brief: Brief }) {
  const asks = briefFields.filter((field) => brief.fields[field.key].status === "ask").length;
  return (
    <>
      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <h2>需求卡</h2>
            <small className="muted">{brief.source === "ai" ? "由模型整理" : "按本地规则整理"} · {asks ? `${asks} 项待问` : "信息齐全"}</small>
          </div>
          <form key={brief.updatedAt} action={saveBriefCard} className="brief-form">
            <input type="hidden" name="id" value={brief.id} />
            <label className="field">
              <span>项目名称</span>
              <input id="brief-title" name="title" defaultValue={brief.title} />
            </label>
            {briefFields.map((field) => {
              const value = brief.fields[field.key];
              return (
                <div key={field.key} className={`brief-field status-${value.status}`}>
                  <label htmlFor={`f-${field.key}`}>{field.label}</label>
                  <textarea id={`f-${field.key}`} name={`field-${field.key}`} defaultValue={value.value} rows={1} placeholder={field.hint} />
                  <select id={`s-${field.key}`} name={`status-${field.key}`} defaultValue={value.status} aria-label={`${field.label}状态`}>
                    {Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
              );
            })}
            <div className="form-actions"><Submit pendingText="保存中…">保存需求卡</Submit></div>
          </form>
        </section>

        <div className="side">
          <section className="panel">
            <div className="panel-head">
              <h2>追问草稿</h2>
              {brief.questions && <CopyButton text={brief.questions} />}
            </div>
            {brief.questions ? <pre className="draft">{brief.questions}</pre> : <p className="muted">没有待问项。</p>}
            <small className="muted">设计台不会替你发送，复制后自己发给需求方。拿到回复后改需求卡并保存，草稿会跟着更新。</small>
          </section>
          <details className="panel">
            <summary>需求原文</summary>
            <pre className="draft">{brief.raw}</pre>
          </details>
        </div>
      </div>

      <details className="danger-zone">
        <summary>删除这个项目</summary>
        <form action={deleteBrief}>
          <input type="hidden" name="id" value={brief.id} />
          <p className="muted">需求卡、脑图、稿件和评审记录都会删除，不能恢复。资产库里的图不受影响。</p>
          <Submit className="button danger">确认删除</Submit>
        </form>
      </details>
    </>
  );
}
