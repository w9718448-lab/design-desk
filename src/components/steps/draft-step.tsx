import { addDraftFromAsset, deleteDraft, toggleCardAsset, uploadDraft } from "@/app/actions";
import { DesignCard, type CardImage } from "@/components/design-card";
import { Icon } from "@/components/icons";
import { pickedPaths } from "@/lib/ideas";
import { CopyButton } from "@/components/copy-button";
import { Submit } from "@/components/submit";
import { Dropzone } from "@/components/dropzone";
import { FileThumb } from "@/components/file-thumb";
import { directionText, promptText } from "@/lib/direction";
import type { Brief, Store } from "@/lib/types";
import { fileUrl } from "@/lib/file-url";

export function DraftStep({ store, brief }: { store: Store; brief: Brief }) {
  const drafts = store.drafts.filter((draft) => draft.briefId === brief.id);
  const direction = directionText(brief, store);
  const prompt = promptText(brief, store);
  const imageAssets = store.assets.filter((asset) => asset.kind === "image");
  const assetById = new Map(store.assets.map((asset) => [asset.id, asset]));
  const images: CardImage[] = [
    ...brief.refs.filter((ref) => ref.kind === "image").map((ref) => ({ src: fileUrl("uploads", ref.file), label: ref.name, tag: "固定" })),
    ...brief.styleRefs.map((ref) => assetById.get(ref.assetId)).filter((asset) => asset?.kind === "image").map((asset) => ({ src: fileUrl("assets", asset!.file), label: asset!.name, tag: "风格" })),
    ...brief.cardAssetIds.map((id) => assetById.get(id)).filter((asset) => asset?.kind === "image").map((asset) => ({ src: fileUrl("assets", asset!.file), label: asset!.name, tag: "参考" })),
  ].filter((item, index, list) => list.findIndex((other) => other.src === item.src) === index);
  const short = (value: string, limit = 90) => (value.length > limit ? `${value.slice(0, limit)}…` : value);
  const rows = (["background", "goal", "audience", "deliverables", "tone"] as const)
    .filter((key) => brief.fields[key].value)
    .map((key) => ({ label: { background: "项目背景", goal: "目标", audience: "受众", deliverables: "物料与尺寸", tone: "视觉调性" }[key], value: short(brief.fields[key].value) }));
  const keywords = [...new Set(pickedPaths(brief.mindmap).map((path) => path[path.length - 1]))];
  const concept = brief.mindmap.find((node) => !node.parentId)?.label || "";
  return (
    <>
      <section className="panel feature">
        <div className="panel-head">
          <div className="panel-title">
            <h2>设计卡片</h2>
            <small className="muted">需求、创意组合和参考图汇成一张卡片。复制或下载后，拿去生图工具或设计软件里，照着卡片做。</small>
          </div>
        </div>
        <DesignCard title={brief.title} concept={concept} keywords={keywords} rows={rows} images={images} prompt={prompt} fileName={brief.title.replace(/[\\/:*?"<>|\s]+/g, "")} />
        <details className="card-picker">
          <summary><Icon name="image" />从资产库添加参考图{brief.cardAssetIds.length ? `（已添加 ${brief.cardAssetIds.length} 张）` : ""}</summary>
          {imageAssets.length === 0 ? <p className="muted">资产库里还没有图片。</p> : (
            <div className="picker-grid">
              {imageAssets.map((asset) => {
                const on = brief.cardAssetIds.includes(asset.id);
                return (
                  <form key={asset.id} action={toggleCardAsset} className={`picker-item ${on ? "is-on" : ""}`}>
                    <input type="hidden" name="id" value={brief.id} />
                    <input type="hidden" name="assetId" value={asset.id} />
                    <button type="submit" title={on ? `从卡片移除${asset.name}` : `把${asset.name}加进卡片`} aria-pressed={on}>
                      <img src={fileUrl("assets", asset.file)} alt={asset.name} loading="lazy" />
                      <span className="picker-mark"><Icon name={on ? "check" : "plus"} size={14} /></span>
                    </button>
                  </form>
                );
              })}
            </div>
          )}
        </details>
      </section>

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
        {store.assets.length > 0 && (
          <form action={addDraftFromAsset} className="inline-form from-asset">
            <input type="hidden" name="briefId" value={brief.id} />
            <span className="muted">或者从资产库放一个进来：</span>
            <select id="draft-from-asset" name="assetId" aria-label="从资产库选择">
              {store.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <Submit className="icon-button" title="放进稿件"><Icon name="plus" /></Submit>
          </form>
        )}
      </section>

      {drafts.length > 0 && (
        <div className="draft-grid">
          {drafts.map((draft) => (
            <article key={draft.id} className="draft-card">
              <a href={fileUrl("uploads", draft.image, draft.kind === "image" ? undefined : draft.imageName)} target="_blank" className="asset-thumb"><FileThumb src={fileUrl("uploads", draft.image)} kind={draft.kind} name={draft.imageName} /></a>
              <div className="match-body">
                <strong>{draft.version}</strong>
                <small className="muted">{new Date(draft.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}{draft.note ? ` · ${draft.note}` : ""}</small>
                <form action={deleteDraft}>
                  <input type="hidden" name="id" value={draft.id} />
                  <Submit className="icon-button danger" title="删除这一版"><Icon name="trash" /></Submit>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
