"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { steps, type StepKey } from "@/lib/types";

export type ProjectNav = { id: string; title: string; done: Partial<Record<StepKey, boolean>>; current: StepKey };

const shared = [
  { href: "/assets", label: "资产库" },
  { href: "/rules", label: "品牌规则" },
  { href: "/roles", label: "评审角色" },
  { href: "/settings", label: "设置" },
];

const check = <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export function SidebarNav({ projects }: { projects: ProjectNav[] }) {
  const pathname = usePathname();
  const match = pathname.match(/^\/briefs\/([^/]+)(?:\/([^/]+))?/);
  const project = match ? projects.find((item) => item.id === match[1]) : undefined;
  const activeStep = (match?.[2] as StepKey | undefined) || project?.current;
  return (
    <nav className="nav" aria-label="导航">
      <Link href="/" className={pathname === "/" ? "is-active" : undefined} aria-current={pathname === "/" ? "page" : undefined}>
        <span className="nav-icon" aria-hidden="true">▦</span>全部项目
      </Link>

      {project && (
        <div className="project-steps">
          <span className="nav-group">当前项目</span>
          <strong className="project-name" title={project.title}>{project.title}</strong>
          <ol>
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
        </div>
      )}

      <span className="nav-group">共用</span>
      {shared.map((item) => {
        const active = pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>{item.label}</Link>;
      })}
    </nav>
  );
}
