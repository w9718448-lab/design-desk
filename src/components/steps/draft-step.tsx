import { deleteDraft, uploadDraft } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { Submit } from "@/components/submit";
import { Dropzone } from "@/components/dropzone";
import { FileThumb } from "@/components/file-thumb";
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
        <h2>放进稿件</h2>
        <Dropzone action={uploadDraft} hidden={{ briefId: brief.id }} multiple title="把稿件拖到这里，或点这里选择" hint="图片、PDF、PSD、AI、Figma 等都可以，一次可以放多个。图片能直接拿去评审。">
          <div className="form-row">
            <label className="field grow">
              <span>这一版改了什么（可选）</span>
              <input id="draft-note" name="note" placeholder="例：主标题放大，换成方向 A 的暖光" />
            </label>
            <label className="field">
              <span>版本名（可选）</span>
              <input id="draft-version" name="version" placeholder={`默认：第 ${drafts.length + 1} 版`} />
            </label>
          </div>
        </Dropzone>
      </section>

      {drafts.length > 0 && (
        <div className="draft-grid">
          {drafts.map((draft) => (
            <article key={draft.id} className="draft-card">
              <a href={`/api/uploads/${draft.image}${draft.kind === "image" ? "" : `?download=${encodeURIComponent(draft.imageName)}`}`} target="_blank" className="asset-thumb"><FileThumb src={`/api/uploads/${draft.image}`} kind={draft.kind} name={draft.imageName} /></a>
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
