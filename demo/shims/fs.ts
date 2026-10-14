// 展示版的“硬盘”：所有读写都只在这个页面的内存里，刷新即清空。
import { registerCopy, forgetFile } from "./files";

const files = new Map<string, string | Blob>();
const base = (p: string) => p.split("/").pop() || p;

function readFileSync(p: string) {
  const value = files.get(p);
  if (value === undefined) { const error = new Error(`ENOENT: ${p}`) as Error & { code: string }; error.code = "ENOENT"; throw error; }
  if (typeof value !== "string") throw new Error("展示版不读取二进制文件");
  return value;
}
const writeFileSync = (p: string, data: string | Blob) => { files.set(p, data); };
const existsSync = (p: string) => files.has(p);
const mkdirSync = () => undefined;
const renameSync = (from: string, to: string) => { const v = files.get(from); files.delete(from); if (v !== undefined) files.set(to, v); };
const copyFileSync = (from: string, to: string) => {
  const v = files.get(from);
  if (v !== undefined) files.set(to, v);
  registerCopy(base(from), base(to));
};
const rmSync = (p: string) => { files.delete(p); forgetFile(base(p)); };

const fs = { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, copyFileSync, rmSync };
export default fs;
export { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, copyFileSync, rmSync };
