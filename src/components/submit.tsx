"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  name?: string;
  value?: string;
  formAction?: (form: FormData) => void | Promise<void>;
  title?: string;
};

export function Submit({ children, pendingText, className = "button primary", name, value, formAction, title }: Props) {
  const { pending, data } = useFormStatus();
  // 同一个表单里有几个按钮时，只让被点的那个显示“保存中…”。
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button className={className} type="submit" disabled={pending} name={name} value={value} formAction={formAction} title={title} aria-label={title}>
      {mine && pendingText ? pendingText : children}
    </button>
  );
}
