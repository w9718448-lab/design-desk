#!/bin/bash
PIDS=$(lsof -ti tcp:4180 -sTCP:LISTEN 2>/dev/null)
if [ -n "$PIDS" ]; then kill $PIDS; echo "设计台已停止。"; else echo "设计台没有在运行。"; fi
