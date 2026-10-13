"use client";

import { useActionState } from "react";
import { runReview, type ReviewState } from "@/app/actions";
import type { Draft, Role } from "@/lib/types";
import { Submit } from "./submit";

export function ReviewForm({ briefId, aiReady, drafts, roles }: { briefId: string; aiReady: boolean; drafts: Draft[]; roles: Role[] }) {
  const [state, action] = useActionState<ReviewState, FormData>(runReview, {});
  return (
    <form action={action} className="review-form">
      <input type="hidden" name="briefId" value={briefId} />
      <fieldset className="draft-pick">
        <legend>评审哪一版</legend>
        {drafts.map((draft, index) => (
          <label key={draft.id} className="draft-option">
            <input type="radio" name="draftId" value={draft.id} defaultChecked={index === 0} />
            <img src={`/api/uploads/${draft.image}`} alt="" />
            <span>{draft.version}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="roles">
        <legend>请谁来看</legend>
        {roles.map((role) => (
          <label key={role.key} className="role-check">
            <input type="checkbox" name={`role-${role.key}`} defaultChecked />
            <span><strong>{role.label}</strong><small>{role.focus}</small></span>
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>补充说明（可选）</span>
        <input id="review-note" name="note" placeholder="例：主标题还没定，先看构图和配色" />
      </label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="form-actions">
        <Submit pendingText={aiReady ? "评审中，大约半分钟…" : "生成中…"}>{aiReady ? "开始评审" : "生成检查清单"}</Submit>
        <small className="muted">{aiReady ? "图片会发给千问视觉模型做评审；稿件文件只保存在这台电脑上。" : "还没配置千问：会按品牌规则、需求卡和角色关注点生成检查清单，由你逐条判断。"}</small>
      </div>
    </form>
  );
}
