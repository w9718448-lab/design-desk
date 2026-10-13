"use client";

import { useActionState, useRef } from "react";
import type { UploadState } from "@/app/actions";
import { Submit } from "./submit";

type Props = {
  action: (state: UploadState, form: FormData) => Promise<UploadState>;
  multiple?: boolean;
  hidden?: Record<string, string>;
  withVersion?: boolean;
  label: string;
  pendingText: string;
  hint?: string;
};

export function UploadForm({ action, multiple, hidden = {}, withVersion, label, pendingText, hint }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<UploadState, FormData>(async (previous, form) => {
    const result = await action(previous, form);
    if (!result.error) formRef.current?.reset();
    return result;
  }, {});
  return (
    <form ref={formRef} action={formAction} className="upload-form">
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <div className={withVersion ? "form-row" : undefined}>
        <label className="field grow">
          <span>{multiple ? "选择图片（可多选）" : "稿件图片"}</span>
          <input id={multiple ? "asset-files" : "draft-file"} type="file" name={multiple ? "images" : "image"} accept=".png,.jpg,.jpeg,.webp" multiple={multiple} required />
        </label>
        {withVersion && (
          <label className="field">
            <span>版本名</span>
            <input id="draft-version" name="version" placeholder="例：第 2 版" />
          </label>
        )}
      </div>
      {withVersion && (
        <label className="field">
          <span>这一版改了什么（可选）</span>
          <input id="draft-note" name="note" placeholder="例：主标题放大，换成方向 A 的暖光" />
        </label>
      )}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.message && <p className="form-ok" role="status">{state.message}</p>}
      <div className="form-actions">
        <Submit pendingText={pendingText}>{label}</Submit>
        {hint && <small className="muted">{hint}</small>}
      </div>
    </form>
  );
}
