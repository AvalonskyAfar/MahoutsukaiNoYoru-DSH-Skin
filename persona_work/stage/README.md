# 交付物索引 —— 表情切换 + 人物站位

> 任务来源：`docs/13-交接-表情切换与站位.md`
> 完成日期：2026-09-16
> **范围**：只产出规格与对照表，**不含皮肤实际代码实现**（交接文件 §1 OUT）。

---

## 1. 交付物清单（对应交接文件 §11）

| # | 交接文件要求 | 本目录产物 | 状态 |
|---|---|---|---|
| ① | 前置缺陷修正（`kin`/`koj`） | 交接文件 §3 记载为"已于 2026-09-16 修复完毕"；本次**复核通过**（全库前缀表、`slot_sprites.json`、`persona_work/agg/fix_kin_koj.log` 均一致） | ✅ 已就绪 |
| ② | **表情对照总表** | `expression-matrix.md`（人读）、`expressions.json`（机器读）、`expressions_extended.json`（候选补充） | ✅ |
| ③ | **六个景配置** | `scenes.json`（机器读）、`README.md` §3（人读摘要） | ✅ |
| ④ | **站位/镜头规则** | `spec-staging.md` + `final/stage_final_all.jpg`（成品预览） | ✅ |
| ⑤ | **切换逻辑规格** | `spec-switching.md`（含伪代码）+ `cn_predicates.md`（中文谓词表） | ✅ |
| ⑥ | **技术难点清单** | `tech-notes.md`（逐条「能实现/需妥协/必须找用户决定」） | ✅ |
| ⑦ | 过程产物 | `persona_work/expressions/`、`persona_work/stage/`（含印相表、矩阵、站位预览） | ✅ |

**需用户拍板的问题**（6 条）已全部确认，决议记录在 `OPEN-QUESTIONS.md`。

---

## 1.5 本次产出的可交付数据文件

| 文件 | 内容 | 规模 |
|---|---|---|
| `scenes.json` | 12 个景（6 对话景 + 6 纯背景景）的完整配置 | 12 景 |
| `expressions.json` | **景 → 服装行 → 12 槽位 → 具体立绘文件** | 六个景、共 284 个具体文件 |
| `expressions_extended.json` | 同服装行的补充候选（标 `unverified`，启用前需复核） | — |
| `cn_predicates.json` / `.md` | **中文谓词表**（由官方简中剧本直取） | 48 叙述 + 22 台词 + 5 运行时 |
| `outfit_index.json` | 每个 (角色, 服装行) 下**全部**通道与帧 → 文件 | 7 个服装行、317 帧 |
| `eye_anchor.json` | 每个立绘的**眼重心**（内容归一化坐标） | 4085 条 |
| `slots_manual_main.json` | 逐文件槽位判定（主表） | — |
| `persona_work/agg/sprite_sequence.json` | 全库 `.chs` 的立绘标识序列 | 165 章 / 6192 条 |

---

## 2. ★ 本次最重要的三个发现

### 2.1 立绘命名语义与交接文件的假设**不同**（最关键）

交接文件 §4.1 写 `<角色>_<批次>_<i3 服装行>_<i4 表情>_<变体编号>`。

**实测更正**：
- `i3` = 服装行 ✅
- `i4` = **姿态/脸型通道**（同一套衣服下并存多条，各通道取景/脸型不同）
- 第 5 段 = **每条 `(批次, i4)` 通道自己动画序列里的帧号**
- **只有具体文件（`i3`+`i4`+`v` 三元组）才确定表情**

证据：`aok_a_12_02_00 … _08` 是 9 张**完全不同的脸**（平静/闭眼/惊讶/为难/微笑/生气/瞪视/半眼）；
同一帧号在不同通道里可以是不同的表情。

→ 所以表情对照表**以文件名为键**，不存在"帧号 → 表情"的全局表。

### 2.2 `_b` 全身立绘**原作一次都没用过**，而且**没有脸**

- 165 个 `.chs` 共引用 **6192** 个立绘标识，**含 `_b` 的 0 个**；
- `_b` 图头部**整块透明**（头部 alpha 覆盖 21%，特写 44%）——脸是运行时另贴的图层。

→ 本皮肤**只用特写**（这恰是原作脚本真正使用的那 6192 张）。

### 2.3 特写立绘的"固有尺寸"其实是**统一的**

头宽实测：青子 631/696px、金鹿 618/625px、有珠 624px —— **全部落在 618~700**。
→ 规格：`alpha bbox 裁切 → scale 0.70 → 内容 bbox 中心对齐画面 (50%, 50%)`，
   各表情、各批次的脸位**完全一致，不会跳**。验收图 `final/stage_final_k0.7.jpg`。

### 2.4 官方**简中**剧本就在素材里，且与日文**行对行对齐**

`game_scripts/ctd/data00200.hfa/` 下有 4 份全文剧本（日 / 简中 / 繁中 / 英），
**都是 24135 行、空行位置集合完全一致**。

→ 既有 74 条日文触发规则（带行号）可以**直接取中文原句**，
  分类器**不需要任何翻译步骤**。已生成 `cn_predicates.json`。

---

## 3. 六个景配置（摘要；完整见 `scenes.json`）

| 景 | 角色 | 服装行 `i3` | 背景 | 可用槽位 |
|---|---|---|---|---|
| **A1** 洋房客厅·白天 | `ari` | `01` 黑色连衣裙 | `data02010/img3008.mzp.png` | **6/12**：angry, glare, neutral, smile, surprised, troubled |
| **A2** 洋房客厅·夜晚 | `ari` | `01` | `data02010/img3006.mzp.png` | 同 A1（同机位夜景） |
| **A3** 教室·白天 | `aok` | `12` 三咲高校制服 | `data02050/img0231_01_01.mzp.png` | **11/12**：除 shy 外全有 |
| **A4** 夜·灯饰通学路 | `aok` | `03` 白色羽绒服 | `data02000/img0296.mzp.png` ⚠️ 不是 `img0295` | **6/12**：angry, glare, neutral, smile, surprised, troubled |
| **A5** 公园步道·秋 | `koj` | `00` 制服（第7章） | `data02000/img0349.mzp.png` | **4/12**：neutral, serious, surprised, troubled |
| **A6** 洋馆客室·夜 | `koj` | `01` 冬季便服 | `data02000/img0222.mzp.png` | **5/12**：angry, neutral, serious, surprised, tired |
| B1~B6 | **无角色** | — | 见 `scenes.json` | — |

> 缺的槽位不是遗漏，是**原作就没给这套衣服画**（金鹿尤其少）。
> 一律走 `spec-switching.md` §6 的 fallback，**不造图补**。

成品预览：`final/stage_final_all.jpg`（六景各一张，含对话框占位带）。

---

## 4. 本次新增/修改的工具（都在 `persona_work/tools/`）

| 工具 | 用途 |
|---|---|
| **`sprite_sequence.py`** | ★ 核心：从 `.chs` 反查「章节 → 有序立绘标识序列」（= 原作调度表）。`dump` 一次导出全库 |
| `sprite_sequence.py mix <章>` | ★ 打出**文本/立绘/背景/音效交替的完整调度流水** |
| `scene_sprites.py` | 按景列出该景章节引用过的立绘 |
| `scene_frames.py` | 按景列出引用过的帧号 + 该帧可用的通道 |
| `scene_expr_sheet.py` | ★ **逐文件印相表**（最终判定用） |
| `variant_matrix.py` | 通道 × 帧号矩阵 |
| `variant_strips.py` | 帧号 × 通道条带（跨通道一致性检查） |
| `frame_consistency.py` | 量化「同帧号跨通道是否同一张脸」 |
| `family_strip.py` | 单个 `(批次, i3, i4)` 家族的全部帧 |
| `scene_matrix.py` | 景 × 引用过的帧/通道 矩阵 |
| `expression_sheets.py` | （早期版本，按 `i4` 分行；已被 `scene_expr_sheet.py` 取代） |
| `gen_expression_batch.py` | 批量生成 + 切片 + manifest |
| `sprite_geometry.py` / `sprite_tiles.py` | 画布档位与 alpha bbox 实测 |
| `sprite_probe_view.py` | 特写 vs `_b` 并排对比 |
| `stage_try.py` | 站位九宫格预览（scale × x × y_bottom） |
| **`stage_final.py`** | ★ **最终站位渲染**（六景成品预览，可扫 `--k` 参数） |
| `stage_eyefix.py` | 眼锚点对齐渲染预览（**已弃用方案**，留档） |
| `eye_anchor_build.py` | 眼重心检测（**试过但判定不可靠，未采用**；`eye_anchor.json` 仅留作单张抽查） |
| `scene_data.py` / `scene_expression_list.py` | 按景汇总原始数据 |
| `build_scenes.py` | 生成 `scenes.json` |
| `build_expressions.py` | 生成 `expressions.json` + `expression-matrix.md` |
| `build_extended.py` | 生成 `expressions_extended.json`（同服装行补充候选） |
| `build_cn_predicates.py` | ★ 生成**中文谓词表**（官方简中剧本直取） |
| `merge_slots.py` | 把逐文件判定合并进主表 |
| `outfit_index.py` | 每个 (角色, 服装行) 的全部通道/帧清单 |
| `slice_sheet.py` / `matrix_split.py` / `sheet_split.py` | 各种印相表切片 |

---

## 5. 过程产物（人读）

| 路径 | 内容 |
|---|---|
| `persona_work/expressions/exprfiles_A*.jpg` | **逐文件印相表**（A1A2 / A3 / A4 / A5 / A6 / A3sou / A3tob） |
| `persona_work/expressions/matrix_aok_12.jpg` 等 | 通道 × 帧号矩阵 |
| `persona_work/expressions/vstrips_*.jpg` | 帧号 × 通道条带 |
| `persona_work/expressions/fcons_*.jpg` | 跨通道一致性行图 |
| `persona_work/expressions/fam_*.jpg` | 单家族全帧条带 |
| `persona_work/expressions/v00face_*.jpg` | 各通道 v00 的脸部归一化对比 |
| `persona_work/stage/try_*.jpg` | 站位九宫格（参数扫描用） |
| `persona_work/stage/final/stage_final_k0.7.jpg` | ★ **六景成品预览**（最终规格） |
| `persona_work/stage/eyefix_*.jpg` | 眼锚点对齐预览（已弃用方案） |
| `persona_work/agg/sprite_sequence.json` | ★ 全库 165 章 / 6192 条立绘标识 + 文件路径 |
| `persona_work/stage/scene_data.md` | 各景原始数据 |
| `persona_work/stage/slot_sprites.json`（旧） | ⚠️ 按旧语义（`i4` 当表情）生成，**已被 `expressions.json` 取代** |

---

## 6. 复现命令

```powershell
# 1) 全库立绘标识序列（核心数据）
python persona_work\tools\sprite_sequence.py dump

# 2) 某章的"原作调度流水"（文本与立绘交错）
python persona_work\tools\sprite_sequence.py mix 2_3

# 3) 某景用到的具体立绘文件
python persona_work\tools\scene_sprites.py 2_1 2_2 2_3 2_4 2_5 --who aok --i3 12

# 4) 生成逐文件印相表（判定用）
python persona_work\tools\scene_expr_sheet.py A3

# 5) 重算全部数据表
python persona_work\tools\build_expressions.py      # expressions.json + expression-matrix.md
python persona_work\tools\build_extended.py       # expressions_extended.json
python persona_work\tools\build_scenes.py         # scenes.json
python persona_work\tools\build_cn_predicates.py  # 中文谓词表
python persona_work\tools\outfit_index.py         # 服装行全量清单

# 6) 站位成品预览（六景）
python persona_work\tools\stage_final.py --k 0.70
```
