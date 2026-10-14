"use client";

import { startTransition, useActionState, useState } from "react";
import { generateDrafts, type GenState } from "@/app/actions";
import type { ImageProviderId } from "@/lib/types";
import { aspects, type Aspect } from "@/lib/image-models";

export type GenProvider = { id: ImageProviderId; name: string; model: string; ready: boolean };
export type GenRef = { value: string; src: string; label: string; tag: string };

export function ImageGenForm({ briefId, providers, defaultProvider, prompt, aspect, refs }: { briefId: string; providers: GenProvider[]; defaultProvider: ImageProviderId; prompt: string; aspect: Aspect; refs: GenRef[] }) {
  const [state, action, pending] = useActionState<GenState, FormData>(generateDrafts, {});
  const ready = providers.filter((provider) => provider.ready);
  const first = ready.find((provider) => provider.id === defaultProvider) || ready[0];
  // 用 onSubmit 自己提交：React 的 form action 提交后会重置表单，选好的模型、画幅会跳回默认值。
  const [choice, setChoice] = useState({ provider: first?.id || defaultProvider, aspect: aspect as string, count: "2", prompt });
  // 参考图默认勾上（固定参考除外）；只记住手动改过的，新加进卡片的图也会默认勾上。
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const isOn = (ref: GenRef) => manual[ref.value] ?? ref.tag !== "固定";
  const set = (key: keyof typeof choice) => (event: { target: { value: string } }) => setChoice((current) => ({ ...current, [key]: event.target.value }));
  if (!first) {
    return (
      <div className="gen-empty">
        <p>还没有可用的生图模型。到 <a href="/settings">设置 → 模型</a> 里填一个 Key：通义万相用千问的 Key 就行，豆包和 GPT 各自一把。</p>
      </div>
    );
  }
  return (
    <form className="gen-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); startTransition(() => action(form)); }}>
      <input type="hidden" name="briefId" value={briefId} />
      <div className="form-row">
        <label className="field">
          <span>模型</span>
          <select id="gen-provider" name="provider" value={choice.provider} onChange={set("provider")}>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id} disabled={!provider.ready}>
                {provider.name}（{provider.model}）{provider.ready ? "" : " · 未配置"}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>画幅</span>
          <select id="gen-aspect" name="aspect" value={choice.aspect} onChange={set("aspect")}>
            {aspects.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>张数</span>
          <select id="gen-count" name="count" value={choice.count} onChange={set("count")}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>提示词（来自设计卡片，可以直接改）</span>
        <textarea id="gen-prompt" name="prompt" rows={6} value={choice.prompt} onChange={set("prompt")} />
      </label>
      {refs.length > 0 && (
        <fieldset className="gen-refs">
          <legend>一起发给模型的参考图</legend>
          <div className="gen-ref-list">
            {refs.map((ref) => (
              <label key={ref.value} className="gen-ref" title={ref.label}>
                <input type="checkbox" name="ref" value={ref.value} checked={isOn(ref)} onChange={() => setManual((current) => ({ ...current, [ref.value]: !isOn(ref) }))} />
                <img src={ref.src} alt={ref.label} loading="lazy" />
                <small>{ref.tag}</small>
              </label>
            ))}
          </div>
          <small className="muted">Logo 这类固定参考默认不发：生图模型画不准 Logo，之后在设计软件里放正版更稳。</small>
        </fieldset>
      )}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.message && <p className="form-ok" role="status">{state.message}</p>}
      <div className="form-actions">
        <button className="button primary" type="submit" disabled={pending}>{pending ? "生成中，通常要半分钟到两分钟…" : "生成效果图"}</button>
        <small className="muted">按张计费，费用走你自己的账号。提示词和勾选的参考图会发给所选模型，生成的图只存在这台电脑上。</small>
      </div>
    </form>
  );
}
