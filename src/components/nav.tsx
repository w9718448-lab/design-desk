"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", index: "01", label: "需求", match: (path: string) => path === "/" || path.startsWith("/briefs") },
  { href: "/rules", index: "02", label: "品牌规则", match: (path: string) => path.startsWith("/rules") },
  { href: "/settings", index: "03", label: "设置", match: (path: string) => path.startsWith("/settings") },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="导航">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={item.match(pathname) ? "is-active" : undefined} aria-current={item.match(pathname) ? "page" : undefined}>
          <span className="index">{item.index}</span>{item.label}
        </Link>
      ))}
    </nav>
  );
}
