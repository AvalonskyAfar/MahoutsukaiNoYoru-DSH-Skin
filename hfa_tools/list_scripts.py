import struct, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hfa import Hfa, GAME

archives = [Hfa(os.path.join(GAME, n))
            for n in sorted(os.listdir(GAME)) if n.lower().endswith('.hfa')]

want = {'.chs', '.ctd', '.ccit'}
sel = [e for a in archives for e in a.entries if e.ext in want]

# 头部模式分类
pat = collections.Counter()
heads = {}
for e in sel:
    a = next(x for x in archives if x.filename == e.archive)
    data = a.read(e)[:32]
    key = data[:16]
    pat[(e.ext, key)] += 1
    heads.setdefault((e.ext, key), (e, data))

print("=== 头部模式 ===")
for (ext, key), n in pat.most_common():
    e, data = heads[(ext, key)]
    printable = key.split(b'\x00')[0].decode('utf-8', 'replace')
    print(f"  {ext:<6} ×{n:<5} head={key.hex(' ')}  ascii={printable!r}")
    print(f"         例: {e.archive}:{e.name}  len={e.length:,}")
    print(f"         前32字节: {data.hex(' ')}")

print()
print("=== .chs 清单（250 个）===")
chs = [e for e in sel if e.ext == '.chs']
byarch = collections.defaultdict(list)
for e in chs:
    byarch[e.archive].append(e)
for arch in sorted(byarch):
    lst = sorted(byarch[arch], key=lambda x: x.name)
    print(f"  [{arch}] {len(lst)} 个:")
    for i in range(0, len(lst), 8):
        print("     " + "  ".join(f"{x.name:<24}" for x in lst[i:i+8]))

print()
print("=== .ctd ===")
for e in sel:
    if e.ext == '.ctd':
        print(f"  {e.archive}:{e.name}  len={e.length:,}")
