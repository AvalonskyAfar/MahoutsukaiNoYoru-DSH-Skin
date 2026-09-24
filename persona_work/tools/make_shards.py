#!/usr/bin/env python3
"""Step 2: split script_text_ja.ctd into 32 overlapping shards.

Each shard line is written as:  <<<L00012>>>　本文...
so a child agent can cite exact global line numbers.

Layout: 32 shards, 60-line overlap on BOTH sides (the handoff calls 60 a lower
bound; we keep 60 because each shard is read by a full-context subagent).
"""
import os

SRC = r"D:\QuickLook插件包\moye\game_scripts\ctd\data00200.hfa\script_text_ja.ctd"
OUT = r"D:\QuickLook插件包\moye\persona_work\shards"
N = 32
OVER = 60

with open(SRC, "r", encoding="utf-8", newline="") as fh:
    raw = fh.read()
lines = raw.split("\r\n")
if lines and lines[-1] == "":
    lines.pop()
total = len(lines)
print(f"total lines = {total}")

os.makedirs(OUT, exist_ok=True)
stride = total // N          # base span of the non-overlapping core
written = []
for k in range(1, N + 1):
    core_start = (k - 1) * stride + 1
    core_end = total if k == N else k * stride
    start = max(1, core_start - OVER)
    end = min(total, core_end + OVER)
    path = os.path.join(OUT, f"{k:02d}.txt")
    body = []
    for i in range(start, end + 1):
        body.append(f"<<<L{i:05d}>>>{lines[i - 1]}")
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(body) + "\n")
    written.append((k, start, end, end - start + 1))

print(f"wrote {len(written)} shards")
for k, s, e, n in written:
    print(f"  {k:02d}  {s:>6} .. {e:>6}   {n:>4} lines")
# coverage proof: union of cores must be exactly 1..total with no gaps
covered = set()
for k in range(1, N + 1):
    a = (k - 1) * stride + 1
    b = total if k == N else k * stride
    covered.update(range(a, b + 1))
print("coverage:", min(covered), "..", max(covered), "count =", len(covered),
      "seamless =", covered == set(range(1, total + 1)))
