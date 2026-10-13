import { saveRole } from "@/app/actions";
import { Submit } from "@/components/submit";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function RolesPage() {
  const store = readStore();
  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Reviewers · 评审小组</span>
        <h1>评审角色</h1>
        <p className="muted">每个角色有自己的人物特质、关注点和依据。AI 评审时会用这个角色的口吻和视角挑问题；没配模型时，按关注点生成检查清单。</p>
      </header>

      <div className="role-grid">
        {store.roles.map((role) => (
          <section key={`${role.key}-${role.label}-${role.enabled}-${role.persona}-${role.focus}-${role.basis}`} className={`panel role-card ${role.enabled ? "" : "is-off"}`}>
            <form action={saveRole} className="stack">
              <input type="hidden" name="key" value={role.key} />
              <div className="panel-head">
                <input id={`label-${role.key}`} name="label" defaultValue={role.label} className="role-name" aria-label="角色名称" />
                <span className={`chip ${role.enabled ? "ok" : ""}`}>{role.enabled ? "参与评审" : "已停用"}</span>
              </div>
              <label className="field"><span>人物特质</span><textarea id={`persona-${role.key}`} name="persona" rows={2} defaultValue={role.persona} placeholder="他是谁、什么性格、平时怎么看稿" /></label>
              <label className="field"><span>关注点</span><input id={`focus-${role.key}`} name="focus" defaultValue={role.focus} placeholder="用顿号分隔，例：信息层级、可读性" /></label>
              <label className="field"><span>依据</span><input id={`basis-${role.key}`} name="basis" defaultValue={role.basis} placeholder="例：品牌规则、需求卡里的受众" /></label>
              <div className="rule-actions">
                <Submit className="button small" name="intent" value="save">保存</Submit>
                <Submit className="link-button" name="intent" value="toggle">{role.enabled ? "停用" : "启用"}</Submit>
                <Submit className="link-button danger" name="intent" value="delete">删除</Submit>
              </div>
            </form>
          </section>
        ))}

        <section className="panel feature role-card">
          <form action={saveRole} className="stack">
            <input type="hidden" name="intent" value="add" />
            <h2>新增角色</h2>
            <label className="field"><span>名称</span><input id="new-role-label" name="label" required placeholder="例：竞品设计师、00 后实习生" /></label>
            <label className="field"><span>人物特质</span><textarea id="new-role-persona" name="persona" rows={2} placeholder="例：在大厂做了五年活动视觉，对“像不像别人家”特别敏感" /></label>
            <label className="field"><span>关注点</span><input id="new-role-focus" name="focus" placeholder="例：差异化、记忆点、是否撞款" /></label>
            <label className="field"><span>依据</span><input id="new-role-basis" name="basis" placeholder="例：行业常见做法" /></label>
            <Submit className="button primary">添加角色</Submit>
          </form>
        </section>
      </div>

      <form action={saveRole} className="danger-zone">
        <input type="hidden" name="intent" value="reset" />
        <Submit className="link-button">恢复默认的五个角色</Submit>
      </form>
    </>
  );
}
