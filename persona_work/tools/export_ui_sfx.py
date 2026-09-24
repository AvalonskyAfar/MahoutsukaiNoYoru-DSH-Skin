# -*- coding: utf-8 -*-
"""把 data00300.hfa 里 7 个 UI 音效（SSE*.hw）导出成可直接 <audio> 播的 .ogg。

依据（本次实测确认，见 docs/21 §7）：
  `.hw` = **64 字节头 + 完整 OGG Vorbis 流**，且在 HFA 里**未再压缩**。
  → 所以"导出音效"**不需要任何解码器/转码器**，把前 64 字节切掉就是合法 .ogg。
     （docs/07 §3.3 说 .hw 是"裸 PCM"是错的；docs/15 §9.2 是对的。）

用法：
    python persona_work/tools/export_ui_sfx.py            # 试跑（只报告，不写文件）
    python persona_work/tools/export_ui_sfx.py --write    # 真正导出到 skin/assets/se/
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "hfa_tools"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from hfa import Hfa, GAME  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DST = os.path.join(ROOT, "skin", "assets", "se")

# client.js 的 SFX 表引用的 6 个键 → 原作文件名
WANT = {
    "menu": "SSETurnedPage.hw",
    "decide": "SSEDecided.hw",
    "move": "SSEChoiced.hw",
    "book": "SSEBookDecided.hw",
    "cancel": "SSECancelled.hw",
    "unable": "SSEUnable.hw",
}
EXTRA = ["SSEBookChoiced.hw"]  # 書庫内移动焦点，表里暂时没用，一并导出备用


def ogg_payload(raw):
    """切掉 64 字节头；校验 OggS 恰好落在 64 且带 vorbis 标识。"""
    off = raw.find(b"OggS")
    if off < 0:
        return None, "找不到 OggS"
    if off != 64:
        return None, f"OggS 偏移 {off} != 64（头长度不符）"
    if raw.find(b"vorbis", off, off + 128) <= 0:
        return None, "OggS 后 128 字节内没有 vorbis 标识"
    return raw[64:], "ok"


def main():
    write = "--write" in sys.argv
    arch = os.path.join(GAME, "data00300.hfa")
    if not os.path.isfile(arch):
        print("✗ 找不到", arch)
        return 1
    a = Hfa(arch)
    by_name = {e.name: e for e in a.entries}
    if write:
        os.makedirs(DST, exist_ok=True)

    print("归档:", os.path.basename(arch), f"({len(a.entries)} 条目)")
    print("%-24s %-22s %10s %10s  %s" % ("原作名", "导出名", ".hw", ".ogg", "判定"))
    print("-" * 92)
    ok = fail = 0
    for key, hw in list(WANT.items()) + [("(备用)", x) for x in EXTRA]:
        e = by_name.get(hw)
        if not e:
            print("%-24s %-22s %10s %10s  %s" % (hw, "-", "-", "-", "✗ 归档里没有"))
            fail += 1
            continue
        raw = a.read(e)
        body, why = ogg_payload(raw)
        out_name = hw[:-3] + ".ogg"
        if body is None:
            print("%-24s %-22s %10d %10s  ✗ %s" % (hw, out_name, len(raw), "-", why))
            fail += 1
            continue
        if write:
            with open(os.path.join(DST, out_name), "wb") as f:
                f.write(body)
        ok += 1
        print("%-24s %-22s %10d %10d  ✅ %s" % (hw, out_name, len(raw), len(body),
                                               "已写" if write else "校验通过（未写）"))
    print("-" * 92)
    print(f"结果：{ok} 个可用 / {fail} 个失败"
          + (f"  → 已导出到 {DST}" if write else "   （加 --write 才真正写盘）"))

    if write and ok:
        print("\n下一步：把 skin/lib/client.js 的 SFX 表从空串改成 'se/SSE*.ogg'，")
        print("        并确认 settings.yaml 的 sfx: true（当前是 false）。")
        print("        ★ 素材 URL 必须带 ?v=<BUILD_ID>（docs/19 §3-1）；SFX 走的是")
        print("          assetURL() 就自动带，若手写路径要自己补。")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
