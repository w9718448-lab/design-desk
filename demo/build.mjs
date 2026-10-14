// 打包展示版：把设计台的页面和组件原样打进一个静态网页，服务端部分换成浏览器内存实现。
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const demo = path.join(root, "demo");
const out = path.resolve(process.argv[2] || path.join(demo, "dist"));
const shim = (name) => path.join(demo, "shims", name);

// 动作（原来的 server actions）逐个包一层：执行完刷新页面，遇到跳转就换地址。
const actionsSrc = fs.readFileSync(path.join(root, "src/app/actions.ts"), "utf8");
const names = [...actionsSrc.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
fs.writeFileSync(shim("actions.ts"), `// 自动生成，勿改。
import * as real from "../../src/app/actions";
import { DemoRedirect, emit, navigate } from "./router";
// 浏览器里 React 不会把被点按钮的 name/value 放进表单数据，这里补上（例如“保存”和“交付完成”共用一个表单）。
let submitter: HTMLButtonElement | HTMLInputElement | null = null;
document.addEventListener("submit", (event) => { submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null; }, true);
function withSubmitter(args: unknown[]) {
  const form = args.find((arg) => arg instanceof FormData) as FormData | undefined;
  if (form && submitter?.name && !form.has(submitter.name)) form.append(submitter.name, submitter.value);
  submitter = null;
}
function wrap<T extends (...args: never[]) => Promise<unknown>>(fn: T): T {
  return (async (...args: never[]) => {
    try { withSubmitter(args); if ((globalThis as { __ddDebug?: boolean }).__ddDebug) console.log("[action]", fn.name, ...args.map((a) => a instanceof FormData ? JSON.stringify([...(a as FormData).entries()].map(([k, v]) => [k, String(v).slice(0, 40)])) : a)); const result = await fn(...args); emit(); return result; }
    catch (error) { if (error instanceof DemoRedirect) { navigate(error.path); return {}; } console.error("[demo action]", error); throw error; }
  }) as T;
}
${names.map((n) => `export const ${n} = wrap(real.${n});`).join("\n")}
export type { UploadState } from "../../src/app/actions";
`);

const exact = {
  "node:fs": shim("fs.ts"), "node:path": shim("path.ts"), "node:crypto": shim("crypto.ts"),
  "server-only": shim("empty.ts"), "next/cache": shim("cache.ts"), "next/navigation": shim("navigation.ts"), "next/link": shim("link.tsx"),
  "@/app/actions": shim("actions.ts"), "@/lib/ai": shim("ai.ts"), "@/lib/files": shim("lib-files.ts"), "@/lib/file-url": shim("file-url.ts"),
};
const relative = { "./ai": shim("ai.ts"), "./files": shim("lib-files.ts"), "./file-url": shim("file-url.ts") };

const demoPlugin = {
  name: "design-desk-demo",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (exact[args.path]) return { path: exact[args.path] };
      if (relative[args.path] && args.importer.startsWith(path.join(root, "src"))) return { path: relative[args.path] };
      if (args.path.startsWith("@/")) return build.resolve(`./${args.path.slice(2)}`, { resolveDir: path.join(root, "src"), kind: args.kind });
      return undefined;
    });
    // 带 "use client" 的组件做个记号。
    build.onLoad({ filter: /src\/.*\.tsx$/ }, (args) => {
      let code = fs.readFileSync(args.path, "utf8");
      if (/^["']use client["']/.test(code)) {
        const exported = [...code.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
        code += `\nimport { markClient as __markClient } from ${JSON.stringify(shim("client-mark.ts"))};\n__markClient(${exported.join(", ")});\n`;
      }
      return { contents: code, loader: "tsx" };
    });
  },
};

if (!out.endsWith("dist") && !fs.existsSync(path.join(out, ".design-desk-demo"))) fs.mkdirSync(out, { recursive: true });
for (const name of ["app.js", "app.css", "index.html", "favicon.svg"]) fs.rmSync(path.join(out, name), { force: true });
fs.rmSync(path.join(out, "files"), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
await esbuild.build({
  entryPoints: { app: path.join(demo, "main.tsx") },
  bundle: true, minify: true, format: "iife", target: "es2022", outdir: out,
  jsx: "automatic", loader: { ".json": "json" },
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'var process={env:{DESIGN_DESK_DATA_DIR:"/demo",NODE_ENV:"production"},platform:"browser",pid:1,cwd:function(){return "/"}};' },
  plugins: [demoPlugin], logLevel: "warning",
});
fs.copyFileSync(path.join(demo, "index.html"), path.join(out, "index.html"));
fs.cpSync(path.join(demo, "public"), out, { recursive: true });
fs.writeFileSync(path.join(out, ".design-desk-demo"), "built by demo/build.mjs\n");
console.log("built", out);
