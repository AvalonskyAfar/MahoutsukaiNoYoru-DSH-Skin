"""从 data03000.hfa 导出全部 BGM 为可播放的 .ogg，并输出时长表。

格式（实测）：每个 m*.hw = 64 字节容器头（magic "hw  " @0x04）+ Ogg Vorbis 流。
0x00 u32 = 头长度（通常 0x40），0x08/0x0C 等为长度/偏移字段。

时长计算不需要解码器：读最后一个 Ogg 页的 granule position（绝对采样数），
除以 ID 头里的采样率即可。

用法:
    python extract_bgm.py            # 导出 + 打印时长表
    python extract_bgm.py --list     # 只打印，不写文件
"""
import os, re, struct, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "hfa_tools"))
from hfa import Hfa, GAME  # noqa: E402

OUT = r"D:\QuickLook插件包\moye\persona_work\audio\bgm"
HEADER_MIN = 0x40


def ogg_info(d):
    """返回 (采样率, 声道, 时长秒)；解析失败返回 None"""
    if d[:4] != b"OggS":
        return None
    # Vorbis ID 头：第 1 个页的 payload 以 \x01vorbis 开头
    i = d.find(b"\x01vorbis")
    if i < 0:
        return None
    ch = d[i + 11]
    rate = struct.unpack_from("<I", d, i + 12)[0]
    # 最后一个 Ogg 页的 granule position
    last = d.rfind(b"OggS")
    if last < 0 or last + 14 > len(d):
        return None
    gran = struct.unpack_from("<q", d, last + 6)[0]
    dur = gran / rate if rate else 0
    return rate, ch, dur


def main():
    write = "--list" not in sys.argv
    if write:
        os.makedirs(OUT, exist_ok=True)
    a = Hfa(os.path.join(GAME, "data03000.hfa"))
    rows = []
    for e in sorted(a.entries, key=lambda x: x.name):
        raw = a.read(e)
        hlen = struct.unpack_from("<I", raw, 0)[0]
        if hlen < HEADER_MIN or hlen > len(raw):
            hlen = HEADER_MIN
        body = raw[hlen:]
        # 有时头长字段不含自身，做一次兜底搜索
        if body[:4] != b"OggS":
            j = raw.find(b"OggS")
            body = raw[j:] if j >= 0 else body
        info = ogg_info(body)
        if write and body[:4] == b"OggS":
            with open(os.path.join(OUT, e.name.replace(".hw", ".ogg")), "wb") as f:
                f.write(body)
        rows.append((e.name, len(raw), hlen, info))

    print(f"{'文件':10} {'容器':>10} {'头长':>5} {'载荷':>10}  {'采样率':>6} {'ch':>3} {'时长':>8}")
    for name, size, hlen, info in rows:
        if info:
            rate, ch, dur = info
            m, s = divmod(int(dur), 60)
            print(f"{name:10} {size:>10,} {hlen:>5} {size-hlen:>10,}  {rate:>6} {ch:>3} {m:>4}分{s:02d}秒")
        else:
            print(f"{name:10} {size:>10,} {hlen:>5} {size-hlen:>10,}  (非 Ogg / 解析失败)")
    if write:
        print(f"\n已导出到 {OUT}")


if __name__ == "__main__":
    main()
