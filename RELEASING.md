# 发布清单

> 2026-09-23 联网核实。**只记录打开页面确证过的渠道**，测源可疑的一律不写。
> 生态背景：DSH 官方对插件生态的"治理"就是 README 里**一句话**，
> 其余全是社区自建。别把任何第三方站点当官方。

---

## 一、上架前必须先满足的硬条件

这两条不满足，后面所有渠道都是白费。

### 1. `package.json` 必须声明 `dsh.bundle`

这是 `awesome-dsh-plugin` registry 的**最高频拒绝原因**。原文：

> The repo declares a `dsh.bundle` manifest in `package.json`
> (this is what makes it installable via `dsh plugin add`).
>
> **Most rejected submissions declare only `dsh.client` — that alone is not installable.**

本包的现状：✅ **已声明**

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-api-remotes"] },
  "engines": { "dsh": ">=0.1.5-rc.1" }
}
```

`cordis.patch.yml` 也必须在仓库根，内容含 `insert` 块（插件 id + 包名）。

### 2. 能被 `dsh plugin --profile web add <包>` 装上

自己先装一遍。装不上就是装不上。

### 3. 描述不许夸大

registry 的第二大拒绝原因，原文：

> A description that overstates the code — numbers of tools, domains,
> command names or API names that the source does not back up.

这条对本项目**反而是加分项**：README 里所有数字都是实测值。
但别在提交的 YAML 里堆数字 —— 一行说清是什么就够了。

---

## 二、渠道（按性价比排序）

### 🥇 T1 · 必做

#### ⓪ 填 GitHub 仓库设置（**这两个只能手动填，不在任何文件里**）

代码里改不了，但它们是**最高杠杆**的两处：

**仓库 Description**（GitHub 右上角 About → 齿轮 → Description）：

```
Witch on the Holy Night theme for the DeepSeek Harness Web UI — full-screen visual-novel
skin with original-style menus, three characters with sprites and expressions, day/night
BGM, and an ending sequence. 《魔法使之夜》DSH 皮肤。
```

GitHub 的仓库搜索**会索引 description**，且它显示在搜索结果里。

**仓库 Topics**（同一处设置）：

```
dsh-plugin
deepseek-harness
dsh
dsh-skin
dsh-theme
theme
skin
visual-novel
mahoyo
witch-on-the-holy-night
```

> `dsh-plugin` 是**官方唯一推荐**的那个，必须有；其余是补充触达面。
> `skin` / `theme` 是通用英文词，搜的人多。

#### ① 给仓库打 `dsh-plugin` topic

**官方 README 唯一正式推荐的渠道**，原文：

> Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic
> to your plugin repository for discoverability.

它同时是所有目录站、市场、awesome list 的**共同数据源**。
**不做这一步，下面 ②③ 全部失效。**

> ⚠️ 但别指望靠它被搜到：该 topic 下有 **15,900+ 个仓库**，无审核无门槛，
> 噪声占绝对多数（官方 topic 页排名靠前的是 2020 年的简历生成器）。

#### ② 往 registry 提一个 YAML 文件的 PR

**最大的杠杆。** 合并后会同时进入：registry 站点、`dsh-market`（装机量第一的市场）、
以及多个下游目录。

- 仓库：**[awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)**
- 站点：`awesome-dsh-plugin.com`
- 规模：16.7k star / 3.2k fork / **6952 commits** / CC0
- 数据路径：`data/plugins/<owner>__<repo>.yml`
- 提交方式：**一个插件一个文件**，PR 只加一个文件
- ⚠️ **有 148 个待合并 PR 的积压**，做好等待准备

模板（本仓库已备好一份，见 `registry-entry.yml`）：

```yaml
url: https://github.com/<owner>/dsh-skin-mahoyo   # 必须与仓库地址完全一致
name: <owner>/dsh-skin-mahoyo
category: theme
description:
  en: A Witch on the Holy Night visual-novel skin for the DeepSeek Harness Web UI.
  zh: 《魔法使之夜》风格的 DeepSeek Harness Web UI 皮肤。
```

要点：

| 项 | 说明 |
|---|---|
| `category` | 有效值共 **23 个**，皮肤用 **`theme`**（不要填 `ui` —— 皮肤有专属分类） |
| `description.en` | **必填**，一行，以句号结尾 |
| `description.zh` | 可选，缺了维护者会补 |
| `url` | **必须与仓库地址完全一致** |
| 描述里的 `: ` | 冒号加空格**必须加引号**，否则 YAML 解析失败 |

> 皮肤填 `theme` 的额外好处：这些条目会**自动流入 `dsh-market` 的 Themes 标签页**，
> 在那里皮肤是**互斥、一键切换、无需重启**的 —— 对皮肤品类体验远好于普通插件。

### 🥈 T2 · 中文用户触达

#### ③ 在 LINUX DO 发自荐帖

中文 DSH 圈的**实际聚集地**，插件作者的反馈主要来源。

- **没有 DSH 专属板块** —— 发在「**开发调优**」或「**资源荟萃**」两个通用板块
- 标题写清 "DSH 插件"，便于搜索
- 发完这一帖，可以顺带申请 `DshMarketPlace` 的 **LINUX DO 来源溯源徽章**

> ⚠️ 那个 "Verified" 徽章**不是安全认证**，定义只是"作者以自己名义发帖并公开负责"。
> 需要人工核对，所以数量很少。**别把它当质量背书。**

#### ④ 进官方 Discord

`https://discord.gg/Ycq5dCaS4` —— 官方 README 明确背书的两个社区之一
（另一个是 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)）。

### 🥉 T3 · 低成本补投

这些站点**都不是官方**，且至少 6 个互相竞争、名字都像官方。补投成本低，
但**不要把"已收录"当背书**：

- `dshplugin.io`（自称 3,729 条）
- `dshmarketplace.dev`
- `realguan/dsh-dock`（Tauri 桌面控制中心）
- `zhu1090093659/dsh-web` 的 `community.json`

---

## 三、不要做的事

| 别做 | 原因 |
|---|---|
| ❌ 找"官方市场" | **不存在**。`marketplace` 一词在官方 README 里**一次都没出现**。所有"市场"都是第三方 |
| ❌ 追 `dsh-plugin` topic 的排名 | 噪声占绝对多数，且官方按 star 排，新项目无法竞争 |
| ❌ 引用任何站点的"插件数量" | 同一仓库的英/中文 README 就差三倍（800+ vs 2300+）。真实漏斗：**11,439 仓 → 2,143 可装 → 955 被下载过**（第三方调查） |
| ❌ 参考 `ai-graveyard/dsh-skin` 当范式 | 真实存在，但 **0 star / 5 commits / 1 个皮肤**，无任何社区验证 |

---

## 四、发布前自检

- [ ] `package.json` 声明 **`dsh.bundle`**（不是只有 `dsh.client`）
- [ ] `package.json` 补齐 `repository` / `homepage` / `bugs` / `author`
- [ ] `package.json` 的 `keywords` 含 `dsh-plugin`、`dsh-theme`、`theme`
- [ ] 仓库打了 **`dsh-plugin`** topic
- [ ] `dsh plugin --profile web add <包>` 实测能装上
- [ ] 仓库根有 `cordis.patch.yml`，含 `insert` 块
- [ ] `LICENSE` 在仓库根
- [ ] README 的截图路径有效（**本仓库截图含原作美术，只作界面演示，不随包分发**）
- [ ] 仓库有维护迹象（有 commit 历史、不是 README-only）
- [ ] 素材不进仓库（`.gitignore` 已覆盖）

---

## 五、发布物

都在 `<仓库根>/release/`：

| 文件 | 大小 | 给谁 |
|---|---|---|
| `dsh-skin-mahoyo-<版本>-source-noassets-<日期>.zip` | 2.9 MB | **GitHub Release 挂这个** —— 不含任何原作素材，附素材重建指南 |
| `dsh-skin-mahoyo-<版本>.tgz` | 263 MB | 本地/私有分发（含素材，**不要公开发布**） |

重打包：

```bash
node skin/tools/pack-source-dist.mjs    # 无素材源码版 → release/
node skin/tools/pack-dist.mjs           # npm 包（含素材）→ release/
```

---

## 六、一个诚实的提醒

DSH 处于 **developer preview**，官方 README 用全大写写着
「**THERE WILL BE COMPATIBILITY-BREAKING CHANGES**」。

皮肤挂在 DSH 的 Web UI 插件体系上，依赖它的插槽与属性 —— **DSH 升级后皮肤可能失效**。
发布说明里要写明这一点，否则用户装完报错会回来找你。
