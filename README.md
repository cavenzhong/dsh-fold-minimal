# dsh-fold-minimal

> 侧栏折叠后，左侧主菜单不再消失：窗口左上角保留
> **「展开 │ 全局面板（与左侧同序）│ 新建会话」** 工具栏。

<br />

DSH（macOS 桌面）把左侧栏完全折叠时，左上角原本只剩「展开侧边栏」和
「新建会话」两个按钮。这个插件在**不改变展开态**的前提下，把左侧主菜单里的
全局面板图标映射进折叠态工具栏：

```
┌─ 窗口左上角（侧栏折叠时）────────────────────────────────────────────┐
│  [▯]  │  [✦ 插件] [🗒 Obsidian MEMO] [◷ 自动化任务]  │  [⊕ 新建会话] │
└────────────────────────────────────────────────────────────────────┘
   展开                全局面板（与左侧主菜单同序）              新建会话
```

- **单一分区**：所有左侧面板放在同一区，顺序与展开态左侧主菜单完全一致；
  只在面板区两侧保留淡分割线。「更多」是菜单，折叠态不渲染。
- **图标来自插件自己**：读 `sidebar.panellist` 的注册者，直接渲染每个插件注册的
  图标组件，所以新装/改名的左侧栏插件会自动出现，不用改本插件。
- **选中态同步**：当前主面板的图标会显示选中底色，点击即切面板。
- **标题让位**：按工具栏实测宽度改写 `--dsh-frame-leading-clearance`，会话标题
  不会被图标压住。

## 安装

在 DSH 里用 `plugin_manager`（或等效的 `dsh plugin --profile desktop add`）：

```bash
plugin_manager install_bundle --target link:/Users/cavenzhong/Documents/个人项目/my-dsh-plugin/dsh-fold-minimal
```

安装后折叠左侧栏即可看到效果；停用/卸载本插件会立刻回退到官方按钮，不需要重启。

开发迭代时：在插件页把本插件**停用再启用**一次，浏览器就会加载新的 `client.js`
（已实测）；`hmr.root` 是 Host 侧模块监听，不要把它当成客户端 bundle 热重载的保证。

## 兼容与边界

- **只影响 macOS 桌面折叠态**：该工具栏占用的 `shell.leading` 座位由 frame 在
  「darwin + 侧栏折叠」时挂载；展开态、Windows/Linux 的窄侧栏轨道都不受影响。
- 折叠态显示**所有**已注册的 `sidebar.panellist` 条目（包含未固定的条目）；
  「更多」菜单里的动作不在折叠态提供。
- `sidebar.panellist` 的图标组件按 `{ size, active }` 直接渲染；如果某个插件的
  图标还依赖 entry 的 `t`、标准 props（`usePanelInfo` 等）或 entry `inject`，
  它会退化为兜底图标，但不会影响整条工具栏。
- 面板很多或窗口极窄时，工具栏不提供横向滚动，超出部分会被 frame 裁掉；
  clearance 按工具栏实测宽度写入，正常规模（3~6 个面板）下不会影响会话标题。
- 不 import 任何 DSH Client 包，只 require 平台基座里的 `react`；样式只引用
  `--dsw-alias-*` / `--dsw-radius-*` 等主题 token。

## 实现位置

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半，空实现（bundle 行需要一个包主模块）。 |
| `client.js` | 浏览器半：注册 `shell.leading`（priority `-1`，覆盖官方折叠态按钮）、按左侧同序映射面板图标、工具栏渲染、clearance 同步。 |
| `cordis.patch.yml` | Loader 行 `fold-minimal`。 |
| `locale/zh.json`、`locale/en.json` | Plugins 页展示用标题/描述。 |
| `icon.svg` | 插件图标。 |
