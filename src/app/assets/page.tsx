import { retagAsset, updateAsset, uploadAssets } from "@/app/actions";
import { Submit } from "@/components/submit";
import { UploadForm } from "@/components/upload-form";
import { modelStatus } from "@/lib/ai";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const store = readStore();
  const status = await modelStatus();
  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Assets · 个人资产库</span>
        <h1>资产库</h1>
        <p className="muted">放你做过的稿子、喜欢的参考图、版式模板。每张图带着风格标签，视觉风格那一步会按创意组合从这里匹配。</p>
      </header>

      <section className="panel feature">
        <h2>上传图片</h2>
        <UploadForm
          action={uploadAssets}
          multiple
          label="上传"
          pendingText={status.qwen ? "上传并打标签中…" : "上传中…"}
          hint={status.qwen ? "上传后千问会看图打上风格、色彩、光感、构图等标签，你可以再改。" : "还没配置千问：上传后请手动写几个风格标签。"}
        />
      </section>

      {store.assets.length === 0 ? (
        <p className="empty">资产库还是空的。先放几张你常用的参考图或往期作品进来。</p>
      ) : (
        <div className="asset-grid">
          {store.assets.map((asset) => (
            <article key={`${asset.id}-${asset.tags.join("")}-${asset.name}`} className="asset-card">
              <a href={`/api/assets/${asset.file}`} target="_blank" className="asset-thumb"><img src={`/api/assets/${asset.file}`} alt={asset.name} loading="lazy" /></a>
              <form action={updateAsset} className="asset-form">
                <input type="hidden" name="id" value={asset.id} />
                <input id={`name-${asset.id}`} name="name" defaultValue={asset.name} aria-label="名称" className="asset-name" />
                <label className="field">
                  <span>风格标签 {asset.tagSource === "ai" ? <em className="chip sev-check">AI 标注</em> : null}</span>
                  <input id={`tags-${asset.id}`} name="tags" defaultValue={asset.tags.join("、")} placeholder="用顿号分隔，例：暖光、留白、胶片颗粒" />
                </label>
                <input id={`note-${asset.id}`} name="note" defaultValue={asset.note} placeholder="备注（可选）：哪里好、能用在哪" aria-label="备注" />
                <div className="asset-actions">
                  <Submit className="button small" name="intent" value="save">保存</Submit>
                  {status.qwen && <Submit className="link-button" formAction={retagAsset}>重新识别</Submit>}
                  <Submit className="link-button danger" name="intent" value="delete">删除</Submit>
                </div>
              </form>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
