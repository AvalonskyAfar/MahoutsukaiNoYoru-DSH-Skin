#!/usr/bin/env python3
"""Parse the 32 MAP outputs, verify coverage, and aggregate into JSON indexes.

Input : persona_work/out/NN.txt   (pipeline-delimited records from the MAP pass)
Output: persona_work/agg/records.json
        persona_work/agg/report.txt
"""
import json
import os
import re
import sys

BASE = r"D:\QuickLook插件包\moye\persona_work"
OUT = os.path.join(BASE, "out")
AGG = os.path.join(BASE, "agg")
os.makedirs(AGG, exist_ok=True)

TOTAL = 24134
SLOTS = ["neutral", "smile", "laugh", "angry", "glare", "surprised",
         "troubled", "sad", "serious", "think", "tired", "shy"]
CHARS = ["aok", "ari", "sou", "kin", "tou", "tob", "sis", "oth", "mob", "unknown"]

rec = {"shard": [], "A": [], "E": [], "P": [], "V": [], "S": [], "bad": []}


def num(s):
    s = s.strip()
    return int(s) if s.isdigit() else None


for i in range(1, 33):
    p = os.path.join(OUT, "%02d.txt" % i)
    if not os.path.exists(p):
        rec["shard"].append({"n": i, "missing": True})
        continue
    with open(p, encoding="utf-8") as fh:
        raw = fh.read()
    lines = [ln.rstrip("\n") for ln in raw.split("\n")]
    nlines = 0
    first = last = None
    cnt = {"A": 0, "E": 0, "P": 0, "V": 0, "S": 0}
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        nlines += 1
        f = ln.split("|")
        tag = f[0]
        try:
            if tag == "#SHARD":
                cnt["shard_bounds"] = (num(f[2]), num(f[3]))
            elif tag == "#A" and len(f) >= 5:
                line = num(f[1])
                rec["A"].append({"shard": i, "line": line, "speaker": f[2],
                                 "conf": f[3], "ev": f[4]})
                cnt["A"] += 1
            elif tag == "#E" and len(f) >= 7:
                line = num(f[1])
                slot = f[5].strip() if len(f) > 5 else ""
                rec["E"].append({"shard": i, "line": line, "subject": f[2],
                                 "raw": f[3], "act": f[4], "slot": slot,
                                 "intensity": f[6] if len(f) > 6 else "",
                                 "target": f[7] if len(f) > 7 else "-"})
                cnt["E"] += 1
            elif tag == "#P" and len(f) >= 5:
                rec["P"].append({"shard": i, "line": num(f[1]), "subject": f[2],
                                 "inner": f[3], "traits": f[4]})
                cnt["P"] += 1
            elif tag == "#V" and len(f) >= 4:
                rec["V"].append({"shard": i, "speaker": f[1], "kind": f[2],
                                 "pattern": f[3]})
                cnt["V"] += 1
            elif tag == "#S" and len(f) >= 5:
                rec["S"].append({"shard": i, "start": num(f[1]), "end": num(f[2]),
                                 "who": f[3], "what": f[4]})
                cnt["S"] += 1
            else:
                rec["bad"].append({"shard": i, "line": ln[:160]})
        except Exception as exc:  # noqa: BLE001
            rec["bad"].append({"shard": i, "line": ln[:160], "err": str(exc)})
    if rec["A"]:
        pass
    a = [r["line"] for r in rec["A"] if r["shard"] == i and r["line"]]
    if a:
        first, last = min(a), max(a)
    rec["shard"].append({"n": i, "lines": nlines, "counts": cnt,
                         "first": first, "last": last})

# ---------------- report ----------------
L = []
L.append("=== MAP coverage ===")
done = [s for s in rec["shard"] if not s.get("missing")]
L.append("shards present: %d / 32" % len(done))
missing = [s["n"] for s in rec["shard"] if s.get("missing")]
if missing:
    L.append("MISSING shards: %s" % missing)
tot = {"A": 0, "E": 0, "P": 0, "V": 0, "S": 0}
for s in done:
    c = s["counts"]
    for k in tot:
        tot[k] += c.get(k, 0)
    L.append("  %02d lines=%-4d A=%-3d E=%-3d P=%-3d V=%-3d S=%-3d" %
             (s["n"], s["lines"], c.get("A", 0), c.get("E", 0), c.get("P", 0),
              c.get("V", 0), c.get("S", 0)))
L.append("TOTALS %s" % tot)
L.append("malformed lines: %d" % len(rec["bad"]))
for b in rec["bad"][:15]:
    L.append("   shard %02d: %s" % (b["shard"], b["line"]))

# line coverage of attributions / expressions
for key in ("A", "E", "P"):
    ls = sorted({r["line"] for r in rec[key] if r["line"]})
    L.append("%s distinct lines: %d  range %s..%s" %
             (key, len(ls), ls[0] if ls else "-", ls[-1] if ls else "-"))
    gaps = [b for a, b in zip(ls, ls[1:]) if b - a > 900]
    L.append("   >900-line gaps: %d %s" % (len(gaps), gaps[:12]))

L.append("")
L.append("=== expression slot histogram ===")
sl = {}
for r in rec["E"]:
    sl[r["slot"]] = sl.get(r["slot"], 0) + 1
for k, v in sorted(sl.items(), key=lambda x: -x[1]):
    L.append("  %-12s %d" % (k, v))
L.append("  unknown/blank: %d" % sl.get("", 0))

L.append("")
L.append("=== expression subject histogram (top) ===")
su = {}
for r in rec["E"]:
    su[r["subject"]] = su.get(r["subject"], 0) + 1
for k, v in sorted(su.items(), key=lambda x: -x[1])[:20]:
    L.append("  %-10s %d" % (k, v))

L.append("")
L.append("=== subject x slot matrix (top chars) ===")
mx = {}
for r in rec["E"]:
    mx.setdefault(r["subject"], {}).setdefault(r["slot"], 0)
    mx[r["subject"]][r["slot"]] += 1
hdr = "  %-8s" % "subj" + "".join("%-10s" % s for s in SLOTS)
L.append(hdr)
for ch in ["aok", "ari", "sou", "kin"]:
    row = "  %-8s" % ch
    for s in SLOTS:
        row += "%-10s" % mx.get(ch, {}).get(s, 0)
    L.append(row)

L.append("")
L.append("=== attribution confidence ===")
cf = {}
for r in rec["A"]:
    cf[r["conf"]] = cf.get(r["conf"], 0) + 1
for k, v in sorted(cf.items(), key=lambda x: -x[1]):
    L.append("  %-8s %d" % (k, v))
L.append("=== attribution speaker histogram ===")
sp = {}
for r in rec["A"]:
    sp[r["speaker"]] = sp.get(r["speaker"], 0) + 1
for k, v in sorted(sp.items(), key=lambda x: -x[1]):
    L.append("  %-10s %d" % (k, v))

L.append("")
L.append("=== psych trait tag frequency (top 40) ===")
tf = {}
for r in rec["P"]:
    for t in re.split(r"[,、，]", r["traits"]):
        t = t.strip()
        if t:
            tf[t] = tf.get(t, 0) + 1
for k, v in sorted(tf.items(), key=lambda x: -x[1])[:40]:
    L.append("  %-16s %d" % (k, v))

L.append("")
L.append("=== voice patterns per speaker ===")
vp = {}
for r in rec["V"]:
    vp.setdefault(r["speaker"], []).append((r["kind"], r["pattern"]))
for ch in ["aok", "ari", "sou", "kin"]:
    L.append("  --- %s (%d) ---" % (ch, len(vp.get(ch, []))))
    agg = {}
    for kind, pat in vp.get(ch, []):
        agg[pat] = agg.get(pat, 0) + 1
    for pat, c in sorted(agg.items(), key=lambda x: -x[1])[:40]:
        L.append("      %s" % pat)

rep = "\n".join(L)
with open(os.path.join(AGG, "report.txt"), "w", encoding="utf-8") as fh:
    fh.write(rep + "\n")
with open(os.path.join(AGG, "records.json"), "w", encoding="utf-8") as fh:
    json.dump(rec, fh, ensure_ascii=False, indent=1)
print(rep)
print("\nwrote agg/records.json and agg/report.txt")
