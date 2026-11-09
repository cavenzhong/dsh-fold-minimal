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
  `--dsw-specific-menu`（浅色近白、深色深灰，跟随主题）。
- **图标来自插件自己**：读 `sidebar.panellist` 的注册者，直接渲染每个插件注册的
  图标组件，所以新装/改名的左侧栏插件会自动出现，不用改本插件。
- **选中态同步**：当前主面板的图标会显示选中底色，点击即切面板。
- **拖到底继续左拖 → 收起（v0.3）**：拖动侧栏到最小宽度后继续往左拖，超过
  80px 再松手才折叠。判定不在拖拽中途改宿主状态：松手后取一帧，用「渲染列宽 −
  指针期望列宽」的过冲量判定，宿主的最小宽度不作为常量写死。越过阈值后指针会
  变成「向左收起」形状（同一套线条、深浅主题各一支），提示松手会折叠。
- **返回会话（v0.2 / v0.4）**：主区域正停在某个全局面板（插件 / 自动化任务 /
  用户插件等）时，「新建会话」右侧出现返回按钮，点击直接回到最后一次工作的会话；
  已经在会话里时按钮隐藏。用的是布局层原生的 `ctx.layout.selectPanel(null)`——
  主会话由 `uiWorkspace` 的 `mainView` 引用保留着，不重新加载、不重新选择会话。
  **v0.4** 在侧栏展开时把同样的按钮注入到顶部收起按钮左侧（见下）。
- **标题让位**：按工具栏实测宽度改写 `--dsh-frame-leading-clearance`，会话标题
  不会被图标压住；面板区固定 4 格后，让位宽度也不再随面板数增长。

## v0.4：展开态返回按钮

- 注册一个不渲染视觉内容的组件到 `sidebar.footer.action`，从 owner prop 拿
  `wide`，用标准 `usePanelInfo` 订阅 `activePanelId`。
- 仅在「darwin + 侧栏展开 + 主区域有面板激活」时，把一个原生 `<button>` 插入
  `[data-sidebar-toggle]` 所属的 `[data-window-drag]` 标题条（即 `topStrip`）
  末尾，并用 CSS `order:-1` 排到收起按钮左侧；点击走同一个
  `ctx.layout.selectPanel(null)`。
- 用 `MutationObserver` 保证宿主重渲染后按钮仍在；effect 清理时移除按钮与监听。
- 不替换 `sidebar` 单槽：那个座位会连同它声明的 `sidebar.workspaces` /
  `sidebar.settings` 等子槽一起被取代，代价与升级风险都不可接受。

## v0.4：面板排序与折叠（可选部件）

### 两个组件开关

插件详情页（`plugins.bundle.config`，key 为包名 `dsh-fold-minimal`）注册一个
设置区块，里面是 2 个组件开关：

- **折叠菜单**（`toolbarEnabled`，默认开）：原有的折叠态工具栏（`shell.leading`
  priority `-1`）、拖到最小继续左拖收起、折叠/展开态返回会话按钮。关闭时动态
  撤销 `shell.leading` 注册与拖拽手势，宿主官方按钮立刻回来；展开态返回按钮
  也随之移除。
- **面板挪位与折叠**（`enabled`，默认关）：v0.4 新增的影子排序、拖拽换位、
  「更多」chevron/二级区与收起项。关闭时撤销全部影子并移除这些 chrome。

两个组件相互独立：只开「面板挪位与折叠」时，展开侧栏的排序/收起仍可用，
折叠工具栏相关增强则不出现。

### 开关与状态

- 开关行用一个与宿主 primitive 同款（`role="switch"` + `aria-checked`）的
  按钮实现；文案走 locale。
- 状态 `{ enabled, toolbarEnabled, order, hidden }` 由 `createPanelLayoutStore` 持有：
  - **cookie 是主存储**：DSH 桌面每次启动给 Web GUI 分配随机本地端口，而
    `localStorage` 按 origin（含端口）隔离，重启会丢；cookie 只按 host 隔离，
    能跨端口保留。键为 `dsh_fold_minimal_panel_layout_v1`，`Max-Age` 一年。
  - `localStorage` 镜像（`dsh.fold-minimal.panel-layout.v1`）只作同源兜底。
  - `trayOpen` 与拖拽中的 `preview` 只存在内存，不持久化。

### 顺序：影子注册（不替换宿主、不搬 DOM）

- 宿主 `ui-sidebar` 把 `entriesOfSlot('sidebar.panellist')` 映射成行，按
  `order` 升序渲染。`SlotCore` 对 list 槽按 `(priority, order)` 排序，并按 id
  去重、保留**最低 priority** 的条目（同 priority 同 id 才会抛错）。
- 开启后，本插件对每个面板以**相同 id、更低 priority**（原 priority − 1）
  重新注册一份影子条目：复刻 `component` / `label` / `inject` / `locale` /
  `store`，`order` 写入保存的顺序。于是：
  - 展开侧栏、折叠工具栏、`sidebar.panellist.actions` 看到的顺序天然一致；
  - 停用开关时撤销全部影子，宿主恢复原始注册与顺序；
  - 不 import/复制宿主组件，也不更改任何其他插件的注册。
- `createShadowManager` 监听 `sidebar.panellist` 与 store 的持久字段变化对账：
  面板新增/移除/重注册、顺序变化时增删影子；只有 `component` 变化才新建包装
  组件，纯 order 变化复用同一个包装，避免图标重挂闪烁。
- 面板条目自带的 `inject` / `store` 会被原样复刻，保证原图标组件的 props 不缺。

### 拖拽换位（不再长按）

- 每个影子条目外层是 `display:contents` 的 `<span data-dfm-id="…">` 包装，
  对宿主行做两件事：收起时设 `display:none`、给事件委托提供稳定锚点。
- `installPanelDrag`（展开侧栏）与 `installRailDrag`（折叠工具栏）都在 document
  上做 `pointerdown` 委托：按下后**移动超过约 4px 立即进入拖拽**（没有长按计时）；
  未超过阈值松手仍是普通点击。展开侧栏的命中范围是整行：图标外层的
  `data-dfm-id` 与影子组件给宿主行打的 `data-dfm-row-id` 都能识别，点标题/空白
  也能拖。
- 拖动期间**不移动、不重排任何宿主行**（避免列表跳动和「更多」位置漂移），
  只用一条固定定位的蓝色插入线（`--dsw-alias-brand-primary`）标出落点：
  纵向列表画横线、折叠工具栏画竖线、二级区内也画横线。松手才 `setOrder`
  并重建影子注册。拖拽中给 `<html>` 挂 `data-dfm-row-drag` 禁选中、换抓取
  指针，松手吞掉紧随的一次 click，避免误开面板。
- 「更多」行始终在面板列表最后：它不属于 `sidebar.panellist` 注册项，拖拽
  与影子注册都不会移动它；拖到「更多」行上时整行高亮，提示松手会收进去。
- 松手收起后强制展开二级区，被收起的面板立刻出现在里面，并且可以在二级区内
  继续拖动排序（收起项顺序也写回同一份 order）。
- 折叠工具栏拖拽期间，`dragActive` 让工具栏把**所有未收起的**面板临时一行
  平铺，方便拖到任意位置；松手后恢复 4 格 + 「更多」的显示规则。

### 收进「更多」：二级区

- 「更多」行（`nav` 直接子元素，含宿主 `aria-haspopup="menu"` 按钮）右侧注入
  一个绝对定位的 chevron：关闭时 `›`，点击后 CSS 旋转 90° 变成 `⌄`。
- chevron 是宿主 More 按钮的**兄弟节点**（不是嵌套 button），点击只切换
  store 的 `trayOpen`，不打开宿主 More 下拉。
- 该行下方、`nav` 内部插入 `[data-dfm-tray]` 容器；`SidebarChrome` 通过平台
  基座的 `react-dom` 把 `HiddenTray` portal 进去（没有 `react-dom` 时不注入
  chevron/容器，避免面板被收起却无法拖回）。容器为空时 `:empty` 隐藏。
- 收起的面板：影子包装把宿主行设 `display:none`（不占 Tab 序、不改宿主 pin
  状态），并出现在二级区。操作：
  - 把上面的面板行拖进二级区 → 收起；
  - 把二级区里的行拖回主区 → 恢复并按落点插入；
  - 二级区内上下拖 → 调整收起项之间的顺序；
  - 点二级区行 → 打开该面板；底部「恢复默认排序」清空顺序与收起项。
- 折叠工具栏的「更多」菜单在开关开启时也列出收起项（图标 + 名称），并加一条
  分隔线；`splitPanels(panels, hidden)` 保证只要存在收起项就保留「更多」入口，
  即使所有面板都被收起。

## 安装

在 DSH 里用 `plugin_manager`（或等效的 `dsh plugin --profile desktop add`）：

```bash
plugin_manager install_bundle --target link:/path/to/dsh-fold-minimal
```

安装后折叠左侧栏即可看到效果；停用/卸载本插件会立刻回退到官方按钮，不需要重启。

开发迭代时：在插件页把本插件**停用再启用**一次，浏览器就会加载新的 `client.js`
（已实测）；`hmr.root` 是 Host 侧模块监听，不要把它当成客户端 bundle 热重载的保证。
从 0.3 升级到 0.4 后也按同样方式重新启用一次即可。

## 兼容与边界

- **仅作用于 macOS 桌面**：`shell.leading` 座位由 frame 在「darwin + 侧栏折叠」时
  挂载；展开态返回按钮/排序拖拽/二级区都按 `data-platform="darwin"` 判定。
  Windows/Linux 上不会出现 v0.4 的 chrome 增强（展开侧栏的影子顺序仍可被设置开启，
  但不提供拖拽手势）。
- 折叠态显示**所有**已注册的 `sidebar.panellist` 条目（包含宿主未 pin 的条目）；
  原侧栏「更多」菜单里的其他动作不在折叠态提供。
- **影子注册的宿主依赖**：依赖 `SlotCore` 的公开语义「list 槽按 priority/order
  排序、同 id 取最低 priority」以及 `ctx.slots.entries()` 能读到全部原始条目。
  宿主若改变去重/排序规则，这里需要跟着回归。影子条目对其他读取
  `entriesOfSlot('sidebar.panellist')` 的插件可见（同 id 去重后即本插件包装），
  组件、标签、inject、store 均复刻原条目；依赖「自报 registrant」的插件会看到
  本插件的 id。
- **展开态 DOM 增强**：依赖 `[data-sidebar-toggle]`、`[data-window-drag]`、
  `nav` 直接子元素与 `button[aria-haspopup="menu"]` 这几个宿主结构；宿主改结构
  时需要回归。注入的按钮/chevron/二级区都带 `data-fold-minimal` 或
  `data-dfm-*` 标记，停止开关或卸载插件即移除。
- **拖拽收起的宿主依赖**：只旁听宿主手柄的 `data-side="sidebar"`、指针事件冒泡，
  以及松手后一帧读取手柄的 `style.left`；不改宿主状态、不抢 pointer capture。
  仅在 darwin 安装；过冲阈值 80px，宿主最小宽度不写死。指针提示是拖拽期间挂在
  `<html>` 上的 `data-dfm-collapse-armed` + 两条自定义 cursor 规则（`!important`
  盖住宿主手柄的 `col-resize`），不改宿主的 cursor 属性，松手/卸载即移除。
- 「返回会话」只出现在面板上下文里，回到会话后自动隐藏；返回目标是主区域保留的
  最后一次会话（空白新会话草稿也算），不另做「最近会话」排序。主会话被归档时
  DSH 会先关闭面板并清空主选择，按钮随之消失。
- `sidebar.panellist` 的图标组件按 `{ size, active }` 直接渲染；如果某个插件的
  图标还依赖 entry 的 `t`、标准 props（`usePanelInfo` 等）或 entry `inject`，
  它会退化为兜底图标（影子包装有错误边界），但不会影响整条工具栏。
- 面板很多或窗口极窄时，超出窗口的部分仍会被 frame 裁掉；面板区固定 4 格后
  常态下不再增长，只有窗口极窄时才可能裁切。
- 不 import 任何 DSH Client 包，只 require 平台基座里的 `react`；二级区 portal
  额外 require 同一基座的 `react-dom`（取不到时禁用收起入口）。样式只引用
  `--dsw-alias-*` / `--dsw-radius-*` 等主题 token。

## 实现位置

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半，空实现（bundle 行需要一个包主模块）。 |
| `client.js` | 浏览器半：`shell.leading` 折叠工具栏（priority `-1`，随「折叠菜单」开关动态注册）、展开态返回按钮注入、`plugins.bundle.config` 的两个组件开关、`sidebar.panellist` 影子注册与拖拽换位、`sidebar.footer.action` 里的 More chevron/二级区/portal、`sidebar.panellist.actions` 的 More 锚点、状态 store 与 cookie 持久化、拖到底继续左拖即收起、clearance 同步。 |
| `cordis.patch.yml` | Loader 行 `fold-minimal`。 |
| `locale/zh.json`、`locale/en.json` | Plugins 页展示用标题/描述。 |
| `icon.svg` | 插件图标。 |
| `.github/workflows/ci.yml` | push / PR 时运行 `node --test`（Node 22 / 24）。 |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Issue 表单，收集版本与面板环境。 |

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
| 无 DSH Client 包 import、无额外构建依赖 | ✅（只 require 平台基座的 react / react-dom） |
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
  `splitPanels`（面板切分规则，含收起项）、`mergePanelOrder`（保存顺序与新增面板
  合并）、`moveVisibleOrder` / `replaceVisibleOrder` / `replaceHiddenOrder`
  （拖拽落点与收起项位置）、`panelsInOrder`、`sanitizeLayoutPrefs`、排序 store 的
  开关/预览去重/收起/重置、`dragOvershoot`（拖拽过冲判定）。
- 运行时链路测试：用最小客户端上下文执行真实的 `apply()`，再渲染注册到
  `shell.leading` 的组件，断言返回按钮出现在「新建会话」之后、会话中隐藏、
  点击调用 `ctx.layout.selectPanel(null)`；开启排序与折叠后收起项进 More、
  拖拽预览顺序立即反映到工具栏；`apply` 确实注册了展开态 chrome 与设置开关。
- 拖拽测试用最小 `document` 替身派发 pointer 事件：过冲判定、指针激活态的
  切换/复原、非 darwin 与右侧栏手柄不接管、监听清理。
- 展开侧栏的 DOM 注入/拖拽手势依赖真实宿主结构，当前以语法检查、`apply`
  注册断言、拖拽控制器的监听生命周期测试和安装后的 Client Slot 检查覆盖；
  视觉与真实手势需要在实际页面回归。

GitHub Actions（`.github/workflows/ci.yml`）在 push 到 `main` 和 PR 时用
Node 22 / 24 运行同一套 `node --test`；测试无第三方依赖，不需要安装步骤。

## 更新记录

- **0.4.0**：插件详情页新增 2 个组件开关（折叠菜单默认开 / 面板挪位与折叠
  默认关）；展开侧栏新增「返回会话」按钮（收起按钮左侧）；「面板挪位与折叠」
  用影子注册统一展开/折叠顺序、两处拖拽排序、面板拖进「更多」二级区收起
  并拖回恢复；状态用 host 级 cookie 跨端口持久化。
- **0.3.0**：面板区固定 4 格，第 5 个面板出现时第 4 格变成「更多」，悬停展开
  其余面板；侧栏拖到最小宽度后继续往左拖，越过阈值时指针切换为「向左收起」、
  松手即收起。两项都不加配置项。
- **0.2.0**：新增「返回会话」按钮——在全局面板中时出现在「新建会话」后，一键回到
  最后一次工作的会话；已在会话中时隐藏。提供 GitHub Release `.tgz` 安装包。
- **0.1.0**：折叠态工具栏按左侧菜单顺序映射全局面板图标。
