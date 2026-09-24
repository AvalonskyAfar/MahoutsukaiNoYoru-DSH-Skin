"""从 .chs 剧本反查 BGM 引用 —— 找出开场、标题、ED 各自用哪首 m*"""
import os, re, glob, collections

CHS = r"D:\QuickLook插件包\moye\game_scripts\chs"
print("### BGM-REFS-START ###")

mpat = re.compile(r"^m\d{2}$|^x_m\d+$")
def refs(name):
    p = glob.glob(os.path.join(CHS, "**", name + ".chs"), recursive=True)
    if not p:
        return None
    d = open(p[0], "rb").read()
    ss = [s.decode("ascii") for s in re.findall(rb"[\x20-\x7e]{2,}", d)]
    return [s for s in ss if mpat.match(s)]

print("=== 关键脚本的 BGM 引用 ===")
for nm, note in [("staffroll", "片尾名单 → ED"),
                 ("start_script", "启动脚本"),
                 ("archive", "书库"),
                 ("opening", "片头")]:
    r = refs(nm)
    if r is None:
        print(f"  {nm:<14} ({note}) —— 未找到")
        continue
    uniq = list(dict.fromkeys(r))
    print(f"  {nm:<14} ({note})  共 {len(r)} 处引用，去重 {len(uniq)} 个: {uniq}")

print("\n=== 全库 BGM 引用频次（哪些曲子被哪些章引用）===")
use = collections.defaultdict(list)
allrefs = collections.Counter()
for p in glob.glob(os.path.join(CHS, "**", "*.chs"), recursive=True):
    ch = os.path.basename(p)[:-4]
    d = open(p, "rb").read()
    ss = [s.decode("ascii") for s in re.findall(rb"[\x20-\x7e]{2,}", d)]
    ms = {s for s in ss if mpat.match(s)}
    for m in ms:
        use[m].append(ch)
        allrefs[m] += 1

have = [f"m{i:02d}" for i in range(1, 65)]
missing = [m for m in have if m not in use]
print(f"  m01~m64 中被 .chs 引用到的: {len([m for m in have if m in use])} / 64")
print(f"  未被任何 .chs 引用的: {missing}")
print("\n  按被引用章数排序（前 20）:")
for m, chs in sorted(use.items(), key=lambda x: -len(x[1]))[:20]:
    print(f"    {m:<8} {len(chs):>3} 章   例: {', '.join(sorted(chs)[:8])}")
print("### BGM-REFS-END ###")
