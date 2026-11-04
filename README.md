<p align="center">
  <img src="assets/banner.png" alt="dsh-fold-minimal：把「刚才」留在左上角" width="100%">
</p>

<p align="center">
  <img src="assets/badge-version.svg" alt="v0.2.0" height="24">
  <img src="assets/badge-platform.svg" alt="macOS Desktop" height="24">
  <img src="assets/badge-license.svg" alt="MIT" height="24">
</p>

<p align="center">
  <b>把「刚才」留在左上角。</b><br>
  <sub>折叠侧栏后，点一下回到上一次工作的会话。一个很小、很轻、不打扰的 DSH 插件。</sub>
</p>

---

## 只解决一个小问题

DSH 折叠左侧栏后，左上角只剩「展开」和「新建会话」。

想从插件面板回到刚才的会话，得先展开侧栏，再在会话列表里找到它。两步不多，但足够打断一次心流。

**dsh-fold-minimal 只做一件事：把「回去」留在左上角。**

折叠态工具栏直接显示左侧所有全局面板图标，顺序和展开态完全一致；打开任意面板时，「新建会话」右侧会多出一个 **← 返回会话**。点一下，回到刚才的工作会话。

<p align="center">
  <img src="assets/hero.png" alt="折叠侧栏 + Plugins 面板中的真实界面" width="100%">
</p>

<p align="center">
  <sub>真实界面截图：折叠侧栏 + Plugins 面板。左上角工具栏里，← 返回会话已经就位。</sub>
</p>

## 轻到几乎不存在

它不新增侧栏，不新增设置页，不新增快捷键，也不改变 DSH 的任何默认行为。

- **只加一个按钮** — 28px，会话中自动隐藏，不占位。
- **只在需要时出现** — 在会话里看不到它；在全局面板里它才出现。
- **不改展开态** — 展开后的侧栏与 DSH 原样一致，不做任何重排。
- **不改你的会话** — 返回只是切回主区域保留的上一次会话，不重新加载历史、不重新排序。
- **没有设置** — 装好即用；停用 / 卸载立刻回退官方按钮，不需要重启。

<p align="center">
  <img src="assets/states.png" alt="在会话中返回按钮隐藏；在全局面板中返回按钮出现" width="100%">
</p>

<p align="center">
  <sub>同一根工具栏，两种状态。返回目标是你离开前正在看的那个会话。</sub>
</p>

## 功能一览

| | |
|---|---|
| 🧩 **面板图标一个不少** | 插件、自动化任务、Obsidian MEMO……新装的左侧面板会自动出现在折叠态工具栏。 |
| ↕️ **顺序就是左侧顺序** | 与展开态左侧主菜单完全一致；当前面板的图标会显示选中底色。 |
| ← **一键回到刚才** | 在任意全局面板中，点一下「返回会话」就回到刚才的工作。 |

## 安装

**需要**：macOS 桌面版 DSH（左侧栏支持折叠）。

1. 克隆仓库：

```bash
git clone https://github.com/cavenzhong/dsh-fold-minimal.git
```

2. 在 DSH 里用 `plugin_manager` 安装（把路径换成你的克隆位置）：

```bash
plugin_manager install_bundle --target link:/path/to/dsh-fold-minimal
```

3. 折叠左侧栏，效果立刻出现。

> 开发时改完 `client.js`，在插件页把本插件**停用再启用**一次即可加载新版本。

## 使用

1. 折叠左侧栏。
2. 左上角出现 **展开 │ 面板图标 │ 新建会话** 工具栏。
3. 点开任意全局面板。
4. **新建会话**右侧出现 **←**；点击回到刚才的会话，按钮自动隐藏。

## 兼容与边界

- 只影响 macOS 桌面的折叠态；展开态、Windows / Linux 的窄侧栏轨道保持原样。
- 返回目标是主区域保留的上一次工作会话（空白新会话草稿也算），不做「最近会话」排序。
- 面板很多或窗口很窄时，工具栏不横向滚动，超出部分会被窗口裁掉。
- 某个插件的图标不兼容时，会退化成兜底图标，不影响整条工具栏。

## 更新记录

### v0.2.0 · 2026-11-05

- 新增「返回会话」按钮：在全局面板中出现在「新建会话」后，一键回到上一次工作的会话；已在会话中时隐藏。
- README 升级为产品介绍页。

### v0.1.0 · 2026-11-04

- 折叠态工具栏按左侧菜单顺序映射全局面板图标。

<details>
<summary>技术细节 / 开发</summary>

- 浏览器半只 require 平台基座里的 `react`，不 import 任何 DSH Client 包。
- 面板图标读 `sidebar.panellist` 注册者，直接渲染插件自己的图标组件。
- 「返回会话」调用布局层原生 `ctx.layout.selectPanel(null)`；主会话由 `uiWorkspace` 的 `mainView` 引用保留，不需要重新加载。
- 完整实现说明与测试：[docs/TECHNICAL.md](docs/TECHNICAL.md)。

</details>

## License

MIT © cavenzhong
