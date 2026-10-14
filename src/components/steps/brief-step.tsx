import { addBackground, deleteBrief, deleteBriefRef, reparseBrief, uploadBriefRefs } from "@/app/actions";
import { BriefCard } from "@/components/brief-card";
import { Dropzone } from "@/components/dropzone";
import { FileThumb } from "@/components/file-thumb";
import { Icon } from "@/components/icons";
import { Submit } from "@/components/submit";
import { modelStatus } from "@/lib/ai";
import { briefFields, type Brief, type Store } from "@/lib/types";
import { fileUrl } from "@/lib/file-url";

export async function BriefStep({ brief }: { store: Store; brief: Brief }) {
  const status = await modelStatus();
  const aiReady = status.qwen || status.deepseek;
  const known = briefFields.filter((field) => brief.fields[field.key].status !== "ask" && brief.fields[field.key].value).length;
  return (
    <>
      <section className="panel feature">
        <div className="panel-head">
          <h2>补充项目背景</h2>
          <form action={reparseBrief}>
            <input type="hidden" name="id" value={brief.id} />
            <Submit className="icon-button" title="用全部背景重新识别一遍" pendingText="…"><Icon name="refresh" /></Submit>
          </form>
        </div>
        <form key={brief.updatedAt} action={addBackground} className="stack">
          <input type="hidden" name="id" value={brief.id} />
          <textarea id="background" name="background" rows={4} required placeholder={"想到什么写什么，可以是一整段品牌理念，模糊的也没关系，例如：\n客户说想要年轻一点，可能还要出一版竖版，时间大概在月底。"} />
          <div className="form-actions">
            <Submit pendingText="识别中…">识别并补进需求卡</Submit>
            <small className="muted">{aiReady ? "AI 会把新信息补进还没定的项；你已经确定的内容不会被改。" : "还没配置模型：按本地规则识别。配上千问后，长段背景会被概括得更准。"}</small>
          </div>
        </form>
        <details className="raw-text">
          <summary>已输入的全部背景</summary>
          <pre className="draft">{brief.raw}</pre>
        </details>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>需求卡</h2>
          <small className="muted">{known} 项已有内容 · {briefFields.length - known} 项待确定</small>
        </div>
        <BriefCard brief={brief} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <div className="panel-title">
            <h2>固定参考</h2>
            <small className="muted">已经确定要用的 Logo、产品图、指定素材，先放在这里，出稿时会进设计卡片。</small>
          </div>
        </div>
        {brief.refs.length > 0 && (
          <div className="ref-strip">
            {brief.refs.map((ref) => (
              <figure key={ref.id} className="ref-chip">
                <a href={fileUrl("uploads", ref.file)} target="_blank" className="asset-thumb"><FileThumb src={fileUrl("uploads", ref.file)} kind={ref.kind} name={ref.name} /></a>
                <figcaption>
                  <span title={ref.name}>{ref.name}</span>
                  <form action={deleteBriefRef}>
                    <input type="hidden" name="id" value={brief.id} />
                    <input type="hidden" name="refId" value={ref.id} />
                    <Submit className="icon-button danger" title="移除"><Icon name="x" size={14} /></Submit>
                  </form>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <Dropzone action={uploadBriefRefs} hidden={{ briefId: brief.id }} multiple title="把 Logo 或确定的参考图拖到这里" hint="图片、PDF、AI、SVG 都可以" />
      </section>

      <details className="danger-zone">
        <summary>删除这个项目</summary>
        <form action={deleteBrief}>
          <input type="hidden" name="id" value={brief.id} />
          <p className="muted">项目会移到“历史项目 · 已删除”，在那里可以恢复，或者彻底删除。</p>
          <Submit className="button danger">确认删除</Submit>
        </form>
      </details>
    </>
  );
}
