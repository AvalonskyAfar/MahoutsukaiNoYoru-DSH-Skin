"""手写 MP4 box 解析器 —— 定位 opening_ja.mp4 的音轨

背景：本机无 ffmpeg / ffprobe / 任何音频库，pip 也不通。
      所以直接按 ISO BMFF 规范自己走 box 树。
目标：
  1. 列出 trak（轨道）类型与数量
  2. 若有音频轨，导出其编码格式（mp4a/esds/Opus/…）、采样率、声道、时长
  3. 定位音频 sample 的字节区间（stsd/stsc/stco/stsz/stts），判断能否直接抠出
"""
import struct, sys, os, json

G = r"D:\QuickLook插件包\moye\WITCH ON THE HOLY NIGHT.7z\WITCH ON THE HOLY NIGHT"
ARCH = os.path.join(G, "data02900.hfa")
OUT = r"D:\QuickLook插件包\moye\bgm\op_mp4"
os.makedirs(OUT, exist_ok=True)

sys.path.insert(0, r"D:\QuickLook插件包\moye\hfa_tools")
from hfa import Hfa

CONTAINERS = {b'moov', b'trak', b'mdia', b'minf', b'stbl', b'edts', b'udta',
              b'mvex', b'wave', b'stsd'}


def read_box_header(buf, pos):
    if pos + 8 > len(buf):
        return None
    size = struct.unpack_from('>I', buf, pos)[0]
    typ = buf[pos + 4:pos + 8]
    hdr = 8
    if size == 1:
        if pos + 16 > len(buf):
            return None
        size = struct.unpack_from('>Q', buf, pos + 8)[0]
        hdr = 16
    elif size == 0:
        size = len(buf) - pos
    if size < hdr:
        return None
    return size, typ, hdr


def walk(buf, start, end, depth=0, maxdepth=6, out=None):
    """递归列出 box 树"""
    pos = start
    while pos < end:
        h = read_box_header(buf, pos)
        if not h:
            break
        size, typ, hdr = h
        payload = pos + hdr
        body_end = pos + size
        if body_end > end:
            body_end = end
        out.append((depth, typ.decode('latin-1'), pos, size, hdr))
        if typ in CONTAINERS and depth < maxdepth:
            if typ == b'stsd':
                # stsd: 4B ver/flags + 4B entry_count，随后是 sample entry box
                walk(buf, payload + 8, body_end, depth + 1, maxdepth, out)
            else:
                walk(buf, payload, body_end, depth + 1, maxdepth, out)
        pos += size


def get_box(buf, start, end, want, path=None):
    pos = start
    while pos < end:
        h = read_box_header(buf, pos)
        if not h:
            return None
        size, typ, hdr = h
        if typ == want:
            return pos, pos + hdr, pos + size
        pos += size
    return None


def parse(path, label):
    print(f"\n{'='*80}\n{label}   {os.path.getsize(path):,} B\n{'='*80}")
    buf = open(path, 'rb').read()

    # 顶层 box
    top = []
    walk(buf, 0, len(buf), 0, 1, top)
    print("顶层 box:")
    for d, t, off, sz, hdr in top:
        print(f"  @{off:<12} {t:<6} {sz:>14,} B")

    moov = get_box(buf, 0, len(buf), b'moov')
    if not moov:
        print("!! 无 moov")
        return
    m_off, m_pay, m_end = moov

    # mvhd: timescale / duration
    mvhd = get_box(buf, m_pay, m_end, b'mvhd')
    if mvhd:
        _, p, _ = mvhd
        ver = buf[p]
        if ver == 0:
            ts, dur = struct.unpack_from('>II', buf, p + 12)
        else:
            ts, dur = struct.unpack_from('>IQ', buf, p + 20)
        print(f"mvhd: timescale={ts} duration={dur} -> {dur/ts:.3f} s")

    # 遍历 trak
    pos = m_pay
    ti = 0
    while True:
        r = get_box(buf, pos, m_end, b'trak')
        if not r:
            break
        t_off, t_pay, t_end = r
        ti += 1

        # tkhd -> track_id
        tkhd = get_box(buf, t_pay, t_end, b'tkhd')
        tid = None
        if tkhd:
            _, p, _ = tkhd
            ver = buf[p]
            tid = struct.unpack_from('>I', buf, p + (12 if ver == 0 else 20))[0]

        mdia = get_box(buf, t_pay, t_end, b'mdia')
        print(f"\n--- trak #{ti} (track_id={tid}) @{t_off} size={t_end-t_off:,} ---")
        if not mdia:
            pos = t_end
            continue
        _, md_pay, md_end = mdia

        hdlr = get_box(buf, md_pay, md_end, b'hdlr')
        handler = None
        if hdlr:
            _, p, _ = hdlr
            handler = buf[p + 8:p + 12].decode('latin-1')
            name_start = p + 24
            nm = buf[name_start:name_start + 40].split(b'\x00')[0]
            print(f"  hdlr handler_type = {handler!r}  name={nm!r}")

        mdhd = get_box(buf, md_pay, md_end, b'mdhd')
        if mdhd:
            _, p, _ = mdhd
            ver = buf[p]
            if ver == 0:
                mts, mdur = struct.unpack_from('>II', buf, p + 12)
                lang = struct.unpack_from('>H', buf, p + 20)[0]
            else:
                mts, mdur = struct.unpack_from('>IQ', buf, p + 20)
                lang = struct.unpack_from('>H', buf, p + 28)[0]
            ch = chr(((lang >> 10) & 0x1F) + 0x60) + chr(((lang >> 5) & 0x1F) + 0x60) + chr((lang & 0x1F) + 0x60)
            print(f"  mdhd timescale={mts} duration={mdur} -> {mdur/mts:.3f} s  lang={ch!r}")

        minf = get_box(buf, md_pay, md_end, b'minf')
        if not minf:
            pos = t_end
            continue
        _, mi_pay, mi_end = minf
        stbl = get_box(buf, mi_pay, mi_end, b'stbl')
        if not stbl:
            pos = t_end
            continue
        _, sb_pay, sb_end = stbl

        # stsd
        stsd = get_box(buf, sb_pay, sb_end, b'stsd')
        codec = None
        if stsd:
            _, p, e = stsd
            n = struct.unpack_from('>I', buf, p + 4)[0]
            print(f"  stsd: {n} 个 sample entry")
            q = p + 8
            for k in range(n):
                h = read_box_header(buf, q)
                if not h:
                    break
                size, typ, hdr = h
                codec = typ.decode('latin-1')
                print(f"    [{k}] {codec}  size={size}")
                # 音频 sample entry: 8B box头 + 6B reserved + 2B data_ref
                #   + 8B(ver/rev/vendor) + 2B channels + 2B samplesize
                #   + 2B compression + 2B packet + 4B samplerate(16.16)
                if typ in (b'mp4a', b'Opus', b'alac', b'ec-3', b'ac-3', b'fLaC'):
                    pl = q + hdr
                    chn, ssz, comp, pkt = struct.unpack_from('>HHHH', buf, pl + 16)
                    srate = struct.unpack_from('>I', buf, pl + 24)[0] >> 16
                    print(f"        声道={chn} 位深={ssz} 采样率={srate} "
                          f"compression={comp} packet={pkt}")
                    # 子 box：esds / dOps
                    sub = q + hdr + 28
                    while sub < q + size:
                        sh = read_box_header(buf, sub)
                        if not sh:
                            break
                        ssz2, styp, shdr = sh
                        print(f"        子box {styp.decode('latin-1')} size={ssz2}")
                        if styp == b'esds':
                            d = buf[sub + shdr:sub + ssz2]
                            # esds: 4B ver/flags + ES_Descriptor
                            print(f"          esds hex[:64] = {d[:64].hex(' ')}")
                            obj = None
                            for i in range(len(d) - 1):
                                if d[i] == 0x04:   # objectTypeIndication 前一个 tag
                                    obj = d[i + 1]
                                    break
                            print(f"          objectTypeIndication ~ 0x{obj:02X}" if obj else "")
                        elif styp == b'dOps':
                            d = buf[sub + shdr:sub + ssz2]
                            if len(d) >= 11:
                                ver, chn2, pre, inr = struct.unpack_from('>BBHI', d, 0)
                                print(f"          dOps: ver={ver} 声道={chn2} preskip={pre} 输入采样率={inr}")
                        sub += ssz2
                elif typ in (b'avc1', b'hvc1', b'hev1'):
                    pl = q + hdr
                    w, ht = struct.unpack_from('>HH', buf, pl + 24)
                    print(f"        视频 {w}x{ht}")
                q += size

        # sample 表规模
        stsz = get_box(buf, sb_pay, sb_end, b'stsz')
        nsamp = 0
        if stsz:
            _, p, _ = stsz
            ss, cnt = struct.unpack_from('>II', buf, p + 4)
            nsamp = cnt
            print(f"  stsz: sample_size={ss} count={nsamp}")
        stco = get_box(buf, sb_pay, sb_end, b'stco')
        co64 = get_box(buf, sb_pay, sb_end, b'co64')
        if stco:
            _, p, _ = stco
            n = struct.unpack_from('>I', buf, p + 4)[0]
            first = struct.unpack_from('>I', buf, p + 8)[0]
            print(f"  stco: {n} 个 chunk，首个 offset={first:,}")
        if co64:
            _, p, _ = co64
            n = struct.unpack_from('>I', buf, p + 4)[0]
            first = struct.unpack_from('>Q', buf, p + 8)[0]
            print(f"  co64: {n} 个 chunk，首个 offset={first:,}")
        stts = get_box(buf, sb_pay, sb_end, b'stts')
        if stts:
            _, p, _ = stts
            n = struct.unpack_from('>I', buf, p + 4)[0]
            print(f"  stts: {n} 组")
            for k in range(min(n, 4)):
                c, d = struct.unpack_from('>II', buf, p + 8 + k * 8)
                print(f"      [{k}] count={c} delta={d}")
        stsc = get_box(buf, sb_pay, sb_end, b'stsc')
        if stsc:
            _, p, _ = stsc
            n = struct.unpack_from('>I', buf, p + 4)[0]
            print(f"  stsc: {n} 组")
            for k in range(min(n, 6)):
                fc, spc, si = struct.unpack_from('>III', buf, p + 8 + k * 12)
                print(f"      [{k}] first_chunk={fc} samples_per_chunk={spc} sample_desc={si}")

        pos = t_end


# 先把 data02900 里的 mp4 抽出来（只抽 opening_ja，最大的那个已够用）
a = Hfa(ARCH)
print("data02900.hfa 条目:")
for e in a.entries:
    print(f"  {e.name:<24} {e.length:>14,} B ({e.length/1048576:.1f} MB)")

for e in a.entries:
    if e.name.endswith(".mp4"):
        p = os.path.join(OUT, e.name)
        if not os.path.exists(p) or os.path.getsize(p) != e.length:
            print(f"\n导出 {e.name} ...")
            open(p, 'wb').write(a.read(e))
        parse(p, e.name)
