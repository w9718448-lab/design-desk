"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { editIdea, expandIdea, seedIdeas, type MindResult } from "@/app/actions";
import type { MindNode } from "@/lib/types";

type Placed = MindNode & { x: number; y: number; depth: number; width: number };

const RING = [0, 240, 390, 520, 640, 750];

function textWidth(label: string) {
  let width = 0;
  for (const char of label) width += /[\u0000-ÿ]/.test(char) ? 8.2 : 15;
  return width;
}

// 径向树布局：中心是核心词，每一圈按子孙数量分配角度，越往外圈越大。
function layout(nodes: MindNode[]) {
  const children = new Map<string, MindNode[]>();
  for (const node of nodes) if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) || []), node]);
  const weight = new Map<string, number>();
  const measure = (node: MindNode): number => {
    const kids = children.get(node.id) || [];
    // 展开过的分支多占一些角度，但不压扁没展开的兄弟节点。
    const value = kids.length ? 1 + kids.reduce((sum, kid) => sum + measure(kid), 0) * 0.5 : 1;
    weight.set(node.id, value);
    return value;
  };
  const root = nodes.find((node) => !node.parentId);
  const placed: Placed[] = [];
  if (!root) return { placed, children };
  measure(root);
  const place = (node: MindNode, depth: number, from: number, to: number) => {
    const angle = (from + to) / 2;
    const radius = RING[Math.min(depth, RING.length - 1)] + Math.max(0, depth - RING.length + 1) * 120;
    const isRoot = depth === 0;
    placed.push({ ...node, depth, x: isRoot ? 0 : Math.cos(angle) * radius, y: isRoot ? 0 : Math.sin(angle) * radius * 0.78, width: textWidth(node.label) + (isRoot ? 44 : node.parentId ? 50 : 30) });
    const kids = children.get(node.id) || [];
    const total = kids.reduce((sum, kid) => sum + (weight.get(kid.id) || 1), 0);
    let cursor = from;
    for (const kid of kids) {
      const share = ((weight.get(kid.id) || 1) / total) * (to - from);
      place(kid, depth + 1, cursor, cursor + share);
      cursor += share;
    }
  };
  place(root, 0, -Math.PI / 2, Math.PI * 1.5);
  return { placed, children };
}

function pathLabels(nodes: MindNode[], id: string) {
  const chain: string[] = [];
  let node = nodes.find((item) => item.id === id);
  while (node && node.parentId) {
    chain.unshift(node.label);
    node = nodes.find((item) => item.id === node!.parentId);
  }
  return chain;
}

export function MindMap({ briefId, initial, aiReady }: { briefId: string; initial: MindNode[]; aiReady: boolean }) {
  const [nodes, setNodes] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [newLabel, setNewLabel] = useState("");
  const [, startTransition] = useTransition();
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);

  const { placed } = useMemo(() => layout(nodes), [nodes]);
  const byId = useMemo(() => new Map(placed.map((node) => [node.id, node])), [placed]);
  const picks = nodes.filter((node) => node.picked && node.parentId);
  const selectedNode = selected ? byId.get(selected) : undefined;

  const bounds = useMemo(() => {
    if (!placed.length) return { x: -400, y: -300, w: 800, h: 600 };
    const xs = placed.flatMap((node) => [node.x - node.width / 2, node.x + node.width / 2]);
    const ys = placed.flatMap((node) => [node.y - 24, node.y + 24]);
    const pad = 60;
    const minX = Math.min(...xs, -380) - pad;
    const maxX = Math.max(...xs, 380) + pad;
    const minY = Math.min(...ys, -260) - pad;
    const maxY = Math.max(...ys, 260) + pad;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [placed]);
  const view = { w: bounds.w / zoom, h: bounds.h / zoom };
  const viewBox = `${bounds.x + (bounds.w - view.w) / 2 - pan.x} ${bounds.y + (bounds.h - view.h) / 2 - pan.y} ${view.w} ${view.h}`;

  const apply = (result: MindResult) => {
    if (result.nodes.length) setNodes(result.nodes);
    setMessage(result.error || "");
  };

  const run = (id: string | null, task: () => Promise<MindResult>) => {
    setBusy(id || "seed");
    startTransition(async () => {
      try {
        apply(await task());
      } catch {
        setMessage("没能连上设计台，请确认设计台还在运行后再试。");
      } finally {
        setBusy(null);
      }
    });
  };

  const expand = (node: Placed) => run(node.id, () => expandIdea(briefId, node.id));
  const toggle = (node: MindNode) => {
    setNodes((list) => list.map((item) => (item.id === node.id ? { ...item, picked: !item.picked } : item)));
    startTransition(async () => apply(await editIdea(briefId, node.id, "pick")));
  };

  if (!nodes.length) {
    return (
      <section className="panel feature mind-empty">
        <div className="mind-empty-art" aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>
        <h2>从需求长出一张脑图</h2>
        <p className="muted">{aiReady ? "AI 会读需求卡，提炼一个核心词，再长出第一圈发散方向。" : "还没配置模型：会用本地词库生成情绪、意象、色彩、材质、场景、构图六个方向。"}</p>
        <button className="button primary" type="button" disabled={busy !== null} onClick={() => run(null, () => seedIdeas(briefId))}>
          {busy ? "生成中…" : "生成脑图"}
        </button>
        {message && <p className="form-error" role="alert">{message}</p>}
      </section>
    );
  }

  return (
    <div className="mind-layout">
      <section className="panel mind-panel">
        <div className="mind-toolbar">
          <span className="muted">点圆圈继续发散，点 ☆ 收藏。拖动画布可以平移。</span>
          <div className="mind-zoom" role="group" aria-label="缩放">
            <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value / 1.25))} aria-label="缩小">−</button>
            <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>复位</button>
            <button type="button" onClick={() => setZoom((value) => Math.min(3, value * 1.25))} aria-label="放大">+</button>
          </div>
        </div>
        <svg
          className="mind-canvas"
          viewBox={viewBox}
          role="img"
          aria-label="创意脑图"
          onPointerDown={(event) => {
            if ((event.target as Element).closest(".mind-node")) return;
            drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y, moved: false };
            (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const svg = event.currentTarget as SVGSVGElement;
            const scale = view.w / svg.clientWidth;
            const dx = (event.clientX - drag.current.x) * scale;
            const dy = (event.clientY - drag.current.y) * scale;
            if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
            setPan({ x: drag.current.px + dx, y: drag.current.py + dy });
          }}
          onPointerUp={() => {
            if (drag.current && !drag.current.moved) setSelected(null);
            drag.current = null;
          }}
        >
          <defs>
            <linearGradient id="mind-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8b6cff" />
              <stop offset="55%" stopColor="#5b8cff" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <g className="mind-links">
            {placed.filter((node) => node.parentId).map((node) => {
              const parent = byId.get(node.parentId!);
              if (!parent) return null;
              const mx = (parent.x + node.x) / 2;
              const my = (parent.y + node.y) / 2;
              return <path key={`l-${node.id}`} className={node.picked ? "is-picked" : undefined} d={`M${parent.x},${parent.y} Q${mx * 0.92 + parent.x * 0.08},${my * 1.08 - parent.y * 0.08} ${node.x},${node.y}`} />;
            })}
          </g>
          {placed.map((node) => {
            const isRoot = node.depth === 0;
            const classes = ["mind-node", `depth-${Math.min(node.depth, 3)}`, node.picked ? "is-picked" : "", node.expanded ? "is-expanded" : "", selected === node.id ? "is-selected" : "", busy === node.id ? "is-busy" : ""].join(" ");
            const h = isRoot ? 52 : 36;
            return (
              <g key={node.id} className={classes} transform={`translate(${node.x},${node.y})`}>
                <g className="mind-pop">
                  <rect
                    x={-node.width / 2}
                    y={-h / 2}
                    width={node.width}
                    height={h}
                    rx={h / 2}
                    role="button"
                    tabIndex={0}
                    aria-label={isRoot ? `核心词：${node.label}` : `${node.label}，${node.expanded ? "已发散" : "点击继续发散"}`}
                    onClick={() => {
                      setSelected(node.id);
                      if (!node.expanded && !isRoot && !busy) expand(node);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(node.id);
                        if (!node.expanded && !isRoot && !busy) expand(node);
                      }
                    }}
                  />
                  <text x={isRoot ? 0 : -10} y={1} textAnchor="middle" dominantBaseline="middle">{node.label}</text>
                  {!isRoot && (
                    <text
                      className="mind-star"
                      x={node.width / 2 - 20}
                      y={1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      role="button"
                      aria-label={node.picked ? `取消收藏${node.label}` : `收藏${node.label}`}
                      onClick={(event) => { event.stopPropagation(); toggle(node); }}
                    >
                      {node.picked ? "★" : "☆"}
                    </text>
                  )}
                  {busy === node.id && <circle className="mind-spinner" r={h / 2 + 6} />}
                </g>
              </g>
            );
          })}
        </svg>

        {selectedNode && (
          <div className="mind-actions" role="group" aria-label={`操作：${selectedNode.label}`}>
            <strong>{selectedNode.label}</strong>
            <button type="button" className="button small" disabled={busy !== null} onClick={() => expand(selectedNode)}>{selectedNode.expanded ? "再长一圈" : "继续发散"}</button>
            {selectedNode.parentId && <button type="button" className="button small" onClick={() => toggle(selectedNode)}>{selectedNode.picked ? "取消收藏" : "收藏"}</button>}
            <form
              className="mind-add"
              onSubmit={(event) => {
                event.preventDefault();
                if (!newLabel.trim()) return;
                const id = selectedNode.id;
                const label = newLabel;
                setNewLabel("");
                run(id, () => editIdea(briefId, id, "add", label));
              }}
            >
              <input id="mind-new-label" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="自己加一个词" maxLength={12} />
              <button type="submit" className="button small">添加</button>
            </form>
            {selectedNode.parentId && (
              <button type="button" className="link-button danger" onClick={() => { const id = selectedNode.id; setSelected(null); run(id, () => editIdea(briefId, id, "remove")); }}>删掉这一支</button>
            )}
          </div>
        )}
        {message && <p className="form-error" role="alert">{message}</p>}
      </section>

      <aside className="panel mind-side">
        <div className="panel-head">
          <h2>创意组合</h2>
          <span className="chip">{picks.length} 个</span>
        </div>
        {picks.length === 0 ? (
          <p className="muted">在脑图里点 ☆ 收藏喜欢的关键词，它们会出现在这里，并带进下一步的风格匹配和出稿说明。</p>
        ) : (
          <ul className="pick-list">
            {picks.map((node) => (
              <li key={node.id}>
                <span className="pick-path">{pathLabels(nodes, node.id).map((label, index, all) => (
                  <span key={`${node.id}-${index}`} className={index === all.length - 1 ? "pick-leaf" : undefined}>{label}</span>
                ))}</span>
                <button type="button" className="link-button" onClick={() => toggle(node)} aria-label={`移除${node.label}`}>移除</button>
              </li>
            ))}
          </ul>
        )}
        <small className="muted">{aiReady ? "发散由 AI 完成：它会参考需求卡、品牌“感觉”规则和你走过的路径。" : "还没配置模型，当前用本地词库发散。配置千问后会按需求和路径联想。"}</small>
      </aside>
    </div>
  );
}
