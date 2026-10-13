"use client";

import { useRef, useState, useTransition } from "react";
import { saveStyleRef } from "@/app/actions";
import type { Box } from "@/lib/types";

// 在参考图上拖出一个框，标出“我要的是这一块”，再写一句要它的什么。
export function StyleRefEditor({ briefId, assetId, src, name, initialNote, initialBox }: { briefId: string; assetId: string; src: string; name: string; initialNote: string; initialBox: Box | null }) {
  const [box, setBox] = useState<Box | null>(initialBox);
  const [note, setNote] = useState(initialNote);
  const [saved, setSaved] = useState(true);
  const [pending, startTransition] = useTransition();
  const frame = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const point = (event: React.PointerEvent) => {
    const rect = frame.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) };
  };

  return (
    <div className="ref-editor">
      <div
        ref={frame}
        className="ref-frame"
        onPointerDown={(event) => {
          event.preventDefault();
          start.current = point(event);
          setBox({ ...start.current, w: 0, h: 0 });
          (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!start.current) return;
          const p = point(event);
          setBox({ x: Math.min(p.x, start.current.x), y: Math.min(p.y, start.current.y), w: Math.abs(p.x - start.current.x), h: Math.abs(p.y - start.current.y) });
          setSaved(false);
        }}
        onPointerUp={() => {
          start.current = null;
          setBox((value) => (value && value.w > 0.01 && value.h > 0.01 ? value : null));
        }}
      >
        <img src={src} alt={name} draggable={false} />
        {box && <span className="ref-box" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }} />}
      </div>
      <div className="ref-fields">
        <strong>{name}</strong>
        <small className="muted">{box ? "已框选局部。拖动可以重新框。" : "在图上拖动，框出你想要的那一块（可选）。"}</small>
        <input id={`ref-note-${assetId}`} value={note} onChange={(event) => { setNote(event.target.value); setSaved(false); }} placeholder="要它的什么？例：这种逆光和颗粒感" maxLength={200} />
        <div className="form-actions">
          <button
            type="button"
            className="button small"
            disabled={pending || saved}
            onClick={() => startTransition(async () => { await saveStyleRef(briefId, assetId, note, box); setSaved(true); })}
          >
            {pending ? "保存中…" : saved ? "已保存" : "保存"}
          </button>
          {box && <button type="button" className="link-button" onClick={() => { setBox(null); setSaved(false); }}>清除框选</button>}
        </div>
      </div>
    </div>
  );
}
