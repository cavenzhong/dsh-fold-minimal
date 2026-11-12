# dsh-fold-minimal —— 源码结构

`client.js` 是**生成产物**，不要直接编辑。源码在 `src/`，由
`scripts/build-client.mjs` 按 `src/manifest.json` 的顺序拼进现有的
`window.__ModuleLoader__.load({ id, factory })` 包装。

```bash
npm run build   # 重新生成 client.js
npm run check   # 只检查 client.js 是否与 src/ 一致
npm test        # pretest 先 check，再跑 node --test
```

发布物仍然只有 `client.js`；运行时没有构建步骤、第三方依赖或额外 chunk。

## 为什么是拼接，不是 ESM

DSH 的 Client loader 要求一个包注册一个 lazy factory。当前包的发布形态是
“单文件、零构建、可直接审计”。如果改成 ESM + bundle，就会引入构建链和
devDependency，改变这个包最重要的维护边界。

`src/` 的 fragment 共享同一个 factory 闭包；函数声明会提升，因此 manifest
的顺序主要按可读性排列，而不是严格的 import 依赖图。不要在两个 fragment
之间放置依赖初始化顺序的**顶层立即执行代码**；需要初始化的量放在函数里。

## 模块地图

| 文件 | 负责 | 常见改动 |
|---|---|---|
| `00-runtime.js` | `react` / `react-dom` 基座 require | 新增平台基座依赖 |
| `01-constants.js` | 槽位名、`data-dfm-*`、延迟、cursor | 改常量、选择器标记 |
| `02-locales.js` | 中英文 UI 文案 | 新增/修改开关、提示文案 |
| `03-styles.js` | 全部 CSS 与样式注入 | 改工具栏、菜单、拖拽提示外观 |
| `04-panels.js` | 面板快照、顺序合并、切分、分组重排 | 改 4 格规则、固定/未固定切分 |
| `05-storage.js` | cookie/localStorage、layout store、三个开关 | 改持久化字段、组件开关默认值 |
| `06-version.js` | release/官方能力探测、官方 `setPinned` 解析 | 改新版/旧版判定、官方兼容 |
| `07-pins.js` | 官方固定状态 store | 改固定状态缓存/订阅 |
| `08-dom.js` | 宿主行/nav 识别、固定状态 DOM 观测 | 适配 DSH 侧栏 DOM 结构变化 |
| `09-data.js` | 面板 observable source、React 订阅 | 改面板账本同步 |
| `10-shadow.js` | 同 id 影子注册与图标包装 | 改排序账本、行隐藏 |
| `11-icons.js` | 内置图标与错误边界 | 换图标、兜底图标 |
| `12-widgets.js` | 工具栏按钮、面板菜单行、折叠「更多」浮层 | 改浮层定位、行按钮、hover |
| `13-menus.js` | 官方「更多」探针、悬停几何、整行命中与官方 More 换位、旧版 More hover | 改官方 More 的整行拖动/换位 |
| `14-settings.js` | 插件详情页三个开关 | 改开关文案、兼容模式说明 |
| `15-chrome.js` | 展开态返回键、旧版二级区、`SidebarChrome` | 改展开侧栏 chrome |
| `16-drag-core.js` | 拖拽几何、ghost、插入线、旧版 placePanel | 改提示线、ghost 样式、旧版落点 |
| `17-collapse-drag.js` | 拖到最小宽度后继续左拖收起 | 改过冲阈值、指针提示 |
| `18-panel-drag.js` | 展开侧栏行排序与旧版二级区落点 | 改行拖拽、收起/恢复 |
| `19-rail-drag.js` | 折叠工具栏拖动、ghost、跨固定边界固定/取消固定 | 改平铺拖拽、落区、pin 提交 |
| `20-rail.js` | 折叠工具栏本体 | 改工具栏布局、返回按钮 |
| `21-apply.js` | 注册、生命周期、slot 接线 | 新增 slot、effect、注入 |
| `99-exports.js` | `inject` / `apply` / `__test` | 新增测试导出 |

## 我要改 X，看哪里

| 想改 | 先看 |
|---|---|
| 折叠后工具栏显示哪些面板、顺序 | `04-panels.js` + `20-rail.js` |
| 新版固定/未固定怎么判定 | `06-version.js` + `07-pins.js` + `08-dom.js` |
| 拖过固定边界时固定/取消固定 | `19-rail-drag.js` + `06-version.js` 的 `resolveOfficialSetPinned` |
| 折叠「更多」的 ghost/平铺拖拽 | `19-rail-drag.js` + `20-rail.js` + `12-widgets.js` |
| 官方「更多」里整行拖动 | `13-menus.js` 的 `installMenuReorder`/`menuRowForTarget` |
| 折叠「更多」浮层定位/悬停不消失 | `12-widgets.js` + `13-menus.js` |
| 组件开关、文案、兼容模式说明 | `14-settings.js` + `02-locales.js` + `05-storage.js` |
| 返回会话按钮 | 看 `15-chrome.js` + `20-rail.js` + `14-settings.js` |
| 拖到底继续左拖收起 | `17-collapse-drag.js` 的 `installDragCollapse` |
| 侧栏 DOM 结构变化导致失效 | `08-dom.js` 的 `hostPanelRow` / `sidebarNavElement` |
| 新增 slot 或 effect | `21-apply.js` |

## 改动约定

1. 只改 `src/`，然后 `npm run build`；不要直接改 `client.js`。
2. `src/manifest.json` 是顺序和模块说明的唯一来源；新增文件要同时加入 manifest。
3. fragment 不能出现 `import` / `export`；构建脚本会拒绝。
4. 不要在 fragment 顶层放跨文件依赖的立即执行代码；放进函数或 `apply`。
5. 提交前跑 `npm test`；`pretest` 会检查生成文件是否过期。
6. 每个模块前的 `/* ── src/xx.js ── */` 注释会出现在 `client.js` 里，便于从堆栈定位。
