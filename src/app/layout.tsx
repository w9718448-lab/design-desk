import type { Metadata } from "next";
import "./globals.css";
import { SidebarNav } from "@/components/sidebar-nav";
import { currentStep, readStore, stageOf } from "@/lib/store";

export const metadata: Metadata = { title: "设计台", description: "个人品牌设计工作流" };
export const dynamic = "force-dynamic";

// 首次打开跟随系统外观，之后记住你的选择；在页面渲染前设置，避免闪一下白屏。
const themeScript = `try{var t=localStorage.getItem("dd-theme");if(t!=="dark"&&t!=="light"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // 进行中的项目排前面，做完的排后面。
  const projects = readStore().briefs
    .map((brief) => ({ id: brief.id, title: brief.title, done: brief.stepsDone, current: currentStep(brief), finished: stageOf(brief) === "完成" }))
    .sort((a, b) => Number(a.finished) - Number(b.finished));
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="#fff"><path d="M12 1.5c.6 4.9 2.9 8.1 9 10.5-6.1 2.4-8.4 5.6-9 10.5-.6-4.9-2.9-8.1-9-10.5 6.1-2.4 8.4-5.6 9-10.5Z" /></svg>
              </span>
              <span className="brand-copy"><strong>设计台</strong><small>DESIGN DESK</small></span>
            </div>
            <SidebarNav projects={projects} />
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
