#!/usr/bin/env python3
import json, os, subprocess, sys
from datetime import datetime, timezone

QUEUE = os.path.expanduser("~/.cyberboss/system-message-queue.json")
LOG = os.path.expanduser("~/.cyberboss/auto-clear.log")

try:
    with open(QUEUE) as f:
        msgs = json.load(f).get("messages", [])
    if not msgs:
        sys.exit(0)
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(msgs[0]["createdAt"].replace("Z","+00:00"))).total_seconds() / 60
    if age < 30:
        sys.exit(0)
    with open(LOG, "a") as f:
        f.write(f"[auto-clear] {datetime.now():%Y-%m-%d %H:%M:%S} - clearing (age={int(age)}m)\n")
    with open(QUEUE, "w") as f:
        json.dump({"messages": []}, f)
    subprocess.run(["pm2", "restart", "cyberboss", "--silent"])
except Exception:
    sys.exit(0)