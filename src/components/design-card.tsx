"use client";

import { useState } from "react";
import { Icon } from "./icons";

export type CardImage = { src: string; label: string; tag: string };
type Props = {
  title: string;
  concept: string;
  keywords: string[];
  rows: Array<{ label: string; value: string }>;
  images: CardImage[];
  prompt: string;
  fileName: string;
};

const W = 1600;
const PAD = 72;

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    if (char === "\n" || ctx.measureText(line + char).width > width) {
      lines.push(line);
      line = char === "\n" ? "" : char;
      if (lines.length === maxLines) break;
    } else line += char;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && lines.join("").length < text.replace(/\n/g, "").length) lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, -1)}…`;
  return lines;
}

const load = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = src;
});

const font = (size: number, weight = 400) => `${weight} ${size}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;

// 把需求、创意和参考图画成一张设计卡片（PNG），可以复制或下载，拿去生图工具或设计软件里用。
async function render(props: Props) {
  const images = (await Promise.all(props.images.map(async (item) => ({ ...item, image: await load(item.src) })))).filter((item) => item.image);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const cols = 3;
  const cell = (W - PAD * 2 - 24 * (cols - 1)) / cols;
  const imageRows = Math.ceil(images.length / cols);
  ctx.font = font(26);
  const promptLines = wrap(ctx, props.prompt, W - PAD * 2 - 48, 6);
  const rowLines = props.rows.map((row) => wrap(ctx, row.value, W - PAD * 2 - 200, 3));
  const height = PAD + 150 + (props.keywords.length ? 90 : 0) + rowLines.reduce((sum, lines) => sum + lines.length * 38 + 18, 0) + 30
    + (images.length ? imageRows * (cell * 0.75 + 70) + 40 : 0) + promptLines.length * 38 + 110 + PAD;
  canvas.width = W;
  canvas.height = height;

  ctx.fillStyle = "#0b0c14";
  ctx.fillRect(0, 0, W, height);
  const glow = ctx.createRadialGradient(W * 0.15, 0, 0, W * 0.15, 0, W * 0.7);
  glow.addColorStop(0, "rgba(139,108,255,0.35)");
  glow.addColorStop(1, "rgba(139,108,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, height);
  const bar = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  bar.addColorStop(0, "#8b6cff");
  bar.addColorStop(0.5, "#5b8cff");
  bar.addColorStop(1, "#22d3ee");

  let y = PAD;
  ctx.fillStyle = "#8b90a6";
  ctx.font = font(22, 500);
  ctx.fillText("DESIGN CARD · 设计卡片", PAD, y + 22);
  y += 44;
  ctx.fillStyle = "#eef0f7";
  ctx.font = font(60, 700);
  ctx.fillText(props.title, PAD, y + 60);
  y += 90;
  if (props.concept) {
    ctx.fillStyle = "#a194ff";
    ctx.font = font(28, 500);
    ctx.fillText(`核心概念：${props.concept}`, PAD, y + 10);
  }
  y += 30;
  if (props.keywords.length) {
    let x = PAD;
    y += 20;
    ctx.font = font(26, 500);
    for (const keyword of props.keywords) {
      const width = ctx.measureText(keyword).width + 40;
      if (x + width > W - PAD) break;
      ctx.fillStyle = "rgba(139,108,255,0.18)";
      ctx.beginPath();
      ctx.roundRect(x, y, width, 48, 24);
      ctx.fill();
      ctx.fillStyle = "#eef0f7";
      ctx.fillText(keyword, x + 20, y + 33);
      x += width + 12;
    }
    y += 70;
  }
  ctx.fillStyle = bar;
  ctx.fillRect(PAD, y, W - PAD * 2, 3);
  y += 30;
  props.rows.forEach((row, index) => {
    ctx.fillStyle = "#8b90a6";
    ctx.font = font(24, 500);
    ctx.fillText(row.label, PAD, y + 28);
    ctx.fillStyle = "#eef0f7";
    ctx.font = font(26);
    rowLines[index].forEach((line, lineIndex) => ctx.fillText(line, PAD + 200, y + 28 + lineIndex * 38));
    y += rowLines[index].length * 38 + 18;
  });
  y += 30;
  if (images.length) {
    images.forEach((item, index) => {
      const x = PAD + (index % cols) * (cell + 24);
      const top = y + Math.floor(index / cols) * (cell * 0.75 + 70);
      const h = cell * 0.75;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, top, cell, h, 18);
      ctx.clip();
      ctx.fillStyle = "#1a1c28";
      ctx.fillRect(x, top, cell, h);
      const image = item.image!;
      const scale = Math.min(cell / image.width, h / image.height);
      ctx.drawImage(image, x + (cell - image.width * scale) / 2, top + (h - image.height * scale) / 2, image.width * scale, image.height * scale);
      ctx.restore();
      ctx.fillStyle = "#a194ff";
      ctx.font = font(20, 600);
      ctx.fillText(item.tag, x, top + h + 32);
      ctx.fillStyle = "#c9ccd8";
      ctx.font = font(22);
      ctx.fillText(wrap(ctx, item.label, cell - 90, 1)[0] || "", x + ctx.measureText(item.tag).width + 16, top + h + 32);
    });
    y += imageRows * (cell * 0.75 + 70) + 20;
  }
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  ctx.roundRect(PAD, y, W - PAD * 2, promptLines.length * 38 + 80, 20);
  ctx.fill();
  ctx.fillStyle = "#8b90a6";
  ctx.font = font(22, 500);
  ctx.fillText("生图提示词", PAD + 24, y + 38);
  ctx.fillStyle = "#eef0f7";
  ctx.font = font(26);
  promptLines.forEach((line, index) => ctx.fillText(line, PAD + 24, y + 80 + index * 38));
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));

async function copyImage(blob: Promise<Blob>) {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

// 单张图转成 PNG 再复制（剪贴板只认 PNG）。
async function imageBlob(src: string) {
  const image = await load(src);
  if (!image) throw new Error("load");
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d")!.drawImage(image, 0, 0);
  return toBlob(canvas);
}

export function DesignCard(props: Props) {
  const [note, setNote] = useState("");
  const say = (text: string) => { setNote(text); setTimeout(() => setNote(""), 2400); };
  const copyCard = async () => {
    try {
      await copyImage(render(props).then(toBlob));
      say("设计卡片已复制，可以直接粘贴到生图工具或设计软件里。");
    } catch {
      say("这个浏览器不支持复制图片，请用下载。");
    }
  };
  const download = async () => {
    const canvas = await render(props);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${props.fileName}_设计卡片.png`;
    link.click();
  };
  const copyOne = async (item: CardImage) => {
    try {
      await copyImage(imageBlob(item.src));
      say(`已复制“${item.label}”。`);
    } catch {
      say("这个浏览器不支持复制图片，可以右键图片另存。");
    }
  };

  return (
    <div className="design-card">
      <div className="design-card-sheet">
        <span className="eyebrow">Design card · 设计卡片</span>
        <h3>{props.title}</h3>
        {props.concept && <p className="design-concept">核心概念：{props.concept}</p>}
        {props.keywords.length > 0 && <div className="chips">{props.keywords.map((keyword) => <span key={keyword} className="chip glow">{keyword}</span>)}</div>}
        <dl className="design-rows">
          {props.rows.map((row) => (
            <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
          ))}
        </dl>
        {props.images.length > 0 ? (
          <div className="design-images">
            {props.images.map((item) => (
              <figure key={item.src}>
                <img src={item.src} alt={item.label} />
                <figcaption><em>{item.tag}</em><span title={item.label}>{item.label}</span>
                  <button type="button" className="icon-button ghost" onClick={() => copyOne(item)} title="复制这张图" aria-label={`复制${item.label}`}><Icon name="copy" size={14} /></button>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : <p className="muted">还没有参考图。可以在需求里固定 Logo，在视觉风格里选参考，或在下面从资产库添加。</p>}
      </div>
      <div className="design-card-actions">
        <button type="button" className="icon-button" onClick={copyCard} title="复制设计卡片（图片）" aria-label="复制设计卡片"><Icon name="copy" /></button>
        <button type="button" className="icon-button" onClick={download} title="下载设计卡片 PNG" aria-label="下载设计卡片"><Icon name="download" /></button>
        {note && <small className="muted" role="status">{note}</small>}
      </div>
    </div>
  );
}
