import Link from "next/link";
import { purgeBrief, restoreBrief } from "@/app/actions";
import { FileThumb } from "@/components/file-thumb";
import { Icon } from "@/components/icons";
import { Submit } from "@/components/submit";
import { readStore, stageOf } from "@/lib/store";
import type { Brief, Store } from "@/lib/types";

export const dynamic = "force-dynamic";

const date = (iso: string) => new Date(iso).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "numeric", day: "numeric" });

function Row({ brief, store, deleted }: { brief: Brief; store: Store; deleted?: boolean }) {
  const draft = store.drafts.find((item) => item.id === brief.finalDraftId);
  const asset = store.assets.find((item) => item.id === brief.finalAssetId);
  const thumb = asset ? { src: `/api/assets/${asset.file}`, kind: asset.kind, name: asset.name } : draft ? { src: `/api/uploads/${draft.image}`, kind: draft.kind, name: draft.imageName } : null;
  const reviews = store.reviews.filter((review) => review.briefId === brief.id).length;
  const drafts = store.drafts.filter((item) => item.briefId === brief.id).length;
  const meta = deleted
    ? `${date(brief.deletedAt!)} 删除 · ${drafts} 版稿件 · ${reviews} 次评审`
    : `${date(brief.updatedAt)} 完成 · ${drafts} 版稿件 · ${reviews} 次评审${draft ? ` · 终稿：${draft.version}` : ""}${asset ? " · 已存入资产库" : ""}`;
  return (
    <li className="history-row">
      <Link href={`/briefs/${brief.id}/${deleted ? "brief" : "delivery"}`} className="history-link">
        <span className="history-thumb">{thumb ? <FileThumb {...thumb} /> : <Icon name={deleted ? "trash" : "archive"} size={18} />}</span>
        <span className="history-main">
          <strong>{brief.title}</strong>
          <small className="muted">{meta}</small>
          {brief.retro && !deleted && <span className="history-retro">复盘：{brief.retro}</span>}
        </span>
      </Link>
      <div className="history-actions">
        {deleted && (
          <form action={restoreBrief}>
            <input type="hidden" name="id" value={brief.id} />
            <Submit className="icon-button" title="恢复项目"><Icon name="refresh" /></Submit>
          </form>
        )}
        <details className="confirm-pop">
          <summary className="icon-button danger" title="彻底删除" aria-label="彻底删除"><Icon name="trash" /></summary>
          <form action={purgeBrief} className="confirm-box">
            <input type="hidden" name="id" value={brief.id} />
            <p>彻底删除“{brief.title}”？需求卡、脑图、稿件和评审都会清掉，不能恢复。{asset ? "资产库里的终稿会保留。" : ""}</p>
            <Submit className="button danger small">彻底删除</Submit>
          </form>
        </details>
      </div>
    </li>
  );
}

// 历史项目：交付完成的项目，以及删除后暂存的项目（可恢复或彻底删除）。
export default function HistoryPage() {
  const store = readStore();
  const byDate = (key: "updatedAt" | "deletedAt") => (a: Brief, b: Brief) => (b[key] || "").localeCompare(a[key] || "");
  const done = store.briefs.filter((brief) => !brief.deletedAt && stageOf(brief) === "完成").sort(byDate("updatedAt"));
  const deleted = store.briefs.filter((brief) => brief.deletedAt).sort(byDate("deletedAt"));
  return (
    <>
      <header className="page-head">
        <span className="eyebrow">History · 历史项目</span>
        <h1>历史项目</h1>
        <p className="muted">交付完成的项目收在这里，终稿同时存进资产库“我的作品”。删除的项目也先放在这里。</p>
      </header>
      <section className="history-group">
        <h2>已完成<span className="count">{done.length}</span></h2>
        {done.length === 0 ? <p className="empty">还没有完成的项目。在“交付”那一步点“交付完成”后会出现在这里。</p> : (
          <ul className="history-list">{done.map((brief) => <Row key={brief.id} brief={brief} store={store} />)}</ul>
        )}
      </section>
      {deleted.length > 0 && (
        <section className="history-group">
          <h2>已删除<span className="count">{deleted.length}</span></h2>
          <ul className="history-list">{deleted.map((brief) => <Row key={brief.id} brief={brief} store={store} deleted />)}</ul>
        </section>
      )}
    </>
  );
}
