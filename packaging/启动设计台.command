#!/bin/bash
# 设计台启动脚本：双击运行，会在浏览器里打开 http://127.0.0.1:4180
cd "$(dirname "$0")"
DIR="$(pwd)"
PORT=4180
URL="http://127.0.0.1:$PORT"
DATA="$HOME/Documents/设计台数据"
mkdir -p "$DATA"

# 已经在运行就直接打开
if curl -s -o /dev/null "$URL"; then
  open "$URL"; echo "设计台已经在运行，已在浏览器打开。这个窗口可以关掉。"; exit 0
fi

# 去掉下载带来的隔离标记，避免每个文件都弹安全提示
xattr -dr com.apple.quarantine "$DIR" 2>/dev/null

if [ "$(uname -m)" = "arm64" ]; then NODE="$DIR/node/arm64/node"; else NODE="$DIR/node/x64/node"; fi
chmod +x "$NODE"

cd "$DIR/app"
DESIGN_DESK_DATA_DIR="$DATA" PORT=$PORT HOSTNAME=127.0.0.1 nohup "$NODE" server.js > "$DATA/运行日志.txt" 2>&1 < /dev/null &

for i in $(seq 1 30); do
  if curl -s -o /dev/null "$URL"; then
    open "$URL"
    echo "设计台已启动：$URL"
    echo "数据保存在：$DATA"
    echo "这个窗口可以关掉，设计台会继续运行。要关掉设计台，双击“停止设计台”。"
    exit 0
  fi
  sleep 1
done
echo "启动失败。请把下面这个文件截图发给 Claude：$DATA/运行日志.txt"
tail -20 "$DATA/运行日志.txt"
