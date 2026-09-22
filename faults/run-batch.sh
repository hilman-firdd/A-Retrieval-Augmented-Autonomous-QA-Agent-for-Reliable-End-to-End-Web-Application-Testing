#!/bin/bash
# Batch runner: untuk tiap fault F06..F25, apply patch -> jalankan k=3 di ppi27-e2e -> revert -> lanjut.
set -uo pipefail

APP_DIR="/Users/macbookprom3pro/Sites/erapor-ppi27"
E2E_DIR="/Users/macbookprom3pro/Documents/RISET/A Retrieval-Augmented Autonomous QA Agent for Reliable End-to-End Web Application Testing/files/ppi27-e2e"
PATCH_DIR="$E2E_DIR/faults/patches"

FAULTS="F06 F07 F08 F09 F10 F11 F12 F13 F14 F15 F16 F17 F18 F19 F20 F21 F22 F23 F24 F25"

cd "$APP_DIR" || exit 1
if [ -n "$(git status --short)" ]; then
  echo "ABORT: repo erapor-ppi27 tidak bersih sebelum mulai. Periksa manual." >&2
  git status --short >&2
  exit 1
fi

for F in $FAULTS; do
  echo ""
  echo "=================================================="
  echo "=== FAULT $F : apply patch ==="
  echo "=================================================="
  cd "$APP_DIR" || exit 1
  if ! git apply "$PATCH_DIR/$F.patch"; then
    echo "GAGAL apply patch $F, skip ke fault berikutnya." >&2
    continue
  fi

  echo "=== FAULT $F : jalankan k=3 ==="
  cd "$E2E_DIR" || exit 1
  rm -rf "results/runs/fault-$F"
  BASE_URL=http://127.0.0.1:8000 node scripts/run-repeated.js --k 3 --label "fault-$F"
  RC=$?
  if [ $RC -ne 0 ]; then
    echo "run-repeated.js fault-$F keluar dengan kode $RC (lanjut tetap, cek log)." >&2
  fi

  echo "=== FAULT $F : revert patch ==="
  cd "$APP_DIR" || exit 1
  git checkout -- .
  if [ -n "$(git status --short)" ]; then
    echo "PERINGATAN: repo tidak bersih setelah revert $F!" >&2
    git status --short >&2
  else
    echo "FAULT $F selesai, repo bersih."
  fi
done

echo ""
echo "=================================================="
echo "SEMUA FAULT BARU (F06-F25) SELESAI DIKUMPULKAN"
echo "=================================================="
cd "$APP_DIR" && git status --short
