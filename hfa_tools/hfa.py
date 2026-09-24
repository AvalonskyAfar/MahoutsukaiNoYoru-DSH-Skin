"""HFA 归档解析器 —— 魔法使之夜 (WITCH ON THE HOLY NIGHT)

格式（实测）
    0x00  12 字节签名 b'HUNEXGGEFA10'
    0x0C  u32 条目数 count
    0x10  count × 0x80 字节记录：
            0x00-0x5F  文件名 (UTF-8, \0 填充)
            0x60-0x63  u32 偏移（相对数据基址）
            0x64-0x67  u32 长度
            0x68-0x7F  保留（全 0）
    数据基址 = 0x10 + count*0x80
"""
import struct, os

SIG = b'HUNEXGGEFA10'
GAME = r"D:\QuickLook插件包\moye\WITCH ON THE HOLY NIGHT.7z\WITCH ON THE HOLY NIGHT"
OUT = r"D:\QuickLook插件包\moye\game_scripts"


class Entry:
    __slots__ = ('name', 'offset', 'length', 'archive')

    def __init__(self, name, offset, length, archive):
        self.name, self.offset, self.length, self.archive = name, offset, length, archive

    @property
    def ext(self):
        return os.path.splitext(self.name)[1].lower()

    def __repr__(self):
        return f"<{self.archive}:{self.name} off={self.offset} len={self.length}>"


class Hfa:
    def __init__(self, path):
        self.path = path
        self.filename = os.path.basename(path)
        with open(path, 'rb') as f:
            head = f.read(16)
            if head[:12] != SIG:
                raise ValueError(f"{self.filename}: 签名不符 {head[:12]!r}")
            count = struct.unpack('<I', head[12:16])[0]
            self.count = count
            self.base = 16 + count * 0x80
            f.seek(16)
            self.entries = []
            for _ in range(count):
                r = f.read(0x80)
                nm = r[:0x60].split(b'\x00')[0].decode('utf-8', 'replace')
                off, ln = struct.unpack('<II', r[0x60:0x68])
                self.entries.append(Entry(nm, off, ln, self.filename))

    def read(self, e):
        with open(self.path, 'rb') as f:
            f.seek(self.base + e.offset)
            return f.read(e.length)


def all_archives():
    return [Hfa(os.path.join(GAME, n))
            for n in sorted(os.listdir(GAME)) if n.lower().endswith('.hfa')]
