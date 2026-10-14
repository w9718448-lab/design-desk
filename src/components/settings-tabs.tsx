"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/settings", label: "外观与模型" },
  { href: "/roles", label: "评审角色" },
  { href: "/rules", label: "品牌规则" },
];

// 设置里的几个分页：外观（深浅色）和模型密钥、评审角色、品牌规则。
export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="settings-tabs" aria-label="设置分类">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={pathname.startsWith(tab.href) ? "is-on" : undefined} aria-current={pathname.startsWith(tab.href) ? "page" : undefined}>{tab.label}</Link>
      ))}
    </nav>
  );
}
