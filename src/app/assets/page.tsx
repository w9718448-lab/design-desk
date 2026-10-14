import Link from "next/link";
import { saveFolder, updateAsset, uploadAssets } from "@/app/actions";
import { Dropzone } from "@/components/dropzone";
import { FileThumb } from "@/components/file-thumb";
import { Icon } from "@/components/icons";
import { Submit } from "@/components/submit";
import { searchAssets } from "@/lib/assets";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

type Search = { q?: string; folder?: string };

// 资产库只留两件事：搜索和上传。整理（改名、移动、删除）收在每张卡片的“整理”里。
export default async function AssetsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { q = "", folder = "all" } = await searchParams;
  const store = readStore();
  const query = q.trim();
  const folders = [{ id: "all", name: "全部" }, ...store.folders, ...(store.assets.some((asset) => asset.folderId === "") ? [{ id: "", name: "未分类" }] : [])];
  const current = folders.find((item) => item.id === folder) || folders[0];
  const inFolder = store.assets.filter((asset) => current.id === "all" || asset.folderId === current.id);
  const found = query ? await searchAssets(query, inFolder) : null;
  const list = found ? found.matches.map((match) => match.asset) : inFolder;
  const count = (id: string) => store.assets.filter((asset) => id === "all" || asset.folderId === id).length;
  const href = (id: string, withQuery = true) => `/assets?folder=${encodeURIComponent(id)}${withQuery && query ? `&q=${encodeURIComponent(query)}` : ""}`;
  const custom = store.folders.find((item) => item.id === current.id && !["own", "collected"].includes(item.id));
  const target = current.id === "all" || current.id === "" ? { id: "collected", name: "收集的素材" } : current;

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Assets · 个人资产库</span>
        <h1>资产库</h1>
      </header>

      <form className="search-bar" action="/assets">
        <input type="hidden" name="folder" value={current.id} />
        <input id="asset-search" name="q" defaultValue={query} placeholder="搜索：写你想找的东西，例：去年的中秋海报、暖光、手提袋" aria-label="搜索资产" />
        <button className="button primary" type="submit">搜索</button>
        {query && <Link className="link-button" href={href(current.id, false)}>清除</Link>}
      </form>

      <Dropzone
        action={uploadAssets}
        hidden={{ folderId: target.id }}
        multiple
        title={`把文件拖到这里，放进“${target.name}”`}
        hint="图片、PDF、PSD、AI、Figma、压缩包都可以，一次可以放多个。AI 会在后台记下检索关键词。"
        busyText="上传并整理中…"
      />

      <nav className="folder-bar" aria-label="文件夹">
        {folders.map((item) => (
          <Link key={item.id || "none"} href={href(item.id)} className={`folder-chip ${item.id === current.id ? "is-on" : ""}`} aria-current={item.id === current.id ? "page" : undefined}>
            {item.name}<span>{count(item.id)}</span>
          </Link>
        ))}
        <details key={`new-${store.folders.length}`} className="folder-new">
          <summary><Icon name="plus" size={14} />新建文件夹</summary>
          <form action={saveFolder} className="inline-form">
            <input type="hidden" name="intent" value="add" />
            <input id="folder-name" name="name" placeholder="文件夹名" maxLength={30} required />
            <Submit className="button small">建好</Submit>
          </form>
        </details>
        {custom && (
          <details key={`edit-${custom.name}`} className="folder-new">
            <summary>改这个文件夹</summary>
            <form action={saveFolder} className="inline-form">
              <input type="hidden" name="id" value={custom.id} />
              <input id="folder-rename" name="name" defaultValue={custom.name} maxLength={30} />
              <Submit className="button small" name="intent" value="rename">改名</Submit>
              <Submit className="link-button danger" name="intent" value="delete">删除文件夹</Submit>
            </form>
            <small className="muted">删除文件夹不会删里面的东西，它们会移到“未分类”。</small>
          </details>
        )}
      </nav>

      {query && <p className="muted">“{query}”找到 {list.length} 个{found?.source === "ai" ? "，按意思接近程度排序" : ""}。</p>}

      {list.length === 0 ? (
        <p className="empty">{query ? "没找到。换个说法试试。" : store.assets.length ? "这个文件夹还是空的。" : "资产库还是空的。把你做过的稿子、收集的参考图拖进上面的框里。"}</p>
      ) : (
        <div className="asset-grid simple">
          {list.map((asset) => {
            const src = `/api/assets/${asset.file}`;
            const open = asset.kind === "image" ? src : `${src}?download=${encodeURIComponent(`${asset.name}.${asset.file.split(".").pop()}`)}`;
            return (
              <article key={`${asset.id}-${asset.name}-${asset.folderId}`} className="asset-card">
                <a href={open} target="_blank" className="asset-thumb" title={asset.kind === "image" ? "看大图" : "下载"}><FileThumb src={src} kind={asset.kind} name={asset.name} /></a>
                <div className="asset-meta">
                  <strong title={asset.name}>{asset.name}</strong>
                  <small className="muted">{store.folders.find((item) => item.id === asset.folderId)?.name || "未分类"}</small>
                </div>
                <details className="asset-edit">
                  <summary title="整理：改名、移动、删除" aria-label="整理"><Icon name="edit" size={15} /></summary>
                  <form action={updateAsset} className="stack tight">
                    <input type="hidden" name="id" value={asset.id} />
                    <label className="field"><span>名称</span><input id={`name-${asset.id}`} name="name" defaultValue={asset.name} /></label>
                    <label className="field">
                      <span>放在</span>
                      <select id={`folder-${asset.id}`} name="folderId" defaultValue={asset.folderId}>
                        {store.folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        <option value="">未分类</option>
                      </select>
                    </label>
                    <label className="field"><span>备注（可选）</span><input id={`note-${asset.id}`} name="note" defaultValue={asset.note} placeholder="哪里好、能用在哪" /></label>
                    <div className="asset-actions">
                      <Submit className="button small" name="intent" value="save">保存</Submit>
                      <Submit className="icon-button danger" name="intent" value="delete" title="删除"><Icon name="trash" /></Submit>
                    </div>
                  </form>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
