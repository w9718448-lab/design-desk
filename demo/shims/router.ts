// 展示版用地址栏 # 后面的部分当页面路径，这样放在任何静态网站上都能打开。
const listeners = new Set<() => void>();
export const emit = () => listeners.forEach((listener) => listener());
export const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function current() {
  const hash = decodeURI(location.hash.slice(1)) || "/";
  const [path, query = ""] = hash.split("?");
  return { path: path || "/", query: new URLSearchParams(query) };
}

export function navigate(href: string, replace = false) {
  const url = `#${href}`;
  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  if (!replace) window.scrollTo(0, 0);
  emit();
}

if (typeof window !== "undefined") window.addEventListener("popstate", emit);

export class DemoRedirect extends Error { constructor(public path: string) { super(`redirect ${path}`); } }
export class DemoNotFound extends Error {}
