# dsh-fold-minimal —— 技术说明

> 产品介绍见 [README](../README.md)。这里保留实现细节、兼容边界与开发备注。

## 行为

侧栏折叠（macOS 桌面）后，窗口左上角原本只剩「展开 / 新建会话」两个按钮。
本插件把左侧主菜单的全局面板图标映射进这个 chrome 座位，顺序与左侧菜单一致：

```
┌─ 窗口左上角（侧栏折叠时）────────────────────────────────────────────────────────┐
│  [▯]  │  [✦ 插件] [🗒 Obsidian MEMO] [◷ 自动化任务]  │  [⊕ 新建会话] [← 返回会话] │
└──────────────────────────────────────────────────────────────────────────────────┘
   展开                全局面板（与左侧主菜单同序）              新建会话   仅打开面板时出现
```

- **单一分区**：所有左侧面板放在同一区，顺序与展开态左侧主菜单完全一致；
  只在面板区两侧保留淡分割线。
- **面板区固定 4 格（v0.3）**：不超过 4 个时全部平铺；第 5 个出现时，第 4 格
  变成「更多」按钮（向下箭头），被顶掉的面板连同其余面板收进悬停菜单——不然
  第 4 个面板会失去入口。悬停约 80ms 展开、移开约 120ms 收回；点击/键盘也能
  打开，Esc 关闭；当前面板在菜单里时按钮显示选中态。菜单表面用
  `--dsw-specific-menu`（浅色近白、深色深灰，跟随主题）。规则写死，不做配置。
- **图标来自插件自己**：读 `sidebar.panellist` 的注册者，直接渲染每个插件注册的
  图标组件，所以新装/改名的左侧栏插件会自动出现，不用改本插件。
- **选中态同步**：当前主面板的图标会显示选中底色，点击即切面板。
- **拖到底继续左拖 → 收起（v0.3）**：拖动侧栏到最小宽度后继续往左拖，超过
  80px 再松手才折叠。判定不在拖拽中途改宿主状态：松手后取一帧，用「渲染列宽 −
  指针期望列宽」的过冲量判定，宿主的最小宽度不作为常量写死。越过阈值后指针会
  变成「向左收起」形状（同一套线条、深浅主题各一支），提示松手会折叠。
- **返回会话（v0.2）**：主区域正停在某个全局面板（插件 / 自动化任务 / 用户插件等）
  时，「新建会话」右侧出现返回按钮，点击直接回到最后一次工作的会话；已经在会话里
  时按钮隐藏。用的是布局层原生的 `ctx.layout.selectPanel(null)`——主会话由
  `uiWorkspace` 的 `mainView` 引用保留着，不重新加载、不重新选择会话。
- **标题让位**：按工具栏实测宽度改写 `--dsh-frame-leading-clearance`，会话标题
  不会被图标压住；面板区固定 4 格后，让位宽度也不再随面板数增长。

## 安装

在 DSH 里用 `plugin_manager`（或等效的 `dsh plugin --profile desktop add`）：

```bash
plugin_manager install_bundle --target link:/path/to/dsh-fold-minimal
```

安装后折叠左侧栏即可看到效果；停用/卸载本插件会立刻回退到官方按钮，不需要重启。

开发迭代时：在插件页把本插件**停用再启用**一次，浏览器就会加载新的 `client.js`
（已实测）；`hmr.root` 是 Host 侧模块监听，不要把它当成客户端 bundle 热重载的保证。
从 0.2 升级到 0.3 后也按同样方式重新启用一次即可。

## 兼容与边界

- **仅作用于 macOS 桌面**：该工具栏占用的 `shell.leading` 座位由 frame 在
  「darwin + 侧栏折叠」时挂载；展开态增加拖拽收起手势。Windows/Linux 不受影响。
- 折叠态显示**所有**已注册的 `sidebar.panellist` 条目（包含未固定的条目）；
  原侧栏「更多」菜单里的其他动作不在折叠态提供。
- **面板区固定 4 格**：这是产品规则，不是配置项；也不读写任何配置文件。
  多余面板只在悬停菜单里出现，不参与左侧展开菜单的排序（v0.3 未实现拖拽排序）。
- **拖拽收起的宿主依赖**：只旁听宿主手柄的 `data-side="sidebar"`、指针事件冒泡，
  以及松手后一帧读取手柄的 `style.left`；不改宿主状态、不抢 pointer capture。
  仅在 darwin 安装；过冲阈值 80px，宿主最小宽度不写死。指针提示是拖拽期间挂在
  `<html>` 上的 `data-dfm-collapse-armed` + 两条自定义 cursor 规则（`!important`
  盖住宿主手柄的 `col-resize`），不改宿主的 cursor 属性，松手/卸载即移除。
  宿主若改动手柄标记或拖拽实现的提交时机，这里需要跟着回归。
- 「返回会话」只出现在面板上下文里，回到会话后自动隐藏；返回目标是主区域保留的
  最后一次会话（空白新会话草稿也算），不另做「最近会话」排序。主会话被归档时
  DSH 会先关闭面板并清空主选择，按钮随之消失。
- `sidebar.panellist` 的图标组件按 `{ size, active }` 直接渲染；如果某个插件的
  图标还依赖 entry 的 `t`、标准 props（`usePanelInfo` 等）或 entry `inject`，
  它会退化为兜底图标，但不会影响整条工具栏。
- 面板很多或窗口极窄时，超出窗口的部分仍会被 frame 裁掉；面板区固定 4 格后
  常态下不再增长，只有窗口极窄时才可能裁切。
- 不 import 任何 DSH Client 包，只 require 平台基座里的 `react`；样式只引用
  `--dsw-alias-*` / `--dsw-radius-*` 等主题 token。

## 实现位置

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半，空实现（bundle 行需要一个包主模块）。 |
| `client.js` | 浏览器半：注册 `shell.leading`（priority `-1`，覆盖官方折叠态按钮）、按左侧同序映射面板图标、面板区 4 格溢出菜单、拖到底继续左拖即收起、工具栏渲染、clearance 同步，以及面板活跃时在新建会话后追加「返回会话」。 |
| `cordis.patch.yml` | Loader 行 `fold-minimal`。 |
| `locale/zh.json`、`locale/en.json` | Plugins 页展示用标题/描述。 |
| `icon.svg` | 插件图标。 |

## 发布与安装

DSH 插件的发布单位是一个 **bundle 包**，不要求上架 npm，也不要求经过中心审核。能被
`plugin_manager` 安装即可：

- **bundle 清单**：`package.json` 的 `dsh.bundle.patch` 指向补丁 YAML；补丁用
  `insert` 插入 Loader 行（`id`、`name`、可选 `config`）。
- **浏览器半（可选）**：`dsh.client` 声明 `platform: web`、`immediately`、`inject`，
  `exports["./client"]` 指向构建好的 `client.js`；bundle 里用
  `window.__ModuleLoader__.load` 注册 lazy factory，`id` 等于包名。
- **展示资源**：`locale/<lang>.json` 提供 `meta.title` / `meta.description`；
  `exports["./icon"]` 指向图标。图标必须是包内有效的 SVG/PNG/JPEG/WebP，≤ 256 KiB，
  不允许绝对路径、外链或越界符号链接。
- **files**：补丁、locale、图标、所有运行时文件和资源都要在 `files` 里；本地链接安装
  不走 `files` 过滤，打包/发布时才会。发布前用 `pnpm pack` 检查实际文件列表。
- **客户端约束**：不要在 factory 外做副作用；样式、监听、定时器、槽位注册都放在
  `apply` 里并通过 `ctx.effect` 返回清理；文案走 locale；样式只用 `--dsw-alias-*`
  等主题 token；不要 import 任何 `@deepseek-ai/dsh-client-*` 包。
- **安装入口**：`plugin_manager install_bundle` 接受绝对目录、npm 包名/版本、Git 地址
  （`github:user/repo#ref` 或 `https://github.com/user/repo`）和 `.tgz`/`.tar.gz` URL。
  DSH 的 **插件 → 添加插件** 对话框接受同一组 spec，是普通用户最方便的安装方式。
- **发现页 / 官方市场**：DSH 的 Discover 读独立的 market index（JSON），这是另一条
  收录流程；直接安装不依赖它。

本仓库对照：

| 项 | 状态 |
|---|---|
| `dsh.bundle.patch` + `cordis.patch.yml` | ✅ |
| `dsh.client` + `exports["./client"]` + lazy factory | ✅ |
| `meta.title` / `meta.description`（中英） | ✅ |
| `exports["./icon"]` + 原创 SVG 图标（< 256 KiB） | ✅ |
| `files` 覆盖补丁、locale、图标、运行时资源 | ✅ |
| 无 DSH Client 包 import、无额外构建依赖 | ✅ |
| 版本 / MIT License / 仓库元信息 | ✅ |

### 给别人安装

把仓库地址粘到 **DSH → 插件 → 添加插件**：

```
https://github.com/cavenzhong/dsh-fold-minimal
```

也可以让 agent 用：

```text
plugin_manager install_bundle --target https://github.com/cavenzhong/dsh-fold-minimal
```

本地开发仍用：

```text
plugin_manager install_bundle --target link:/path/to/dsh-fold-minimal
```

## 测试

```bash
pnpm test
```

- 不依赖 DOM 的纯逻辑测试：面板快照、排序、语言表、`isPanelActive`、
  `splitPanels`（面板切分规则）、`dragOvershoot`（拖拽过冲判定）。
- 运行时链路测试：用最小客户端上下文执行真实的 `apply()`，再渲染注册到
  `shell.leading` 的组件，断言返回按钮出现在「新建会话」之后、会话中隐藏、
  点击调用 `ctx.layout.selectPanel(null)`，以及面板超过 4 个时只平铺 3 个图标
  并把其余交给溢出菜单。
- 拖拽测试用最小 `document` 替身派发 pointer 事件：过冲判定、指针激活态的
  切换/复原、非 darwin 与右侧栏手柄不接管、监听清理。

## 更新记录

- **0.3.0**：面板区固定 4 格，第 5 个面板出现时第 4 格变成「更多」，悬停展开
  其余面板；侧栏拖到最小宽度后继续往左拖，越过阈值时指针切换为「向左收起」、
  松手即收起。两项都不加配置项。
- **0.2.0**：新增「返回会话」按钮——在全局面板中时出现在「新建会话」后，一键回到
  最后一次工作的会话；已在会话中时隐藏。提供 GitHub Release `.tgz` 安装包。
- **0.1.0**：折叠态工具栏按左侧菜单顺序映射全局面板图标。
