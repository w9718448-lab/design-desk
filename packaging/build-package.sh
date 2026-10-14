#!/usr/bin/env bash
# 打包设计台：Mac + Windows 通用压缩包，自带 Node，解压后双击就能用。
# 用法：bash packaging/build-package.sh [输出目录]（默认 dist-package/）
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-v22.23.3}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mkdir -p "${1:-$ROOT/dist-package}" && cd "${1:-$ROOT/dist-package}" && pwd)"
WORK="$(mktemp -d)"
PKG="$WORK/设计台"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT"
npx next build --webpack
mkdir -p "$PKG/node/arm64" "$PKG/node/x64" "$PKG/node/win-x64"
cp -r .next/standalone "$PKG/app"
cp -r .next/static "$PKG/app/.next/static"
if [ -d public ]; then cp -r public "$PKG/app/public"; fi
rm -rf "$PKG/app/node_modules/sharp" "$PKG/app/node_modules/@img" "$PKG/app/demo"
cp -r packaging/launcher packaging/*.command packaging/*.bat packaging/使用说明.txt "$PKG/"
chmod +x "$PKG"/*.command

# 下载官方 Node，并用官方 SHASUMS256 校验。
BASE="https://nodejs.org/dist/$NODE_VERSION"
curl -fsSL "$BASE/SHASUMS256.txt" -o "$WORK/SHASUMS256.txt"
fetch() {
  curl -fsSL "$BASE/$1" -o "$WORK/$1"
  (cd "$WORK" && grep " $1\$" SHASUMS256.txt | sha256sum -c -)
}
for pair in darwin-arm64:arm64 darwin-x64:x64; do
  name="node-$NODE_VERSION-${pair%%:*}"
  fetch "$name.tar.gz"
  tar -xzf "$WORK/$name.tar.gz" -C "$WORK" "$name/bin/node"
  mv "$WORK/$name/bin/node" "$PKG/node/${pair##*:}/node"
done
fetch "node-$NODE_VERSION-win-x64.zip"
python3 -c "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); open(sys.argv[2],'wb').write(z.read(sys.argv[3]))" \
  "$WORK/node-$NODE_VERSION-win-x64.zip" "$PKG/node/win-x64/node.exe" "node-$NODE_VERSION-win-x64/node.exe"

# 用 Python 打 zip：中文文件名带 UTF-8 标记，Mac 上的可执行权限也保留。
python3 - "$WORK" "$OUT/设计台_安装包_Mac和Windows.zip" <<'PY'
import os, stat, sys, zipfile
root, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for d, _, files in os.walk(os.path.join(root, "设计台")):
        for f in files:
            p = os.path.join(d, f)
            info = zipfile.ZipInfo(os.path.relpath(p, root))
            info.external_attr = (stat.S_IFREG | (os.stat(p).st_mode & 0o777)) << 16
            info.flag_bits |= 0x800
            info.compress_type = zipfile.ZIP_DEFLATED
            with open(p, "rb") as fh:
                z.writestr(info, fh.read())
print("打包完成：", out, os.path.getsize(out) // 1_000_000, "MB")
PY
