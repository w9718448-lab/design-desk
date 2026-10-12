"use client";

import { useActionState, useRef } from "react";
import { runReview, type ReviewState } from "@/app/actions";
import { reviewRoles } from "@/lib/types";
import { Submit } from "./submit";

export function ReviewForm({ briefId, aiReady }: { briefId: string; aiReady: boolean }) {
  const [state, action] = useActionState<ReviewState, FormData>(async (previous, form) => {
    const result = await runReview(previous, form);
    if (!result.error) formRef.current?.reset();
    return result;
  }, {});
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="review-form">
      <input type="hidden" name="briefId" value={briefId} />
      <div className="form-row">
        <label className="field grow">
          <span>稿件图片</span>
          <input type="file" name="image" accept=".png,.jpg,.jpeg,.webp" required />
        </label>
        <label className="field">
          <span>版本名</span>
          <input name="version" placeholder="例：第 2 版" />
        </label>
      </div>
      <fieldset className="roles">
        <legend>请谁来看</legend>
        {reviewRoles.map((role) => (
          <label key={role.key} className="role-check">
            <input type="checkbox" name={`role-${role.key}`} defaultChecked />
            <span><strong>{role.label}</strong><small>{role.focus}</small></span>
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>补充说明（可选）</span>
        <input name="note" placeholder="例：主标题还没定，先看构图和配色" />
      </label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="form-actions">
        <Submit pendingText={aiReady ? "评审中，大约半分钟…" : "生成中…"}>{aiReady ? "开始评审" : "生成检查清单"}</Submit>
        <small className="muted">{aiReady ? "图片会发给千问视觉模型做评审；稿件文件只保存在这台电脑上。" : "还没配置千问：会按品牌规则和需求卡生成检查清单，由你对照稿子逐条判断。"}</small>
      </div>
    </form>
  );
}
