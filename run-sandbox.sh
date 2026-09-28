#!/bin/bash
# ==============================================================================
# WELL POS — UNIFIED LOCAL SANDBOX RUNNER
# Menjalankan Backend API (Port 5001) & Frontend Client (Port 5173) Sekaligus
# ==============================================================================

set -e

# Warna Terminal
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/pos_apps/server"
CLIENT_DIR="$ROOT_DIR/pos_apps/client"

echo -e "${BLUE}${BOLD}"
echo "=================================================================="
echo "          🚀 WELL POS — ZERO-FRICTION LOCAL SANDBOX RUNNER        "
echo "=================================================================="
echo -e "${NC}"
echo -e "${CYAN}Direktori Proyek:${NC} $ROOT_DIR"
echo -e "${CYAN}Backend Service :${NC} $SERVER_DIR (Port 5001)"
echo -e "${CYAN}Frontend Client :${NC} $CLIENT_DIR (Port 5173)"
echo ""

# Periksa node_modules
if [ ! -d "$SERVER_DIR/node_modules" ]; then
  echo -e "${YELLOW}⚠️ node_modules backend belum terpasang. Menjalankan npm install...${NC}"
  (cd "$SERVER_DIR" && npm install)
fi

if [ ! -d "$CLIENT_DIR/node_modules" ]; then
  echo -e "${YELLOW}⚠️ node_modules client belum terpasang. Menjalankan npm install...${NC}"
  (cd "$CLIENT_DIR" && npm install)
fi

echo -e "${GREEN}${BOLD}⚡ Kredensial Akun Sandbox Siap Pakai:${NC}"
echo -e "   1. Platform SuperAdmin : ${BOLD}superadmin@wellpos.id${NC} (Pass: SuperAdmin123!)"
echo -e "   2. Merchant Owner      : ${BOLD}owner@uracoffee.id${NC}    (Pass: Owner123!)"
echo -e "   3. Kasir Toko          : ${BOLD}kasir@uracoffee.id${NC}    (PIN: 123456 / Pass: Kasir123!)"
echo -e "   4. Kepala Gudang       : ${BOLD}gudang@uracoffee.id${NC}   (Pass: Gudang123!)"
echo -e "   5. Supervisor Toko     : ${BOLD}supervisor@uracoffee.id${NC} (Pass: Spv123!)"
echo ""
echo -e "${YELLOW}Tips: Tekan Ctrl+C untuk menghentikan seluruh layanan secara bersih.${NC}"
echo "------------------------------------------------------------------"

# Trap untuk membersihkan child processes saat SIGINT (Ctrl+C) atau SIGTERM
cleanup() {
  echo ""
  echo -e "${RED}${BOLD}🛑 Menghentikan seluruh proses sandbox...${NC}"
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -n "$CLIENT_PID" ]; then
    kill "$CLIENT_PID" 2>/dev/null || true
  fi
  wait "$SERVER_PID" 2>/dev/null || true
  wait "$CLIENT_PID" 2>/dev/null || true
  echo -e "${GREEN}✓ Layanan backend dan frontend berhasil dimatikan secara bersih.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Menjalankan Backend API
echo -e "${GREEN}▶ Memulai Backend REST API di port 5001...${NC}"
(cd "$SERVER_DIR" && npm run dev) &
SERVER_PID=$!

# Menjalankan Frontend Vite Dev Server
echo -e "${GREEN}▶ Memulai Frontend Client di port 5173...${NC}"
(cd "$CLIENT_DIR" && npm run dev) &
CLIENT_PID=$!

# Tunggu child processes
wait
