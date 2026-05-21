#!/bin/bash
QUEUE="$HOME/.cyberboss/system-message-queue.json"
AGE_MIN=30
if [ ! -f "$QUEUE" ]; then exit 0; fi
# check if queue is non-empty
count=$(python3 -c "import json;
print(len(json.load(open("$QUEUE")).get('messages',[])))" 2>/dev/null || echo "0")
if [ "$count" = "0" ]; then exit 0; fi
# check age of oldest message
now=$(date +%s)
oldest=$(python3 -c "
import json,sys
msgs=json.load(open("$QUEUE")).get('messages',[])
if msgs:
print(msgs[0].get('createdAt',''))
" 2>/dev/null)
if [ -z "$oldest" ]; then exit 0; fi
ts=$(date -d "$oldest" +%s 2>/dev/null || echo 0)
age=$(( ($now - $ts) / 60 ))
if [ "$age" -ge "$AGE_MIN" ]; then
echo "[auto-clear] $(date '+%Y-%m-%d %H:%M:%S') - clearing stuck message
(age=${age}m)" >> "$HOME/.cyberboss/auto-clear.log"
echo '{"messages":[]}' > "$QUEUE"
pm2 restart cyberboss --silent
fi
