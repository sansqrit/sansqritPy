#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  Sanskrit Visual Builder — Node.js Heap Memory Expander
# ══════════════════════════════════════════════════════════════
echo ""
echo "  Sanskrit Visual Builder — Heap Memory Configuration"
echo "  ===================================================="
echo ""

# Detect total system RAM
if command -v free &>/dev/null; then
    TOTAL_MB=$(free -m | awk '/^Mem:/{print $2}')
elif [[ "$OSTYPE" == "darwin"* ]]; then
    TOTAL_MB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024)}')
else
    TOTAL_MB=4096
fi
echo "  System RAM: ${TOTAL_MB}MB"
echo ""

echo "  Select heap size for Node.js:"
echo "  [1]   64 MB  — minimal"
echo "  [2]  128 MB  — small"
echo "  [3]  256 MB  — default"
echo "  [4]  512 MB  — medium"
echo "  [5] 1024 MB  — large (1 GB)"
echo "  [6] 2048 MB  — x-large (2 GB)"
echo "  [7] 4096 MB  — huge (4 GB)"
echo "  [8] MAX      — use all available RAM (${TOTAL_MB}MB)"
echo "  [9] Custom   — enter your own value in MB"
echo ""

read -p "  Your choice [1-9]: " CHOICE

case "$CHOICE" in
  1) HEAP=64;;
  2) HEAP=128;;
  3) HEAP=256;;
  4) HEAP=512;;
  5) HEAP=1024;;
  6) HEAP=2048;;
  7) HEAP=4096;;
  8) HEAP=$TOTAL_MB;;
  9) read -p "  Enter heap size in MB: " HEAP;;
  *) HEAP=256;;
esac

echo ""
echo "  Starting with --max-old-space-size=${HEAP}MB (of ${TOTAL_MB}MB available)"
echo ""
export NODE_OPTIONS="--max-old-space-size=${HEAP}"
export PORT="${PORT:-3000}"
node src/server/server.js
