# 素材重建指南 —— `dsh-skin-mahoyo`

> **这份文档替代了素材本身。**
> 分发包里**不含**任何原作图像与 BGM（版权属于 TYPE-MOON）。本文件写给"拿到皮肤、
> 并且自己电脑上有原著"的人（或他的 agent），照着做就能把素材接回去。
>
> 交接时间：2026-09-23　适用版本：`dsh-skin-mahoyo@0.1.0`

---

## 0. 先读这段：能做什么、不能做什么

把素材分成两类，**结论完全不同**，请先看清楚再动手：

| 类别 | 文件数 | 能从原著重建吗 |
|---|---:|---|
| **音频** —— `assets/bgm/`（16）+ `assets/se/`（7） | 23 | ✅ **可以，且完全可靠**。`.hw` 本质是"64 字节头 + 完整 OGG"，切掉头即得合法 `.ogg`，**不需要任何解码器** |
| **图像** —— `assets/bg/`(13) + `sprite/`(136) + `ui/`(128) + `ui/conf/`(80) | 357 | ❌ **不能直接从原著重建**，见下 |

### 图像为什么不能直接从原著重建

原著把图像存在 `.hfa` 归档里，格式是私有的 `.mzp` / `.cbg`。**解码 `.mzp`/`.cbg` 的代码不在本仓库里** ——
`hfa_png/convert.py` 依赖一个叫 `mahoyo` 的 Python 包（`convert.py:18` 指向
`C:\Users\Iroh\AppData\Local\Temp\hfa_mzp_tools`），而那个包**在整个仓库、pip 环境、pip 缓存里都不存在**。

所以图像有**两条路**，按你手上有什么选一条：

| | **路线 A：从解包产物装配** | **路线 B：从原著解包** |
|---|---|---|
| 前提 | 有解包好的 PNG（`hfa_png/out/`，24284 张 / 13 GB） | 有原著 `.hfa` + **自己的 `.mzp`/`.cbg` 解码器** |
| 可行性 | ✅ 全部 357 张可复现，已逐像素验证 | ❌ 仓库里没有解码器，**这条路目前没人走通** |
| 适用 | 皮肤作者本人、或拿到过解包产物的人 | 只有原著、又愿意自己写解码器的人 |
| 见 | [§3](#3-路线-a从解包产物装配推荐) | [§4](#4-路线-b从原著解包需要自备解码器) |

> ⚠️ **如果你只有原著、没有解包产物，且不想写解码器** —— 最省事的办法是找作者要一份
> `hfa_png/out/`（或直接要一份已装配好的 `assets/`）。社区里
> [`nike4613/MahoyoHDRepack`](https://github.com/nike4613/MahoyoHDRepack)（MIT）含 `.mzp`/`.cbg`
> 解码实现，是路线 B 最直接的参照物。

---

## 1. 原著的最低要求

**你不需要整个 17 GB 的游戏，也不需要能启动它。**

皮肤真正用到的只有 **6 个归档**：

| 归档 | 大小 | 提供 |
|---|---:|---|
| `data00000.hfa` | 157 MB | 全部 UI 构件（128）+ 表紙背景（B3/B4）+ 设置页图集 |
| `data02100.hfa` | 701 MB | 青子立绘源层 |
| `data02110.hfa` | 191 MB | 有珠立绘源层 |
| `data02150.hfa` | 51 MB | 金鹿立绘源层 |
| `data03000.hfa` | 262 MB | BGM（64 条） |
| `data00300.hfa` | 110 KB | UI 音效（**恰好 7 条**） |

背景图散在 `data02000` / `data02010` / `data02002` / `data02050`（各 1.5 GB 左右）。

> **"有原著"= 一个目录，里面放着 `.hfa` 文件。**
> 不需要 `WoH.exe`、不需要 `woh_data.dll`、不需要 `steam_appid.txt`。
> 原著目录里那些 `原版备份/`、`UserData/*.sud`、`KF@vieira.txt` 与本流程**完全无关**。

**先问用户原著装在哪**，然后只读上面那几个归档，不要全量扫描 52 个。

---

## 2. 工具在哪

本流程用到三组脚本，**都不在分发包里**（`package.json` 的 `files` 白名单不含它们），
需要从**源码工作区**取：

| 目录 | 内容 | 体量 |
|---|---|---|
| `hfa_tools/` | HFA 归档解析（`hfa.py`）、LenZu 解压（`lenzu.py`）、音频导出、剧本提取 | 285 KB |
| `persona_work/tools/` | 立绘合成、BGM/音效导出、设置页切片 | 756 KB |
| `skin/tools/` | `crop_alpha.py`（裁透明边）、`crop_conf.py`（切设置页） | ~200 KB |

### 2.1 ⚠ 第 0 步：改掉写死的本机路径（必做）

**`hfa_tools/hfa.py:16` 是整条链的单一入口** —— 下面几乎所有脚本都 `from hfa import GAME`：

```python
# hfa_tools/hfa.py:16
GAME = r"D:\QuickLook插件包\moye\WITCH ON THE HOLY NIGHT.7z\WITCH ON THE HOLY NIGHT"
```

改成你自己机器上的原著目录。**只改这一行，音频链就全活了。**

其余散落的硬编码本机路径（约 40 处，值高度一致），可批量替换：

```bash
# 示例：新仓库在 E:\proj\moye
grep -rl 'D:\\QuickLook插件包\\moye' hfa_tools persona_work/tools skin/tools \
  | xargs sed -i 's|D:\\QuickLook插件包\\moye|E:\\proj\\moye|g'
```

> ⚠️ **`hfa_png/convert.py:18` 的 `C:\Users\Iroh\...` 不要用上面这条替换** ——
> 那个目录本来就不存在，替换了也没用。详见 §4。

**已用相对路径、无需修改的**：`skin/tools/crop_alpha.py`、`skin/tools/crop_conf.py`、
`persona_work/tools/export_ui_sfx.py`、`persona_work/tools/build_stage_sprites.py`、
`skin/tools/assemble-assets.mjs`。

---

## 3. 路线 A：从解包产物装配（推荐）

前提：有 `hfa_png/out/`（24,284 张 PNG，目录结构为 `out/<归档名>/<条目名>.png`）。

### 3.1 音频（先做这个，最简单）

```bash
# UI 音效 7 个 → skin/assets/se/
python persona_work/tools/export_ui_sfx.py            # 试跑，只报告不写盘
python persona_work/tools/export_ui_sfx.py --write    # 真正导出

# BGM：先从 64 首里导出，再挑 16 首
python persona_work/tools/extract_bgm.py --list       # 只打印时长表，不写盘
python persona_work/tools/extract_bgm.py              # 导出 64 首
```

然后把**这 16 个**（不是全部 64 首）拷进 `skin/assets/bgm/`：

```
m01s  m02  m06  m08  m09  m17  m18  m27  m29  m37  m46  m47  m49  m53  m56  m63
```

> 这 16 首的取舍依据是 `bgm/bgm_mapping.tsv` 里 `确认状态 = 用户已确认` 的那批
> （该表含人工听后的用途标注、淡入淡出秒数）。**用途分配**在
> `skin/data/manifest.json` 的 `bgm` 段：`titleLight=m01s`、`titleDark=m56`、
> `ending=m53`、`dailyLight`/`dailyDark` 各一组。

### 3.2 图像

```bash
# ① UI 构件（128 个）：从 out/data00000/ 拷进 skin/assets/ui/
#    126 个是逐字节原样拷贝；另有 2 个是自切图（cap_scroll.png / cap_scroll_r.png）
#    ⚠ 那 2 个自切图已无代码引用，可以跳过

# ② 背景（13 张）：文件名带景号前缀，要按 §6.1 的映射表改名
#    然后★必须★裁掉透明外框：
python skin/tools/crop_alpha.py --write --dir bg

# ③ 设置页 80 个切片：
python skin/tools/crop_conf.py --check     # 期望 80/80 一致，exit 0
python skin/tools/crop_conf.py --write     # 落盘

# ④ 立绘 136 张：见 §3.3
```

### 3.3 立绘（136 张）—— 两步，缺一步就全错

```bash
# ① 合成（身体层 + 脸层叠加）
python persona_work/tools/build_stage_sprites.py

# ② ★ 裁到 alpha 边界 ★ —— 这一步不做，136 张尺寸全错
python skin/tools/crop_alpha.py --write --dir sprite
```

**为什么必须两步**：`build_stage_sprites.py` 输出的是**整张素材画布**（例如 1262×1272），
而磁盘上正确的文件是裁过透明边的（1165×1260）。参数在
`persona_work/stage/stage_spec.json` 里，**不在 py 脚本里**。

> ⚠️⚠️ **一个会误导你的文档矛盾**：`docs/MAINTENANCE.md` §4.5 有一条红线写着
> 「立绘按素材画布整张输出，**绝不按内容 bbox 裁**」。
> **那条红线只对 `build_stage_sprites.py` 内部的窗口选择成立**（意思是别在合成时按内容
> 收紧取景框，会切平头顶）；对最终产物而言，**磁盘上 136 张全部是 alpha-bbox 裁过的**。
> 照那条红线的字面意思跳过第 ② 步，会得到 136 张尺寸全错的图。

**重跑前要先清空** `skin/assets/sprite/` —— `build_stage_sprites.py` 对已存在的文件会跳过
（`if not os.path.isfile(dst)`），不清空就改了配方也不会覆盖。

---

## 4. 路线 B：从原著解包（需要自备解码器）

### 4.1 为什么这条路断了

```python
# hfa_png/convert.py:18-19
TOOLS = r"C:\Users\Iroh\AppData\Local\Temp\hfa_mzp_tools"
sys.path.insert(0, TOOLS)
```

- 该目录**不存在**（用户名都不是本机的）。
- 它要 import 的 `mahoyo.hfa` / `mahoyo.mzp` / `mahoyo.cbg`（`convert.py:37,45,46`）
  **在整个仓库里零命中** —— 没有任何实现。

直接跑会 `ModuleNotFoundError: No module named 'mahoyo'`。

### 4.2 修起来要改哪几处

| 行号 | 原值 | 改法 |
|---|---|---|
| `convert.py:18-19` | `TOOLS = r"C:\Users\Iroh\..."` + `sys.path.insert` | **删掉**，换成指向你自己解码器的路径 |
| `convert.py:21` | `r"D:\moye\WITCH ON THE HOLY NIGHT.7z\..."` | 改成真实原著路径，或强制走 `sys.argv[1]` |
| `convert.py:22` | `r"D:\moye\hfa_png\out"` | 改成 `<仓库>/hfa_png/out` |
| `convert.py:37,45,46` | `from mahoyo.hfa/mzp/cbg import ...` | **这是真正的活**：自己写 `.mzp`/`.cbg` 解码器 |

> ⚠️ **`OUT_DIR` 默认值是 `D:\moye\hfa_png\out`，与真实目录不同**，而 `:23` 有
> `os.makedirs(OUT_DIR, exist_ok=True)` —— 只改 `GAME_DIR` 不改 `OUT_DIR`，
> 脚本会**静默创建目录并把 24000 张图写到错的地方**，不报错。

**好消息**：`convert.py:68-88` 的 `list_tasks()` 自己用 `struct` 解了 HFA 头（没走 `mahoyo.hfa`），
所以**归档遍历、去重、断点续跑的逻辑是好的**，只有 `convert_one()` 里的实际解码要换。

**不需要写解码器的部分** —— 音频和剧本：

```bash
python hfa_tools/hw_to_ogg.py          # BGM：64 条 .hw → .ogg（切 64 字节头，无重编码）
python hfa_tools/extract_scripts.py    # 剧本（皮肤不用，旁支）
```

### 4.3 参照实现

`.mzp` / `.cbg` 的格式本仓库**没有任何说明**。外部参照只有
[`nike4613/MahoyoHDRepack`](https://github.com/nike4613/MahoyoHDRepack)（MIT）——
`hfa_tools/lenzu.py` 就是从它的 `LenZuCompressorFile.Managed.cs` 移植的，可以照着那个风格找解码部分。

---

## 5. ★ 透明层必须裁掉（最要紧的一节）

这条是你**一定会踩**的：解包出来的原作素材**自带宽窄不一的透明外框**。

### 5.1 不裁会怎样

皮肤用 `object-fit:cover` 铺满视口。**透明区也被算进缩放比例**，于是：

1. **贴边黑缝** —— 有效画面被推偏。实测最宽的透明边达到 **451 px**
2. **画面被放大、发糊** —— 因为 cover 先把整张（含透明边）缩到铺满，再裁

裁掉之后，cover 的口径才等于"肉眼看到的画面"，任意窗口比例都不留缝。

### 5.2 实测的透明边尺寸

**背景（13 张，裁前）**

| 文件 | 裁前画布 | 裁后 | 左边距 | 上边距 | **右边距** | **下边距** |
|---|---|---|---|---|---|---|
| `A1_img3008` | 2552×1272 | 2101×1261 | 0 | 0 | **451** | 11 |
| `A2_img3006` | 2552×1272 | 2101×1261 | 0 | 0 | 451 | 11 |
| `A3_img0231_01_01` | 3572×2042 | 3285×1972 | **14** | **14** | 273 | 56 |
| `A4_img0296` | 3572×2034 | 3282×1969 | 0 | 0 | 290 | 65 |
| `A5_img0349` | 3572×2034 | 3282×1969 | 0 | 0 | 290 | 65 |
| `A6_img0222` | 2552×1272 | 2101×1261 | 0 | 0 | 451 | 11 |
| `B1_img3000` | 2552×1272 | 2101×1261 | 0 | 0 | 451 | 11 |
| `B2_img3002` | 2552×1272 | 2101×1261 | 0 | 0 | 451 | 11 |
| `B3_title_bg1` | 1920×1080 | 1920×1080 | 0 | 0 | **0** | **0** |
| `B4_title_bg2` | 1920×1080 | 1920×1080 | 0 | 0 | 0 | 0 |
| `B5_img0292` | 3572×2034 | 3282×1969 | 0 | 0 | 290 | 65 |
| `B6_img0315` | 1532×2034 | 1454×1969 | 0 | 0 | 78 | 65 |
| `ED_img2073` | 2552×3558 | 2401×3421 | 0 | 0 | 151 | 137 |

**三个必须知道的结论**：

- **宽窄毫无规律** —— 右边距从 0 到 451 px 都有，**不能套统一的裁边规则**
- **横向上远大于纵向**（最大 451 vs 137）—— cover 在宽屏下主要被横向边距推偏
- **`B3`/`B4` 完全没有透明边**（它们是 RGB 无 alpha 通道的 `.cbg`）——
  **不要假设"所有素材都有透明框"**，必须逐张算

**立绘（136 张，裁前）**

| 指标 | 实测 |
|---|---|
| 画布高 | 全部 **1272** |
| **底部下边距** | **全部正好 11 px**（136 张一张不差） |
| 右边距 | **逐张不同**（3 ~ 93 px），因为每张姿势宽度不同 |
| 左边距 / 上边距 | 全部 0 |

裁后从 `884×1272` → `816×1260`（宽 −68、高 −11），136 张全部如此。

### 5.3 用法

```bash
python skin/tools/crop_alpha.py                       # 试跑：只打印会裁什么
python skin/tools/crop_alpha.py --write               # 就地裁切
python skin/tools/crop_alpha.py --write --dir bg      # 只裁背景
python skin/tools/crop_alpha.py --write --dir sprite --pad 0
```

| 参数 | 作用 |
|---|---|
| `--write` | 真正落盘。**不加就是试跑**，只打印 |
| `--dir` | 只处理某个子目录。**默认只处理 `bg` 与 `sprite`** —— `ui/` 不在其内 |
| `--pad N` | 保留 N px 透明边。默认 0（裁到最紧） |

**关键性质**：

- **判据是 `alpha > 8`**（`crop_alpha.py:31`）—— 先把 alpha 二值化再取 bbox
- **PNG 裁切无损、不重采样**（`im.crop().save()`）——
  用户担心的"影响显示效果"**不是压缩损失**，而是 cover 的缩放口径
- **幂等**：已经裁过的会算 `skip` 跳过（打印 `= 文件名 无透明边`）。
  所以对装配好的 `assets/` 再跑一次 `--write` 是**空操作**，可以当验收手段用
- **安全阀**：非 RGBA 模式直接跳过（打印 `无 alpha → 跳过`），不会误裁成 0×0

> ⚠️ **`ui/` 不要裁** —— 那些构件的透明边是构图的一部分。
> `crop_alpha.py` 默认就不处理它。

---

## 6. 逐文件映射表

### 6.1 背景（13 张）

景号 `A1`~`B6` 是**本项目指派**的，不是原作文件名。
映射规则来自 `persona_work/tools/build_scenes.py` 的 `SCENES` 字面量表，
经 `persona_work/stage/scenes.json` → `assemble-assets.mjs` → `manifest.json`。

| `assets/bg/` | 原著归档 | 归档内条目名 |
|---|---|---|
| `A1_img3008.mzp.png` | `data02010.hfa` | `img3008.mzp` |
| `A2_img3006.mzp.png` | `data02010.hfa` | `img3006.mzp` |
| `A3_img0231_01_01.mzp.png` | `data02050.hfa` | `img0231_01_01.mzp` |
| `A4_img0296.mzp.png` | `data02000.hfa` | `img0296.mzp` |
| `A5_img0349.mzp.png` | `data02000.hfa` | `img0349.mzp` |
| `A6_img0222.mzp.png` | `data02000.hfa` | `img0222.mzp` |
| `B1_img3000.mzp.png` | `data02010.hfa` | `img3000.mzp` |
| `B2_img3002.mzp.png` | `data02010.hfa` | `img3002.mzp` |
| `B3_title_bg1.cbg.png` | `data00000.hfa` | `title_bg1.cbg` |
| `B4_title_bg2.cbg.png` | `data00000.hfa` | `title_bg2.cbg` |
| `B5_img0292.mzp.png` | `data02000.hfa` | `img0292.mzp` |
| `B6_img0315.mzp.png` | `data02000.hfa` | `img0315.mzp` |
| `ED_img2073.mzp.png` | `data02002.hfa` | `img2073.mzp` |

**命名规则**：`<景号>_<原条目名去掉扩展名>` + `.png`。
在 `hfa_png/out/` 里的路径是 `out/<归档名>/<原条目名>.png`（**双后缀**：原扩展名保留 + `.png`）。

**用途**：`A1..A6` / `B1..B6` 与角色的对应关系见 `manifest.json` 的 `scenes` 段
（`SHELL_OF` = 表紙壳景 B3/B4，`SCENE_OF` = 阅读景 A1~A6）。

### 6.2 BGM（16 首）

**全部来自 `data03000.hfa`**（该归档 64 条目）。命名规则 `m<NN>.hw`，
另有两条特例：`m01s.hw`（`m01` 的短版）与 `x_m64.hw`。注意**没有 `m20.hw`**。

提取方式：切掉前 **64 字节**，剩下的就是完整 OGG（`OggS` 精确落在偏移 64，16/16 实测）。
**无重编码** —— `assets/bgm/*.ogg` 与归档载荷逐字节一致。

| 文件 | 条目 | 用途（见 `manifest.bgm`） |
|---|---|---|
| `m01s.ogg` | `m01s.hw` | `titleLight`（初始界面·浅色） |
| `m56.ogg` | `m56.hw` | `titleDark`（初始界面·深色） |
| `m53.ogg` | `m53.hw` | `ending`（ED 彩蛋） |
| `m02` `m08` `m09` `m17` `m27` `m29` `m37` `m49` | 同名 `.hw` | `dailyLight`（阅读态·浅色，8 首循环） |
| `m06` `m18` `m46` `m47` `m63` | 同名 `.hw` | `dailyDark`（阅读态·深色，5 首循环） |

> ⚠️ **`.hw` 是"64 字节头 + 完整 OGG"，不是裸 PCM。**
> 仓库里的 `hfa_tools/hw_to_wav.py` 基于"裸 PCM"的错误前提写的（它自己的诊断输出
> 就否证了这一点），**不要用**，`hw_to_ogg.py` / `extract_bgm.py` 才是对的。

### 6.3 UI 音效（7 个）

**全部来自 `data00300.hfa`** —— 该归档**恰好 7 个条目**，正好就是界面音。

| `assets/se/` | 条目 | 客户端用途（`client.js` 的 `SFX` 表） |
|---|---|---|
| `SSETurnedPage.ogg` | `SSETurnedPage.hw` | `menu` |
| `SSEDecided.ogg` | `SSEDecided.hw` | `decide` |
| `SSEChoiced.ogg` | `SSEChoiced.hw` | `move` |
| `SSEBookDecided.ogg` | `SSEBookDecided.hw` | `book` |
| `SSECancelled.ogg` | `SSECancelled.hw` | `cancel` |
| `SSEUnable.ogg` | `SSEUnable.hw` | `unable` |
| `SSEBookChoiced.ogg` | `SSEBookChoiced.hw` | *（备用，无代码引用）* |

每个都精确 **−64 字节**（7/7 实测），`OggS` 全部落在偏移 64。

> ⚠️ 别用 `data03100.hfa` 导出这 7 个 —— 那是 906 个 `.hw` / 94 MB 的
> "音效 + 环境音"那条，与界面音是两回事。

### 6.4 UI 构件（128 个）

**全部来自 `data00000.hfa`**，文件名 = 原条目名 + `.png`（如 `menu_window.cbg.png` ← `menu_window.cbg`）。

- **126 个逐字节原样拷贝**（未改一个字节，含 `conf_*.cbg.png`、`btn_base*` 等图集原料）
- **2 个是自切图**：`cap_scroll.png`（`sel_win.cbg` 裁 `(52,374,104,458)`）、
  `cap_scroll_r.png`（同源裁 `(50,372,106,460)` 后水平镜像）。
  这两个**当前已无任何 CSS 引用**（端帽花纹已全部删除），可以跳过。

`manifest.json` 的 `ui` 段有 **28 个键**，指向 **24 个不同文件** ——
`cap` / `band` 与 `muBar` 同值，`wood` 与 `archiveFrame` 同值（是有意复用）。

> ⚠️ **`assets/ui/` 里缺一个文件：`btn_base4_zc.cbg.png`。**
> 它是 `crop_conf.py` 的输入之一（切出 16 个 `opt4_*` 切片），但**不在 `assets/ui/` 顶层**。
> 从零重建时，`crop_conf.py` 会在 `:159-163` 报"图集缺失"——
> **要么把它从 `hfa_png/out/data00000/` 补拷进来，要么让 `--src` 指向解包目录**（后者是默认行为）。

### 6.5 设置页切片（`ui/conf/`，80 个）

**不由 `assemble-assets.mjs` 生成**，唯一来源是 `skin/tools/crop_conf.py`。

- **输入**：`hfa_png/out/data00000/` 下的 **13 个图集**
  （`btn_base0_zc` / `btn_base2_zc` / `btn_base4_zc` / `btn_default_zc` / `btn_base3` /
  `conf_sbtn` / `conf_stxt01_zc` / `conf_stxt2_zc` / `conf_sbar` / `conf_sbar2` /
  `conf_line` / `conf_band` + `sel_win`）
- **几何表**：`crop_conf.py:47-106`，**逐格写死**
- **输出**：80 个文件，居中放到固定画布

**为什么必须逐格写死**：图集行高**不均匀**（`btn_base0_zc` 是 71/71/79/79），
按百分比一定切歪。几何表全部由逐像素探边量出。

**为什么是"切图"而不是"找文字"**：原著「環境設定」屏的文字**烧在 PNG 上** ——
250 个 `.chs` 编译脚本全文搜过，页签名/选项名/按钮名**一个都没有**。
所以切图就是证据链本身。

```bash
python skin/tools/crop_conf.py --check     # 只校验：现役 80 个与几何表是否逐字节一致
python skin/tools/crop_conf.py             # 试跑
python skin/tools/crop_conf.py --write     # 落盘（先备份）
python skin/tools/crop_conf.py --write --src <别的解包目录>
```

> ⚠️ `crop_conf.py --check` 的退出码是 0/1，**可以并进检查套件**。

### 6.6 立绘（136 张）

**不是原图直拷，是合成的。** 命名 `stage_<景>_c<通道>_<帧>.png`，
**按素材帧命名、不按槽位** —— 同一帧被两个槽位用到时复用同一张
（这就是"152 个槽位引用 → 136 张图"的原因）。

**配方在 `persona_work/stage/stage_spec.json`**：

```json
{ "A3": { "char": "aok", "batch": "n", "i3": "12", "framing": "胸像",
          "slots": { "neutral": [["02","00"], ["02","01"]], ... } } }
```

**合成方式**：身体层（`_b`）+ 脸层 alpha 叠加，画布原点对齐（`rel = 0,0`），
再按 alpha 边界裁剪（判据同样是 `alpha > 8`）。

| 景 | 角色_批次_i3 | 通道 | 源目录 |
|---|---|---|---|
| A1 / A2 | `ari_n_01` | 02, 03, 08, 10 | `data02110` |
| A3 | `aok_n_12` | 02, 03, 08, 09, 20, 21 | `data02100` |
| A4 | `aok_n_03` | 02, 03, 08, 09, 14, 16, 18, 21 | `data02100` |
| A5 | `koj_n_00` | 01, 07 | `data02150` |
| A6 | `koj_l_01` | 01 | `data02150` |

完整步骤见 [§3.3](#33-立绘136-张-两步缺一步就全错)。

---

## 7. 装回皮肤

素材装配到 `skin/assets/` 之后：

```bash
node skin/tools/check-client.mjs          # 离线自检（不需要浏览器）
pwsh -File skin/tools/install.ps1         # 装进 $DSH_HOME/profiles/web/node_modules/
# 然后刷新浏览器页面（改 client.js 只需刷新；改 index.js 才要重启 DSH）
```

最终 `skin/assets/` 应有的形状：

```
assets/
├── bg/        13 个
├── bgm/       16 个
├── se/         7 个
├── sprite/   136 个
├── ui/       128 个（含 ui/conf/ 80 个）
└── 合计      380 个文件 / 263.2 MiB
```

---

## 8. ⛔ 永远不要跑这个

```bash
node skin/tools/assemble-assets.mjs
```

**自 2026-09-23 起它已被硬拦截**（脚本开头的 `guardManifest()`，没有
`--i-know-this-destroys-manifest` 参数就直接 `exit 2`）。**不要加那个参数绕过它。**

它读的是**旧立绘管线** `persona_work/stage/expressions.json`（文件名形如
`aok_n_12_02_01.mzp.png`），而线上 manifest 用的是 `stage_a3_c02_01.png`
（来自 `build_stage_sprites.py` + `apply_stage_manifest.py`）。**两者不同源。**

2026-09-20 误跑一次的实测后果（67 处差异）：

- 12 景的 `slots` 全被重写
- 12 景的 `stageSource` 全部消失
- `spriteBases` 5 → 157
- 往 `assets/sprite/` 多拷 **157 个旧命名立绘**（30.3 MB 死重量）

**它引用的输入文件至今全都存在，所以误跑必然执行成功并再次破坏。**

> 要改 manifest：手改，或用 `persona_work/tools/restore-expressions.mjs`。
> 要重算**词表**：用 `skin/tools/rebuild-lexicon.mjs`（安全，不碰素材）。

---

## 9. 素材 URL 的一个易忘点

皮肤的素材 URL 走 `assetURL()`，会**自动带上 `?v=<BUILD_ID>`**：

```
/moye-skin/assets/bg/A3_img0231_01_01.mzp.png?v=<BUILD_ID>
```

**缓存策略是 `max-age=86400`，而素材文件名在重烘之后是不变的** ——
不带这个参数，换过素材之后浏览器会一直用缓存里的旧图（实测：把"紧裁版"换成
"整画布版"之后，用户看到的是一模一样的画面，这不是错觉）。

`assetURL()` 会自动加，**手写路径时要自己补**。`BUILD_ID` 由 `install.ps1` 在装机时
注入（源码哈希 + 时间戳），所以每次安装都会变，换包即失效。

---

## 10. 一句话总结

**音频照着 §3.1 做，几分钟搞定、完全可靠。**
**图像走路线 A（§3.2 / §3.3），做完 ★ 一定要跑 `crop_alpha.py --write` ★。**
**只有原著、没有解包产物的话，图像这条路目前是断的（§4）。**
