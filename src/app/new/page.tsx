import { NewProjectForm } from "@/components/new-project-form";
import { modelStatus } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function NewProject() {
  const status = await modelStatus();
  return (
    <>
      <header className="page-head">
        <span className="eyebrow">New project · 新建项目</span>
        <h1>新项目</h1>
        <p className="muted">每接到一个需求就建一个项目，比如“校招海报”“新品包装”。建好后会出现在左边的项目列表里，按六个步骤往下走。</p>
      </header>
      <section className="panel feature">
        <NewProjectForm aiReady={status.qwen || status.deepseek} autoFocus />
      </section>
    </>
  );
}
