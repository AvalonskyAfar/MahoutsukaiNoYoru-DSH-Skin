"""列出每个景「实际被原作引用过」的立绘帧号（变体号）。

**为什么按帧号列**（2026-09-16 实测更正）：
立绘名的第 4 段 `i4` 是「表情组/通道」，**第 5 段（帧号/变体号）才是真正的表情编号**。
证据：`aok_a_12_02_00..08` 是「平静／闭眼／惊讶／为难／脸红／微笑／生气／怒视／半眼」
等完全不同的表情，不是取景微调。所以查表要用「(角色, 服装行 i3, 帧号) → 表情」。

用法:
    python scene_frames.py A3
    python scene_frames.py --all
"""
import json, os, re, sys
from collections import defaultdict

AGG = r"D:\QuickLook插件包\moye\persona_work\agg\sprite_sequence.json"
ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")

SCENES = {
    "A1/A2": (["4_2", "4_3", "9_3", "9_7", "wik_b_1_b", "wik_e", "wik_g_a", "wik_h_a", "wik_k", "wik_l_2"],
              [("ari", "01")]),
    "A3": (["2_1", "2_2", "2_3", "2_4", "2_5"], [("aok", "12")]),
    "A4": (["d_8"], [("aok", "03")]),
    "A5": (["7_1", "8dot5"], [("koj", "00"), ("koj", "01")]),
    "A6": (["wik_nap", "wik_wakeup", "wik_noroom", "wik_room"], [("koj", "00"), ("koj", "01")]),
    "B": ([], []),
}


def frame_files(who, i3):
    """帧号 -> {通道: 文件}"""
    d = defaultdict(dict)
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            m = SINGLE.match(f.split(".mzp.png")[0])
            if m and m.group(1) == who and m.group(3) == i3 and not m.group(6):
                d[m.group(5)].setdefault(m.group(4), (m.group(2), f"{arch}/{f}"))
    return d


def main():
    data = json.load(open(AGG, encoding="utf-8"))
    want = list(SCENES) if (not sys.argv[1:] or sys.argv[1] == "--all") else sys.argv[1:]
    for scene in want:
        chs, chars = SCENES[scene]
        print(f"\n{'='*76}\n## 景 {scene}   章节 {'+'.join(chs) if chs else '—'}\n")
        for who, i3 in chars:
            refs = defaultdict(list)
            for ch in chs:
                for s in data.get(ch, {}).get("sprites", []):
                    if s["who"] == who and s["i3"] == i3:
                        refs[s["variant"]].append((ch, s["i4"], s["id"]))
            allf = frame_files(who, i3)
            print(f"### {who} i3={i3}  全库共 {len(allf)} 个帧号")
            print(f"原作引用过 {len(refs)} 个帧号: {', '.join(sorted(refs))}\n")
            for v in sorted(refs):
                items = sorted(set(refs[v]))
                chs_used = sorted({c for c, _, _ in items})
                print(f"  帧 v{v}  被 {len(items)} 处引用（章: {','.join(chs_used)}）")
                for c, i4, sid in items:
                    print(f"       {sid}")
                # 全库同帧号的其它通道（用作 fallback 的姿态/批次）
                others = allf.get(v, {})
                print("       全库该帧可用通道: " +
                      ", ".join(f"i4={k}({b})" for k, (b, _f) in sorted(others.items())))


if __name__ == "__main__":
    main()
