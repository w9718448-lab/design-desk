import { notFound } from "next/navigation";
import { decideFinding, deleteBrief, deleteReview, findingToRule, saveBriefCard, setStage } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { ReviewForm } from "@/components/review-form";
import { Submit } from "@/components/submit";
import { modelStatus } from "@/lib/ai";
import { readStore } from "@/lib/store";
import { briefFields, reviewRoles, severityLabel, stages, type Finding, type Review } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusLabel = { confirmed: "已确认", inferred: "推断，待核对", ask: "待问" } as const;

function FindingRow({ review, finding }: { review: Review; finding: Finding }) {
  const isCheck = finding.severity === "check";
  return (
    <li className={`finding ${finding.decision ? "is-decided" : ""}`}>
      <div className="finding-main">
        <span className={`chip sev-${finding.severity}`}>{severityLabel[finding.severity]}</span>
        <div>
          <p>{finding.text}</p>
          {finding.basis && <small className="muted">依据：{finding.basis}</small>}
        </div>
      </div>
      <form action={decideFinding} className="decision">
        <input type="hidden" name="reviewId" value={review.id} />
        <input type="hidden" name="findingId" value={finding.id} />
        <input name="reason" defaultValue={finding.reason} placeholder={isCheck ? "备注（可选）" : "不改的话，写一句理由"} />
        <Submit className={`button small ${finding.decision === "fix" ? "is-on" : ""}`} name="decision" value="fix">{isCheck ? "有问题" : "要改"}</Submit>
        <Submit className={`button small ${finding.decision === "keep" ? "is-on" : ""}`} name="decision" value="keep">{isCheck ? "没问题" : "不改"}</Submit>
      </form>
      {finding.decision === "keep" && finding.reason && !isCheck && (
        finding.ruleAdded
          ? <small className="muted rule-added">已存为一条待确认的指引</small>
          : (
            <form action={findingToRule} className="to-rule">
              <input type="hidden" name="reviewId" value={review.id} />
              <input type="hidden" name="findingId" value={finding.id} />
              <Submit className="link-button">把理由存为品牌指引</Submit>
            </form>
          )
      )}
    </li>
  );
}

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = readStore();
  const brief = store.briefs.find((item) => item.id === id);
  if (!brief) notFound();
  const reviews = store.reviews.filter((review) => review.briefId === id);
  const status = await modelStatus();
  const asks = briefFields.filter((field) => brief.fields[field.key].status === "ask").length;

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Brief · {brief.stage}</span>
        <h1>{brief.title}</h1>
        <form action={setStage} className="stage-switch" aria-label="阶段">
          <input type="hidden" name="id" value={brief.id} />
          {stages.map((stage) => (
            <button key={stage} type="submit" name="stage" value={stage} className={brief.stage === stage ? "is-on" : undefined} aria-pressed={brief.stage === stage}>{stage}</button>
          ))}
        </form>
      </header>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <h2>需求卡</h2>
            <small className="muted">{brief.source === "ai" ? "由模型整理" : "按本地规则整理"} · {asks ? `${asks} 项待问` : "信息齐全"}</small>
          </div>
          <form key={brief.updatedAt} action={saveBriefCard} className="brief-form">
            <input type="hidden" name="id" value={brief.id} />
            <label className="field">
              <span>名称</span>
              <input name="title" defaultValue={brief.title} />
            </label>
            {briefFields.map((field) => {
              const value = brief.fields[field.key];
              return (
                <div key={field.key} className={`brief-field status-${value.status}`}>
                  <label htmlFor={`f-${field.key}`}>{field.label}</label>
                  <textarea id={`f-${field.key}`} name={`field-${field.key}`} defaultValue={value.value} rows={1} placeholder={field.hint} />
                  <select name={`status-${field.key}`} defaultValue={value.status} aria-label={`${field.label}状态`}>
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
            {brief.questions
              ? <pre className="draft">{brief.questions}</pre>
              : <p className="muted">没有待问项。</p>}
            <small className="muted">设计台不会替你发送，复制后自己发给需求方。拿到回复后改需求卡并保存，草稿会跟着更新。</small>
          </section>
          <details className="panel">
            <summary>需求原文</summary>
            <pre className="draft">{brief.raw}</pre>
          </details>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>稿件评审</h2>
          <small className="muted">五个角色按品牌规则和需求卡挑问题，改不改由你决定。</small>
        </div>
        <ReviewForm briefId={brief.id} aiReady={status.qwen} />
      </section>

      {reviews.map((review) => {
        const pending = review.findings.filter((finding) => finding.decision === null).length;
        return (
          <section key={review.id} className="panel review">
            <div className="review-head">
              <a href={`/api/uploads/${review.image}`} target="_blank" className="thumb"><img src={`/api/uploads/${review.image}`} alt={review.version} /></a>
              <div>
                <h2>{review.version}</h2>
                <p className="muted">
                  {new Date(review.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}{review.mode === "ai" ? `模型评审（${review.model}）` : "本地检查清单"}
                  {" · "}{pending ? `${pending} 条待定` : "已全部处理"}
                </p>
                {review.note && <p className="muted">说明：{review.note}</p>}
              </div>
              <form action={deleteReview} className="push-right">
                <input type="hidden" name="id" value={review.id} />
                <Submit className="link-button danger">删除这一版</Submit>
              </form>
            </div>
            {review.conflicts.length > 0 && (
              <div className="conflicts">
                <strong>意见冲突，需要你裁决</strong>
                <ul>{review.conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul>
              </div>
            )}
            {reviewRoles.filter((role) => review.roles.includes(role.key)).map((role) => {
              const findings = review.findings.filter((finding) => finding.role === role.key);
              if (!findings.length) return null;
              return (
                <div key={role.key} className="role-block">
                  <h3>{role.label}<small className="muted">依据{role.basis}</small></h3>
                  <ul className="findings">{findings.map((finding) => <FindingRow key={`${finding.id}-${finding.decision}-${finding.reason}`} review={review} finding={finding} />)}</ul>
                </div>
              );
            })}
          </section>
        );
      })}

      <details className="danger-zone">
        <summary>删除这个需求</summary>
        <form action={deleteBrief}>
          <input type="hidden" name="id" value={brief.id} />
          <p className="muted">需求卡和所有评审记录、稿件图片都会删除，不能恢复。</p>
          <Submit className="button danger">确认删除</Submit>
        </form>
      </details>
    </>
  );
}
