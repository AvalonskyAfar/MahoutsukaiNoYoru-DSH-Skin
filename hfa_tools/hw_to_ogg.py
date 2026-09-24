"""从 .hw 提取内嵌的 OGG —— 依据 nijinekoyo/MahoyoFileFormatConverter 的 HW.go

格式：64 字节头 + 完整 OGG Vorbis 流
提取：在文件里搜索 b"OggS"，从那里截断到文件尾
"""
import sys, os, struct
sys.path.insert(0, r"D:\QuickLook插件包\moye\hfa_tools")
from hfa import Hfa, GAME

OUT = r"D:\QuickLook插件包\moye\bgm"
os.makedirs(OUT, exist_ok=True)
print("### HW-TO-OGG ###")


def hw_to_ogg(data):
    if len(data) < 8 or data[4:6] != b"hw":
        raise ValueError("不是 .hw（头不符）")
    off = data.find(b"OggS")
    if off < 0:
        raise ValueError("未找到 OggS")
    return data[off:], off


def ogg_info(ogg):
    """粗验 OGG：头 4 字节 OggS，且能找到 vorbis 标识与结尾 EOS 页"""
    if ogg[:4] != b"OggS":
        return False, "头不是 OggS"
    has_vorbis = ogg.find(b"vorbis") > 0
    # 末页 header_type 的 EOS 位（0x04）
    tail = ogg[-4096:]
    idx = tail.rfind(b"OggS")
    eos = (tail[idx + 5] & 0x04) != 0 if idx >= 0 else False
    return has_vorbis, f"vorbis标识={has_vorbis} EOS尾页={eos}"


a = Hfa(os.path.join(GAME, "data03000.hfa"))
for name in ("m01", "m17", "m54", "x_m64"):
    e = next((x for x in a.entries if x.name == name + ".hw"), None)
    if not e:
        print(f"  {name}: 未找到"); continue
    d = a.read(e)
    f3 = struct.unpack("<I", d[12:16])[0]
    ogg, off = hw_to_ogg(d)
    ok, info = ogg_info(ogg)
    print(f"  {name:<8} .hw={len(d):>9,}B  OggS偏移={off:<4}  .ogg={len(ogg):>9,}B  "
          f"f3={f3:>10,}  {info}")
    if ok:
        p = os.path.join(OUT, name + ".ogg")
        open(p, "wb").write(ogg)
        print(f"           -> {p}")

print("\n=== 批量抽取全部 64 个 BGM ===")
okn = fail = 0
for e in sorted(a.entries, key=lambda x: x.name):
    try:
        d = a.read(e)
        ogg, _ = hw_to_ogg(d)
        v, _ = ogg_info(ogg)
        if not v:
            raise ValueError("vorbis 标识缺失")
        open(os.path.join(OUT, e.name.replace(".hw", ".ogg")), "wb").write(ogg)
        okn += 1
    except Exception as ex:
        fail += 1
        print(f"  FAIL {e.name}: {ex}")
print(f"  成功 {okn} / {a.count}，失败 {fail}")
print("### END ###")
