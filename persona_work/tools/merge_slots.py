"""把一个「逐文件判定」JSON 数组合并进 slots_manual_main.json 的某个景下。

用法: python merge_slots.py <景id> <判定JSON文件>
判定 JSON 形如 [{"no":1,"id":"...","slot":"...","desc":"...","conf":"high"}, ...]
"""
import json, os, sys

STAGE = r"D:\QuickLook插件包\moye\persona_work\stage"
TARGET = os.path.join(STAGE, "slots_manual_main.json")
MAP = {"high": "high", "mid": "mid", "low": "low", "高": "high", "中": "mid", "低": "low"}


def main():
    scene, src = sys.argv[1], sys.argv[2]
    items = json.load(open(src, encoding="utf-8"))
    d = json.load(open(TARGET, encoding="utf-8"))
    d.setdefault(scene, {})
    n = 0
    for it in items:
        fid = it.get("id")
        slot = it.get("slot")
        if not fid or not slot:
            continue
        d[scene][fid] = {
            "slot": slot,
            "desc": it.get("desc", ""),
            "conf": MAP.get(str(it.get("conf", "mid")).lower(), "mid"),
            "src": it.get("src", "sub"),
        }
        n += 1
    json.dump(d, open(TARGET, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"合并 {n} 条到 {scene} -> {TARGET}")


if __name__ == "__main__":
    main()
