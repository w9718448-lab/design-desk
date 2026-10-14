import "../src/app/globals.css";
import "./demo.css";
import { cloneElement, createElement, Fragment, isValidElement, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SidebarNav } from "@/components/sidebar-nav";
import { currentStep, readStore, stageOf } from "@/lib/store";
import { clientComponents } from "./shims/client-mark";
import { current, DemoNotFound, DemoRedirect, navigate, subscribe } from "./shims/router";
import { seed } from "./seed";
import Home from "@/app/page";
import NewPage from "@/app/new/page";
import AssetsPage from "@/app/assets/page";
import HistoryPage from "@/app/history/page";
import SettingsPage from "@/app/settings/page";
import RolesPage from "@/app/roles/page";
import RulesPage from "@/app/rules/page";
import BriefIndex from "@/app/briefs/[id]/page";
import StepPage from "@/app/briefs/[id]/[step]/page";

seed();
(window as unknown as { __dd: unknown }).__dd = { readStore };

type Page = (props: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> }) => unknown;
const routes: Array<[RegExp, Page, string[]]> = [
  [/^\/$/, Home  as unknown as Page, []],
  [/^\/new$/, NewPage  as unknown as Page, []],
  [/^\/assets$/, AssetsPage  as unknown as Page, []],
  [/^\/history$/, HistoryPage  as unknown as Page, []],
  [/^\/settings$/, SettingsPage  as unknown as Page, []],
  [/^\/roles$/, RolesPage  as unknown as Page, []],
  [/^\/rules$/, RulesPage  as unknown as Page, []],
  [/^\/briefs\/([^/]+)$/, BriefIndex  as unknown as Page, ["id"]],
  [/^\/briefs\/([^/]+)\/([^/]+)$/, StepPage  as unknown as Page, ["id", "step"]],
];

// 像服务器那样先把页面里的服务端组件（含 async 组件）算成普通元素，再交给 React。
async function resolve(node: unknown): Promise<unknown> {
  if (Array.isArray(node)) return Promise.all(node.map(resolve));
  if (!isValidElement(node)) return node;
  const type = node.type as unknown;
  const props = node.props as Record<string, unknown>;
  if (typeof type === "function" && !clientComponents.has(type) && !(type as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent) {
    const output = await (type as (p: unknown) => unknown)(props);
    return createElement(Fragment, { key: node.key ?? undefined }, (await resolve(output)) as ReactNode);
  }
  const next: Record<string, unknown> = {};
  let changed = false;
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || isValidElement(value) || (Array.isArray(value) && value.some(isValidElement))) {
      next[key] = await resolve(value);
      changed = true;
    }
  }
  return changed ? cloneElement(node, next) : node;
}

async function build(): Promise<ReactNode> {
  for (let hop = 0; hop < 5; hop++) {
    const { path, query } = current();
    const route = routes.find(([pattern]) => pattern.test(path));
    try {
      if (!route) throw new DemoNotFound();
      const match = path.match(route[0])!;
      const params = Object.fromEntries(route[2].map((name, index) => [name, decodeURIComponent(match[index + 1])]));
      const page = await route[1]({ params: Promise.resolve(params), searchParams: Promise.resolve(Object.fromEntries(query)) });
      return (await resolve(page)) as ReactNode;
    } catch (error) {
      if (error instanceof DemoRedirect) { navigate(error.path, true); continue; }
      if (error instanceof DemoNotFound) return <div className="empty">找不到这个页面。<a href="#/">回到全部项目</a></div>;
      throw error;
    }
  }
  return null;
}

function Shell({ children }: { children: ReactNode }) {
  const projects = readStore().briefs
    .map((brief) => ({ deleted: Boolean(brief.deletedAt), id: brief.id, title: brief.title, done: brief.stepsDone, current: currentStep(brief), finished: stageOf(brief) === "完成" }))
    .sort((a, b) => Number(a.finished) - Number(b.finished));
  return (
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
      <main className="main">
        <div className="demo-banner" role="note">
          <strong>展示版</strong>
          <span>可以随便点、随便改。内容只存在这个页面里，刷新或关掉就恢复成示例，不会留下任何数据。</span>
          <button type="button" className="link-button" onClick={() => { location.hash = "#/"; location.reload(); }}>恢复示例</button>
        </div>
        {children}
      </main>
    </div>
  );
}

function App() {
  const [tree, setTree] = useState<ReactNode>(null);
  useEffect(() => {
    let run = 0;
    const render = () => {
      const mine = ++run;
      build().then((next) => { if (mine === run) setTree(next); }, (error) => { console.error(error); if (mine === run) setTree(<div className="form-error">出了点问题：{String(error?.message || error)}</div>); });
    };
    render();
    return subscribe(render);
  }, []);
  return <Shell>{tree}</Shell>;
}

// 页面里普通的 <a href="/..."> 和 GET 表单（例如资产库搜索）也改走 # 路由。
document.addEventListener("click", (event) => {
  const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
  if (!link) return;
  const href = link.getAttribute("href") || "";
  if (href === "/api/skill") { event.preventDefault(); window.alert("展示版不导出文件。装到自己电脑上的设计台可以把品牌规则导出成 Skill。"); return; }
  if (href.startsWith("/") && !link.target) { event.preventDefault(); navigate(href); }
});
document.addEventListener("submit", (event) => {
  const form = event.target as HTMLFormElement;
  const action = form.getAttribute("action");
  if (!action || !action.startsWith("/")) return;
  event.preventDefault();
  const query = new URLSearchParams();
  new FormData(form).forEach((value, key) => { if (typeof value === "string" && value) query.set(key, value); });
  navigate(`${action}${query.size ? `?${query}` : ""}`);
});

createRoot(document.getElementById("root")!).render(<App />);
