import type { FileKind } from "@/lib/types";

// 图片直接显示；源文件、PDF 等显示成一张带扩展名的卡片。
export function FileThumb({ src, kind, name }: { src: string; kind: FileKind; name: string }) {
  if (kind === "image") return <img src={src} alt={name} loading="lazy" />;
  const ext = src.split(".").pop()?.toUpperCase() || "FILE";
  return (
    <span className="file-tile" aria-label={`${ext} 文件：${name}`}>
      <span className="file-ext">{ext}</span>
      <small>{name}</small>
    </span>
  );
}
