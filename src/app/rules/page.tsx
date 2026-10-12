import { addRule, updateRule } from "@/app/actions";
import { Submit } from "@/components/submit";
import { readStore } from "@/lib/store";
import { ruleRole } from "@/lib/review";
import { reviewRoles, ruleLayers } from "@/lib/types";

export const dynamic = "force-dynamic";

const sourceLabel = { preset: "预置示例", manual: "手动添加", review: "评审回流" } as const;

export default function RulesPage() {
  const store = readStore();
  const pending = store.rules.filter((rule) => !rule.confirmed).length;
  return (
    <>
      <header className="page-head">
        <h1>品牌规则</h1>
        <p className="muted">从感觉到指引，三层写清楚。评审时每条意见都要引用这里的规则；没确认的规则只能当建议。</p>
        <div className="head-actions">
          <a className="button" href="/api/skill" download>导出为 Skill 文件</a>
          {pending > 0 && <span className="chip warn">{pending} 条待确认</span>}
        </div>
      </header>

      <div className="rule-columns">
        {ruleLayers.map((layer) => {
          const rules = store.rules.filter((rule) => rule.layer === layer.key);
          return (
            <section key={layer.key} className="panel">
              <div className="panel-head">
                <h2>{layer.label}</h2>
                <small className="muted">{layer.hint}</small>
              </div>
              <ul className="rules">
                {rules.map((rule) => {
                  const role = reviewRoles.find((item) => item.key === ruleRole(rule));
                  return (
                    <li key={`${rule.id}-${rule.text}-${rule.confirmed}`} className={rule.confirmed ? "is-confirmed" : "is-pending"}>
                      <form action={updateRule} className="rule-form">
                        <input type="hidden" name="id" value={rule.id} />
                        <textarea name="text" defaultValue={rule.text} rows={2} aria-label="规则内容" />
                        <div className="rule-meta">
                          <span className={`chip ${rule.confirmed ? "ok" : "warn"}`}>{rule.confirmed ? "已确认" : "待确认"}</span>
                          <small className="muted">{sourceLabel[rule.source]} · 评审时由{role?.label}检查</small>
                        </div>
                        <div className="rule-actions">
                          <Submit className="link-button" name="intent" value="save">保存</Submit>
                          <Submit className="link-button" name="intent" value="toggle">{rule.confirmed ? "改回待确认" : "确认"}</Submit>
                          <Submit className="link-button danger" name="intent" value="delete">删除</Submit>
                        </div>
                      </form>
                    </li>
                  );
                })}
              </ul>
              <form action={addRule} className="add-rule">
                <input type="hidden" name="layer" value={layer.key} />
                <textarea name="text" rows={2} placeholder={`新增一条${layer.label}`} required />
                <label className="inline-check"><input type="checkbox" name="confirmed" />已和品牌负责人确认</label>
                <Submit className="button small">添加</Submit>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}
