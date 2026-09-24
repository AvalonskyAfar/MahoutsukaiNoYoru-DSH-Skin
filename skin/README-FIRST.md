# 先读这个

这是 **dsh-skin-mahoyo（《魔法使之夜》DSH 皮肤）的源码分发版**，**不含原作素材**
（图像与 BGM 的版权属于 TYPE-MOON）。皮肤代码、工具链、立绘配方都在，**素材要你自己接**。

- 皮肤版本：`{{VERSION}}`
- 打包日：{{DATE}}

---

## 你要做的事，按顺序

### 1. 读素材重建指南

**[`skin/ASSET-RECOVERY.md`](skin/ASSET-RECOVERY.md)** —— 这是本包最重要的文件。

它写清了：素材来自原著的哪个归档、每个文件对应哪一条、怎么接，
**以及为什么必须裁掉原图自带的透明层**（不裁会出现贴边黑缝 + 画面发糊）。

### 2. 改一行路径

```python
# hfa_tools/hfa.py:16 —— 整条链的单一入口，改成你机器上的原著目录
GAME = r"<你的原著目录>"
```

### 3. 按指南接素材

- **音频**（`bgm/` 16 首 + `se/` 7 个）：照着做，几分钟搞定，**完全可靠**
- **图像**（`bg/` + `sprite/` + `ui/`）：见指南 §3（有解包产物）或 §4（只有原著）

### 4. 装进 DSH

```bash
node skin/tools/check-client.mjs        # 离线自检
pwsh -File skin/tools/install.ps1       # 装进 $DSH_HOME/profiles/web/node_modules/
# 然后刷新浏览器页面
```

---

## ⛔ 两条禁令

**不要跑 `skin/tools/assemble-assets.mjs`** —— 它读的是旧立绘管线，会毁 `manifest.json`。
脚本已加硬拦截（`exit 2`），**不要加 `--i-know-this-destroys-manifest` 绕过**。
要改 manifest 请手改，或用 `persona_work/tools/restore-expressions.mjs`。

**不要在 `ui/` 上跑 `crop_alpha.py`** —— 那些构件的透明边是构图的一部分。
该脚本默认只处理 `bg` 与 `sprite`，别加 `--dir ui`。

---

## 这个包里有什么

| 路径 | 内容 |
|---|---|
| `skin/` | 皮肤源码（`assets/` 是空的） |
| `skin/ASSET-RECOVERY.md` | **素材重建指南** |
| `hfa_tools/` | 原著 `.hfa` 归档解包工具链 |
| `persona_work/tools/` | 立绘合成、音频导出、场景表 |
| `persona_work/stage/` | 立绘配方 json（`stage_spec.json` 是权威） |
| `bgm/` | BGM 映射表（`.tsv` / `.json`，**无 .ogg**） |
| `recovery/` | DSH 起不来时的急救脚本 |
| `docs/MAINTENANCE.md` | 维护手册（红线 / 踩过的坑） |

**不含**：`skin/assets/`、`hfa_png/`（解包产物）、原著本体、`persona_work` 的过程证据。
