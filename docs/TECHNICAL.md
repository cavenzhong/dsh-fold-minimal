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
  第 4 个面板会失去入口。悬停约 80ms 展开、移开约 180ms 收回；点击/键盘也能
  打开，Esc 关闭；当前面板在菜单里时按钮显示选中态。菜单表面用
  `--dsw-specific-menu`（浅色近白、深色深灰，跟随主题）。
- **新版对齐官方固定菜单（v0.5）**：DSH 0.2.2+ 的官方「更多」负责固定/取消固定。
  插件读取 boot release / 官方 `entry-customization` 注册者自动识别版本；新版
  折叠工具栏只平铺固定项，未固定项与固定项溢出一起进「更多」，不再维护第二套
  隐藏状态。旧版继续使用插件自己的隐藏与二级区。
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

## v0.4–v0.6：面板排序与折叠（可选部件）

### 三个组件开关

插件详情页（`plugins.bundle.config`，key 为包名 `dsh-fold-minimal`）注册一个
设置区块，里面是 3 个组件开关：

- **折叠菜单**（`toolbarEnabled`，默认开）：折叠态工具栏（`shell.leading`
  priority `-1`）与拖到最小继续左拖收起。关闭时动态撤销 `shell.leading`
  注册与拖拽手势，宿主官方按钮立刻回来。
- **返回会话按钮**（`backEnabled`，默认开）：折叠工具栏与展开侧栏顶部的两处
  「返回会话」入口。关闭后两处一起隐藏；展开态按钮不再跟随「折叠菜单」开关。
- **面板挪位与折叠 / 面板挪位**（`enabled`，默认关）：影子排序、拖拽换位；
  新版跨固定边界时调用官方固定/取消固定，旧版还包括「更多」chevron/二级区与
  收起项。关闭时撤销全部影子并移除这些 chrome。

三个组件相互独立：只开「面板挪位与折叠」时，展开侧栏的排序/收起仍可用，
折叠工具栏相关增强则不出现；只开「返回会话按钮」时，展开态返回按钮仍会出现。

### 开关与状态

- 开关行用一个与宿主 primitive 同款（`role="switch"` + `aria-checked`）的
  按钮实现；文案走 locale。
- 状态 `{ enabled, toolbarEnabled, order, hidden }` 由 `createPanelLayoutStore` 持有：
  - **cookie 是主存储**：DSH 桌面每次启动给 Web GUI 分配随机本地端口，而
    `localStorage` 按 origin（含端口）隔离，重启会丢；cookie 只按 host 隔离，
    能跨端口保留。键为 `dsh_fold_minimal_panel_layout_v1`，`Max-Age` 一年。
  - `localStorage` 镜像（`dsh.fold-minimal.panel-layout.v1`）只作同源兜底。
  - `trayOpen`、`dragActive`、`dragPanelId` 只存在内存，不持久化；拖动时只画插入线，松手才提交顺序，不维护额外预览顺序。
  - 0.4.3 起字段与数组内容相同时不创建新快照、不通知订阅者，也不重复写入；cookie / localStorage 的属性访问与读写均支持异常降级。

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
  隐藏和行标记仅作用于宿主 `nav` 的直接面板按钮；二级列表、悬浮菜单和工具栏
  复用影子图标时不会隐藏所在按钮，也不会混入主列表的落点计算。
- `installPanelDrag`（展开侧栏）与 `installRailDrag`（折叠工具栏）都在 document
  上做 `pointerdown` 委托：按下后**移动超过约 4px 立即进入拖拽**（没有长按计时）；
  未超过阈值松手仍是普通点击。展开侧栏的命中范围是整行：图标外层的
  `data-dfm-id` 与影子组件给宿主行打的 `data-dfm-row-id` 都能识别，点标题/空白
  也能拖。
- 拖动期间**不移动、不重排任何宿主行**（避免列表跳动和「更多」位置漂移），
  用固定定位的箭头与蓝色插入线标出落点，沿用宿主工作区 dropBefore/dropAfter 的
  三层渐变、12px 提示高度、2px 线宽与 `--dsw-alias-state-business-primary` 主题色。
  纵向列表及二级区使用横向提示，折叠工具栏将同一图形旋转 90°。松手才提交顺序
  并重建影子注册。拖拽中给 `<html>` 挂 `data-dfm-row-drag` 禁选中、换抓取
  指针，松手吞掉紧随的一次 click，避免误开面板。
- 「更多」行始终在面板列表最后：它不属于 `sidebar.panellist` 注册项，拖拽
  与影子注册都不会移动它；拖到「更多」行上时只变底色，浅灰虚线始终只围住下方
  二级区，空提示文字不再重复画框。
- 松手收起后强制展开二级区，被收起的面板立刻出现在里面，并且可以在二级区内
  继续拖动排序（收起项顺序也写回同一份 order）。
- 折叠工具栏拖拽期间，`dragActive` 让**全部面板**临时一行平铺，包括收起项。
  `data-dfm-rail-zone="visible"` 与 `"hidden"` 将两组图标分开，用分隔线和浅色
  「拖到这里隐藏」文字标明隐藏区；显示区为空时提示「拖到这里显示」。两个区都
  能接收首个面板，跨区放置修改显隐，区内放置只调整该组顺序，松手后恢复
  4 格 + 「更多」。`data-dfm-rail-menu-id` 让菜单项也能作为拖动起点；激活前
  复制图标到不参与命中的固定浮层，原菜单卸载后图标仍跟随鼠标。平铺提交后
  再用一帧重新测量插入线；目标位置只根据对应分区内的图标计算。
- 跨组放置通过 `setPlacement` 一次提交顺序和收起状态，避免恢复面板先闪到旧位置。
  无效落点不提交；Esc、pointercancel、窗口失焦、关闭开关和卸载都会清理拖动状态。
- 0.4.3 起，两处拖拽均按动画帧合并指针移动，仅使用最新坐标测量与绘制；取消时移除待执行帧，松手独立计算最终落点。排序开关关闭时不安装这两个控制器及其插入提示节点。

### 旧版收进「更多」：二级区

> 新版 DSH 由官方「更多」固定/取消固定，插件不再注入 chevron/二级区；下面仅适用于旧版。

- 「更多」行（`nav` 直接子元素，含宿主 `aria-haspopup="menu"` 按钮）右侧注入
  一个绝对定位的 chevron：关闭时 `›`，点击后 CSS 旋转 90° 变成 `⌄`。
- chevron 是宿主 More 按钮的**兄弟节点**（不是嵌套 button），点击只切换
  store 的 `trayOpen`，不打开宿主 More 下拉。
- 二级区收起时，通过宿主 More 按钮打开原生悬浮菜单。收起项注册在
  `sidebar.panellist.actions` 的前置分组，显示在原有固定动作上方，点击沿用宿主
  `onDismiss` 关闭菜单；固定动作仍由宿主渲染。指针在入口与 portal 浮层之间移动
  时保持打开，离开后延迟收回。二级区展开或拖拽开始时立即关闭并禁止重新打开浮层。
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

## v0.5：官方固定菜单兼容

### 版本识别

`createCapabilities(ctx)` 依次读取：

1. `window.__DSH_BOOT__.release.version`，与 `0.2.2-rc.2` 做 semver（含 prerelease）比较；
2. boot 图里是否加载了 `@deepseek-ai/dsh-client-ui-entry-customization`；
3. 运行时 `sidebar.panellist.actions` 里是否有 id 为 `entry-customization` 的注册者。

任一命中即进入新版模式。新版模式只影响「收纳」来源，不影响折叠工具栏、拖拽收起
或返回按钮；旧版模式完全保留 0.4 的行为。

### 固定状态同步

- `installPinnedObserver` 在 `apply` 里独立安装，不依赖 `SidebarChrome` 的挂载时序。
  优先从官方 `shell.leading` 注入结果取得 `hooks.entryPins`，直接订阅未固定 id
  数组，并跟随面板增删重算固定集合，不维护第二套可写固定状态。
  缺少该 observable 时回退 nav 的 `aria-label` / `data-dfm-id` 观测；兼容路径
  跟随侧栏根替换，无法可靠匹配时保留上次状态。
- 官方「更多」菜单渲染时，它的 owner props `entries` 带权威 `pinned` 布尔值；
  `MoreMenuObserver` 在每个浮层打开时回写 `createPinsStore`，修正 DOM 推断。
- `splitOfficialPanels` 只平铺固定项；固定项超过 4 个时保留前 3 个，固定项溢出
  与未固定项分组进入「更多」：固定溢出在前，未固定组带「未固定到侧栏」说明，
  两组同时存在时用分割线区分，各组内部保留保存顺序。`pinned === null`（尚未观测）时先按全部固定
  处理，避免启动瞬间隐藏入口。

### 排序换位

- 新版不修改插件 `hidden` 状态：`installPanelDrag` 只在固定行之间换位；
  折叠工具栏与「更多」走 `installRailDrag`，拖过固定边界时调用官方
  `setPinned`；官方「更多」里的行由 `MoreMenuObserver` 安装
  `installMenuReorder` 做区内换位。
- `reorderBucket` 只替换目标分组在完整 order 中的位置，组外项保持原位；影子
  注册随后把同一 order 同步到展开侧栏、折叠工具栏与「更多」。
- `installMenuReorder` 现在只服务官方「更多」：它用
  `menuRowForTarget` 找“包含面板标记的整行按钮”，所以标题、空白都能拖，行内
  图钉按钮不会误触发。拖动时只画固定定位的插入线，松手才提交；菜单外松手取消。
- 所有落点共用 `insertionTargetAt`：按仍占位的完整列表计算视觉边界，再换算
  移除被拖项后的下标，避免提示线穿过原行。展开侧栏不显示 ghost。

### 悬停浮层

新版把折叠工具栏「更多」portal 到 `document.body`，固定定位在高 z-index 层。
悬停不是靠 DOM 祖先关系，而是：

- 按钮 `pointerenter` 80ms 后打开；
- 按钮/浮层任一侧 `pointermove` 都取消关闭；
- `hoverBridgeContains` 把按钮与浮层之间的 6px 间隙也算作命中；
- 离开后 180ms 才关闭，点击浮层内任意位置转为粘性打开。

这修复了插件面板等整页容器盖住标题栏时，鼠标一离开按钮浮层就消失的问题。

### 行容器变化

0.2.2 的 `PanelRow` 在按钮外增加了 `.panelEntry`（承载 pin 按钮）。原来的
`hostPanelRow` 要求按钮是 `nav` 的直接子元素，因此排序/隐藏/固定观测全部失效。
现在向上找到 nav 的直接子元素做行判定，返回按钮作为拖拽行，另用
`hostPanelRowItem` 定位整行容器做隐藏。

## v0.6：折叠工具栏的平铺 drag + ghost

v0.6 把折叠「更多」的换位改回 0.4 的手感，但语义对齐官方固定状态：

1. 在折叠「更多」里按住任意一行，移动超过约 4px；
2. 关闭竖向菜单，`layout.dragActive` 让折叠工具栏整体展开；
3. `createDragGhost` 克隆该行图标，跟随鼠标；
4. 工具栏渲染两个区：
   - `data-dfm-rail-zone="pinned"`：当前固定面板；
   - `data-dfm-rail-zone="unpinned"`：官方未固定面板；
5. 蓝色插入线只出现在指针所在的区，松手提交；
6. 指针在哪个区松手，就调用官方 `setPinned(id, 该区是否固定)`；随后
   `officialDropPlan` 计算目标 bucket，`reorderBucket` 写回顺序；
7. 如果拿不到官方 `setPinned`，跨区落点取消，不假装改变固定状态。

官方 `setPinned` 的取得方式：`resolveOfficialSidebar(ctx)` 从
`ctx.slots.entries('shell.leading')` 里找官方注册项，调用它的
`options.inject()`，识别同时带 `setPinned` 与 `hooks.entryPins` 的返回值。
不模拟点击，也不复制官方 pin store。`setOfficialPinned` 调用后核对官方快照，
宿主拒绝变更（如 `plugins` 不可取消固定）时取消跨区排序。

旧版 DSH 仍然渲染 `visible` / `hidden` 两区，跨区调用 `placePanel` 修改插件
自己的收起状态。两种模式共用同一个 `installRailDrag`，只是落区与提交函数不同。

整行拖动、ghost、插入线和清理都在 `installRailDrag` / `installMenuReorder` /
`createDragGhost` 内完成；拖动期间不移动宿主 DOM，避免菜单跳动。

## 安装

普通用户在 DSH 的 **插件 → 添加插件** 里输入 npm 包名 `dsh-fold-minimal`，安装后点 **立即启用**。
之后升级走插件页 **刷新 / 更新到** 或详情页 **版本** 区块（DSH 自带的插件更新组件）；Git、
本地目录或 `.tgz` 安装的版本没有这个区块，需要先移除再按包名安装一次。

开发时改用本地目录链接（桌面版 profile 通常叫 `desktop`）：

```bash
dsh plugin --profile <profile> add link:/path/to/dsh-fold-minimal
```

也可以让 agent 调用 `plugin_manager` 的 `install_bundle`，`target` 填
`link:/path/to/dsh-fold-minimal`。

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
  0.2.2 起宿主 `PanelRow` 在按钮外多了一层 `.panelEntry` 行容器；`hostPanelRow`
  向上找到 nav 的直接子元素来确认主列表行，隐藏时隐藏该行容器。
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
- 新版固定状态由官方保存在内存中；插件只在渲染时读取（优先影子标记，关闭排序
  时用 nav 行的 `aria-label` 与面板顺序匹配），不写官方状态。
- 折叠工具栏「更多」在新版通过 `react-dom` portal 到 `document.body`：浮层不再
  受标题栏/主面板层叠上下文影响，并用按钮与浮层的几何走廊连接悬停区域。
- 面板很多或窗口极窄时，超出窗口的部分仍会被 frame 裁掉；面板区固定 4 格后
  常态下不再增长，只有窗口极窄时才可能裁切。
- 不 import 任何 DSH Client 包，只 require 平台基座里的 `react`；二级区 portal
  额外 require 同一基座的 `react-dom`（取不到时禁用收起入口）。样式只引用
  `--dsw-alias-*` / `--dsw-radius-*` 等主题 token。

## 实现位置

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半，空实现（bundle 行需要一个包主模块）。 |
| `src/` | 浏览器半的源码，按功能拆分；`src/manifest.json` 定义拼接顺序。入口与模块地图见 [ARCHITECTURE](ARCHITECTURE.md)。 |
| `scripts/build-client.mjs` | 零依赖构建/校验脚本：按 manifest 把 `src/` 拼进 `window.__ModuleLoader__.load` 包装，`--check` 检查 `client.js` 是否过期。 |
| `client.js` | **生成产物**，由 `src/` 构建得到。内容：版本/官方固定菜单探测、`shell.leading` 折叠工具栏（priority `-1`，随「折叠菜单」开关动态注册）、展开态返回按钮注入、`plugins.bundle.config` 的三个组件开关、`sidebar.panellist` 影子注册与拖拽换位、新版固定状态同步（影子标记 / aria-label 兜底）、官方「更多」与折叠「更多」浮层内的拖动换位、`sidebar.footer.action` 里的 More chevron/二级区、`sidebar.panellist.actions` 的新版探针/旧版锚点、状态 store 与 cookie 持久化、拖到底继续左拖即收起、clearance 同步。 |
| `docs/CODE_REVIEW.md` | 0.4.3 的结构、冗余和性能排查结论、计数验证与未覆盖边界。 |
| `cordis.patch.yml` | Loader 行 `fold-minimal`。 |
| `locale/zh.json`、`locale/en.json` | Plugins 页展示用标题/描述。 |
| `icon.svg` | 插件图标。 |
| `.github/workflows/ci.yml` | push / PR 时运行 `node --test`（Node 22 / 24）。 |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Issue 表单，收集版本与面板环境。 |

## 发布与安装

DSH 插件的发布单位是一个 **bundle 包**。发布到 npm 后，用户在 **插件 → 添加插件** 输入包名
即可安装；从 npm 安装的第三方 bundle 还能使用 DSH 自带的检查与更新（插件页刷新 /
详情页「更新到」/「版本」区块）升级。

- **bundle 清单**：`package.json` 的 `dsh.bundle.patch` 指向补丁 YAML；补丁用
  `insert` 插入 Loader 行（`id`、`name`、可选 `config`）。
- **平台声明**：`dsh.bundle.platforms: ["darwin"]` 让启动器和插件管理器在非 macOS Host 上
  跳过/隐藏本插件；省略时允许所有平台。
- **DSH 版本要求**：`engines.dsh` 声明兼容范围（本仓库为 `>=0.2.0-0 <0.3.0-0`）。安装、
  启动和「版本」列表都按它判断兼容性，不兼容的版本不会安装/加载；官方实现按
  `includePrerelease` 匹配，因此 `0.2.x` 的预发布版也被接受。上界写成 `<0.3.0-0`
  而不是 `<0.3.0`，是为了同时排除 0.3 的预发布版。
- **浏览器半（可选）**：`dsh.client` 声明 `platform: web`、`immediately`、`inject`，
  `exports["./client"]` 指向构建好的 `client.js`；bundle 里用
  `window.__ModuleLoader__.load` 注册 lazy factory，`id` 等于包名。
- **展示资源**：`locale/<lang>.json` 提供 `meta.title` / `meta.description`；
  `exports["./icon"]` 指向图标。图标必须是包内有效的 SVG/PNG/JPEG/WebP，≤ 256 KiB，
  不允许绝对路径、外链或越界符号链接。
- **files**：补丁、locale、图标、所有运行时文件和资源都要在 `files` 里；本地链接安装
  不走 `files` 过滤，打包/发布时才会。发布前用 `npm pack --dry-run` 检查实际文件列表。
- **客户端约束**：不要在 factory 外做副作用；样式、监听、定时器、槽位注册都放在
  `apply` 里并通过 `ctx.effect` 返回清理；文案走 locale；样式只用 `--dsw-alias-*`
  等主题 token；不要 import 任何 `@deepseek-ai/dsh-client-*` 包。
- **安装入口**：`plugin_manager install_bundle` 接受绝对目录、npm 包名/版本、Git 地址
  （`github:user/repo#ref` 或 `https://github.com/user/repo`）和 `.tgz`/`.tar.gz` URL。
  DSH 的 **插件 → 添加插件** 对话框接受同一组 spec，是普通用户最方便的安装方式。
- **发现页 / 官方市场**：DSH 的 Discover 读独立的 market index（JSON），这是另一条收录
  流程；发布到 npm 只保证「按包名安装」，不会自动出现在 Discover/推荐里。

### npm 发布与升级链路

官方插件页只对「从注册表、以自身包名安装」的第三方 bundle 显示 **版本** 区块并允许
**更新**：

- profile 依赖按注册表 spec 保存（不是 `npm:` 别名，也不是 `link:`/`file:`/Git/tarball）；
- 包版本是合法 semver，且新版本仍声明 `dsh.bundle`；
- 新版本的 `engines.dsh` / DSH peer 要求接受当前运行的 DSH。

所以发布到 npm 后，用户在插件页输入 `dsh-fold-minimal` 安装一次，之后升级不需要卸载重装。
发布前确认：

```bash
npm pack --dry-run        # 检查 tarball 内容
npm publish --access public
```

若本机 registry 指向镜像（例如 npmmirror），发布时要显式使用官方源；`package.json` 的
`publishConfig.registry` 已固定为 `https://registry.npmjs.org/`。发布后若镜像尚未同步，
在插件页把 **安装源** 切到 npm 官方源即可。

本仓库对照：

| 项 | 状态 |
|---|---|
| `dsh.bundle.patch` + `cordis.patch.yml` | ✅ |
| `dsh.bundle.platforms: ["darwin"]` | ✅ |
| `engines.dsh: ">=0.2.0-0 <0.3.0-0"` | ✅ |
| `dsh.client` + `exports["./client"]` + lazy factory | ✅ |
| `meta.title` / `meta.description`（中英） | ✅ |
| `exports["./icon"]` + 原创 SVG 图标（< 256 KiB） | ✅ |
| `files` 覆盖补丁、locale、图标、运行时资源 | ✅ |
| 无 DSH Client 包 import、无额外构建依赖 | ✅（只 require 平台基座的 react / react-dom） |
| 版本 / MIT License / 仓库元信息 | ✅ |
| `publishConfig.registry` 固定 npm 官方源 | ✅ |

### 给别人安装

在 **DSH → 插件 → 添加插件** 输入包名：

```
dsh-fold-minimal
```

也可以让 agent 调用 `plugin_manager` 的 `install_bundle`，`target` 填 `dsh-fold-minimal`。

本地开发仍用：

```bash
dsh plugin --profile <profile> add link:/path/to/dsh-fold-minimal
```

注意：`link:` 安装不会出现「版本」区块；要验证官方升级链路，先移除 link 版本，再按包名安装一次。

## 测试

```bash
npm test
```

`pretest` 先运行 `node scripts/build-client.mjs --check`：只改 `src/` 不重新构建会让测试直接失败。

- 不依赖 DOM 的纯逻辑测试：面板快照、排序、语言表、`isPanelActive`、
  `splitPanels`（面板切分规则，含收起项）、`mergePanelOrder`（保存顺序与新增面板
  合并）、`moveVisibleOrder` / `replaceVisibleOrder` / `replaceHiddenOrder`
  （拖拽落点与收起项位置）、`panelsInOrder`、`sanitizeLayoutPrefs`、排序 store 的
  开关/顺序与显隐去重/收起/重置、`dragOvershoot`（拖拽过冲判定）。
- 运行时链路测试：用最小客户端上下文执行真实的 `apply()`，再渲染注册到
  `shell.leading` 的组件，断言返回按钮出现在「新建会话」之后、会话中隐藏、
  点击调用 `ctx.layout.selectPanel(null)`；开启排序与折叠后收起项进 More、
  已提交顺序立即反映到工具栏；新版固定项切分、未固定项进 More、版本检测与
  三个组件开关；`apply` 确实注册了展开态 chrome 与设置开关。
- 拖拽测试用最小 `document` 替身派发 pointer 事件：过冲判定、指针激活态的
  切换/复原、非 darwin 与右侧栏手柄不接管、监听清理。
- 回归用例覆盖影子图标的隐藏范围、原生 More 分组与二级区互斥、悬停浮层的
  生命周期、跨组放置的原子提交、菜单收起项拖出后的临时平铺与取消拖动。
- 0.4.3 新增相同布局零持久化、存储属性访问受限、特殊 id、影子读取失败与重注册、延迟折叠取消、每帧合并测量、组件开关完整清理和图标选中快照测试。
- 0.5.0 新增 semver/prerelease 比较、boot/官方注册者探测、官方固定项切分、分组换位、固定状态 store、悬停几何走廊、0.2.2 行容器识别与 aria-label 固定项反推。
- 0.6.0 新增官方「更多」整行命中、官方注入解析、跨固定边界 `officialDropPlan` 与平铺两区渲染测试；本轮补充几何、菜单分组、状态订阅和异常路径，共 64 项。详见 [适配排查](REFACTOR_REVIEW.md)。
- 本轮额外用本机 DSH 打包的 React、Menu、PanelMoreMenu 和 PanelRow 组件搭建
  浏览器夹具，验证展开二级区、悬停菜单、拖进/拖出、溢出项移到首位、全收起后
  恢复首项、无效落点与 Esc 取消；完整宿主窗口仍需在安装后确认。

GitHub Actions（`.github/workflows/ci.yml`）在 push 到 `main` 和 PR 时用
Node 22 / 24 运行同一套 `node --test`；测试无第三方依赖，不需要安装步骤。

## 更新记录

- **0.6.5**：四处拖动落点共用 `insertionTargetAt`，按仍占位的完整列表计算视觉边界；展开侧栏移除 ghost，顶部折叠工具栏保留；折叠「更多」分开固定溢出项与未固定项。官方菜单预览和提交共用边界检测，固定状态优先订阅 `entryPins`，跨区操作核对宿主是否接受；修复旧版 tray 识别及版本检测。64 项测试与 27 项浏览器夹具检查通过，详见 [适配排查](REFACTOR_REVIEW.md)。
- **0.6.1**：`client.js` 改为生成产物，源码按功能拆到 `src/`（23 个 fragment，manifest 定序）；新增零依赖 `scripts/build-client.mjs` 与 `npm run build` / `check`，`pretest` 校验生成文件；行为不变。模块地图见 [ARCHITECTURE](ARCHITECTURE.md)。
- **0.6.0**：折叠「更多」改回平铺 + ghost：拖动时菜单关闭、工具栏展开为「固定 / 未固定」两区，跨边界调用官方 `setPinned`；官方「更多」与折叠「更多」整行可拖；修复拖动时光标压在竖向菜单上的问题。
- **0.5.0**：自动识别 DSH 0.2.2+ 官方固定菜单：新版折叠工具栏只显示固定项、未固定项进官方「更多」，删除第二套隐藏状态；旧版保持原收起。新增独立「返回会话按钮」开关；修复折叠工具栏「更多」浮层被主面板遮挡导致一移开就消失（portal + 悬停走廊）；修复 0.2.2 `PanelRow` 多一层容器后排序失效、展开/折叠/更多不同步；官方「更多」与折叠「更多」浮层内支持拖动换位。
- **0.4.3**：拖拽测量按帧合并，相同状态不重复通知或写存储；开关生命周期集中管理，排序关闭时不安装控制器；影子图标只订阅自己的隐藏状态。修复停用 / 失焦后的延迟折叠、存储访问受限、账本读取失败及特殊 id 兼容；移除失效预览、未使用图标与重复包装账本，详见 [排查记录](CODE_REVIEW.md)。
- **0.4.2**：修复收起项复用图标被误隐藏、二级区与原生 More 浮层互斥、菜单项拖出
  和跨组原子提交；拖动提示对齐工作区原生箭头与线宽。折叠工具栏拖动时平铺全部
  面板，分为显示/隐藏两个区域，支持两区内排序与双向拖放；二级区使用浅灰虚线，
  More 行不再重复描边。
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
