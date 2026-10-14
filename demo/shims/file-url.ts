import { urlOf } from "./files";
export function fileUrl(folder: "uploads" | "assets", name: string) {
  return urlOf(folder, name);
}
