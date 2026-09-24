import struct, sys, os

GAME = r"D:\QuickLook插件包\moye\WITCH ON THE HOLY NIGHT.7z\WITCH ON THE HOLY NIGHT"

def probe(name):
    path = os.path.join(GAME, name)
    if not os.path.exists(path):
        print(f"--- {name}: NOT FOUND"); return
    size = os.path.getsize(path)
    with open(path, 'rb') as f:
        head = f.read(16)
        print(f"--- {name}  size={size:,}")
        print("   header hex :", head.hex(' '))
        print("   magic      :", head[:4])
        count = struct.unpack('<I', head[12:16])[0]
        name_end = 16 + count * 0x80
        print(f"   count@12   = {count}   name table ends @ {name_end:,}")
        if count and name_end <= size:
            f.seek(16)
            names = []
            for _ in range(min(count, 6)):
                raw = f.read(0x80)
                names.append(raw[:0x60].split(b'\x00')[0].decode('utf-8', 'replace'))
            print("   first names:", names)
            # 统计扩展名
            f.seek(16)
            exts = {}
            for _ in range(count):
                raw = f.read(0x80)
                nm = raw[:0x60].split(b'\x00')[0].decode('utf-8', 'replace')
                e = os.path.splitext(nm)[1].lower()
                exts[e] = exts.get(e, 0) + 1
            print("   扩展名分布 :", dict(sorted(exts.items(), key=lambda x: -x[1])[:14]))
            f.seek(name_end)
            idx = f.read(min(64, size - name_end))
            print("   index hex  :", idx.hex(' '))
            if len(idx) >= 16:
                print("   as u64,u64 :", struct.unpack('<QQ', idx[:16]))
                print("   as u32x4   :", struct.unpack('<IIII', idx[:16]))
        else:
            print("   !! count 不合理")

for a in sys.argv[1:]:
    probe(a)
