"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "需求", match: (path: string) => path === "/" || path.startsWith("/briefs") },
  { href: "/rules", label: "品牌规则", match: (path: string) => path.startsWith("/rules") },
  { href: "/settings", label: "设置", match: (path: string) => path.startsWith("/settings") },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="导航">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={item.match(pathname) ? "is-active" : undefined} aria-current={item.match(pathname) ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
