import { reopenStep, saveDelivery } from "@/app/actions";
import { Submit } from "@/components/submit";
import { CopyButton } from "@/components/copy-button";
import { FileThumb } from "@/components/file-thumb";
import Link from "next/link";
import type { Brief, Store } from "@/lib/types";
import { fileUrl } from "@/lib/file-url";

const standardChecks = [
  "终稿文案已经由需求方确认",
  "Logo 使用官方文件，没有变形和改色",
  "尺寸、出血、分辨率与物料要求一致",
  "导出格式符合交付方式（印刷 PDF / 线上 PNG / 源文件）",
  "源文件和导出图已按命名规则归档",
];

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date()).replaceAll("-", "");
}

export function DeliveryStep({ store, brief }: { store: Store; brief: Brief }) {
  const drafts = store.drafts.filter((draft) => draft.briefId === brief.id);
  const ruleChecks = store.rules.filter((rule) => rule.layer === "guide").map((rule) => `规则：${rule.text}`);
  const checks = [...standardChecks, ...ruleChecks];
  const final = drafts.find((draft) => draft.id === brief.finalDraftId) || drafts[0];
  const sizeText = `${brief.fields.deliverables.value} ${brief.raw}`;
  const size = sizeText.match(/\d{2,5}\s*[×xX*]\s*\d{2,5}/)?.[0].replace(/\s*[xX*]\s*/, "×") || brief.fields.deliverables.value.split(/[；;，,]/)[0]?.trim() || "尺寸";
  const fileName = `${today()}_${brief.title.replace(/[\\/:*?"<>|\s]+/g, "")}_${size.replace(/[\\/:*?"<>|\s]+/g, "")}_${final ? final.version.replace(/\s+/g, "") : "终稿"}`;
  const done = Boolean(brief.stepsDone.delivery);
  const archived = store.assets.find((asset) => asset.id === brief.finalAssetId);
  const checked = new Set(brief.deliveryChecks);

  return (
    <form key={brief.updatedAt} action={saveDelivery} className="stack">
      <input type="hidden" name="id" value={brief.id} />
      <section className="panel">
        <h2>选定终稿</h2>
        <p className="muted">评审不一定人人满意，最后用哪一版由你决定。</p>
        {drafts.length === 0 ? <p className="muted">还没有稿件版本。</p> : (
          <fieldset className="draft-pick">
            <legend className="sr-only">终稿</legend>
            {drafts.map((draft) => (
              <label key={draft.id} className="draft-option">
                <input type="radio" name="finalDraftId" value={draft.id} defaultChecked={draft.id === final?.id} />
                <FileThumb src={fileUrl("uploads", draft.image)} kind={draft.kind} name={draft.imageName} />
                <span>{draft.version}</span>
              </label>
            ))}
          </fieldset>
        )}
      </section>

      <div className="two-col even">
        <section className="panel">
          <div className="panel-head">
            <h2>交付核对</h2>
            <small className="muted">{checks.filter((item) => checked.has(item)).length} / {checks.length}</small>
          </div>
          <ul className="check-list">
            {checks.map((item, index) => (
              <li key={item}>
                <label className="inline-check big">
                  <input id={`check-${index}`} type="checkbox" name="checks" value={item} defaultChecked={checked.has(item)} />
                  <span>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
        <div className="side">
          <section className="panel">
            <div className="panel-head">
              <h2>建议文件名</h2>
              <CopyButton text={fileName} />
            </div>
            <pre className="draft mono">{fileName}</pre>
            <small className="muted">格式：日期_项目_尺寸_版本。导出 PDF、PNG 和源文件时用同一个名字。</small>
          </section>
          <section className="panel">
            <h2>复盘</h2>
            <textarea id="retro" name="retro" rows={5} defaultValue={brief.retro} placeholder={"两三句就好：\n这次哪里做得顺？哪里卡住了？下次同类需求先做什么？"} />
          </section>
        </div>
      </div>

      <div className="step-foot">
        <div className="step-foot-row">
          <Submit className="button" name="intent" value="save" pendingText="保存中…">保存</Submit>
          {done
            ? <span className="chip ok">项目已完成</span>
            : <Submit name="intent" value="finish" pendingText="存档中…">交付完成，终稿存进资产库 ✓</Submit>}
          {done && archived && <Link className="link-button" href={`/assets?folder=own`}>终稿已存进资产库“我的作品” →</Link>}
          {done && <Submit className="link-button" formAction={reopenStep}>改回进行中</Submit>}
          <input type="hidden" name="step" value="delivery" />
        </div>
      </div>
    </form>
  );
}
