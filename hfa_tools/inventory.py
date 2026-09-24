import struct, os, sys, collections, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hfa import Hfa, GAME, OUT

REPORT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'inventory.txt')

archives = [Hfa(os.path.join(GAME, n))
            for n in sorted(os.listdir(GAME)) if n.lower().endswith('.hfa')]

ext_global = collections.Counter()
ext_bytes = collections.Counter()
lines = []
nonimage = []

for a in archives:
    exts = collections.Counter(e.ext for e in a.entries)
    for e in a.entries:
        ext_global[e.ext] += 1
        ext_bytes[e.ext] += e.length
    lines.append(f"=== {a.filename}  count={a.count}  base={a.base:,}  size={os.path.getsize(a.path):,}")
    lines.append("    " + ", ".join(f"{k or '(无扩展名)'}×{v}" for k, v in exts.most_common()))
    for e in a.entries:
        if e.ext not in ('.mzp', '.cbg', '.png', '.jpg', '.webp'):
            nonimage.append(e)

lines.append("")
lines.append("=== 全局扩展名统计（数量 / 总字节）===")
for k, v in ext_global.most_common():
    lines.append(f"  {k or '(无扩展名)':<10} {v:>7}  {ext_bytes[k]:>14,}")

lines.append("")
lines.append(f"=== 非图片条目：{len(nonimage)} 个 ===")
for e in sorted(nonimage, key=lambda x: (x.ext, x.name))[:400]:
    lines.append(f"  {e.ext:<8} {e.length:>10,}  {e.archive:<16} {e.name}")

with open(REPORT, 'w', encoding='utf-8') as f:
    f.write("\n".join(lines))

print("归档数:", len(archives))
print("总条目:", sum(a.count for a in archives))
print("非图片条目:", len(nonimage))
print()
print("=== 全局扩展名 ===")
for k, v in ext_global.most_common():
    print(f"  {k or '(none)':<10} {v:>7}  {ext_bytes[k]:>14,}")
print()
print("报告已写入:", REPORT)

# 分类非图片条目
by_ext = collections.defaultdict(list)
for e in nonimage:
    by_ext[e.ext].append(e)
print()
print("=== 非图片扩展名分类 ===")
for k, v in sorted(by_ext.items(), key=lambda x: -len(x[1])):
    print(f"  {k:<8} {len(v):>5} 个   例: {', '.join(x.name for x in v[:5])}")
