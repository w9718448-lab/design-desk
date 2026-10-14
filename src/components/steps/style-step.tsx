import Link from "next/link";
import { runStyleMatch, toggleStyleRef } from "@/app/actions";
import { StyleRefEditor } from "@/components/style-ref-editor";
import { Icon } from "@/components/icons";
import { Submit } from "@/components/submit";
import { modelStatus } from "@/lib/ai";
import { pickedPaths } from "@/lib/ideas";
import type { Brief, Store } from "@/lib/types";

export async function StyleStep({ store, brief }: { store: Store; brief: Brief }) {
  const status = await modelStatus();
  const chosen = new Set(brief.styleRefs.map((ref) => ref.assetId));
  const keywords = [...new Set(pickedPaths(brief.mindmap).flat())];
  const signature = keywords.join("|");
  const match = brief.styleMatch;
  const stale = match && match.signature !== signature;
  const scores = new Map((match?.items || []).map((item) => [item.assetId, item]));
  const images = store.assets.filter((asset) => asset.kind === "image");
  const assets = [...images].filter((asset) => !match?.query || (scores.get(asset.id)?.score || 0) > 0 || chosen.has(asset.id)).sort((a, b) => (scores.get(b.id)?.score || 0) - (scores.get(a.id)?.score || 0));

  return (
    <>
      <section className="panel feature">
        <div className="panel-head">
          <div className="panel-title">
            <h2>创意组合</h2>
            <small className="muted">来自上一步脑图里收藏的关键词</small>
          </div>
          <Link className="icon-button" href={`/briefs/${brief.id}/ideas`} title="回脑图修改" aria-label="回脑图修改"><Icon name="branch" /></Link>
        </div>
        {keywords.length ? (
          <div className="chips big">{keywords.map((keyword) => <span key={keyword} className="chip glow">{keyword}</span>)}</div>
        ) : (
          <p className="muted">还没有收藏关键词。可以先回脑图点 ☆ 收藏几个，匹配会更准；不收藏也能直接从资产库挑。</p>
        )}
        <form action={runStyleMatch} className="form-actions">
          <input type="hidden" name="id" value={brief.id} />
          <Submit pendingText="匹配中…">{match && !match.query ? "按创意组合重新匹配" : "按创意组合匹配"}</Submit>
          <small className="muted">
            {store.assets.length === 0
              ? "资产库还是空的，先去资产库上传几张图。"
              : match && !match.query
                ? `${match.source === "ai" ? "AI 按意思匹配" : "按关键词字面匹配"}，共 ${images.length} 张。${stale ? "创意组合有变化，建议重新匹配。" : ""}`
                : status.qwen || status.deepseek ? "AI 会按关键词的意思给每张图打分并说明理由。" : "还没配置模型：按标签字面重合度排序。"}
          </small>
        </form>
        <form action={runStyleMatch} className="search-row">
          <input type="hidden" name="id" value={brief.id} />
          <input id="style-query" name="query" key={match?.query || ""} defaultValue={match?.query || ""} placeholder="也可以自己输入想找的风格，例：胶片颗粒 暖光 留白" aria-label="输入风格关键词" />
          <Submit className="button" pendingText="检索中…">检索</Submit>
        </form>
        {match?.query && <p className="muted">“{match.query}”找到 {assets.length} 张{match.source === "ai" ? "（AI 按意思匹配）" : ""}。清空输入框再点检索，或点上面的按钮，回到按创意组合匹配。</p>}
      </section>

      {brief.styleRefs.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>已选风格参考</h2>
            <small className="muted">{brief.styleRefs.length} 张 · 框选和备注会写进出稿说明</small>
          </div>
          <div className="ref-list">
            {brief.styleRefs.map((ref) => {
              const asset = store.assets.find((item) => item.id === ref.assetId);
              if (!asset) return null;
              return <StyleRefEditor key={ref.assetId} briefId={brief.id} assetId={asset.id} src={`/api/assets/${asset.file}`} name={asset.name} initialNote={ref.note} initialBox={ref.box} />;
            })}
          </div>
        </section>
      )}

      {images.length === 0 ? (
        <p className="empty">资产库是空的。<Link className="link-button" href="/assets">去上传</Link></p>
      ) : (
        <div className="asset-grid">
          {assets.map((asset) => {
            const score = scores.get(asset.id);
            const selected = chosen.has(asset.id);
            return (
              <article key={asset.id} className={`asset-card match ${selected ? "is-selected" : ""} ${score && score.score > 0 ? "has-score" : ""}`}>
                <div className="asset-thumb"><img src={`/api/assets/${asset.file}`} alt={asset.name} loading="lazy" /></div>
                <div className="match-body">
                  <div className="panel-head">
                    <strong>{asset.name}</strong>
                    {score && (score.score > 0 || match?.source === "ai") && <span className={`chip ${score.score >= 6 ? "ok" : ""}`}>{match?.source === "ai" ? `${score.score} 分` : `${score.score} 处相近`}</span>}
                  </div>
                  {score?.reason && <p className="match-reason">{score.reason}</p>}
                  <form action={toggleStyleRef}>
                    <input type="hidden" name="id" value={brief.id} />
                    <input type="hidden" name="assetId" value={asset.id} />
                    <Submit className={`button small ${selected ? "is-on" : ""}`}>{selected ? "✓ 已选用" : "选用"}</Submit>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
