import { SettingsTabs } from "@/components/settings-tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { saveImageSettings, saveKey } from "@/app/actions";
import { Submit } from "@/components/submit";
import { modelStatus, providers } from "@/lib/ai";
import { dataDir, readStore } from "@/lib/store";
import { imageProviderIds, imageProviders, imageSettingsOf } from "@/lib/image-models";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const status = await modelStatus();
  const imageSettings = imageSettingsOf(readStore().imageSettings);
  const isMac = process.platform === "darwin";
  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Settings · 设置</span>
        <h1>外观与模型</h1>
        <p className="muted">不配置模型也能用：需求卡按本地规则整理，评审生成检查清单。配上千问后，能自动看图评审，还能用通义万相生成效果图。</p>
      </header>
      <SettingsTabs />
      <section className="panel">
        <div className="panel-head">
          <div className="panel-title">
            <h2>界面</h2>
            <small className="muted">深色或浅色，选好后会记住。</small>
          </div>
          <div className="theme-slot"><ThemeToggle /></div>
        </div>
      </section>
      <section className="panel">
        <h2>文字与看图模型</h2>
        <ul className="settings-list">
          {(Object.keys(providers) as Array<keyof typeof providers>).map((id) => (
            <li key={id}>
              <div>
                <strong>{providers[id].name}</strong>
                <small className="muted">{id === "qwen" ? "整理需求 + 看图评审 + 通义万相生图（推荐，国内直连，新用户有免费额度）" : "只能整理需求，不能看图"}</small>
              </div>
              <span className={`chip ${status[id] ? "ok" : ""}`}>{status[id] ? "已配置" : "未配置"}</span>
              {(
                <form action={saveKey} className="key-form">
                  <input type="hidden" name="provider" value={id} />
                  <input type="password" name="key" placeholder="粘贴 API Key" autoComplete="off" />
                  <Submit className="button small" name="intent" value="save">保存</Submit>
                  {status[id] && <Submit className="link-button danger" name="intent" value="remove">移除</Submit>}
                </form>
              )}
            </li>
          ))}
        </ul>
        <small className="muted">
          {isMac
            ? "密钥保存在这台 Mac 的钥匙串里，和上等马共用；在上等马里配过的，这里会自动显示“已配置”。不要把密钥发给任何人。"
            : "密钥只保存在这台电脑的“文档/设计台数据”文件夹里（模型密钥.json），不会上传。不要把密钥或这个文件发给任何人。"}
        </small>
      </section>
      <section className="panel" id="image-models">
        <div className="panel-title">
          <h2>生图模型</h2>
          <small className="muted">“出稿 → 生成效果图”用的模型。按张计费，费用走你自己的账号。</small>
        </div>
        <ul className="settings-list">
          <li>
            <div>
              <strong>{imageProviders.tongyi.name}</strong>
              <small className="muted">{imageProviders.tongyi.note}</small>
            </div>
            <span className={`chip ${status.qwen ? "ok" : ""}`}>{status.qwen ? "已配置（千问 Key）" : "填上面的千问 Key 即可"}</span>
          </li>
          {imageProviderIds.filter((id) => id !== "tongyi").map((id) => {
            const secret = imageProviders[id].secret;
            return (
              <li key={id}>
                <div>
                  <strong>{imageProviders[id].name}</strong>
                  <small className="muted">{imageProviders[id].note}</small>
                </div>
                <span className={`chip ${status[secret] ? "ok" : ""}`}>{status[secret] ? "已配置" : "未配置"}</span>
                <form action={saveKey} className="key-form">
                  <input type="hidden" name="provider" value={secret} />
                  <input type="password" name="key" placeholder={`粘贴${imageProviders[id].keyHint}`} autoComplete="off" />
                  <Submit className="button small" name="intent" value="save">保存</Submit>
                  {status[secret] && <Submit className="link-button danger" name="intent" value="remove">移除</Submit>}
                </form>
              </li>
            );
          })}
        </ul>
        <form action={saveImageSettings} className="image-settings">
          <fieldset>
            <legend>默认用哪个</legend>
            <div className="radio-row">
              {imageProviderIds.map((id) => (
                <label key={id} className="radio-pill">
                  <input type="radio" name="provider" value={id} defaultChecked={imageSettings.provider === id} />
                  <span>{imageProviders[id].name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="model-grid">
            {imageProviderIds.map((id) => (
              <label key={id} className="field">
                <span>{imageProviders[id].name} 模型名</span>
                <input id={`model-${id}`} name={`model-${id}`} defaultValue={imageSettings.models[id] || imageProviders[id].model} placeholder={imageProviders[id].model} autoComplete="off" spellCheck={false} />
              </label>
            ))}
          </div>
          <div className="form-actions">
            <Submit className="button small">保存生图设置</Submit>
            <small className="muted">各家出了新模型，把模型名改成新的就行；清空就恢复默认。</small>
          </div>
        </form>
      </section>
      <section className="panel">
        <h2>数据</h2>
        <p>所有需求、规则、评审记录和稿件图片都保存在：</p>
        <pre className="draft">{dataDir()}</pre>
        <small className="muted">每次保存前会自动备份上一份（design-desk.json.bak）。换电脑时整个文件夹复制过去即可。</small>
      </section>
    </>
  );
}
