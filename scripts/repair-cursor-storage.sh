#!/usr/bin/env bash
# Repairs Cursor globalStorage when state.vscdb is corrupted (often after a full-file rewrite).
# Quit Cursor completely before running this script.

set -euo pipefail

STORAGE_DIR="${CURSOR_GLOBAL_STORAGE:-$HOME/.config/Cursor/User/globalStorage}"
DB="$STORAGE_DIR/state.vscdb"
WAL="$STORAGE_DIR/state.vscdb-wal"
SHM="$STORAGE_DIR/state.vscdb-shm"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$STORAGE_DIR/repair-backup-$STAMP"

if pgrep -x cursor >/dev/null 2>&1 || pgrep -f "/usr/share/cursor" >/dev/null 2>&1; then
  echo "Cursor is still running. Quit Cursor completely, then rerun this script."
  exit 1
fi

if [[ ! -f "$DB" ]]; then
  echo "No state.vscdb found at $DB — nothing to repair."
  exit 0
fi

mkdir -p "$BACKUP_DIR"
cp -a "$DB" "$BACKUP_DIR/" 2>/dev/null || true
[[ -f "$WAL" ]] && cp -a "$WAL" "$BACKUP_DIR/"
[[ -f "$SHM" ]] && cp -a "$SHM" "$BACKUP_DIR/"

check_db() {
  sqlite3 "$1" "PRAGMA integrity_check;" 2>/dev/null | head -1
}

echo "Removing stale WAL sidecars..."
rm -f "$WAL" "$SHM"

RESULT="$(check_db "$DB" || true)"
if [[ "$RESULT" == "ok" ]]; then
  echo "state.vscdb integrity is OK after removing WAL sidecars."
  echo "Backup saved to $BACKUP_DIR"
  exit 0
fi

echo "state.vscdb is still damaged ($RESULT)."
mv "$DB" "$BACKUP_DIR/state.vscdb.broken"
echo "Moved broken database aside. Cursor will create a fresh state.vscdb on next launch."
echo "You may need to sign in to Cursor again. Backup: $BACKUP_DIR"
