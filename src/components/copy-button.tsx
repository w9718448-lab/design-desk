"use client";

import { useState } from "react";
import { Icon } from "./icons";

export function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`icon-button ${done ? "is-on" : ""}`}
      title={done ? "已复制" : label}
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      <Icon name={done ? "check" : "copy"} />
    </button>
  );
}
