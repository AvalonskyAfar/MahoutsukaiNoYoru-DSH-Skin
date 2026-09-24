"""给每个景补一份「同一服装行里其他可用差分」—— 只从**同一 i4 通道**取，
且只取与已判定文件**同通道内相邻**的帧，全部标 `unverified`，供后续视觉复核。

理由：某个景缺失的槽位（如 A4 缺 `tired`），往往在**同一套衣服**的其他章节里出现过。
这是"每个景的组合不一样"的补救，但**同通道相邻 ≠ 同表情**（已实测），
所以只能作为「候选」，不能直接进主表。

用法: python build_extended.py
"""
import json, os, re, sys
from collections import defaultdict

STAGE = r"D:\QuickLook插件包\moye\persona_work\stage"
ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
SLOTS = ["neutral", "smile", "laugh", "angry", "glare", "surprised",
         "troubled", "sad", "serious", "think", "tired", "shy"]
NON_EMO = {"blink", "talk", "unknown", ""}
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})$")


def main():
    exp = json.load(open(os.path.join(STAGE, "expressions.json"), encoding="utf-8"))
    idx = json.load(open(os.path.join(STAGE, "outfit_index.json"), encoding="utf-8"))
    slots = json.load(open(os.path.join(STAGE, "slots_manual_main.json"), encoding="utf-8"))

    out = {}
    for sid, sc in exp["scenes"].items():
        if not sc.get("character"):
            continue
        who, i3 = sc["character"], sc["outfit_i3"]
        key = f"{who}_{i3}"
        bych = idx.get(key, {}).get("by_channel", {})
        have = set()
        for lst in sc["slots"].values():
            for it in lst:
                have.add(it["file"])

        # 该景已判定过的 (i4, v) -> slot
        known = {}
        for fid, rec in slots.get(sid, {}).items():
            m = SINGLE.match(fid)
            if m and m.group(1) == who and m.group(3) == i3:
                # key = (i4, v)  ->  (slot, conf)
                known[(m.group(4), m.group(5))] = (rec["slot"], rec.get("conf", "low"))

        ext = defaultdict(list)
        for e, frames in bych.items():
            # 该通道内已判定的帧
            near = sorted((int(vv), sv[0]) for (ee, vv), sv in known.items() if ee == e)
            if not near:
                continue
            have_v = {f.rsplit("_", 1)[1] for f in have
                      if SINGLE.match(f.rsplit("_", 1)[0]) and
                      SINGLE.match(f.rsplit("_", 1)[0]).group(4) == e}
            for v in sorted(frames):
                if v in have_v:
                    continue
                cur = int(v)
                best_v, slot = min(near, key=lambda x: abs(x[0] - cur))
                if slot in NON_EMO:
                    continue
                ext[slot].append({
                    "file": frames[v][0].replace(".mzp.png", ""),
                    "channel": e, "v": v,
                    "anchor": f"同通道 i4={e} 的 v{best_v:02d}（判定为 {slot}）",
                    "status": "unverified",
                })
        out[sid] = {
            "character": who, "outfit_i3": i3,
            "note": "同一服装行里、该景未引用过、但同通道相邻帧被判为同一槽位的候选。"
                    "⚠️ 同通道相邻 ≠ 同表情（实测），启用前必须逐张视觉复核。",
            "slots_missing_in_main": sc["slots_missing"],
            "extended": {k: v[:6] for k, v in sorted(ext.items())},
        }

    p = os.path.join(STAGE, "expressions_extended.json")
    json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("写出", p)
    for sid, v in out.items():
        cov = [s for s in SLOTS if v["extended"].get(s)]
        print(f"  {sid}: 主表缺 {len(v['slots_missing_in_main'])} 个槽位；"
              f"可补候选覆盖 {len(cov)} 个 -> {cov}")


if __name__ == "__main__":
    main()
