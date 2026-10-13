import { deleteDraft, uploadDraft } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { Submit } from "@/components/submit";
import { UploadForm } from "@/components/upload-form";
import { directionText, promptText } from "@/lib/direction";
import type { Brief, Store } from "@/lib/types";

export function DraftStep({ store, brief }: { store: Store; brief: Brief }) {
  const drafts = store.drafts.filter((draft) => draft.briefId === brief.id);
  const direction = directionText(brief, store);
  const prompt = promptText(brief, store);
  return (
    <>
      <div className="two-col even">
        <section className="panel">
          <div className="panel-head">
            <h2>方向说明</h2>
            <CopyButton text={direction} />
          </div>
          <pre className="draft">{direction}</pre>
          <small className="muted">汇总了需求卡、创意组合和风格参考，可以发给同事对齐，也能作为汇报时的思路说明。</small>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>生图提示词</h2>
            <CopyButton text={prompt} />
          </div>
          <pre className="draft">{prompt}</pre>
          <small className="muted">粘贴到即梦、通义万相等工具出底图；文字和 Logo 之后在设计软件里排。</small>
        </section>
      </div>

      <section className="panel feature">
        <h2>放进一版稿件</h2>
        <UploadForm action={uploadDraft} hidden={{ briefId: brief.id }} withVersion label="放进稿件" pendingText="上传中…" hint="PNG、JPG 或 WebP，长边 2000 像素左右就够评审用。" />
      </section>

      {drafts.length > 0 && (
        <div className="draft-grid">
          {drafts.map((draft) => (
            <article key={draft.id} className="draft-card">
              <a href={`/api/uploads/${draft.image}`} target="_blank" className="asset-thumb"><img src={`/api/uploads/${draft.image}`} alt={draft.version} /></a>
              <div className="match-body">
                <strong>{draft.version}</strong>
                <small className="muted">{new Date(draft.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}{draft.note ? ` · ${draft.note}` : ""}</small>
                <form action={deleteDraft}>
                  <input type="hidden" name="id" value={draft.id} />
                  <Submit className="link-button danger">删除这一版</Submit>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
