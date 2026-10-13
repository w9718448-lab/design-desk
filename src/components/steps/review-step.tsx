import { FileThumb } from "@/components/file-thumb";
import Link from "next/link";
import { chooseFinal, decideFinding, deleteReview, findingToRule } from "@/app/actions";
import { ReviewForm } from "@/components/review-form";
import { Submit } from "@/components/submit";
import { modelStatus } from "@/lib/ai";
import { severityLabel, type Brief, type Finding, type Review, type Store } from "@/lib/types";

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
        <input id={`reason-${finding.id}`} name="reason" defaultValue={finding.reason} placeholder={isCheck ? "备注（可选）" : "不改的话，写一句理由"} />
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

export async function ReviewStep({ store, brief }: { store: Store; brief: Brief }) {
  const status = await modelStatus();
  const drafts = store.drafts.filter((draft) => draft.briefId === brief.id);
  const reviews = store.reviews.filter((review) => review.briefId === brief.id);
  const roles = store.roles.filter((role) => role.enabled);
  const labelOf = (review: Review, key: string) => review.roleLabels?.[key] || store.roles.find((role) => role.key === key)?.label || "已删除的角色";

  return (
    <>
      <section className="panel feature">
        <div className="panel-head">
          <h2>发起评审</h2>
          <Link className="link-button" href="/roles">编辑评审角色</Link>
        </div>
        {drafts.length === 0
          ? <p className="muted">还没有稿件。先到 <Link className="link-button" href={`/briefs/${brief.id}/draft`}>出稿</Link> 这一步放进一版。</p>
          : <ReviewForm briefId={brief.id} aiReady={status.qwen} drafts={drafts} roles={roles} />}
      </section>

      {reviews.map((review) => {
        const pending = review.findings.filter((finding) => finding.decision === null).length;
        return (
          <section key={review.id} className="panel review">
            <div className="review-head">
              <a href={`/api/uploads/${review.image}`} target="_blank" className="thumb"><FileThumb src={`/api/uploads/${review.image}`} kind={/\.(png|jpe?g|webp|gif)$/i.test(review.image) ? "image" : "file"} name={review.imageName} /></a>
              <div>
                <h2>{review.version}</h2>
                <p className="muted">
                  {new Date(review.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}{review.mode === "ai" ? `模型评审（${review.model}）` : "本地检查清单"}
                  {" · "}{pending ? `${pending} 条待定` : "已全部处理"}
                </p>
                {review.note && <p className="muted">说明：{review.note}</p>}
              </div>
              <div className="push-right review-actions">
                {review.draftId && drafts.some((draft) => draft.id === review.draftId) && (
                  <form action={chooseFinal}>
                    <input type="hidden" name="id" value={brief.id} />
                    <input type="hidden" name="draftId" value={review.draftId} />
                    <Submit className="button small" pendingText="提交中…">就用这一版，提交终稿 →</Submit>
                  </form>
                )}
                <form action={deleteReview}>
                  <input type="hidden" name="id" value={review.id} />
                  <Submit className="link-button danger">删除这次评审</Submit>
                </form>
              </div>
            </div>
            {review.conflicts.length > 0 && (
              <div className="conflicts">
                <strong>意见冲突，需要你裁决</strong>
                <ul>{review.conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul>
              </div>
            )}
            {review.roles.map((key) => {
              const findings = review.findings.filter((finding) => finding.role === key);
              if (!findings.length) return null;
              return (
                <div key={key} className="role-block">
                  <h3>{labelOf(review, key)}</h3>
                  <ul className="findings">{findings.map((finding) => <FindingRow key={`${finding.id}-${finding.decision}-${finding.reason}`} review={review} finding={finding} />)}</ul>
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
