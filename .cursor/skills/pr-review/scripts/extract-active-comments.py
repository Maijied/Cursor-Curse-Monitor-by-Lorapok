#!/usr/bin/env python3
"""Extract active (unresolved) PR review comments from ADO threads JSON."""
import json
import sys

path = sys.argv[1]
with open(path) as f:
    data = json.load(f)

threads = data.get("value", data) if isinstance(data, dict) else data
if not isinstance(threads, list):
    threads = []

print("# Active PR comments\n")
count = 0
for t in threads:
  status = t.get("status", "")
  if status == "closed":
    continue
  ctx = t.get("threadContext") or {}
  fp = (ctx.get("filePath") or "").lstrip("/")
  line = (ctx.get("rightFileStart") or {}).get("line") or (ctx.get("leftFileStart") or {}).get("line") or "?"
  comments = t.get("comments") or []
  for c in comments:
    if c.get("isDeleted"):
      continue
    author = (c.get("author") or {}).get("displayName", "?")
    content = (c.get("content") or "").strip()
    if not content:
      continue
    count += 1
    loc = f"{fp}:L{line}" if fp else "general"
    print(f"## {count}. {loc} — {author}")
    print(content)
    print()

if count == 0:
  print("_No active thread comments found._")
