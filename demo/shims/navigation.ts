import { useSyncExternalStore } from "react";
import { current, DemoNotFound, DemoRedirect, navigate, subscribe } from "./router";

export function usePathname() {
  return useSyncExternalStore(subscribe, () => current().path, () => "/");
}
export function useSearchParams() {
  const hash = useSyncExternalStore(subscribe, () => location.hash, () => "");
  return new URLSearchParams(hash.split("?")[1] || "");
}
export function useRouter() {
  return { push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), refresh: () => undefined, back: () => history.back() };
}
export function redirect(path: string): never { throw new DemoRedirect(path); }
export function notFound(): never { throw new DemoNotFound(); }
