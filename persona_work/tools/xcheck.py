#!/usr/bin/env python3
"""Step 6 support: line-aligned cross-check against the zh-CN corpus.

ja and zc are line-aligned (both 24134 lines, same text IDs).  The Chinese
translation frequently promotes a Japanese pronoun (彼女 / 少年) into an actual
name (青子 / 草十郎), which is exactly the cheap attribution witness the
handoff calls out in section 4.

Usage:
    python xcheck.py show 12007 12012
    python xcheck.py zoom 12000 12020
    python xcheck.py grep 青子 12000 12100
    python xcheck.py batch lowconf.txt        # file: one line number per line
"""
import io
import os
import re
import sys

BASE = r"D:\QuickLook插件包\moye\game_scripts\ctd\data00200.hfa"
JA = os.path.join(BASE, "script_text_ja.ctd")
ZC = os.path.join(BASE, "script_text_zc.ctd")
ZT = os.path.join(BASE, "script_text_zt.ctd")
EN = os.path.join(BASE, "script_text_en.ctd")

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def load(path):
    with open(path, "rb") as fh:
        t = fh.read().decode("utf-8")
    lines = t.replace("\r\n", "\n").split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    return lines


_JA = None
_ZC = None


def ja():
    global _JA
    if _JA is None:
        _JA = load(JA)
    return _JA


def zc():
    global _ZC
    if _ZC is None:
        _ZC = load(ZC)
    return _ZC


def fmt(ln):
    j = ja()[ln - 1]
    z = zc()[ln - 1]
    j = re.sub(r"<([^|>]+)\|([^>]+)>", r"\1", j)
    return "L%05d\n   JA %s\n   ZC %s" % (ln, j, z)


def cmd_show(nums):
    for n in nums:
        print(fmt(int(n)))


def cmd_zoom(a, b):
    for n in range(int(a), int(b) + 1):
        print(fmt(n))
    print()


def cmd_grep(name, a, b):
    hits = []
    for n in range(int(a), int(b) + 1):
        if name in zc()[n - 1]:
            hits.append(n)
    print("grep %r in L%d..L%d : %d hits" % (name, int(a), int(b), len(hits)))
    for n in hits:
        print(fmt(n))


def cmd_batch(path):
    with open(path, encoding="utf-8") as fh:
        nums = [int(x.strip()) for x in fh if x.strip().isdigit()]
    for n in nums:
        print(fmt(n))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd = sys.argv[1]
    if cmd == "show":
        cmd_show(sys.argv[2:])
    elif cmd == "zoom":
        cmd_zoom(sys.argv[2], sys.argv[3])
    elif cmd == "grep":
        cmd_grep(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "batch":
        cmd_batch(sys.argv[2])
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
