// 稿件和资产文件的访问地址。展示版（浏览器里运行）会换成自己的实现。
export function fileUrl(folder: "uploads" | "assets", name: string, download?: string) {
  return `/api/${folder}/${name}${download ? `?download=${encodeURIComponent(download)}` : ""}`;
}
