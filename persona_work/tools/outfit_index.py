"""★ 服装行全量清单：某个 (角色, i3) 下，每个 `i4` 通道有哪些帧、对应哪个文件。
这就是「穷举某个景所需服装下的全部表情差分」的机器可读版。

用法:
    python outfit_index.py aok 12
    python outfit_index.py --all-scenes      # 六个景涉及的服装行全导
"""
import json, os, re, sys
from collections import defaultdict

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUT = r"D:\QuickLook插件包\moye\persona_work\stage\outfit_index.json"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")

SCENES = {
    "A1": [("ari", "01")], "A2": [("ari", "01")], "A3": [("aok", "12")],
    "A4": [("aok", "03")], "A5": [("koj", "00"), ("koj", "01")],
    "A6": [("koj", "01")], "A3sou": [("sou", "12")], "A3tob": [("tob", "00")],
}


def index(who, i3):
    chans = defaultdict(dict)      # i4 -> v -> [file]
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            m = SINGLE.match(f.split(".mzp.png")[0])
            if not m or m.group(1) != who or m.group(3) != i3 or m.group(6):
                continue
            chans[m.group(4)].setdefault(m.group(5), []).append(f"{arch}/{f}")
    return {e: {v: fl for v, fl in sorted(d.items())} for e, d in sorted(chans.items())}


def main():
    out = {}
    pairs = set()
    for v in SCENES.values():
        pairs |= set(v)
    for who, i3 in sorted(pairs):
        idx = index(who, i3)
        n = sum(len(d) for d in idx.values())
        out[f"{who}_{i3}"] = {
            "who": who, "i3": i3,
            "channels": sorted(idx),
            "frames_total": n,
            "by_channel": idx,
        }
        print(f"{who} i3={i3}: {len(idx)} 个通道, 共 {n} 帧  "
              f"[{' '.join(sorted(idx))}]")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("写出", OUT)


if __name__ == "__main__":
    main()
