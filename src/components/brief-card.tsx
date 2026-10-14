import { saveBriefCard } from "@/app/actions";
import { Submit } from "@/components/submit";
import { briefFields, type Brief } from "@/lib/types";

export const statusLabel = { confirmed: "已确定", inferred: "大致", ask: "待确定" } as const;

// 需求卡只摆出已经有内容的项；还没定的收在下面，可以先不管，想到了再填。
export function BriefCard({ brief }: { brief: Brief }) {
  const known = briefFields.filter((field) => brief.fields[field.key].status !== "ask" && brief.fields[field.key].value);
  const open = briefFields.filter((field) => !known.includes(field));
  const row = (field: typeof briefFields[number]) => {
    const value = brief.fields[field.key];
    return (
      <div key={field.key} className={`brief-field status-${value.value ? value.status : "ask"}`}>
        <label htmlFor={`f-${field.key}`}>{field.label}</label>
        <textarea id={`f-${field.key}`} name={`field-${field.key}`} defaultValue={value.value} rows={Math.min(8, Math.max(1, Math.ceil(value.value.length / 46)))} placeholder={field.hint} />
        <select id={`s-${field.key}`} name={`status-${field.key}`} defaultValue={value.status === "ask" ? "inferred" : value.status} aria-label={`${field.label}确定程度`}>
          <option value="confirmed">{statusLabel.confirmed}</option>
          <option value="inferred">{statusLabel.inferred}</option>
        </select>
      </div>
    );
  };
  return (
    <form key={brief.updatedAt} action={saveBriefCard} className="brief-form">
      <input type="hidden" name="id" value={brief.id} />
      <label className="field">
        <span>项目名称</span>
        <input id="brief-title" name="title" defaultValue={brief.title} />
      </label>
      {known.length ? known.map(row) : <p className="muted">还没有识别出明确的内容。可以在右边补一段背景，或者直接在下面填。</p>}
      {open.length > 0 && (
        <details className="brief-open">
          <summary>还有 {open.length} 项待确定：{open.map((field) => field.label).join("、")}<small>可以先不管，想到了再填</small></summary>
          {open.map(row)}
        </details>
      )}
      <div className="form-actions"><Submit pendingText="保存中…">保存需求卡</Submit></div>
    </form>
  );
}
