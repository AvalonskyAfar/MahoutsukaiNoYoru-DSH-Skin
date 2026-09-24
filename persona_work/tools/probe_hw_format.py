# -*- coding: utf-8 -*-
"""探测 .hw 的真实格式：裸 PCM（docs/07 §3.3）还是 64字节头+OGG Vorbis（docs/15 §9.2）。

判别法：在解压后的字节流里找 b'OggS'。
  · 偏移 64 且带 vorbis 标识 → docs/15 对（64 字节头 + OGG Vorbis）
  · 找不到 OggS 且开头是 64 字节头 + 裸 PCM → docs/07 对
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "hfa_tools"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from hfa import Hfa, GAME  # noqa: E402
import lenzu  # noqa: E402

ARCH = os.path.join(GAME, "data03100.hfa")
print("归档:", ARCH, os.path.exists(ARCH))
a = Hfa(ARCH)
hw = [e for e in a.entries if e.ext == ".hw"]
print("条目总数:", len(a.entries), " .hw:", len(hw))

sse = [e for e in hw if "SSE" in e.name]
print("SSE* 音效:", [e.name for e in sse][:10])
print("前 6 个条目名:", [e.name for e in hw[:6]])
print()
print("%-26s %10s %10s %10s  %s" % ("名称", "归档内长", "解压后", "OggS偏移", "判定"))
print("-" * 88)
for e in (sse[:4] or hw[:4]):
    try:
        raw = lenzu.decompress(a.read(e))
        note = "LenZu 解压"
    except Exception:
        raw = a.read(e)
        note = "未压缩"
    off = raw.find(b"OggS")
    if off >= 0:
        has_vorbis = raw.find(b"vorbis", off, off + 128) > 0
        verdict = "64头+OGG Vorbis ✅(docs/15 对)" if (off == 64 and has_vorbis) else \
                  "含 OggS@%d vorbis=%s" % (off, has_vorbis)
    else:
        verdict = "无 OggS（像裸 PCM）"
    print("%-26s %10d %10d %10s  %s" % (e.name, e.length, len(raw), off, verdict))

# 再看一眼头 64 字节里有没有 'hw' 标记
e = sse[0] if sse else hw[0]
try:
    raw = lenzu.decompress(a.read(e))
except Exception:
    raw = a.read(e)
print()
print("样例:", e.name)
print("  头 64 字节 hex:", raw[:64].hex())
print("  含 b'hw':", b"hw" in raw[:64])
if raw.find(b"OggS") >= 0:
    o = raw.find(b"OggS")
    print("  OggS 起 32 字节:", raw[o:o + 32].hex())
