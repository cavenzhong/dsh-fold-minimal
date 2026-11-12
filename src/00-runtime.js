/**
 * dsh-fold-minimal —— 浏览器半。
 *
 * 侧栏折叠（macOS 桌面）后，窗口左上角原本只剩「展开 / 新建会话」两个按钮。
 * 本插件把左侧主菜单的全局面板图标映射进这个 chrome 座位，顺序与左侧菜单一致：
 *
 *   [展开] │ [全局面板图标…] │ [新建会话]
 *
 *  - ui-sidebar 在该座位注册了官方按钮；本插件以 priority -1 覆盖同一单槽，
 *    同时自己渲染展开/新建会话，保证两个基础入口不丢，停用即恢复官方按钮。
 *  - 面板图标直接复用 `sidebar.panellist` 各插件注册的图标组件
 *    （`{ size, active }`），顺序沿用其 order。
 *  - 面板区固定 4 格：多于 4 个时第 4 格变成「更多」，其余面板收进悬停菜单。
 *  - 侧栏拖到最小宽度后继续往左拖，松手即收起；判定不写死最小宽度。
 *  - 只 require 平台基座里的 react；不 import 任何 DSH Client 包。
 *  - 折叠态按工具栏实测宽度改写 `--dsh-frame-leading-clearance`，让会话标题
 *    让位；展开/卸载时移除。
 *  - v0.4 起，侧栏展开时在收起按钮左侧注入「返回会话」按钮。
 *  - v0.4 新增可选部件「面板挪位与折叠」（插件详情页的组件开关开启）：
 *    对 `sidebar.panellist` 的每个面板以同 id、更低 priority 做「影子注册」改写
 *    order，宿主的 entriesOfSlot 同 id 取最低 priority，于是展开侧栏、折叠工具栏
 *    与「更多」菜单天然共享同一顺序；影子组件外面包一层带 `data-dfm-id` 的
 *    `display:contents` 包装，用来挂拖拽、隐藏宿主行，以及给事件委托提供锚点。
 *    展开侧栏「更多」行右侧的 `›` 展开下方缩进二级区，把面板行拖进去即收起。
 *
 * @module dsh-fold-minimal/client
 */
    var React = require('react');
    var h = React.createElement;
    /**
     * react-dom 是平台基座模块（与 react 同一张冻结模块表），只用于把二级区
     * portal 进宿主侧栏里我们创建的容器。取不到时退化为不渲染二级区内容，
     * 排序/拖拽/设置开关仍可用。
     */
    var ReactDOM = null;
    try {
      ReactDOM = require('react-dom');
    } catch (error) {
      ReactDOM = null;
    }

