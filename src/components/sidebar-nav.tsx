"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { steps, type StepKey } from "@/lib/types";
import { ThemeToggle } from "./theme-toggle";

export type ProjectNav = { id: string; title: string; done: Partial<Record<StepKey, boolean>>; current: StepKey; finished: boolean };

const check = <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

// 左栏：上面是项目（每个需求一个项目，点“＋”新建），当前项目展开成六个步骤；最下面是设置。
export function SidebarNav({ projects }: { projects: ProjectNav[] }) {
  const pathname = usePathname();
  const match = pathname.match(/^\/briefs\/([^/]+)(?:\/([^/]+))?/);
  const activeId = match?.[1];
  const link = (href: string, label: React.ReactNode, className = "") => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return <Link href={href} className={`${className} ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>{label}</Link>;
  };

  return (
    <nav className="nav" aria-label="导航">
      <div className="nav-top">
        {link("/", <><span className="nav-icon" aria-hidden="true">▦</span>全部项目</>)}
        {link("/assets", <><span className="nav-icon" aria-hidden="true">▤</span>资产库</>)}
      </div>

      <div className="nav-projects">
        <div className="nav-group-row">
          <span className="nav-group">项目</span>
          <Link href="/new" className={`nav-add ${pathname === "/new" ? "is-active" : ""}`} aria-label="新建项目" title="新建项目">＋</Link>
        </div>
        {projects.length === 0 && <Link href="/new" className="nav-empty">还没有项目，点这里新建</Link>}
        <ul className="project-list">
          {projects.map((project) => {
            const open = project.id === activeId;
            const activeStep = (open ? (match?.[2] as StepKey | undefined) : undefined) || project.current;
            return (
              <li key={project.id} className={open ? "is-open" : undefined}>
                <Link href={`/briefs/${project.id}`} className={`project-link ${open ? "is-active" : ""} ${project.finished ? "is-finished" : ""}`} title={project.title}>
                  <span className="project-dot" aria-hidden="true">{project.finished ? check : null}</span>
                  <span className="project-title">{project.title}</span>
                </Link>
                {open && (
                  <ol className="project-steps">
                    {steps.map((step, index) => {
                      const done = Boolean(project.done[step.key]);
                      const active = activeStep === step.key;
                      const state = done ? "is-done" : step.key === project.current ? "is-current" : "";
                      return (
                        <li key={step.key}>
                          <Link href={`/briefs/${project.id}/${step.key}`} className={`${state} ${active ? "is-active" : ""}`} aria-current={active ? "step" : undefined}>
                            <span className="step-dot" aria-hidden="true">{done ? check : String(index + 1).padStart(2, "0")}</span>
                            <span className="step-text"><span>{step.label}</span><small>{step.hint}</small></span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="nav-settings">
        <span className="nav-group">设置</span>
        <ThemeToggle />
        {link("/roles", "评审角色")}
        {link("/rules", "品牌规则", "is-quiet")}
        {link("/settings", "模型与密钥", "is-quiet")}
      </div>
    </nav>
  );
}
