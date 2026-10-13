"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import type { UploadState } from "@/app/actions";

type Props = {
  action: (state: UploadState, form: FormData) => Promise<UploadState>;
  hidden?: Record<string, string>;
  multiple?: boolean;
  accept?: string;
  title: string;
  hint?: string;
  busyText?: string;
  children?: React.ReactNode;
};

// 拖进框里或点框选择，松手就上传；框上方可以放版本名等可选字段。
export function Dropzone({ action, hidden = {}, multiple, accept, title, hint, busyText = "上传中…", children }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, formAction] = useActionState<UploadState, FormData>(async (previous, form) => {
    const result = await action(previous, form);
    if (!result.error) formRef.current?.reset();
    return result;
  }, {});

  const submit = (files: FileList | null) => {
    if (!files?.length || !formRef.current) return;
    const form = new FormData(formRef.current);
    form.delete("files");
    for (const file of Array.from(files).slice(0, multiple ? 50 : 1)) form.append("files", file);
    startTransition(() => formAction(form));
  };

  return (
    <form ref={formRef} className="dropzone-form" onSubmit={(event) => event.preventDefault()}>
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      <label
        className={`dropzone ${over ? "is-over" : ""} ${pending ? "is-busy" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => { event.preventDefault(); setOver(false); submit(event.dataTransfer.files); }}
      >
        <input ref={inputRef} type="file" name="files" accept={accept} multiple={multiple} className="sr-only" onChange={(event) => submit(event.target.files)} disabled={pending} />
        <span className="dropzone-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
        </span>
        <strong>{pending ? busyText : title}</strong>
        {hint && <small className="muted">{hint}</small>}
      </label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.message && !pending && <p className="form-ok" role="status">{state.message}</p>}
    </form>
  );
}
