import Link from "next/link";
import { createBrief } from "./actions";
import { Submit } from "@/components/submit";
import { readStore, currentStep, stageOf } from "@/lib/store";
import { modelStatus } from "@/lib/ai";
import { stages, steps } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const store = readStore();
  const status = await modelStatus();
  const aiReady = status.qwen || status.deepseek;
  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Projects · 一个需求一个项目</span>
        <h1>全部项目</h1>
        <p className="muted">把收到的需求原样贴进来，设计台会建一个项目，带你按 需求 → 创意发散 → 视觉风格 → 出稿 → 评审 → 交付 一步步走。</p>
      </header>

      <section className="panel feature">
        <h2>新需求</h2>
        <form action={createBrief} className="stack">
          <textarea id="new-brief" name="raw" rows={5} required placeholder={"把群消息、口头需求原样粘贴进来，例如：\n下周五前出一张校招海报，1080×1920，发公众号和朋友圈，主要给应届生看，想要年轻一点的感觉。"} />
          <div className="form-actions">
            <Submit pendingText="整理中…">建项目</Submit>
            <small className="muted">{aiReady ? "会用你配置的模型整理需求卡，原文里没有的信息一律标“待问”。" : "还没配置模型：按本地规则抽取，没抽到的标“待问”。"}</small>
          </div>
        </form>
      </section>

      <section className="stage-board">
        {stages.map((stage, index) => {
          const briefs = store.briefs.filter((brief) => stageOf(brief) === stage);
          return (
            <div key={stage} className="stage-column">
              <h2><span className="eyebrow">{String(index + 1).padStart(2, "0")}</span>{stage}<span className="count">{briefs.length}</span></h2>
              {briefs.length === 0 && <p className="empty">暂无</p>}
              {briefs.map((brief) => {
                const step = steps.find((item) => item.key === currentStep(brief));
                const open = store.reviews.filter((review) => review.briefId === brief.id).flatMap((review) => review.findings).filter((finding) => finding.decision === null).length;
                return (
                  <Link key={brief.id} href={`/briefs/${brief.id}`} className="brief-card">
                    <strong>{brief.title}</strong>
                    <span className="step-track" aria-label={`已完成 ${steps.filter((item) => brief.stepsDone[item.key]).length} / ${steps.length} 步`}>
                      {steps.map((item) => <i key={item.key} className={brief.stepsDone[item.key] ? "is-done" : item.key === step?.key ? "is-current" : undefined} />)}
                    </span>
                    <span className="meta">{stage === "完成" ? "已交付" : `下一步：${step?.label}`}{brief.fields.deadline.value ? ` · 截止 ${brief.fields.deadline.value}` : ""}</span>
                    {open > 0 && stage !== "完成" && <span className="chips"><span className="chip warn">{open} 条评审意见待定</span></span>}
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
