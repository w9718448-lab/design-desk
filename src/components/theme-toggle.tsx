"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const sun = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
const moon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></svg>;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const choose = (next: Theme) => {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("dd-theme", next); } catch {}
    setTheme(next);
  };
  return (
    <div className="theme-toggle" role="group" aria-label="外观">
      <button type="button" className={theme === "dark" ? "is-on" : undefined} aria-pressed={theme === "dark"} onClick={() => choose("dark")}>{moon}深色</button>
      <button type="button" className={theme === "light" ? "is-on" : undefined} aria-pressed={theme === "light"} onClick={() => choose("light")}>{sun}浅色</button>
    </div>
  );
}
