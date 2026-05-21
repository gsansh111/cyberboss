#!/usr/bin/env bash
set -euo pipefail

WATCHDOG_LOG="$HOME/.cyberboss/watchdog.log"
BRIDGE_PID_FILE="$HOME/.cyberboss/logs/shared-wechat.pid"
BRIDGE_DIR="$HOME/cyberboss"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$WATCHDOG_LOG"
}

# Check if the shared-start process is running
if [ -f "$BRIDGE_PID_FILE" ]; then
  BRIDGE_PID=$(cat "$BRIDGE_PID_FILE" 2>/dev/null || echo "")
  if [ -n "$BRIDGE_PID" ] && kill -0 "$BRIDGE_PID" 2>/dev/null; then
    # Process is running — nothing to do
    exit 0
  fi
  log "PID file exists but process $BRIDGE_PID is not running. Starting..."
else
  log "No PID file found. Starting..."
fi

# Try to start the bridge
cd "$BRIDGE_DIR" 2>/dev/null || {
  log "ERROR: Cannot cd to $BRIDGE_DIR"
  exit 1
}

nohup node scripts/shared-start.js >> "$WATCHDOG_LOG" 2>&1 &
NEW_PID=$!
echo $NEW_PID > "$BRIDGE_PID_FILE" 2>/dev/null || true
log "Started shared-start with PID $NEW_PID"
