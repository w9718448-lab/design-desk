"use client";

import { useFormStatus } from "react-dom";

export function Submit({ children, pendingText, className = "button primary", name, value }: { children: React.ReactNode; pendingText?: string; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} name={name} value={value}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
