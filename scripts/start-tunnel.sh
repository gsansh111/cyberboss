#!/bin/bash
# Start cloudflared quick tunnel and save URL to file
URL_FILE="$HOME/.cyberboss/cf-tunnel-url.txt"
mkdir -p "$HOME/.cyberboss"

/usr/local/bin/cloudflared tunnel --url http://127.0.0.1:4321 2>&1 | while read line; do
  echo "$line"
  if [[ "$line" =~ (https://[a-z0-9-]+\.trycloudflare\.com) ]]; then
    echo "${BASH_REMATCH[1]}" > "$URL_FILE"
    echo "[tunnel] URL saved: ${BASH_REMATCH[1]}"
  fi
done
