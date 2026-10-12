import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = { title: "设计台", description: "个人品牌设计工作流" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand"><strong>设计台</strong><small>需求、规则、评审</small></div>
            <Nav />
            <div className="boundary">
              <strong>分工</strong>
              <p>AI：整理需求、找漏项、按规则挑问题。</p>
              <p>你：去问人、做判断、改稿、对外发送。</p>
              <p className="muted">数据只存在这台电脑上。</p>
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
