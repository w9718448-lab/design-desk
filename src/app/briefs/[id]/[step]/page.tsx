import { notFound } from "next/navigation";
import { completeStep, reopenStep } from "@/app/actions";
import { Submit } from "@/components/submit";
import { BriefStep } from "@/components/steps/brief-step";
import { IdeasStep } from "@/components/steps/ideas-step";
import { StyleStep } from "@/components/steps/style-step";
import { DraftStep } from "@/components/steps/draft-step";
import { ReviewStep } from "@/components/steps/review-step";
import { DeliveryStep } from "@/components/steps/delivery-step";
import { readStore } from "@/lib/store";
import { steps, type StepKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const intro: Record<StepKey, string> = {
  brief: "把需求整理成需求卡，缺的信息标成“待问”，先问清楚再开工。",
  ideas: "从需求的核心词出发，点圆圈让 AI 继续长出关键词，把喜欢的收进创意组合。",
  style: "按创意组合从你的资产库里匹配风格，勾选喜欢的图，也可以框出喜欢的局部。",
  draft: "把需求、创意和风格汇总成一段方向说明，拿去出图或排版；做好的稿子放回这里。",
  review: "选一版稿子，请评审角色按品牌规则和需求挑问题，改不改由你决定。",
  delivery: "选定终稿，逐条核对交付要求，按规则命名，写两句复盘。",
};

const nextLabel: Partial<Record<StepKey, string>> = {
  brief: "需求问清楚了，进入创意发散",
  ideas: "创意选好了，进入视觉风格",
  style: "风格定好了，进入出稿",
  draft: "稿子出好了，进入评审",
  review: "评审处理完了，进入交付",
};

export default async function StepPage({ params }: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await params;
  const index = steps.findIndex((item) => item.key === step);
  const store = readStore();
  const brief = store.briefs.find((item) => item.id === id);
  if (!brief || index < 0) notFound();
  const key = step as StepKey;
  const done = Boolean(brief.stepsDone[key]);

  return (
    <>
      <header className="page-head step-head">
        <span className="eyebrow">Step {String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")} · {brief.title}</span>
        <h1>{steps[index].label}</h1>
        <p className="muted">{intro[key]}</p>
      </header>

      {key === "brief" && <BriefStep store={store} brief={brief} />}
      {key === "ideas" && <IdeasStep store={store} brief={brief} />}
      {key === "style" && <StyleStep store={store} brief={brief} />}
      {key === "draft" && <DraftStep store={store} brief={brief} />}
      {key === "review" && <ReviewStep store={store} brief={brief} />}
      {key === "delivery" && <DeliveryStep store={store} brief={brief} />}

      {key !== "delivery" && (
        <div className="step-foot">
          {done ? (
            <form action={reopenStep} className="step-foot-row">
              <input type="hidden" name="id" value={brief.id} />
              <input type="hidden" name="step" value={key} />
              <span className="chip ok">这一步已完成</span>
              <Submit className="link-button">改回进行中</Submit>
            </form>
          ) : (
            <form action={completeStep} className="step-foot-row">
              <input type="hidden" name="id" value={brief.id} />
              <input type="hidden" name="step" value={key} />
              <Submit pendingText="保存中…">{nextLabel[key]} →</Submit>
            </form>
          )}
        </div>
      )}
    </>
  );
}
