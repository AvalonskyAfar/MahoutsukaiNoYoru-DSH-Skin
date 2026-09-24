import struct, sys, os

GAME = r"D:\QuickLook插件包\moye\WITCH ON THE HOLY NIGHT.7z\WITCH ON THE HOLY NIGHT"

def dump(name, nrec=3):
    path = os.path.join(GAME, name)
    size = os.path.getsize(path)
    with open(path, 'rb') as f:
        head = f.read(16)
        count = struct.unpack('<I', head[12:16])[0]
        print(f"===== {name}  size={size:,}  count={count}")
        f.seek(16)
        recs = [f.read(0x80) for _ in range(count)]
        for i, r in enumerate(recs[:nrec]):
            nm = r[:0x60].split(b'\x00')[0].decode('utf-8', 'replace')
            print(f"  rec{i} name={nm!r}")
            print(f"       0x00-0x5F: {r[0x00:0x60].hex(' ')}")
            print(f"       0x60-0x7F: {r[0x60:0x80].hex(' ')}")
            tail = r[0x60:0x80]
            print(f"       tail as u32x8 : {struct.unpack('<8I', tail)}")
            print(f"       tail as u64x4 : {struct.unpack('<4Q', tail)}")
        # 最后一个记录也看看
        r = recs[-1]
        nm = r[:0x60].split(b'\x00')[0].decode('utf-8', 'replace')
        print(f"  last  name={nm!r}")
        print(f"       0x60-0x7F: {r[0x60:0x80].hex(' ')}")
        print(f"       tail as u32x8 : {struct.unpack('<8I', r[0x60:0x80])}")
        # 名字表之后
        f.seek(16 + count * 0x80)
        after = f.read(64)
        print(f"  after-names[0:64]: {after.hex(' ')}")

for a in sys.argv[1:]:
    dump(a)
