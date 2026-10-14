import Link from "next/link";
import { NewProjectForm } from "@/components/new-project-form";
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
        <p className="muted">一个需求一个项目。写一段背景就能建项目，左边会多出一个项目，按 需求 → 创意发散 → 视觉风格 → 出稿 → 评审 → 交付 一步步走。</p>
      </header>

      <section className="panel feature">
        <h2>新项目</h2>
        <NewProjectForm aiReady={aiReady} />
      </section>

      <section className="stage-board">
        {stages.map((stage, index) => {
          const briefs = store.briefs.filter((brief) => !brief.deletedAt && stageOf(brief) === stage);
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
