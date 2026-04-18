#!/bin/bash
# Sanskrit Visual Builder v3.2.1 — Mac/Linux Launcher

PORT="${PORT:-3000}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}  ╔══════════════════════════════════════╗"
echo -e "  ║  SANSKRIT VISUAL BUILDER v3.2.1     ║"
echo -e "  ║  ETL | Data Science | Quantum        ║"
echo -e "  ╚══════════════════════════════════════╝${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}  ERROR: Node.js not found.${NC}"
    echo "  Install from: https://nodejs.org (v18 or higher)"
    exit 1
fi

NODE_VER=$(node --version)
echo -e "  Node.js ${NODE_VER} detected"
echo ""

# Check if port is in use
check_port() {
    lsof -ti tcp:$PORT &>/dev/null 2>&1
    return $?
}

if check_port; then
    EXISTING_PID=$(lsof -ti tcp:$PORT 2>/dev/null | head -1)
    echo -e "${YELLOW}  ┌─────────────────────────────────────────────┐"
    echo -e "  │  WARNING: Port $PORT is already in use!         │"
    echo -e "  │  PID $EXISTING_PID may be a previous session.         │"
    echo -e "  └─────────────────────────────────────────────┘${NC}"
    echo ""
    echo "  What would you like to do?"
    echo ""
    echo "  [1] Kill existing session and start fresh  (recommended)"
    echo "  [2] Open existing session in browser"
    echo "  [3] Use port $((PORT+1)) instead"
    echo "  [4] Exit"
    echo ""
    read -p "  Your choice [1/2/3/4]: " CHOICE
    echo ""

    case "$CHOICE" in
        1|"")
            echo -e "  ${YELLOW}Stopping existing server (PID $EXISTING_PID)...${NC}"
            kill -9 $EXISTING_PID 2>/dev/null
            # Kill all node processes on this port just in case
            lsof -ti tcp:$PORT 2>/dev/null | xargs kill -9 2>/dev/null
            sleep 1.5
            echo -e "  ${GREEN}[OK] Port $PORT is now free${NC}"
            echo ""
            ;;
        2)
            echo "  Opening existing session at http://localhost:$PORT"
            if command -v open &>/dev/null; then open "http://localhost:$PORT"
            elif command -v xdg-open &>/dev/null; then xdg-open "http://localhost:$PORT"
            fi
            exit 0
            ;;
        3)
            PORT=$((PORT+1))
            echo "  Using port $PORT instead."
            echo ""
            ;;
        4)
            echo "  Exiting."
            exit 0
            ;;
    esac
fi

echo -e "  ${CYAN}Starting server on port $PORT...${NC}"
echo ""

export PORT=$PORT
node src/server/server.js

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}  Server exited (code $EXIT_CODE).${NC}"
    read -p "  Restart? [y/N]: " RESTART
    if [[ "$RESTART" =~ ^[Yy]$ ]]; then
        exec "$0"
    fi
fi
