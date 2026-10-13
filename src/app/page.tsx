import Link from "next/link";
import { createBrief } from "./actions";
import { Submit } from "@/components/submit";
import { readStore } from "@/lib/store";
import { modelStatus } from "@/lib/ai";
import { briefFields, stages } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const store = readStore();
  const status = await modelStatus();
  const aiReady = status.qwen || status.deepseek;
  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Briefs · 一个需求一张卡</span>
        <h1>需求</h1>
        <p className="muted">一个设计需求一张卡。把收到的需求原样贴进来，先问清楚，再开工。</p>
      </header>

      <section className="panel feature">
        <h2>新需求</h2>
        <form action={createBrief} className="stack">
          <textarea name="raw" rows={6} required placeholder={"把群消息、口头需求原样粘贴进来，例如：\n下周五前出一张校招海报，1080×1920，发公众号和朋友圈，主要给应届生看，想要年轻一点的感觉。"} />
          <div className="form-actions">
            <Submit pendingText="整理中…">整理成需求卡</Submit>
            <small className="muted">{aiReady ? "会用你配置的模型整理，原文里没有的信息一律标“待问”。" : "还没配置模型：按本地规则抽取，没抽到的标“待问”。"}</small>
          </div>
        </form>
      </section>

      <section className="stage-board">
        {stages.map((stage, index) => {
          const briefs = store.briefs.filter((brief) => brief.stage === stage);
          return (
            <div key={stage} className="stage-column">
              <h2><span className="eyebrow">{String(index + 1).padStart(2, "0")}</span>{stage}<span className="count">{briefs.length}</span></h2>
              {briefs.length === 0 && <p className="empty">暂无</p>}
              {briefs.map((brief) => {
                const asks = briefFields.filter((field) => brief.fields[field.key].status === "ask").length;
                const reviews = store.reviews.filter((review) => review.briefId === brief.id);
                const open = reviews.flatMap((review) => review.findings).filter((finding) => finding.decision === null).length;
                return (
                  <Link key={brief.id} href={`/briefs/${brief.id}`} className="brief-card">
                    <strong>{brief.title}</strong>
                    <span className="meta">
                      {brief.fields.deadline.value ? `截止 ${brief.fields.deadline.value}` : "截止时间待问"}
                    </span>
                    <span className="chips">
                      {asks > 0 && <span className="chip warn">{asks} 项待问</span>}
                      {reviews.length > 0 && <span className="chip">{reviews.length} 版稿</span>}
                      {open > 0 && <span className="chip warn">{open} 条意见待定</span>}
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </section>
    </>
  );
}
