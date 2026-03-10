#!/usr/bin/env bash
# ──────────────────────────────────────────────
#  FrameVault — Launch Script (macOS / Linux)
# ──────────────────────────────────────────────

set -e

CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

echo ""
echo -e "${YELLOW}  ███████╗██████╗  █████╗ ███╗   ███╗███████╗${RESET}"
echo -e "${YELLOW}  ██╔════╝██╔══██╗██╔══██╗████╗ ████║██╔════╝${RESET}"
echo -e "${YELLOW}  █████╗  ██████╔╝███████║██╔████╔██║█████╗  ${RESET}"
echo -e "${YELLOW}  ██╔══╝  ██╔══██╗██╔══██║██║╚██╔╝██║██╔══╝  ${RESET}"
echo -e "${YELLOW}  ██║     ██║  ██║██║  ██║██║ ╚═╝ ██║███████╗${RESET}"
echo -e "${YELLOW}  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝${RESET}"
echo -e "${CYAN}           V A U L T  ·  Precision Capture${RESET}"
echo ""

# ── Check for Node.js ──────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo -e "${RED}  ✗ Node.js not found.${RESET}"
  echo -e "    Please install it from ${CYAN}https://nodejs.org${RESET} and re-run this script."
  exit 1
fi

NODE_VER=$(node -v)
echo -e "${GREEN}  ✓ Node.js found:${RESET} $NODE_VER"

# ── Check for npm ──────────────────────────────────────────────────────────
if ! command -v npm &> /dev/null; then
  echo -e "${RED}  ✗ npm not found. Please reinstall Node.js.${RESET}"
  exit 1
fi

# ── First-time setup ───────────────────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo ""
  echo -e "${CYAN}  → First run detected. Installing dependencies...${RESET}"
  npm install
  echo -e "${GREEN}  ✓ Dependencies installed.${RESET}"
else
  echo -e "${GREEN}  ✓ Dependencies already installed.${RESET}"
fi

# ── Launch ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  → Starting FrameVault dev server...${RESET}"
echo -e "    Open ${YELLOW}http://localhost:5173${RESET} in your browser."
echo -e "    Press ${RED}Ctrl+C${RESET} to stop."
echo ""

npm run dev
