"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "./icons";
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

type Shown = Placed & { opacity: number };

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (k: number) => 1 - Math.pow(1 - k, 3);

// 布局变化时，节点从原来的位置平滑移到新位置；新长出来的词从父节点里慢慢“长”出来。
function useTweened(placed: Placed[]) {
  const [shown, setShown] = useState<Shown[]>(() => placed.map((node) => ({ ...node, opacity: 1 })));
  const current = useRef(new Map(placed.map((node) => [node.id, { x: node.x, y: node.y }])));
  useEffect(() => {
    const from = new Map(current.current);
    const target = (k: number) => placed.map((node) => {
      const prev = from.get(node.id) || (node.parentId && from.get(node.parentId)) || { x: 0, y: 0 };
      const e = ease(k);
      return { ...node, x: prev.x + (node.x - prev.x) * e, y: prev.y + (node.y - prev.y) * e, opacity: from.has(node.id) ? 1 : Math.min(1, e * 1.4) };
    });
    const commit = (list: Shown[]) => {
      setShown(list);
      current.current = new Map(list.map((node) => [node.id, { x: node.x, y: node.y }]));
    };
    if (reduceMotion()) {
      commit(target(1));
      return;
    }
    const begin = performance.now();
    let frame = 0;
    const step = (time: number) => {
      const k = Math.min(1, (time - begin) / 650);
      commit(target(k));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [placed]);
  return shown;
}

export function MindMap({ briefId, initial, aiReady }: { briefId: string; initial: MindNode[]; aiReady: boolean }) {
  const [nodes, setNodes] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 0 });
  const [newLabel, setNewLabel] = useState("");
  const [, startTransition] = useTransition();
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraFrame = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const { placed } = useMemo(() => layout(nodes), [nodes]);
  const shown = useTweened(placed);
  const byId = useMemo(() => new Map(shown.map((node) => [node.id, node])), [shown]);
  const picks = nodes.filter((node) => node.picked && node.parentId);
  const selectedNode = selected ? placed.find((node) => node.id === selected) : undefined;

  // 画布范围跟着目标布局走，镜头（缩放、平移）单独动画。
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
  const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  const view = { w: bounds.w / camera.zoom, h: bounds.h / camera.zoom };
  const viewBox = `${center.x - camera.x - view.w / 2} ${center.y - camera.y - view.h / 2} ${view.w} ${view.h}`;

  const moveCamera = (to: { zoom: number; x: number; y: number }) => {
    cancelAnimationFrame(cameraFrame.current);
    if (reduceMotion()) return setCamera(to);
    const from = camera;
    const begin = performance.now();
    const step = (time: number) => {
      const k = ease(Math.min(1, (time - begin) / 450));
      setCamera({ zoom: from.zoom + (to.zoom - from.zoom) * k, x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
      if (k < 1) cameraFrame.current = requestAnimationFrame(step);
    };
    cameraFrame.current = requestAnimationFrame(step);
  };
  const zoomBy = (factor: number) => moveCamera({ ...camera, zoom: Math.min(4, Math.max(0.4, camera.zoom * factor)) });
  const focus = (node: Placed) => moveCamera({ zoom: Math.max(2.2, camera.zoom), x: center.x - node.x, y: center.y - node.y });

  // 触控板双指捏合 / Ctrl + 滚轮缩放。
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setCamera((value) => ({ ...value, zoom: Math.min(4, Math.max(0.4, value.zoom * Math.exp(-event.deltaY * 0.01))) }));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  });

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

  const expand = (node: MindNode) => run(node.id, () => expandIdea(briefId, node.id));
  const toggle = (node: MindNode) => {
    setNodes((list) => list.map((item) => (item.id === node.id ? { ...item, picked: !item.picked } : item)));
    startTransition(async () => apply(await editIdea(briefId, node.id, "pick")));
  };
  // 单击：选中并发散；双击：放大并定位到这个词（单击稍等一下，避免和双击冲突）。
  const onNodeClick = (node: Placed) => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      setSelected(node.id);
      if (!node.expanded && node.parentId && !busy) expand(node);
    }, 220);
  };
  const onNodeDouble = (node: Placed) => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    setSelected(node.id);
    focus(node);
  };

  if (!nodes.length) {
    return (
      <section className="panel feature mind-empty">
        <div className="mind-empty-art" aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>
        <h2>从需求长出一张脑图</h2>
        <p className="muted">{aiReady ? "AI 会读需求卡，提炼一个核心概念，再长出第一圈发散方向。" : "还没配置模型：会从需求卡里拆出关键词当第一圈分支。想要真正的头脑风暴效果，请在设置里配上千问。"}</p>
        <button className="button primary" type="button" disabled={busy !== null} onClick={() => run(null, () => seedIdeas(briefId))}>
          <Icon name="sparkle" />{busy ? "生成中…" : "生成脑图"}
        </button>
        {message && <p className="form-error" role="alert">{message}</p>}
      </section>
    );
  }

  return (
    <div className="mind-layout">
      <section className="panel mind-panel">
        <div className="mind-toolbar">
          <span className="muted mind-tip">单击发散 · 双击放大 · ☆ 收藏 · 拖动平移</span>
          <div className="mind-zoom" role="group" aria-label="缩放">
            <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="缩小" title="缩小"><Icon name="zoomOut" /></button>
            <button type="button" onClick={() => moveCamera({ zoom: 1, x: 0, y: 0 })} aria-label="看全图" title="看全图"><Icon name="fit" /></button>
            <button type="button" onClick={() => zoomBy(1.3)} aria-label="放大" title="放大"><Icon name="zoomIn" /></button>
          </div>
        </div>
        <svg
          ref={svgRef}
          className="mind-canvas"
          viewBox={viewBox}
          role="img"
          aria-label="创意脑图"
          onPointerDown={(event) => {
            if ((event.target as Element).closest(".mind-node")) return;
            cancelAnimationFrame(cameraFrame.current);
            drag.current = { x: event.clientX, y: event.clientY, px: camera.x, py: camera.y, moved: false };
            (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const svg = event.currentTarget as SVGSVGElement;
            const scale = view.w / svg.clientWidth;
            const dx = (event.clientX - drag.current.x) * scale;
            const dy = (event.clientY - drag.current.y) * scale;
            if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
            const start = drag.current;
            setCamera((value) => ({ ...value, x: start.px + dx, y: start.py + dy }));
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
            {shown.filter((node) => node.parentId).map((node) => {
              const parent = byId.get(node.parentId!);
              if (!parent) return null;
              const mx = (parent.x + node.x) / 2;
              const my = (parent.y + node.y) / 2;
              return <path key={`l-${node.id}`} style={{ opacity: node.opacity }} className={node.picked ? "is-picked" : undefined} d={`M${parent.x},${parent.y} Q${mx * 0.92 + parent.x * 0.08},${my * 1.08 - parent.y * 0.08} ${node.x},${node.y}`} />;
            })}
          </g>
          {shown.map((node) => {
            const isRoot = node.depth === 0;
            const classes = ["mind-node", `depth-${Math.min(node.depth, 3)}`, node.picked ? "is-picked" : "", node.expanded ? "is-expanded" : "", selected === node.id ? "is-selected" : "", busy === node.id ? "is-busy" : ""].join(" ");
            const h = isRoot ? 52 : 36;
            const scale = 0.7 + 0.3 * node.opacity;
            return (
              <g key={node.id} className={classes} transform={`translate(${node.x},${node.y}) scale(${scale})`} style={{ opacity: node.opacity }}>
                <rect
                  x={-node.width / 2}
                  y={-h / 2}
                  width={node.width}
                  height={h}
                  rx={h / 2}
                  role="button"
                  tabIndex={0}
                  aria-label={isRoot ? `核心词：${node.label}` : `${node.label}，${node.expanded ? "已发散" : "单击继续发散"}，双击放大`}
                  onClick={() => onNodeClick(node)}
                  onDoubleClick={() => onNodeDouble(node)}
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
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    {node.picked ? "★" : "☆"}
                  </text>
                )}
                {busy === node.id && <circle className="mind-spinner" r={h / 2 + 6} />}
              </g>
            );
          })}
        </svg>

        {selectedNode && (
          <div className="mind-actions" role="group" aria-label={`操作：${selectedNode.label}`}>
            <strong>{selectedNode.label}</strong>
            <button type="button" className="icon-button" disabled={busy !== null} onClick={() => expand(selectedNode)} title={selectedNode.expanded ? "再长一圈" : "继续发散"} aria-label={selectedNode.expanded ? "再长一圈" : "继续发散"}><Icon name="branch" /></button>
            {selectedNode.parentId && (
              <button type="button" className={`icon-button ${selectedNode.picked ? "is-on" : ""}`} onClick={() => toggle(selectedNode)} title={selectedNode.picked ? "取消收藏" : "收藏"} aria-label={selectedNode.picked ? "取消收藏" : "收藏"}><Icon name="star" /></button>
            )}
            <button type="button" className="icon-button" onClick={() => focus(selectedNode)} title="放大定位" aria-label="放大定位"><Icon name="target" /></button>
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
              <button type="submit" className="icon-button" title="添加" aria-label="添加"><Icon name="plus" /></button>
            </form>
            {selectedNode.parentId && (
              <button type="button" className="icon-button danger" title="删掉这一支" aria-label="删掉这一支" onClick={() => { const id = selectedNode.id; setSelected(null); run(id, () => editIdea(briefId, id, "remove")); }}><Icon name="trash" /></button>
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
                <button type="button" className="icon-button" onClick={() => toggle(node)} title="移除" aria-label={`移除${node.label}`}><Icon name="x" size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <small className="muted">{aiReady ? "发散由 AI 完成：它会参考需求卡、品牌“感觉”规则和你走过的路径。" : "还没配置模型：现在是按需求卡里的词和本地词库发散，只能当示例。配上千问后才是真正的头脑风暴。"}</small>
      </aside>
    </div>
  );
}
