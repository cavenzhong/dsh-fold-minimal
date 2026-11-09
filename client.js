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
 *  - v0.4 新增可选部件「面板排序与折叠」（设置 → 通用里开启）：
 *    对 `sidebar.panellist` 的每个面板以同 id、更低 priority 做「影子注册」改写
 *    order，宿主的 entriesOfSlot 同 id 取最低 priority，于是展开侧栏、折叠工具栏
 *    与「更多」菜单天然共享同一顺序；影子组件外面包一层带 `data-dfm-id` 的
 *    `display:contents` 包装，用来挂长按拖拽、隐藏宿主行，以及拖拽时的 order 预览。
 *    展开侧栏「更多」行右侧的 `›` 展开下方缩进二级区，把面板行拖进去即收起。
 *
 * @module dsh-fold-minimal/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-fold-minimal',
  factory: function (require) {
    var React = require('react');
    var h = React.createElement;
    /**
     * react-dom 是平台基座模块（与 react 同一张冻结模块表），只用于把二级区
     * portal 进宿主侧栏里我们创建的容器。取不到时退化为不渲染二级区内容，
     * 排序/长按拖拽/设置开关仍可用。
     */
    var ReactDOM = null;
    try {
      ReactDOM = require('react-dom');
    } catch (error) {
      ReactDOM = null;
    }

    /** 本插件在 locale 服务里的命名空间。 */
    var NS = 'fold-minimal';
    /** 折叠态窗口左上角的 chrome 座位（单槽，只在 macOS 侧栏折叠时挂载）。 */
    var SLOT = 'shell.leading';
    /** 左侧主菜单的全局面板图标列表。 */
    var PANEL_SLOT = 'sidebar.panellist';
    /** 与 ui-sidebar 一致：只对官方面板上报点击。 */
    var OFFICIAL_PANEL_ANALYTICS = { plugins: 'plugin', schedules: 'cron' };
    /** 图标尺寸（与窗口 chrome 里的原按钮一致）。 */
    var ICON_SIZE = 16;
    /**
     * clearance 额外留白：标题内容起点正好等于 clearance（header 左内边距 20 +
     * titleRow 的 clearance - 20），所以取 8 即宿主默认的「离工具栏右缘 8px」。
     */
    var CLEARANCE_TRAILING_GAP = 8;
    /**
     * 面板区固定格数。超出时最后一格让给「更多」，其余面板收进悬停菜单。
     * 规则写死、不做配置：这个插件只映射入口，不承担设置面板的职责。
     */
    var PANEL_SLOTS = 4;
    /**
     * 拖拽过冲阈值（px）：松手时的渲染列宽比指针期望列宽还大这么多，才算
     * 「已经拖到最小、还想继续往左」。取 80 让「拖到最小」和「触发折叠」之
     * 间留出明显的距离，避免贴边时误触；不写死宿主的最小宽度，宿主改范围也不失效。
     */
    var DRAG_COLLAPSE_OVERSHOOT = 80;
    /** 悬停意图：进入时的展开延迟与离开时的收回延迟（ms）。 */
    var MENU_OPEN_DELAY = 80;
    var MENU_CLOSE_DELAY = 120;
    /**
     * 拖拽中「松手会折叠」的指针：向左箭头 + 左侧竖线，线条粗细与缩放箭头一致。
     * 深浅主题各一支：浅色主题黑字形 + 白描边，深色主题白字形 + 黑描边。
     * 挂到 `<html>` 上用 !important 盖住宿主手柄的 col-resize。
     */
    var ARMED_ATTR = 'data-dfm-collapse-armed';

    /* ────────────── v0.4：面板排序与折叠（可选部件）────────────── */

    /**
     * 排序/隐藏状态的存储位置。
     *
     * DSH 桌面每次启动给 Web GUI 随机分配本地端口，而 localStorage 按 origin
     * （含端口）隔离，重启会丢。cookie 只按 host 隔离，正好跨端口保留；再镜像
     * 一份 localStorage 作为同源会话内的快速路径与兜底。不读写 Host 配置。
     */
    var LAYOUT_COOKIE = 'dsh_fold_minimal_panel_layout_v1';
    var LAYOUT_STORAGE_KEY = 'dsh.fold-minimal.panel-layout.v1';
    var LAYOUT_COOKIE_MAX_AGE = 31536000;

    /** 长按进入拖拽的阈值；未到阈值前移动超过这个距离就当作普通点击/滑动。 */
    var LONG_PRESS_MS = 360;
    var LONG_PRESS_SLOP = 6;

    /** 影子组件挂在宿主面板行图标外层的包装标记。 */
    var MARKER_ATTR = 'data-dfm-id';
    /** 展开侧栏「更多」行下方自绘的二级区。 */
    var TRAY_ATTR = 'data-dfm-tray';
    /** 二级区里每一行的面板 id。 */
    var TRAY_ID_ATTR = 'data-dfm-tray-id';
    /** 宿主「更多」行（nav 直接子元素）上的标记，用来定位二级区与 chevron。 */
    var MORE_ROW_ATTR = 'data-dfm-more-row';
    /** 拖拽悬停到二级区时的高亮标记。 */
    var DROP_ATTR = 'data-dfm-drop';
    /** 正在拖拽面板行时挂在 `<html>` 上的标记（禁选中、换指针）。 */
    var DRAG_ROOT_ATTR = 'data-dfm-row-drag';

    /**
     * 生成「向左收起」指针的 CSS cursor 值。
     * @param ink - 字形颜色。
     * @param outline - 描边颜色（保证在相反底色上也看得见）。
     * @returns `url(...) hotspot, fallback`。
     */
    function collapseCursor(ink, outline) {
      var glyph = "M6 8v12M21 14H11M16 9l-6 5 6 5";
      var svg =
        "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>" +
        "<g fill='none' stroke='" + outline + "' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'>" +
        "<path d='" + glyph + "'/></g>" +
        "<g fill='none' stroke='" + ink + "' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>" +
        "<path d='" + glyph + "'/></g>" +
        '</svg>';
      return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 14 14, w-resize';
    }

    var ARMED_CURSOR_LIGHT = collapseCursor('#111111', '#ffffff');
    var ARMED_CURSOR_DARK = collapseCursor('#ffffff', '#111111');

    var zh = {
      'rail.label': '折叠态工具栏',
      'toggle.open': '打开侧边栏',
      'session.new.label': '新建会话',
      'session.back.label': '返回会话',
      'panels.more': '更多面板',
      'layout.title': '面板排序与折叠',
      'layout.description': '开启后：长按拖动面板可调整顺序；把面板拖进「更多」可收起来。',
      'layout.reset': '恢复默认排序',
      'tray.label': '已收起的面板',
      'tray.empty': '把上面的面板拖到这里收起',
      'tray.expand': '展开已收起的面板',
      'tray.collapse': '收起已收起的面板列表',
    };

    var en = {
      'rail.label': 'Collapsed toolbar',
      'toggle.open': 'Open sidebar',
      'session.new.label': 'New session',
      'session.back.label': 'Back to session',
      'panels.more': 'More panels',
      'layout.title': 'Panel order & fold',
      'layout.description': 'When on: long-press a panel to reorder it; drag a panel into More to put it away.',
      'layout.reset': 'Reset panel order',
      'tray.label': 'Hidden panels',
      'tray.empty': 'Drag a panel here to put it away',
      'tray.expand': 'Show hidden panels',
      'tray.collapse': 'Hide the hidden-panel list',
    };

    /* ───────────────────────────── 样式 ───────────────────────────── */

    var CSS_TAG = 'dsh-fold-minimal/FoldMinimal.css';
    var CSS = [
      // 一行图标；tooltip 绝对定位在按钮下方，靠 :hover / :focus-visible 显示。
      '.DFM_rail{box-sizing:border-box;display:flex;align-items:center;gap:2px;height:28px}',
      '.DFM_divider{flex:none;width:1px;height:16px;margin:0 6px;border-radius:1px;',
      'background:var(--dsw-alias-border-l2);opacity:.55}',
      '.DFM_button{box-sizing:border-box;position:relative;flex:none;display:inline-flex;align-items:center;',
      'justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:var(--dsw-radius-sm);',
      'background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;-webkit-app-region:no-drag}',
      '.DFM_button:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_button:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      '.DFM_button.DFM_active{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.DFM_svg{display:block;flex:none}',
      '.DFM_tip{position:absolute;z-index:40;top:calc(100% + 7px);left:50%;transform:translateX(-50%);',
      'display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:var(--dsw-radius-sm);',
      'background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px;',
      'white-space:nowrap;pointer-events:none;visibility:hidden;opacity:0;',
      'box-shadow:var(--dsw-elevation-prominent,0 6px 16px rgba(0,0,0,.18))}',
      '.DFM_button:hover .DFM_tip,.DFM_button:focus-visible .DFM_tip{visibility:visible;opacity:1;',
      'transition:opacity .1s ease .38s,visibility 0s linear .38s}',
      '.DFM_kbd{font:inherit;opacity:.7}',
      // 「更多」的悬停菜单：贴着按钮下缘展开，只画一层浮层，不引入新容器。
      '.DFM_more{position:relative;flex:none}',
      '.DFM_menu{position:absolute;top:calc(100% + 6px);left:0;z-index:60;display:flex;flex-direction:column;',
      'gap:1px;min-width:168px;max-width:260px;padding:4px;border-radius:var(--dsw-radius-md);',
      // --dsw-specific-menu：浅色是近乎白的 #f8f9fa，深色是 #303136，跟随主题。
      'background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay));',
      'box-shadow:var(--dsw-elevation-prominent,0 6px 16px rgba(0,0,0,.18))}',
      '.DFM_menuItem{box-sizing:border-box;display:flex;align-items:center;gap:8px;height:30px;padding:0 8px;',
      'border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-primary);',
      'font:inherit;font-size:13px;line-height:18px;text-align:left;cursor:pointer}',
      '.DFM_menuItem:hover,.DFM_menuItem.DFM_active{background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_menuItem:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      '.DFM_menuLabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      // 拖拽进入「松手即折叠」的距离后，指针换成向左收起的形状（深浅主题各一支）。
      'html[' + ARMED_ATTR + '],html[' + ARMED_ATTR + '] *{cursor:' + ARMED_CURSOR_LIGHT + ' !important}',
      'html[' + ARMED_ATTR + '] body[data-ds-dark-theme],html[' + ARMED_ATTR + '] body[data-ds-dark-theme] *{',
      'cursor:' + ARMED_CURSOR_DARK + ' !important}',

      /* ───────── v0.4：展开态返回按钮 / 二级区 / 设置行 ───────── */
      // 展开态返回按钮：注入到侧栏 topStrip，用 order 排到收起按钮左侧。
      '.DFM_topBack{box-sizing:border-box;order:-1;flex:none;display:inline-flex;align-items:center;',
      'justify-content:center;width:28px;height:28px;margin:0;padding:0;border:none;',
      'border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);',
      'cursor:pointer;-webkit-app-region:no-drag}',
      '.DFM_topBack:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_topBack:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      // 「更多」行右侧的展开箭头（绝对定位在 More 行上，不嵌套进宿主 button）。
      '.DFM_moreChevron{position:absolute;right:4px;top:50%;transform:translateY(-50%);z-index:2;',
      'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;',
      'padding:0;border:none;border-radius:var(--dsw-radius-sm);background:transparent;',
      'color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.DFM_moreChevron:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.DFM_moreChevron:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      '.DFM_moreChevron svg{display:block;transition:transform .12s ease}',
      '.DFM_moreChevron[data-open="true"] svg{transform:rotate(90deg)}',
      // 「更多」下方的二级区：稍微右缩进，拖拽悬停时整块高亮。
      '.DFM_tray{box-sizing:border-box;display:flex;flex-direction:column;gap:2px;',
      'margin:0 0 4px 14px;max-height:320px;overflow:auto}',
      '.DFM_tray:empty{display:none}',
      '.DFM_tray[data-dfm-drop="true"]{outline:2px dashed var(--dsw-alias-brand-primary);outline-offset:2px;',
      'border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_trayRow{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;',
      'min-height:32px;margin:0;padding:4px 10px;border:none;border-radius:var(--dsw-radius-sm);',
      'background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;',
      'line-height:18px;text-align:left;cursor:grab}',
      '.DFM_trayRow:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_trayRow:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      '.DFM_trayRow[data-dfm-dragging="true"]{opacity:.5}',
      '.DFM_trayLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.DFM_trayEmpty{box-sizing:border-box;margin:0;padding:8px 10px;border:1px dashed ',
      'var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);',
      'font-size:12px;line-height:18px}',
      '.DFM_trayFooter{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:2px 2px 4px}',
      '.DFM_linkButton{border:none;background:transparent;color:var(--dsw-alias-brand-primary);',
      'font:inherit;font-size:12px;line-height:18px;padding:2px 4px;border-radius:var(--dsw-radius-sm);cursor:pointer}',
      '.DFM_linkButton:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      // 「更多」菜单里被拆分出来的分组。
      '.DFM_menuDivider{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l2);opacity:.7}',
      '.DFM_menuGroup{padding:4px 8px 2px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}',
      // 设置 → 通用里的开关行（版式与宿主偏好行一致）。
      '.DFM_setRow{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;',
      'gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}',
      '.DFM_setText{min-width:0}',
      '.DFM_setTitle{font-size:14px;line-height:20px}',
      '.DFM_setDesc{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      // Switch 直接照宿主 primitive 的样式复制，只用主题 token。
      '.DFM_switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;',
      'border:0;border-radius:999px;corner-shape:round;background:var(--dsw-alias-border-l3);cursor:pointer}',
      '.DFM_switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}',
      '.DFM_switch:disabled{cursor:default;opacity:.5}',
      '.DFM_switch:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
      '.DFM_switchThumb{display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;',
      'background:var(--dsw-alias-label-primary-foreground);transition:transform .12s ease}',
      '.DFM_switch[aria-checked="false"] .DFM_switchThumb{background:var(--dsw-alias-switch-thumb)}',
      '.DFM_switch[aria-checked="true"] .DFM_switchThumb{transform:translate(16px)}',
      // 拖拽面板行时的全局指针/选区状态。
      'html[' + DRAG_ROOT_ATTR + ']{user-select:none}',
      'html[' + DRAG_ROOT_ATTR + '] *{cursor:grabbing !important}',
      '.DFM_rowDragging{opacity:.5}',
    ].join('');

    /** 注入本插件样式；返回清理函数。 */
    function injectStyles() {
      if (typeof document === 'undefined' || !document.head) return undefined;
      var tag = document.createElement('style');
      tag.dataset.plugin = 'fold-minimal';
      tag.dataset.pluginCss = CSS_TAG;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return function () {
        if (tag.parentNode) tag.parentNode.removeChild(tag);
      };
    }

    /* ─────────────────────────── 面板数据源 ─────────────────────────── */

    /**
     * 读取一个注册条目的展示文案（thunk 会跟随当前语言）。
     * @param options - panellist 注册选项。
     * @returns 非空字符串；缺失时回退到 id。
     */
    function labelOf(options) {
      var value = options.label;
      var text;
      try {
        text = typeof value === 'function' ? value() : value;
      } catch (error) {
        text = undefined;
      }
      if (typeof text === 'string' && text.length > 0) return text;
      return options.id;
    }

    /**
     * 把 `sidebar.panellist` 的当前注册者折成不可变快照。
     * @param ctx - 客户端根上下文（用 slots 服务读账本）。
     * @returns `{ id, order, label, Icon }[]`，按左侧菜单的 order 升序。
     */
    function buildPanels(ctx) {
      var entries = ctx.slots.entriesOfSlot(PANEL_SLOT);
      var panels = [];
      for (var index = 0; index < entries.length; index += 1) {
        var entry = entries[index];
        var options = entry && entry.options ? entry.options : {};
        var id = options.id;
        if (typeof id !== 'string' || id.length === 0) continue;
        panels.push({
          id: id,
          order: Number.isFinite(options.order) ? options.order : 0,
          label: labelOf(options),
          Icon: entry.component,
        });
      }
      panels.sort(function (left, right) {
        return left.order - right.order;
      });
      return panels;
    }

    /** 面板快照的浅比较；引用不变时下游不重渲染。 */
    function samePanels(left, right) {
      if (left.length !== right.length) return false;
      for (var index = 0; index < left.length; index += 1) {
        var a = left[index];
        var b = right[index];
        if (a.id !== b.id || a.order !== b.order || a.label !== b.label || a.Icon !== b.Icon) return false;
      }
      return true;
    }

    /**
     * 把按 order 排好的面板切成「直接平铺」与「收进更多菜单」两段。
     *
     * 关闭「排序与折叠」时规则与 v0.3 相同：不超过 `PANEL_SLOTS` 个时全部平铺；
     * 超出时保留前 `PANEL_SLOTS - 1` 个、其余进菜单。开启后，被用户收起的
     * 面板也从主区移除、并保证「更多」按钮始终出现（否则收起的入口会消失）。
     * @param panels - `buildPanels` 的快照（已按 order 升序）。
     * @param hiddenIds - 被收起的面板 id（可选）。
     * @returns `{ visible, overflow, hidden }`；`hidden` 只含「排序与折叠」开启时的收起项。
     */
    function splitPanels(panels, hiddenIds) {
      var hidden = Array.isArray(hiddenIds) ? hiddenIds : [];
      if (hidden.length === 0) {
        if (panels.length <= PANEL_SLOTS) return { visible: panels, overflow: [], hidden: [] };
        return {
          visible: panels.slice(0, PANEL_SLOTS - 1),
          overflow: panels.slice(PANEL_SLOTS - 1),
          hidden: [],
        };
      }
      var hiddenSet = {};
      for (var index = 0; index < hidden.length; index += 1) hiddenSet[hidden[index]] = true;
      var flat = [];
      var folded = [];
      for (var scan = 0; scan < panels.length; scan += 1) {
        if (hiddenSet[panels[scan].id]) folded.push(panels[scan]);
        else flat.push(panels[scan]);
      }
      var needsMore = flat.length > PANEL_SLOTS || folded.length > 0;
      if (!needsMore) return { visible: flat, overflow: [], hidden: [] };
      return {
        visible: flat.slice(0, PANEL_SLOTS - 1),
        overflow: flat.slice(PANEL_SLOTS - 1),
        hidden: folded,
      };
    }

    /**
     * 把用户保存的顺序与当前面板集合合并：先按保存顺序挑出仍然存在的 id，
     * 再按宿主当前顺序补上新增面板（追加在末尾），保证结果覆盖且只覆盖当前面板。
     * @param savedOrder - 已保存的 id 顺序（可能为空/含失效 id）。
     * @param ids - 当前全部面板 id。
     * @param fallbackIds - 宿主默认顺序的面板 id（用于新增项的位置）。
     * @returns 完整顺序数组。
     */
    function mergePanelOrder(savedOrder, ids, fallbackIds) {
      var known = {};
      for (var index = 0; index < ids.length; index += 1) known[ids[index]] = true;
      var seen = {};
      var result = [];
      var append = function (id) {
        if (!known[id] || seen[id]) return;
        seen[id] = true;
        result.push(id);
      };
      var saved = Array.isArray(savedOrder) ? savedOrder : [];
      for (var savedIndex = 0; savedIndex < saved.length; savedIndex += 1) append(saved[savedIndex]);
      var fallback = Array.isArray(fallbackIds) ? fallbackIds : [];
      for (var fallbackIndex = 0; fallbackIndex < fallback.length; fallbackIndex += 1) {
        append(fallback[fallbackIndex]);
      }
      for (var idIndex = 0; idIndex < ids.length; idIndex += 1) append(ids[idIndex]);
      return result;
    }

    /**
     * 把 `id` 从可见序列里取出，插到 `index` 位置。
     * @param visibleIds - 当前可见顺序。
     * @param id - 被拖拽的 id。
     * @param index - 移除后序列里的目标插入下标（越界自动钳住）。
     * @returns 新可见顺序。
     */
    function moveVisibleOrder(visibleIds, id, index) {
      var without = [];
      for (var scan = 0; scan < visibleIds.length; scan += 1) {
        if (visibleIds[scan] !== id) without.push(visibleIds[scan]);
      }
      var target = Math.max(0, Math.min(index, without.length));
      without.splice(target, 0, id);
      return without;
    }

    /**
     * 用新的可见顺序替换完整顺序中的可见位，保持被收起项的相对位置不变，
     * 这样排序时被收起的面板不会因为不可见而乱跳。
     * @param allOrder - 完整顺序（通常来自当前面板快照）。
     * @param hiddenIds - 被收起的面板 id。
     * @param visibleIds - 新的可见顺序。
     * @returns 新完整顺序；长度对不上时原样返回 `allOrder`（保护异常输入）。
     */
    function replaceVisibleOrder(allOrder, hiddenIds, visibleIds) {
      var hiddenSet = {};
      for (var index = 0; index < hiddenIds.length; index += 1) hiddenSet[hiddenIds[index]] = true;
      var next = [];
      var cursor = 0;
      for (var scan = 0; scan < allOrder.length; scan += 1) {
        var id = allOrder[scan];
        if (hiddenSet[id]) next.push(id);
        else if (cursor < visibleIds.length) next.push(visibleIds[cursor++]);
        else return allOrder.slice();
      }
      return cursor === visibleIds.length ? next : allOrder.slice();
    }

    /**
     * 用新的收起项顺序替换完整顺序中的收起位，保持可见项的相对位置不变。
     * @param allOrder - 完整顺序。
     * @param hiddenIds - 被收起的面板 id。
     * @param hiddenOrder - 新的收起项顺序。
     * @returns 新完整顺序；长度对不上时原样返回 `allOrder`。
     */
    function replaceHiddenOrder(allOrder, hiddenIds, hiddenOrder) {
      var hiddenSet = {};
      for (var index = 0; index < hiddenIds.length; index += 1) hiddenSet[hiddenIds[index]] = true;
      var next = [];
      var cursor = 0;
      for (var scan = 0; scan < allOrder.length; scan += 1) {
        var id = allOrder[scan];
        if (!hiddenSet[id]) next.push(id);
        else if (cursor < hiddenOrder.length) next.push(hiddenOrder[cursor++]);
        else return allOrder.slice();
      }
      return cursor === hiddenOrder.length ? next : allOrder.slice();
    }

    /** 读取当前全部面板 id（快照顺序即当前生效顺序）。 */
    function panelIdsOf(panels) {
      var ids = [];
      for (var index = 0; index < panels.length; index += 1) ids.push(panels[index].id);
      return ids;
    }

    /**
     * 按给定 id 顺序重排面板对象；不在顺序里的面板按原快照顺序补在末尾。
     * @param panels - 面板快照。
     * @param order - id 顺序（可为 null，表示沿用快照顺序）。
     * @returns 新数组。
     */
    function panelsInOrder(panels, order) {
      if (!Array.isArray(order)) return panels;
      var byId = {};
      for (var index = 0; index < panels.length; index += 1) byId[panels[index].id] = panels[index];
      var seen = {};
      var result = [];
      for (var orderIndex = 0; orderIndex < order.length; orderIndex += 1) {
        var panel = byId[order[orderIndex]];
        if (panel && !seen[panel.id]) {
          seen[panel.id] = true;
          result.push(panel);
        }
      }
      for (var scan = 0; scan < panels.length; scan += 1) {
        if (!seen[panels[scan].id]) result.push(panels[scan]);
      }
      return result;
    }

    /**
     * 把任意读到的值收成合法的排序/隐藏状态。
     * @param value - 来自 cookie / localStorage 的 JSON。
     * @returns `{ enabled, order, hidden }`；无效值回落到默认关闭。
     */
    function sanitizeLayoutPrefs(value) {
      var source = value && typeof value === 'object' ? value : {};
      var clean = function (list) {
        var result = [];
        if (!Array.isArray(list)) return result;
        for (var index = 0; index < list.length; index += 1) {
          var entry = list[index];
          if (typeof entry === 'string' && entry.length > 0 && result.indexOf(entry) === -1) result.push(entry);
        }
        return result;
      };
      return {
        enabled: source.enabled === true,
        order: clean(source.order),
        hidden: clean(source.hidden),
      };
    }

    /** 从 cookie 读取排序状态；没有 document 或解析失败时返回 null。 */
    function readLayoutCookie() {
      if (typeof document === 'undefined' || typeof document.cookie !== 'string') return null;
      var prefix = LAYOUT_COOKIE + '=';
      var parts = document.cookie.split(';');
      for (var index = 0; index < parts.length; index += 1) {
        var part = parts[index].replace(/^\s+/, '');
        if (part.indexOf(prefix) !== 0) continue;
        try {
          return JSON.parse(decodeURIComponent(part.slice(prefix.length)));
        } catch (error) {
          return null;
        }
      }
      return null;
    }

    /** 写入 cookie；失败（隐私模式/超长）不影响功能。 */
    function writeLayoutCookie(prefs) {
      if (typeof document === 'undefined' || typeof document.cookie !== 'string') return;
      try {
        var value = encodeURIComponent(JSON.stringify(prefs));
        document.cookie =
          LAYOUT_COOKIE +
          '=' +
          value +
          '; Max-Age=' +
          LAYOUT_COOKIE_MAX_AGE +
          '; Path=/; SameSite=Lax';
      } catch (error) {
        // 忽略：状态仍保存在内存里，不打断拖拽。
      }
    }

    /** 读取 localStorage 镜像；异常时返回 null。 */
    function readLayoutStorage() {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      try {
        var raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    }

    /** 写回 localStorage 镜像；异常时忽略。 */
    function writeLayoutStorage(prefs) {
      if (typeof window === 'undefined' || !window.localStorage) return;
      try {
        window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(prefs));
      } catch (error) {
        // 忽略：cookie 仍是跨重启的主存储。
      }
    }

    /**
     * 读取启动状态：cookie 优先（跨端口），localStorage 仅作兜底。
     * @returns `{ enabled, order, hidden }`。
     */
    function readLayoutPrefs() {
      var cookie = readLayoutCookie();
      if (cookie) return sanitizeLayoutPrefs(cookie);
      return sanitizeLayoutPrefs(readLayoutStorage());
    }

    /** 持久化排序状态（cookie + localStorage 镜像）。 */
    function writeLayoutPrefs(prefs) {
      var clean = sanitizeLayoutPrefs(prefs);
      writeLayoutCookie(clean);
      writeLayoutStorage(clean);
    }

    /**
     * 排序/显隐状态的小型 observable store。
     *
     * 快照字段：`enabled`（设置开关）、`order`（保存的 id 顺序）、
     * `hidden`（收起的 id）、`trayOpen`（二级区展开，不持久化）、
     * `preview`（拖拽中的临时顺序，不持久化）。
     * @param initial - `readLayoutPrefs()` 的结果。
     * @returns store：`subscribe/getSnapshot` + 动作。
     */
    function createPanelLayoutStore(initial) {
      var prefs = sanitizeLayoutPrefs(initial);
      var snapshot = {
        enabled: prefs.enabled,
        order: prefs.order,
        hidden: prefs.hidden,
        trayOpen: false,
        preview: null,
      };
      var listeners = [];
      var notify = function () {
        var current = listeners.slice();
        for (var index = 0; index < current.length; index += 1) current[index]();
      };
      var patch = function (changes, persist) {
        var next = {
          enabled: snapshot.enabled,
          order: snapshot.order,
          hidden: snapshot.hidden,
          trayOpen: snapshot.trayOpen,
          preview: snapshot.preview,
        };
        for (var key in changes) {
          if (Object.prototype.hasOwnProperty.call(changes, key)) next[key] = changes[key];
        }
        snapshot = next;
        if (persist) writeLayoutPrefs(next);
        notify();
      };
      return {
        getSnapshot: function () {
          return snapshot;
        },
        subscribe: function (listener) {
          listeners.push(listener);
          return function () {
            var index = listeners.indexOf(listener);
            if (index !== -1) listeners.splice(index, 1);
          };
        },
        observable: {
          getSnapshot: function () {
            return snapshot;
          },
          subscribe: function (listener) {
            listeners.push(listener);
            return function () {
              var index = listeners.indexOf(listener);
              if (index !== -1) listeners.splice(index, 1);
            };
          },
        },
        setEnabled: function (enabled) {
          patch({ enabled: enabled === true, preview: null, trayOpen: enabled === true ? snapshot.trayOpen : false }, true);
        },
        setOrder: function (order) {
          patch({ order: sanitizeLayoutPrefs({ order: order }).order }, true);
        },
        setHidden: function (hidden) {
          patch({ hidden: sanitizeLayoutPrefs({ hidden: hidden }).hidden }, true);
        },
        setPreview: function (preview) {
          if (preview === null || preview === undefined) {
            if (snapshot.preview !== null) patch({ preview: null }, false);
            return;
          }
          var current = snapshot.preview;
          if (current !== null && current.length === preview.length) {
            var same = true;
            for (var index = 0; index < preview.length; index += 1) {
              if (current[index] !== preview[index]) {
                same = false;
                break;
              }
            }
            if (same) return;
          }
          patch({ preview: preview.slice() }, false);
        },
        setTrayOpen: function (open) {
          patch({ trayOpen: open === true }, false);
        },
        hidePanel: function (id) {
          if (snapshot.hidden.indexOf(id) !== -1) return;
          patch({ hidden: snapshot.hidden.concat([id]) }, true);
        },
        showPanel: function (id) {
          var index = snapshot.hidden.indexOf(id);
          if (index === -1) return;
          var hidden = snapshot.hidden.slice();
          hidden.splice(index, 1);
          patch({ hidden: hidden }, true);
        },
        reset: function () {
          patch({ order: [], hidden: [], preview: null }, true);
        },
      };
    }

    /**
     * 拖拽过冲量：松手时的渲染列宽减去「指针期望的列宽」。
     * 差值越大，说明指针已经越过宿主的最小宽度越多；宿主的最小宽度不需要写死。
     * @param width - 松手那一帧渲染出的侧栏列宽。
     * @param startWidth - 拖拽起点列宽。
     * @param startX - 按下时的指针 x。
     * @param endX - 松手时的指针 x。
     * @returns 过冲像素；往右拖为负。
     */
    function dragOvershoot(width, startWidth, startX, endX) {
      return width - (startWidth + (endX - startX));
    }

    /**
     * 可被 slot 渲染器绑成 `usePanels` 的 observable source。
     * @param ctx - 客户端根上下文。
     * @returns `{ source, sync }`；source 的订阅者在面板账本或语言变化时收到通知。
     */
    function createPanelsSource(ctx) {
      var snapshot = [];
      var listeners = [];
      var sync = function () {
        var next = buildPanels(ctx);
        if (samePanels(snapshot, next)) return;
        snapshot = next;
        var current = listeners.slice();
        for (var index = 0; index < current.length; index += 1) current[index]();
      };
      return {
        source: {
          getSnapshot: function () {
            return snapshot;
          },
          subscribe: function (listener) {
            listeners.push(listener);
            return function () {
              var index = listeners.indexOf(listener);
              if (index !== -1) listeners.splice(index, 1);
            };
          },
        },
        sync: sync,
      };
    }

    /**
     * 订阅一个 observable source；优先用 React 18 的 useSyncExternalStore。
     * 测试桩没有这个 hook 时退化为快照读取（不订阅），保证纯逻辑测试可跑。
     * @param store - `{ getSnapshot, subscribe }`。
     * @returns 当前快照。
     */
    function useObservedSnapshot(store) {
      if (typeof React.useSyncExternalStore === 'function') {
        return React.useSyncExternalStore(store.subscribe, store.getSnapshot);
      }
      if (typeof React.useState === 'function' && typeof React.useEffect === 'function') {
        var pair = React.useState(store.getSnapshot());
        React.useEffect(function () {
          return store.subscribe(function () {
            pair[1](store.getSnapshot());
          });
        }, []);
        return pair[0];
      }
      return store.getSnapshot();
    }

    /**
     * 生成一个面板的「影子组件」。
     *
     * 宿主 PanelRow 把 panellist 条目渲染在行图标里；影子注册沿用原组件，
     * 外面包一层 `data-dfm-id` 的 display:contents 包装。包装负责三件事：
     *  - 把用户收起的面板的宿主行设成 display:none（不占 Tab 序、不改宿主 pin）；
     *  - 拖拽排序时把预览顺序临时写到宿主行的 CSS `order` 上（宿主行本身不进 DOM 重排）；
     *  - 给拖拽事件委托提供稳定的 id 锚点。
     * @param id - 面板 id。
     * @param Icon - 原插件注册的图标组件。
     * @param store - 排序状态 store。
     * @returns 包装组件。
     */
    function createShadowPanel(id, Icon, store) {
      function ShadowPanel(props) {
        var snapshot = useObservedSnapshot(store);
        var markerRef = React.useRef(null);
        var hidden = snapshot.hidden.indexOf(id) !== -1;
        var previewIndex = snapshot.preview === null ? -1 : snapshot.preview.indexOf(id);
        React.useLayoutEffect(function () {
          var marker = markerRef.current;
          var row = marker && typeof marker.closest === 'function' ? marker.closest('button') : null;
          if (!row) return undefined;
          row.setAttribute('data-dfm-row-id', id);
          if (hidden) row.style.display = 'none';
          if (previewIndex !== -1) row.style.order = String(previewIndex);
          return function () {
            row.style.removeProperty('display');
            row.style.removeProperty('order');
            if (row.getAttribute('data-dfm-row-id') === id) row.removeAttribute('data-dfm-row-id');
          };
        }, [hidden, previewIndex]);
        var content;
        if (typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null)) {
          content = h(
            IconBoundary,
            { icon: Icon, fallback: h(FallbackPanelIcon, props) },
            h(Icon, props),
          );
        } else {
          content = h(FallbackPanelIcon, props);
        }
        return h(
          'span',
          { ref: markerRef, 'data-dfm-id': id, style: { display: 'contents' } },
          content,
        );
      }
      ShadowPanel.__dfmShadow = true;
      return ShadowPanel;
    }

    /** 面板条目上判断是否本插件影子注册的标记。 */
    function isShadowComponent(component) {
      return typeof component === 'function' && component.__dfmShadow === true;
    }

    /**
     * 影子注册管理器。
     *
     * 对 `sidebar.panellist` 里每个面板以同 id、更低 priority 重新注册一份
     * 复制条目（组件外面包 `createShadowPanel`），order 取用户顺序。宿主的
     * `entriesOfSlot` 按 id 去重、保留最低 priority，于是展开侧栏、折叠工具栏、
     * More 菜单都读到同一顺序。开关关闭时撤销全部影子，恢复宿主原顺序。
     * @param ctx - 客户端根上下文。
     * @param store - 排序状态 store。
     * @returns `{ sync, dispose }`。
     */
    function createShadowManager(ctx, store) {
      var shadows = {};
      var wrappers = [];
      var syncing = false;
      var pending = false;

      var disposeShadow = function (id) {
        var record = shadows[id];
        if (!record) return;
        delete shadows[id];
        var wrapperIndex = wrappers.indexOf(record.wrapper);
        if (wrapperIndex !== -1) wrappers.splice(wrapperIndex, 1);
        try {
          record.dispose();
        } catch (error) {
          // 条目可能已随声明一起被回收；不影响其它面板。
        }
      };

      var disposeAll = function () {
        var ids = Object.keys(shadows);
        for (var index = 0; index < ids.length; index += 1) disposeShadow(ids[index]);
      };

      /** 读取宿主原始条目（去掉本插件的影子），同 id 取最低 priority 的赢家。 */
      var readOriginals = function () {
        var entries;
        try {
          entries =
            typeof ctx.slots.entries === 'function'
              ? ctx.slots.entries(PANEL_SLOT)
              : ctx.slots.entriesOfSlot(PANEL_SLOT);
        } catch (error) {
          return [];
        }
        var winners = {};
        var order = [];
        for (var index = 0; index < entries.length; index += 1) {
          var entry = entries[index];
          if (!entry || isShadowComponent(entry.component)) continue;
          var options = entry.options || {};
          var id = options.id;
          if (typeof id !== 'string' || id.length === 0) continue;
          var priority = Number.isFinite(options.priority) ? options.priority : 0;
          var previous = winners[id];
          if (!previous) {
            winners[id] = { entry: entry, priority: priority };
            order.push(id);
          } else if (priority < previous.priority) {
            winners[id] = { entry: entry, priority: priority };
          }
        }
        order.sort(function (left, right) {
          var a = winners[left];
          var b = winners[right];
          var aOrder = a && Number.isFinite(a.entry.options.order) ? a.entry.options.order : 0;
          var bOrder = b && Number.isFinite(b.entry.options.order) ? b.entry.options.order : 0;
          return aOrder - bOrder;
        });
        return { winners: winners, order: order };
      };

      var sync = function () {
        if (syncing) {
          pending = true;
          return;
        }
        syncing = true;
        try {
          if (!store.getSnapshot().enabled) {
            disposeAll();
            return;
          }
          var originals = readOriginals();
          var ids = originals.order;
          var saved = mergePanelOrder(store.getSnapshot().order, ids, ids);
          for (var index = 0; index < ids.length; index += 1) {
            var id = ids[index];
            var winner = originals.winners[id];
            var priority = winner.priority - 1;
            var order = saved.indexOf(id);
            var record = shadows[id];
            if (
              record &&
              record.component === winner.entry.component &&
              record.label === winner.entry.options.label &&
              record.inject === winner.entry.inject &&
              record.locale === winner.entry.locale &&
              record.store === winner.entry.store &&
              record.order === order &&
              record.priority === priority
            ) {
              continue;
            }
            // 只有 order/priority 变化时复用同一个包装组件，避免图标被卸载重挂
            // 造成闪烁；组件本身变了才新建包装。
            var reuseWrapper = record && record.component === winner.entry.component;
            var wrapper = reuseWrapper ? record.wrapper : createShadowPanel(id, winner.entry.component, store);
            if (record) disposeShadow(id);
            wrappers.push(wrapper);
            try {
              var dispose = ctx.slots.register(
                {
                  name: PANEL_SLOT,
                  id: id,
                  order: order,
                  priority: priority,
                  label: winner.entry.options.label,
                  locale: winner.entry.locale,
                  inject: winner.entry.inject,
                  store: winner.entry.store,
                },
                wrapper,
              );
              shadows[id] = {
                dispose: dispose,
                wrapper: wrapper,
                component: winner.entry.component,
                label: winner.entry.options.label,
                inject: winner.entry.inject,
                locale: winner.entry.locale,
                store: winner.entry.store,
                order: order,
                priority: priority,
              };
            } catch (error) {
              var wrapperIndex = wrappers.indexOf(wrapper);
              if (wrapperIndex !== -1) wrappers.splice(wrapperIndex, 1);
            }
          }
          var active = Object.keys(shadows);
          for (var activeIndex = 0; activeIndex < active.length; activeIndex += 1) {
            if (ids.indexOf(active[activeIndex]) === -1) disposeShadow(active[activeIndex]);
          }
        } finally {
          syncing = false;
          if (pending) {
            pending = false;
            sync();
          }
        }
      };

      return { sync: sync, dispose: disposeAll };
    }

    /* ───────────────────────────── 图标 ───────────────────────────── */

    /** 侧栏开合图标（与 chrome 原按钮同一套路径）。 */
    function PanelLeftIcon(props) {
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          className: 'DFM_svg',
          strokeWidth: 1,
        },
        h('path', {
          d: 'M13.5 1.5H2.5C1.94772 1.5 1.5 1.94772 1.5 2.5V13.5C1.5 14.0523 1.94772 14.5 2.5 14.5H13.5C14.0523 14.5 14.5 14.0523 14.5 13.5V2.5C14.5 1.94772 14.0523 1.5 13.5 1.5Z',
          stroke: 'currentColor',
        }),
        h('path', { d: 'M5.5 1.5V14.5', stroke: 'currentColor' }),
      );
    }

    /** 新建会话图标（与 chrome 原按钮同一套路径）。 */
    function NewChatIcon(props) {
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          className: 'DFM_svg',
          strokeWidth: 1,
        },
        h('path', {
          d: 'M2.37091 11.2501C1.58745 9.89288 1.32067 8.29835 1.61969 6.76006C1.91872 5.22177 2.76342 3.8433 3.99826 2.87846C5.2331 1.91362 6.77494 1.42737 8.33988 1.50925C9.90482 1.59113 11.3875 2.23562 12.5149 3.32406C13.6425 4.41269 14.3387 5.87206 14.4754 7.4334C14.612 8.99474 14.18 10.5529 13.2587 11.8209C12.3375 13.0888 10.9891 13.9813 9.46194 14.3337C8.18691 14.628 6.85895 14.5294 5.64989 14.0605C5.1712 13.8748 4.76962 13.4932 4.26534 13.3967C3.67413 13.2835 2.95257 13.5598 2.03794 14.3337',
          stroke: 'currentColor',
        }),
        h('path', { d: 'M8 5V11', stroke: 'currentColor' }),
        h('path', { d: 'M5 8H11', stroke: 'currentColor' }),
      );
    }

    /** 返回会话图标（左箭头，线条与工具栏原按钮一致）。 */
    function BackIcon(props) {
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          className: 'DFM_svg',
          strokeWidth: 1,
        },
        h('path', { d: 'M12.5 8H3.5', stroke: 'currentColor' }),
        h('path', { d: 'M7.25 4.25 3.5 8l3.75 3.75', stroke: 'currentColor' }),
      );
    }

    /** 「更多面板」图标：向下箭头，提示第 4 格这里还收着面板。 */
    function MorePanelsIcon(props) {
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          className: 'DFM_svg',
          strokeWidth: 1,
        },
        h('path', { d: 'M4.25 6.25 8 10 11.75 6.25', stroke: 'currentColor' }),
      );
    }

    /** 「更多」行右侧的展开箭头：收起时 `›`，展开时 CSS 转 90° 变成 `⌄`。 */
    function ChevronRightIcon(props) {
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          className: 'DFM_svg',
          strokeWidth: 1,
        },
        h('path', { d: 'M6.25 3.75 10.5 8l-4.25 4.25', stroke: 'currentColor' }),
      );
    }

    /** 插件图标不可用/崩溃时的兜底图标（原创：圆角面板 + 中心点）。 */
    function FallbackPanelIcon(props) {
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          className: 'DFM_svg',
        },
        h('rect', {
          x: 2.25,
          y: 2.25,
          width: 11.5,
          height: 11.5,
          rx: 2.75,
          stroke: 'currentColor',
          strokeWidth: 1.2,
        }),
        h('circle', { cx: 8, cy: 8, r: 1.7, fill: 'currentColor' }),
      );
    }

    /**
     * 单个插件图标崩溃时退化为兜底图标：我们直接渲染别的插件注册的组件，
     * 一个坏图标不应该让整条工具栏 abdicate 回官方按钮。
     */
    class IconBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false, icon: props.icon };
      }

      static getDerivedStateFromError() {
        return { failed: true };
      }

      // 图标组件被重新注册（插件更新 / HMR）时重新尝试，避免永久停在兜底图标。
      static getDerivedStateFromProps(props, state) {
        if (props.icon !== state.icon) return { failed: false, icon: props.icon };
        return null;
      }

      render() {
        return this.state.failed ? this.props.fallback : this.props.children;
      }
    }

    /* ──────────────────────────── 小部件 ──────────────────────────── */

    /** 淡分割线。 */
    function Divider() {
      return h('span', { className: 'DFM_divider', 'aria-hidden': 'true' });
    }

    /**
     * 工具栏图标按钮：28×28、hover 底色、焦点环、aria-label、hover/聚焦显示 tooltip。
     * @param props - label / shortcut / active / onClick / testId / panelId /
     *   hideTip / hasPopup / expanded / onPointerDown / children。
     */
    function RailButton(props) {
      var shortcut = props.shortcut;
      var keys = shortcut && Array.isArray(shortcut.keys) ? shortcut.keys : null;
      return h(
        'button',
        {
          type: 'button',
          className: 'DFM_button' + (props.active ? ' DFM_active' : ''),
          'aria-label': props.label,
          'aria-current': props.active ? 'page' : undefined,
          'aria-keyshortcuts': shortcut && shortcut.aria ? shortcut.aria : undefined,
          'aria-haspopup': props.hasPopup,
          'aria-expanded': props.expanded === undefined ? undefined : props.expanded,
          'data-fold-minimal': props.testId,
          'data-panel-id': props.panelId,
          onPointerDown: props.onPointerDown,
          onClick: props.onClick,
        },
        props.children,
        props.hideTip
          ? null
          : h(
              'span',
              { className: 'DFM_tip', 'aria-hidden': 'true' },
              props.label,
              keys && keys.length > 0 ? h('kbd', { className: 'DFM_kbd' }, keys.join('')) : null,
            ),
      );
    }

    /** 点开某个全局面板：官方面板补一条埋点，然后切到对应主面板。 */
    function openPanel(panel, selectPanel, trackEntryClick) {
      var menuName = OFFICIAL_PANEL_ANALYTICS[panel.id];
      if (typeof menuName === 'string') {
        trackEntryClick({ menu_name: menuName, position: 'titlebar' });
      }
      selectPanel(panel.id);
    }

    /**
     * 直接渲染该插件自己注册的图标组件（`{ size, active }`）；坏图标退化为兜底图标。
     * 工具栏图标与「更多」菜单共用，保证两个入口看起来是同一个图标。
     * @param props - panel / active。
     */
    function PanelGlyph(props) {
      var Icon = props.panel.Icon;
      if (typeof Icon !== 'function' && (typeof Icon !== 'object' || Icon === null)) {
        return h(FallbackPanelIcon, { size: ICON_SIZE });
      }
      return h(
        IconBoundary,
        { icon: Icon, fallback: h(FallbackPanelIcon, { size: ICON_SIZE }) },
        h(Icon, { size: ICON_SIZE, active: props.active }),
      );
    }

    /**
     * 一个左侧面板图标：点击切到对应主面板，选中态与展开态一致。
     * @param props - panel / selectPanel / trackEntryClick / usePanelInfo / onPointerDown。
     */
    function PanelButton(props) {
      var panel = props.panel;
      var active = props.usePanelInfo(function (info) {
        return info.activePanelId === panel.id;
      });
      return h(
        RailButton,
        {
          label: panel.label,
          active: active,
          testId: 'panel',
          panelId: panel.id,
          onPointerDown: props.onPointerDown,
          onClick: function () {
            openPanel(panel, props.selectPanel, props.trackEntryClick);
          },
        },
        h(PanelGlyph, { panel: panel, active: active }),
      );
    }

    /**
     * 「更多」菜单里的一行：图标 + 名称，选中态与工具栏图标一致。
     * 每行自己订阅选中态，菜单开关不连累整条工具栏重渲染。
     * @param props - panel / onSelect / usePanelInfo。
     */
    function PanelMenuItem(props) {
      var panel = props.panel;
      var active = props.usePanelInfo(function (info) {
        return info.activePanelId === panel.id;
      });
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: 'DFM_menuItem' + (active ? ' DFM_active' : ''),
          'aria-current': active ? 'page' : undefined,
          onClick: function () {
            props.onSelect(panel);
          },
        },
        h(PanelGlyph, { panel: panel, active: active }),
        h('span', { className: 'DFM_menuLabel' }, panel.label),
      );
    }

    /**
     * 面板区的最后一格：面板多于 `PANEL_SLOTS` 个或被收起了面板时取代原图标，
     * 悬停（带意图延迟）或点击、键盘展开被挤出的面板；「排序与折叠」开启时
     * 菜单末尾额外列出被收起的面板。
     * 只服务折叠态工具栏，不改左侧展开菜单的顺序与内容。
     * @param props - panels（被挤出的部分）/ hiddenPanels / t / usePanelInfo / onSelect。
     */
    function PanelOverflowMenu(props) {
      var panels = props.panels;
      var hiddenPanels = Array.isArray(props.hiddenPanels) ? props.hiddenPanels : [];
      var state = React.useState(false);
      var open = state[0];
      var setOpen = state[1];
      var timer = React.useRef(null);
      var cancel = function () {
        if (timer.current === null) return;
        clearTimeout(timer.current);
        timer.current = null;
      };
      var schedule = function (next, delay) {
        cancel();
        timer.current = setTimeout(function () {
          timer.current = null;
          setOpen(next);
        }, delay);
      };
      React.useEffect(function () {
        return cancel;
      }, []);
      var close = function () {
        cancel();
        setOpen(false);
      };
      var active = props.usePanelInfo(function (info) {
        for (var index = 0; index < panels.length; index += 1) {
          if (panels[index].id === info.activePanelId) return true;
        }
        for (var hiddenIndex = 0; hiddenIndex < hiddenPanels.length; hiddenIndex += 1) {
          if (hiddenPanels[hiddenIndex].id === info.activePanelId) return true;
        }
        return false;
      });
      var rows = panels.map(function (panel) {
        return h(PanelMenuItem, {
          key: 'overflow:' + panel.id,
          panel: panel,
          usePanelInfo: props.usePanelInfo,
          onSelect: function (selected) {
            close();
            props.onSelect(selected);
          },
        });
      });
      if (hiddenPanels.length > 0) {
        rows.push(
          h('div', {
            key: 'fold-minimal:hidden-divider',
            className: 'DFM_menuDivider',
            'aria-hidden': 'true',
          }),
        );
        rows.push(
          h(
            'div',
            { key: 'fold-minimal:hidden-label', className: 'DFM_menuGroup' },
            props.t('tray.label'),
          ),
        );
        for (var hiddenIndex = 0; hiddenIndex < hiddenPanels.length; hiddenIndex += 1) {
          rows.push(
            h(PanelMenuItem, {
              key: 'hidden:' + hiddenPanels[hiddenIndex].id,
              panel: hiddenPanels[hiddenIndex],
              usePanelInfo: props.usePanelInfo,
              onSelect: function (selected) {
                close();
                props.onSelect(selected);
              },
            }),
          );
        }
      }
      return h(
        'div',
        {
          className: 'DFM_more',
          onPointerEnter: function () {
            schedule(true, MENU_OPEN_DELAY);
          },
          onPointerLeave: function () {
            schedule(false, MENU_CLOSE_DELAY);
          },
          onBlur: function (event) {
            // 键盘把焦点移出这个入口（按钮 + 菜单）时收起，避免留下无主浮层。
            var next = event.relatedTarget;
            if (next && event.currentTarget.contains(next)) return;
            close();
          },
          onKeyDown: function (event) {
            if (event.key !== 'Escape' || !open) return;
            event.stopPropagation();
            close();
          },
        },
        h(
          RailButton,
          {
            label: props.t('panels.more'),
            active: active,
            testId: 'more-panels',
            hideTip: true,
            hasPopup: 'menu',
            expanded: open,
            onClick: function () {
              setOpen(function (value) {
                return !value;
              });
            },
          },
          h(MorePanelsIcon, { size: ICON_SIZE }),
        ),
        open
          ? h(
              'div',
              { className: 'DFM_menu', role: 'menu', 'aria-label': props.t('panels.more') },
              rows,
            )
          : null,
      );
    }

    /** 与 shortcut 服务里某条快捷键对应的选择器。 */
    function shortcutFinder(id) {
      return function (rows) {
        return rows.find(function (row) {
          return row !== undefined && row !== null && row.id === id;
        });
      };
    }

    /* ───────────────── v0.4：开关 / 二级区 / 展开态返回键 ───────────────── */

    /** 侧栏顶部返回按钮的内联 SVG（与折叠态返回同一套路径）。 */
    var TOP_BACK_SVG =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" ' +
      'aria-hidden="true"><path d="M12.5 8H3.5" stroke="currentColor"/><path d="M7.25 4.25 3.5 8l3.75 3.75" ' +
      'stroke="currentColor"/></svg>';
    /** 「更多」行右侧 chevron 的内联 SVG。 */
    var MORE_CHEVRON_SVG =
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" ' +
      'aria-hidden="true"><path d="M6.25 3.75 10.5 8l-4.25 4.25" stroke="currentColor"/></svg>';

    /**
     * 偏好开关：照宿主 primitive 的 `role="switch"` 行为实现。
     * @param props - checked / label / onChange。
     */
    function Switch(props) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': props.checked === true,
          'aria-label': props.label,
          className: 'DFM_switch',
          onClick: function () {
            props.onChange(props.checked !== true);
          },
        },
        h('span', { className: 'DFM_switchThumb' }),
      );
    }

    /**
     * 设置 → 通用里的「面板排序与折叠」开关行。
     * @param props - t / useLayout / setLayoutEnabled。
     */
    function PanelLayoutSettingsRow(props) {
      var enabled = props.useLayout(function (snapshot) {
        return snapshot.enabled;
      });
      return h(
        'div',
        { className: 'DFM_setRow' },
        h(
          'div',
          { className: 'DFM_setText' },
          h('div', { className: 'DFM_setTitle' }, props.t('layout.title')),
          h('div', { className: 'DFM_setDesc' }, props.t('layout.description')),
        ),
        h(Switch, {
          checked: enabled,
          label: props.t('layout.title'),
          onChange: function (next) {
            props.setLayoutEnabled(next);
          },
        }),
      );
    }

    /**
     * 展开侧栏「更多」下方的缩进二级区：列出被收起的面板。
     * 点行打开面板；Drag 出/入由 installPanelDrag 的事件委托处理。
     * @param props - panels（已按当前顺序过滤的收起项）/ activePanelId / t / onOpen / onReset。
     */
    function HiddenTray(props) {
      var rows = props.panels.map(function (panel) {
        var active = panel.id === props.activePanelId;
        return h(
          'button',
          {
            key: panel.id,
            type: 'button',
            className: 'DFM_trayRow' + (active ? ' DFM_active' : ''),
            'data-dfm-tray-id': panel.id,
            title: panel.label,
            onClick: function () {
              props.onOpen(panel);
            },
          },
          h(PanelGlyph, { panel: panel, active: active }),
          h('span', { className: 'DFM_trayLabel' }, panel.label),
        );
      });
      if (rows.length === 0) {
        rows.push(h('div', { key: 'fold-minimal:tray-empty', className: 'DFM_trayEmpty' }, props.t('tray.empty')));
      }
      rows.push(
        h(
          'div',
          { key: 'fold-minimal:tray-footer', className: 'DFM_trayFooter' },
          h(
            'button',
            {
              type: 'button',
              className: 'DFM_linkButton',
              onClick: function () {
                props.onReset();
              },
            },
            props.t('layout.reset'),
          ),
        ),
      );
      return h(React.Fragment, null, rows);
    }

    /**
     * 挂在 `sidebar.footer.action` 上的无渲染组件，负责三件宿主 chrome 增强：
     *  - 展开态返回按钮（注入到 topStrip 收起按钮左侧）；
     *  - 「更多」行右侧的 chevron 与下方二级区容器；
     *  - 把 HiddenTray 通过 portal 渲染进二级区。
     *
     * 它们都不替换宿主组件，只在宿主已渲染的 DOM 上做增量增强，插件停用即移除。
     * @param props - wide / usePanelInfo / useLayout / usePanels / t / 注入动作。
     */
    function SidebarChrome(props) {
      var wide = props.wide === true;
      var t = props.t;
      var tRef = React.useRef(t);
      tRef.current = t;
      var actionsRef = React.useRef({
        backToSession: props.backToSession,
        selectPanel: props.selectPanel,
        trackEntryClick: props.trackEntryClick,
        toggleTray: props.toggleTray,
        resetLayout: props.resetLayout,
      });
      actionsRef.current = {
        backToSession: props.backToSession,
        selectPanel: props.selectPanel,
        trackEntryClick: props.trackEntryClick,
        toggleTray: props.toggleTray,
        resetLayout: props.resetLayout,
      };
      var panelActive = props.usePanelInfo(isPanelActive);
      var activePanelId = props.usePanelInfo(function (info) {
        return info.activePanelId;
      });
      var layout = props.useLayout(function (snapshot) {
        return snapshot;
      });
      var panels = props.usePanels(function (snapshot) {
        return snapshot;
      });
      var containerState = React.useState(null);
      var container = containerState[0];
      var setContainer = containerState[1];
      var chevronRef = React.useRef(null);
      var moreRowRef = React.useRef(null);

      // 1) 展开态返回按钮：仅在「侧栏展开 + 面板打开」时插入宿主顶栏。
      React.useLayoutEffect(function () {
        if (typeof document === 'undefined' || !wide || !panelActive) return undefined;
        var root = document.documentElement;
        if (!root || root.getAttribute('data-platform') !== 'darwin') return undefined;
        var toggle = document.querySelector('[data-sidebar-toggle]');
        var strip = toggle && toggle.closest ? toggle.closest('[data-window-drag]') : null;
        if (!strip) return undefined;
        var label = tRef.current('session.back.label');
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'DFM_topBack';
        button.setAttribute('data-fold-minimal', 'top-back');
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.innerHTML = TOP_BACK_SVG;
        var onClick = function () {
          actionsRef.current.backToSession();
        };
        button.addEventListener('click', onClick);
        strip.appendChild(button);
        var observer =
          typeof MutationObserver === 'function'
            ? new MutationObserver(function () {
                if (!strip.contains(button)) strip.appendChild(button);
              })
            : null;
        if (observer) observer.observe(strip, { childList: true });
        return function () {
          if (observer) observer.disconnect();
          button.removeEventListener('click', onClick);
          if (button.parentNode) button.parentNode.removeChild(button);
        };
      }, [wide, panelActive]);

      // 2) 「更多」行 chevron + 二级区容器（开关开启时才出现）。
      React.useLayoutEffect(function () {
        if (typeof document === 'undefined' || !wide || !layout.enabled) return undefined;
        // 没有 react-dom 就画不出二级区内容；此时不提供收起入口，避免面板被
        // 收进去却无法拖回来。
        if (!ReactDOM || typeof ReactDOM.createPortal !== 'function') return undefined;
        var root = document.documentElement;
        if (!root || root.getAttribute('data-platform') !== 'darwin') return undefined;

        var chevron = document.createElement('button');
        chevron.type = 'button';
        chevron.className = 'DFM_moreChevron';
        chevron.setAttribute('data-fold-minimal', 'more-chevron');
        chevron.innerHTML = MORE_CHEVRON_SVG;
        var onChevronClick = function (event) {
          event.preventDefault();
          event.stopPropagation();
          actionsRef.current.toggleTray();
        };
        var swallowPointer = function (event) {
          event.stopPropagation();
        };
        chevron.addEventListener('click', onChevronClick);
        chevron.addEventListener('pointerdown', swallowPointer);

        var tray = document.createElement('div');
        tray.className = 'DFM_tray';
        tray.setAttribute(TRAY_ATTR, '');
        tray.setAttribute('role', 'group');
        tray.setAttribute('aria-label', tRef.current('tray.label'));

        var ensure = function () {
          var toggleNode = document.querySelector('[data-sidebar-toggle]');
          var stripNode =
            toggleNode && toggleNode.closest ? toggleNode.closest('[data-window-drag]') : null;
          var sidebarRoot = stripNode ? stripNode.parentElement : null;
          var nav = null;
          if (sidebarRoot) {
            for (var index = 0; index < sidebarRoot.children.length; index += 1) {
              if (sidebarRoot.children[index].tagName === 'NAV') {
                nav = sidebarRoot.children[index];
                break;
              }
            }
          }
          var moreButton = nav ? nav.querySelector('button[aria-haspopup="menu"]') : null;
          var moreRow = moreButton;
          while (moreRow && moreRow.parentElement !== nav) moreRow = moreRow.parentElement;
          if (!nav || !moreRow) {
            if (chevron.parentNode) chevron.parentNode.removeChild(chevron);
            if (tray.parentNode) tray.parentNode.removeChild(tray);
            moreRowRef.current = null;
            return;
          }
          if (moreRowRef.current !== moreRow) {
            var previous = moreRowRef.current;
            if (previous) {
              previous.removeAttribute(MORE_ROW_ATTR);
              previous.style.removeProperty('position');
              var previousButton = previous.querySelector('button[aria-haspopup="menu"]');
              if (previousButton) previousButton.style.removeProperty('padding-right');
            }
            moreRowRef.current = moreRow;
            moreRow.setAttribute(MORE_ROW_ATTR, '');
            if (window.getComputedStyle && window.getComputedStyle(moreRow).position === 'static') {
              moreRow.style.position = 'relative';
            }
            if (moreButton) moreButton.style.paddingRight = '28px';
          }
          if (chevron.parentNode !== moreRow) moreRow.appendChild(chevron);
          if (tray.parentNode !== nav || tray.previousElementSibling !== moreRow) {
            nav.insertBefore(tray, moreRow.nextSibling);
          }
        };
        ensure();
        var observer =
          typeof MutationObserver === 'function'
            ? new MutationObserver(function () {
                ensure();
              })
            : null;
        if (observer) {
          var toggleNode = document.querySelector('[data-sidebar-toggle]');
          var stripNode =
            toggleNode && toggleNode.closest ? toggleNode.closest('[data-window-drag]') : null;
          var sidebarRoot = stripNode ? stripNode.parentElement : null;
          if (sidebarRoot) observer.observe(sidebarRoot, { childList: true, subtree: true });
        }
        chevronRef.current = chevron;
        setContainer(tray);
        return function () {
          if (observer) observer.disconnect();
          if (chevron.parentNode) chevron.parentNode.removeChild(chevron);
          if (tray.parentNode) tray.parentNode.removeChild(tray);
          chevronRef.current = null;
          setContainer(null);
          var row = moreRowRef.current;
          if (row) {
            row.removeAttribute(MORE_ROW_ATTR);
            row.style.removeProperty('position');
            var button = row.querySelector('button[aria-haspopup="menu"]');
            if (button) button.style.removeProperty('padding-right');
            moreRowRef.current = null;
          }
        };
      }, [wide, layout.enabled]);

      // 3) chevron 的朝向/文案跟随二级区展开状态。
      React.useLayoutEffect(function () {
        var chevron = chevronRef.current;
        if (!chevron) return;
        var open = layout.trayOpen === true;
        chevron.setAttribute('data-open', open ? 'true' : 'false');
        chevron.setAttribute('aria-expanded', open ? 'true' : 'false');
        var label = tRef.current(open ? 'tray.collapse' : 'tray.expand');
        chevron.setAttribute('aria-label', label);
        chevron.setAttribute('title', label);
      }, [layout.trayOpen, layout.enabled]);

      // 4) 把二级区内容 portal 进宿主 nav 里我们创建的容器。
      if (!container || !layout.enabled || !wide || !ReactDOM || typeof ReactDOM.createPortal !== 'function') {
        return null;
      }
      var ordered = panelsInOrder(panels, layout.preview);
      var hiddenSet = {};
      for (var hiddenIndex = 0; hiddenIndex < layout.hidden.length; hiddenIndex += 1) {
        hiddenSet[layout.hidden[hiddenIndex]] = true;
      }
      var hiddenPanels = [];
      for (var panelIndex = 0; panelIndex < ordered.length; panelIndex += 1) {
        if (hiddenSet[ordered[panelIndex].id]) hiddenPanels.push(ordered[panelIndex]);
      }
      return ReactDOM.createPortal(
        layout.trayOpen
          ? h(HiddenTray, {
              panels: hiddenPanels,
              activePanelId: activePanelId,
              t: t,
              onOpen: function (panel) {
                openPanel(panel, actionsRef.current.selectPanel, actionsRef.current.trackEntryClick);
              },
              onReset: function () {
                actionsRef.current.resetLayout();
              },
            })
          : null,
        container,
      );
    }

    /**
     * 把工具栏实测右缘写入 frame 的 `--dsh-frame-leading-clearance`，
     * 让会话标题行按工具栏实际宽度让位；卸载/展开时恢复宿主默认值。
     * @param ref - 工具栏根节点 ref。
     */
    function useLeadingClearance(ref) {
      React.useLayoutEffect(function () {
        var rail = ref.current;
        if (!rail || typeof rail.closest !== 'function') return undefined;
        var frame = rail.closest('[data-sidebar-collapsed]');
        if (!frame) return undefined;

        var applied = false;
        var lastValue = '';

        var measure = function () {
          var width =
            Math.ceil(rail.getBoundingClientRect().right - frame.getBoundingClientRect().left) +
            CLEARANCE_TRAILING_GAP;
          var next = width + 'px';
          if (next === lastValue) return;
          lastValue = next;
          applied = true;
          frame.style.setProperty('--dsh-frame-leading-clearance', next);
        };

        // 先建 observer 再写变量：避免 setup 中途抛错时 React 不调 cleanup、变量残留。
        // 同时观察工具栏（增删面板）与 frame（窗口尺寸 / 全屏切换）。
        var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
        if (observer) {
          observer.observe(rail);
          observer.observe(frame);
        }
        measure();
        return function () {
          if (observer) observer.disconnect();
          if (applied) frame.style.removeProperty('--dsh-frame-leading-clearance');
        };
      }, [ref]);
    }

    /* ─────────────────────── 拖到底继续左拖 → 收起 ─────────────────────── */

    /**
     * 旁听宿主侧栏的拖拽：拖到最小宽度后继续往左拖，松手时收起侧栏。
     *
     * 宿主的拖拽手柄带 `data-side="sidebar"`，指针捕获只把事件目标改到手柄，
     * 事件仍冒泡到 document，所以这里只读不改宿主。判定放在 pointerup 之后
     * 的一帧：那时宿主已经把最终宽度写进 DOM，用「渲染宽度 − 指针期望宽度」
     * 判过冲，既不用写死最小宽度，也不会在拖拽中途和宿主抢着写宽度。
     *
     * @param layout - 布局服务（`toggleSidebar`）。
     * @returns 清理函数。
     */
    function installDragCollapse(layout) {
      if (typeof document === 'undefined' || !layout) return undefined;

      var session = null;

      /** 切换「松手即折叠」的指针提示；只影响指针样式，失败也不影响拖拽本身。 */
      function setArmed(armed) {
        var root = document.documentElement;
        if (!root) return;
        if (armed) root.setAttribute(ARMED_ATTR, '');
        else root.removeAttribute(ARMED_ATTR);
      }

      function onPointerMove(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        session.endX = event.clientX;
        // 拖动中实时提示：过冲量达到阈值就把指针换成「向左收起」形状。
        var width = parseFloat(session.handle.style.left);
        if (!Number.isFinite(width)) return;
        var armed =
          dragOvershoot(width, session.startWidth, session.startX, event.clientX) >=
          DRAG_COLLAPSE_OVERSHOOT;
        if (armed === session.armed) return;
        session.armed = armed;
        setArmed(armed);
      }

      function cleanup() {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerCancel);
        setArmed(false);
        session = null;
      }

      function settle(drag) {
        if (!drag.handle.isConnected) return;
        var width = parseFloat(drag.handle.style.left);
        var overshoot = Number.isFinite(width)
          ? dragOvershoot(width, drag.startWidth, drag.startX, drag.endX)
          : Number.NEGATIVE_INFINITY;
        // 指针已经提示「松手折叠」时以提示为准：快速拖动时宽度有一帧滞后，
        // 否则会出现「指针说会折叠、松手却没折」的不一致。
        if (drag.armed || overshoot >= DRAG_COLLAPSE_OVERSHOOT) layout.toggleSidebar();
      }

      function onPointerUp(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        var drag = session;
        drag.endX = event.clientX;
        cleanup();
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(function () {
            settle(drag);
          });
        } else {
          settle(drag);
        }
      }

      function onPointerCancel(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        cleanup();
      }

      function onPointerDown(event) {
        if (event.button !== 0 || session) return;
        // 本插件只服务 macOS 桌面折叠态；其它平台不接管拖拽语义。
        // 每个 pointerdown 现查平台属性，避免插件先于桌面 preload 启动时静默失效。
        if (document.documentElement.getAttribute('data-platform') !== 'darwin') return;
        var target = event.target;
        var handle =
          target && typeof target.closest === 'function' ? target.closest('[data-side="sidebar"]') : null;
        if (!handle) return;
        var startWidth = parseFloat(handle.style.left);
        if (!Number.isFinite(startWidth)) return;
        session = {
          pointerId: event.pointerId,
          startX: event.clientX,
          endX: event.clientX,
          startWidth: startWidth,
          handle: handle,
          armed: false,
        };
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerCancel);
      }

      document.addEventListener('pointerdown', onPointerDown);
      return function () {
        cleanup();
        document.removeEventListener('pointerdown', onPointerDown);
      };
    }

    /* ───────────── 展开侧栏：长按拖拽排序 / 拖进二级区收起 ───────────── */

    /**
     * 从事件目标向上找最近的带某个属性的元素（含自身）。
     * @param node - 事件目标。
     * @param attribute - 属性名。
     * @returns 命中的元素，或 null。
     */
    function closestMarked(node, attribute) {
      var current = node;
      var selector = '[' + attribute + ']';
      while (current && current.nodeType === 1) {
        if (current.closest) {
          var hit = current.closest(selector);
          if (hit) return hit;
        }
        current = current.parentElement;
      }
      return null;
    }

    /** 点是否落在 rect 内。 */
    function rectContains(rect, x, y) {
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        x >= rect.left &&
        x < rect.right &&
        y >= rect.top &&
        y < rect.bottom
      );
    }

    /** 吞掉拖拽结束后紧跟的一次 click（避免松手顺便打开面板）。 */
    function suppressNextClick() {
      if (typeof document === 'undefined') return;
      var handler = function (event) {
        event.preventDefault();
        event.stopPropagation();
      };
      document.addEventListener('click', handler, true);
      setTimeout(function () {
        document.removeEventListener('click', handler, true);
      }, 400);
    }

    /**
     * 展开侧栏的长按拖拽：面板行拖拽排序，拖进「更多」二级区收起；
     * 二级区里的行拖回主区恢复显示，区里上下拖则调整收起项顺序。
     * 全部通过宿主已渲染行的 `data-dfm-id` 包装与自绘二级区的事件委托完成，
     * 不在拖拽中途改宿主状态，松手才写 store。
     * @param store - 排序状态 store。
     * @param panelsSource - 当前面板快照（提供生效顺序）。
     * @returns 清理函数。
     */
    function installPanelDrag(store, panelsSource) {
      if (typeof document === 'undefined') return undefined;
      var session = null;

      function platformOk() {
        var root = document.documentElement;
        return !!root && root.getAttribute('data-platform') === 'darwin';
      }

      function currentOrder() {
        var snapshot = store.getSnapshot();
        if (snapshot.preview !== null) return snapshot.preview;
        return panelIdsOf(panelsSource.getSnapshot());
      }

      function hiddenIds() {
        return store.getSnapshot().hidden;
      }

      function hiddenSetOf(ids) {
        var set = {};
        for (var index = 0; index < ids.length; index += 1) set[ids[index]] = true;
        return set;
      }

      /** 可见的宿主面板行（按视觉位置从上到下）。 */
      function mainMarkers() {
        var nodes = document.querySelectorAll('[' + MARKER_ATTR + ']');
        var hidden = hiddenSetOf(hiddenIds());
        var result = [];
        for (var index = 0; index < nodes.length; index += 1) {
          var marker = nodes[index];
          var id = marker.getAttribute(MARKER_ATTR);
          if (!id || hidden[id]) continue;
          var row = typeof marker.closest === 'function' ? marker.closest('button') : null;
          if (!row) continue;
          var rect = row.getBoundingClientRect();
          if (rect.height <= 0 || rect.width <= 0) continue;
          result.push({ id: id, row: row, rect: rect });
        }
        result.sort(function (left, right) {
          return left.rect.top - right.rect.top;
        });
        return result;
      }

      /** 二级区里的行（按视觉位置从上到下）。 */
      function trayRows() {
        var nodes = document.querySelectorAll('[' + TRAY_ID_ATTR + ']');
        var result = [];
        for (var index = 0; index < nodes.length; index += 1) {
          var row = nodes[index];
          var id = row.getAttribute(TRAY_ID_ATTR);
          if (!id) continue;
          var rect = row.getBoundingClientRect();
          if (rect.height <= 0) continue;
          result.push({ id: id, row: row, rect: rect });
        }
        result.sort(function (left, right) {
          return left.rect.top - right.rect.top;
        });
        return result;
      }

      function trayElement() {
        return document.querySelector('[' + TRAY_ATTR + ']');
      }

      function moreRowElement() {
        return document.querySelector('[' + MORE_ROW_ATTR + ']');
      }

      function setDropHighlight(on) {
        var tray = trayElement();
        if (!tray) return;
        if (on) tray.setAttribute(DROP_ATTR, 'true');
        else tray.removeAttribute(DROP_ATTR);
      }

      function schedulePreviewClear() {
        var clear = function () {
          if (store.getSnapshot().preview !== null) store.setPreview(null);
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(clear);
        else setTimeout(clear, 0);
      }

      function cancelTimer() {
        if (session && session.timer !== null) {
          clearTimeout(session.timer);
          session.timer = null;
        }
      }

      function resetSession() {
        cancelTimer();
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', onPointerCancel, true);
        setDropHighlight(false);
        if (typeof document !== 'undefined') {
          document.documentElement.removeAttribute(DRAG_ROOT_ATTR);
        }
        if (session && session.row && session.row.classList) {
          session.row.classList.remove('DFM_rowDragging');
        }
        session = null;
      }

      function activate() {
        if (!session) return;
        session.timer = null;
        session.active = true;
        document.documentElement.setAttribute(DRAG_ROOT_ATTR, '');
        if (session.row && session.row.classList) session.row.classList.add('DFM_rowDragging');
        session.preview = currentOrder();
        store.setPreview(session.preview);
      }

      function updateMainPreview(y, id) {
        var markers = mainMarkers();
        var index = 0;
        for (var scan = 0; scan < markers.length; scan += 1) {
          if (markers[scan].id === id) continue;
          if (y > markers[scan].rect.top + markers[scan].rect.height / 2) index += 1;
        }
        var all = currentOrder();
        var hidden = hiddenIds();
        var hiddenSet = hiddenSetOf(hidden);
        var visible = all.filter(function (panelId) {
          return !hiddenSet[panelId];
        });
        var nextVisible = moveVisibleOrder(visible, id, index);
        store.setPreview(replaceVisibleOrder(all, hidden, nextVisible));
      }

      function updateTrayPreview(y, id) {
        var rows = trayRows();
        var index = 0;
        for (var scan = 0; scan < rows.length; scan += 1) {
          if (rows[scan].id === id) continue;
          if (y > rows[scan].rect.top + rows[scan].rect.height / 2) index += 1;
        }
        var all = currentOrder();
        var hidden = hiddenIds();
        var hiddenSet = hiddenSetOf(hidden);
        var hiddenOrder = all.filter(function (panelId) {
          return hiddenSet[panelId];
        });
        var nextHidden = moveVisibleOrder(hiddenOrder, id, index);
        store.setPreview(replaceHiddenOrder(all, hidden, nextHidden));
      }

      function onPointerMove(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        if (!session.active) {
          var dx = event.clientX - session.startX;
          var dy = event.clientY - session.startY;
          if (Math.abs(dx) + Math.abs(dy) > LONG_PRESS_SLOP) resetSession();
          return;
        }
        if (event.cancelable) event.preventDefault();
        var tray = trayElement();
        var overTray = tray ? rectContains(tray.getBoundingClientRect(), event.clientX, event.clientY) : false;
        if (!session.fromTray) {
          if (!overTray) {
            // 拖着面板靠近「更多」时自动展开二级区，松手即可放进去。
            var more = moreRowElement();
            if (
              !store.getSnapshot().trayOpen &&
              more &&
              rectContains(more.getBoundingClientRect(), event.clientX, event.clientY)
            ) {
              store.setTrayOpen(true);
            }
          }
          session.hideTarget = overTray;
          setDropHighlight(overTray);
          if (!overTray) updateMainPreview(event.clientY, session.id);
        } else if (overTray) {
          updateTrayPreview(event.clientY, session.id);
        }
      }

      function onPointerUp(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        var drag = session;
        var x = event.clientX;
        var y = event.clientY;
        var tray = trayElement();
        var overTray = tray ? rectContains(tray.getBoundingClientRect(), x, y) : false;
        var markers = mainMarkers();
        var more = moreRowElement();
        var overMain = !overTray && more ? y < more.getBoundingClientRect().top : markers.length > 0;
        var active = drag.active;
        resetSession();
        if (!active) {
          if (store.getSnapshot().preview !== null) store.setPreview(null);
          return;
        }
        suppressNextClick();
        if (drag.fromTray) {
          if (overTray) {
            var foldedPreview = store.getSnapshot().preview;
            if (foldedPreview !== null) {
              store.setOrder(foldedPreview);
              schedulePreviewClear();
            } else {
              store.setPreview(null);
            }
          } else if (overMain) {
            var index = 0;
            for (var scan = 0; scan < markers.length; scan += 1) {
              if (y > markers[scan].rect.top + markers[scan].rect.height / 2) index += 1;
            }
            var snapshot = store.getSnapshot();
            var all = currentOrder();
            var beforeHidden = hiddenSetOf(snapshot.hidden);
            var visible = all.filter(function (panelId) {
              return !beforeHidden[panelId];
            });
            var nextVisible = moveVisibleOrder(visible, drag.id, index);
            var nextHidden = snapshot.hidden.filter(function (panelId) {
              return panelId !== drag.id;
            });
            store.setHidden(nextHidden);
            store.setOrder(replaceVisibleOrder(all, nextHidden, nextVisible));
            store.setPreview(null);
          } else {
            store.setPreview(null);
          }
          return;
        }
        if (overTray) {
          store.hidePanel(drag.id);
          store.setPreview(null);
          return;
        }
        var preview = store.getSnapshot().preview;
        if (preview !== null) {
          store.setOrder(preview);
          schedulePreviewClear();
        } else {
          store.setPreview(null);
        }
      }

      function onPointerCancel(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        resetSession();
        if (store.getSnapshot().preview !== null) store.setPreview(null);
      }

      function onPointerDown(event) {
        if (event.button !== 0 || session) return;
        if (!store.getSnapshot().enabled) return;
        if (!platformOk()) return;
        if (document.documentElement.hasAttribute(DRAG_ROOT_ATTR)) return;
        var target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        var trayRow = closestMarked(target, TRAY_ID_ATTR);
        var marker = trayRow ? null : closestMarked(target, MARKER_ATTR);
        if (!trayRow && !marker) return;
        var row = trayRow || marker.closest('button');
        if (!row) return;
        var id = trayRow
          ? row.getAttribute(TRAY_ID_ATTR)
          : marker.getAttribute(MARKER_ATTR);
        if (!id) return;
        session = {
          pointerId: event.pointerId,
          id: id,
          row: row,
          fromTray: trayRow !== null,
          startX: event.clientX,
          startY: event.clientY,
          active: false,
          hideTarget: false,
          preview: null,
          timer: null,
        };
        session.timer = setTimeout(activate, LONG_PRESS_MS);
        document.addEventListener('pointermove', onPointerMove, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('pointercancel', onPointerCancel, true);
      }

      document.addEventListener('pointerdown', onPointerDown, true);
      return function () {
        resetSession();
        if (typeof document !== 'undefined' && store.getSnapshot().preview !== null) {
          store.setPreview(null);
        }
        document.removeEventListener('pointerdown', onPointerDown, true);
      };
    }

    /* ───────────── 折叠工具栏：长按拖拽排序（与展开侧栏同序）───────────── */

    /**
     * 折叠工具栏上的长按拖拽：在图标之间左右拖拽，松手写回同一份顺序。
     * 工具栏图标由本插件渲染，事件目标是带 `data-panel-id` 的按钮；
     * 排序结果仍交给影子注册同步到展开侧栏。
     * @param store - 排序状态 store。
     * @param panelsSource - 当前面板快照。
     * @returns 清理函数。
     */
    function installRailDrag(store, panelsSource) {
      if (typeof document === 'undefined') return undefined;
      var session = null;

      function platformOk() {
        var root = document.documentElement;
        return !!root && root.getAttribute('data-platform') === 'darwin';
      }

      function currentOrder() {
        var snapshot = store.getSnapshot();
        if (snapshot.preview !== null) return snapshot.preview;
        return panelIdsOf(panelsSource.getSnapshot());
      }

      function railButtons() {
        var rail = document.querySelector('[data-fold-minimal="rail"]');
        if (!rail) return [];
        var nodes = rail.querySelectorAll('[data-fold-minimal="panel"][data-panel-id]');
        var result = [];
        for (var index = 0; index < nodes.length; index += 1) {
          var rect = nodes[index].getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          result.push({ id: nodes[index].getAttribute('data-panel-id'), row: nodes[index], rect: rect });
        }
        result.sort(function (left, right) {
          return left.rect.left - right.rect.left;
        });
        return result;
      }

      function reset() {
        if (session && session.timer !== null) {
          clearTimeout(session.timer);
          session.timer = null;
        }
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', onPointerCancel, true);
        document.documentElement.removeAttribute(DRAG_ROOT_ATTR);
        if (session && session.row && session.row.classList) session.row.classList.remove('DFM_rowDragging');
        session = null;
      }

      function activate() {
        if (!session) return;
        session.timer = null;
        session.active = true;
        document.documentElement.setAttribute(DRAG_ROOT_ATTR, '');
        if (session.row && session.row.classList) session.row.classList.add('DFM_rowDragging');
        store.setPreview(currentOrder());
      }

      function onPointerMove(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        if (!session.active) {
          var dx = event.clientX - session.startX;
          var dy = event.clientY - session.startY;
          if (Math.abs(dx) + Math.abs(dy) > LONG_PRESS_SLOP) reset();
          return;
        }
        if (event.cancelable) event.preventDefault();
        var buttons = railButtons();
        var index = 0;
        for (var scan = 0; scan < buttons.length; scan += 1) {
          if (buttons[scan].id === session.id) continue;
          if (event.clientX > buttons[scan].rect.left + buttons[scan].rect.width / 2) index += 1;
        }
        var all = currentOrder();
        var hidden = store.getSnapshot().hidden;
        var hiddenSet = {};
        for (var hiddenIndex = 0; hiddenIndex < hidden.length; hiddenIndex += 1) {
          hiddenSet[hidden[hiddenIndex]] = true;
        }
        var visible = all.filter(function (panelId) {
          return !hiddenSet[panelId];
        });
        store.setPreview(replaceVisibleOrder(all, hidden, moveVisibleOrder(visible, session.id, index)));
      }

      function onPointerUp(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        var active = session.active;
        var preview = store.getSnapshot().preview;
        reset();
        if (!active) {
          if (preview !== null) store.setPreview(null);
          return;
        }
        suppressNextClick();
        if (preview !== null) {
          store.setOrder(preview);
          var clear = function () {
            if (store.getSnapshot().preview !== null) store.setPreview(null);
          };
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(clear);
          else setTimeout(clear, 0);
        } else {
          store.setPreview(null);
        }
      }

      function onPointerCancel(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        reset();
        if (store.getSnapshot().preview !== null) store.setPreview(null);
      }

      function onPointerDown(event) {
        if (event.button !== 0 || session) return;
        if (!store.getSnapshot().enabled) return;
        if (!platformOk()) return;
        var target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        var button = target.closest('[data-fold-minimal="panel"][data-panel-id]');
        if (!button) return;
        var rail = button.closest('[data-fold-minimal="rail"]');
        if (!rail) return;
        var id = button.getAttribute('data-panel-id');
        if (!id) return;
        session = {
          pointerId: event.pointerId,
          id: id,
          row: button,
          startX: event.clientX,
          startY: event.clientY,
          active: false,
          timer: null,
        };
        session.timer = setTimeout(activate, LONG_PRESS_MS);
        document.addEventListener('pointermove', onPointerMove, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('pointercancel', onPointerCancel, true);
      }

      document.addEventListener('pointerdown', onPointerDown, true);
      return function () {
        reset();
        if (store.getSnapshot().preview !== null) store.setPreview(null);
        document.removeEventListener('pointerdown', onPointerDown, true);
      };
    }

    /* ──────────────────────────── 工具栏 ──────────────────────────── */

    /**
     * 主区域是否正被某个全局面板占用（而不是在会话里）。
     * @param info - usePanelInfo 的布局快照。
     * @returns 面板活跃时为 true；会话中为 false。
     */
    function isPanelActive(info) {
      return info.activePanelId !== null;
    }

    /**
     * 折叠态窗口左上角工具栏：展开 │ 全局面板（与左侧菜单同序）│ 新建会话，
     * 面板活跃时在新建会话后追加「返回会话」。
     * @param props - 槽位标准 props + 本插件 inject 的 props。
     */
    function LeadingRail(props) {
      var t = props.t;
      var usePanelInfo = props.usePanelInfo;
      var panels = props.usePanels(function (snapshot) {
        return snapshot;
      });
      var layoutState = props.useLayout(function (snapshot) {
        return snapshot;
      });
      var panelActive = usePanelInfo(isPanelActive);
      var toggleShortcut = props.useShortcuts(shortcutFinder('sidebar.left.toggle'));
      var newShortcut = props.useShortcuts(shortcutFinder('session.new'));

      var railRef = React.useRef(null);
      useLeadingClearance(railRef);

      var enabled = layoutState.enabled === true;
      var hiddenIds = enabled && Array.isArray(layoutState.hidden) ? layoutState.hidden : [];
      // 影子注册会把宿主账本顺序改成保存的顺序；这里再兜一层，保证账本
      // 尚未刷新（拖拽预览）或影子尚未重建时工具栏也按同一顺序渲染。
      var orderSource = Array.isArray(layoutState.preview)
        ? layoutState.preview
        : Array.isArray(layoutState.order) && layoutState.order.length > 0
          ? layoutState.order
          : null;
      var effectivePanels = enabled && orderSource ? panelsInOrder(panels, orderSource) : panels;
      var split = splitPanels(effectivePanels, hiddenIds);
      var needsMore = split.overflow.length > 0 || split.hidden.length > 0;

      var children = [
        h(
          RailButton,
          {
            key: 'rail:toggle',
            label: t('toggle.open'),
            shortcut: toggleShortcut,
            testId: 'toggle',
            onClick: props.toggleSidebar,
          },
          h(PanelLeftIcon, { size: ICON_SIZE }),
        ),
      ];

      if (effectivePanels.length > 0) {
        children.push(h(Divider, { key: 'rail:divider-panels' }));
        for (var index = 0; index < split.visible.length; index += 1) {
          children.push(
            h(PanelButton, {
              key: 'panel:' + split.visible[index].id,
              panel: split.visible[index],
              selectPanel: props.selectPanel,
              trackEntryClick: props.trackEntryClick,
              usePanelInfo: usePanelInfo,
            }),
          );
        }
        if (needsMore) {
          children.push(
            h(PanelOverflowMenu, {
              key: 'rail:more-panels',
              panels: split.overflow,
              hiddenPanels: split.hidden,
              t: t,
              usePanelInfo: usePanelInfo,
              onSelect: function (panel) {
                openPanel(panel, props.selectPanel, props.trackEntryClick);
              },
            }),
          );
        }
      }

      children.push(h(Divider, { key: 'rail:divider-session' }));
      children.push(
        h(
          RailButton,
          {
            key: 'rail:new-session',
            label: t('session.new.label'),
            shortcut: newShortcut,
            testId: 'new-session',
            onClick: function () {
              props.trackEntryClick({ menu_name: 'new_session', position: 'titlebar' });
              props.startSession();
            },
          },
          h(NewChatIcon, { size: ICON_SIZE }),
        ),
      );

      // 「返回会话」只属于面板上下文：已经回到会话时没有可返回的目标，隐藏。
      if (panelActive) {
        children.push(
          h(
            RailButton,
            {
              key: 'rail:back-session',
              label: t('session.back.label'),
              testId: 'back-session',
              onClick: props.backToSession,
            },
            h(BackIcon, { size: ICON_SIZE }),
          ),
        );
      }

      return h(
        'div',
        {
          className: 'DFM_rail',
          ref: railRef,
          role: 'group',
          'aria-label': t('rail.label'),
          'data-fold-minimal': 'rail',
        },
        children,
      );
    }

    /* ───────────────────────────── 插件 ───────────────────────────── */

    /** 需要的客户端服务：槽位、布局、会话导航、语言、快捷键。 */
    var inject = ['slots', 'layout', 'uiWorkspace', 'locale', 'shortcuts'];

    /**
     * 注册折叠态工具栏；同时把面板账本与语言变化同步进 observable source。
     * @param ctx - 客户端根上下文。
     */
    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en });
      }, 'fold-minimal: dictionaries');

      ctx.effect(injectStyles, 'fold-minimal: styles');

      // 拖拽收起只在 darwin 生效（installDragCollapse 内部判定），
      // 生命周期跟随插件启停。
      ctx.effect(function () {
        return installDragCollapse(ctx.layout);
      }, 'fold-minimal: drag to collapse');

      var panels = createPanelsSource(ctx);
      var layout = createPanelLayoutStore(readLayoutPrefs());
      var shadows = createShadowManager(ctx, layout);

      var syncAll = function () {
        panels.sync();
        shadows.sync();
      };

      // 面板账本 + 影子注册跟随 `sidebar.panellist` 声明生命周期：
      // 侧栏插件卸载/重载时重新对账，不会留下指向已消失声明的影子记录。
      ctx.effect(function () {
        return ctx.slots.inject(PANEL_SLOT, function () {
          var offSlot = ctx.slots.subscribe(PANEL_SLOT, syncAll);
          // 只有持久字段（开关/顺序）变化才需要重建影子；拖拽预览变化不必。
          var lastShadowKey = null;
          var syncShadowsIfChanged = function () {
            var snapshot = layout.getSnapshot();
            var key = (snapshot.enabled ? '1' : '0') + ':' + snapshot.order.join(',');
            if (key === lastShadowKey) return;
            lastShadowKey = key;
            shadows.sync();
          };
          var offLayout = layout.subscribe(syncShadowsIfChanged);
          var offLocale = ctx.locale.subscribe(panels.sync);
          syncAll();
          return function () {
            offLocale();
            offLayout();
            offSlot();
            shadows.dispose();
          };
        });
      }, 'fold-minimal: panel layout ledger');

      // 两处长按拖拽（展开侧栏行 / 折叠工具栏图标）共用一个状态 store。
      ctx.effect(function () {
        return installPanelDrag(layout, panels.source);
      }, 'fold-minimal: expanded panel drag');
      ctx.effect(function () {
        return installRailDrag(layout, panels.source);
      }, 'fold-minimal: rail panel drag');

      var layoutActions = {
        toggleTray: function () {
          layout.setTrayOpen(!layout.getSnapshot().trayOpen);
        },
        resetLayout: function () {
          layout.reset();
        },
        setLayoutEnabled: function (enabled) {
          layout.setEnabled(enabled);
        },
      };

      var actions = {
        toggleSidebar: function () {
          ctx.layout.toggleSidebar();
        },
        startSession: function () {
          ctx.uiWorkspace.startSession();
        },
        selectPanel: function (id) {
          ctx.layout.selectPanel(id);
        },
        backToSession: function () {
          // null 是布局层原生的「回到 Conversation」；主会话由 uiWorkspace
          // 以 mainView 引用保留着，所以不需要重新加载或重新选择会话。
          ctx.layout.selectPanel(null);
        },
        trackEntryClick: function (attributes) {
          // 埋点是可选服务；它失败也不能影响「打开面板 / 新建会话」本身。
          try {
            var analytics = ctx.get('productAnalytics');
            if (analytics && typeof analytics.track === 'function') {
              analytics.track('sidebar_menu_click', attributes);
            }
          } catch (error) {
            // 忽略：分析服务缺席或拒绝时保持按钮可用。
          }
        },
      };

      // priority -1 覆盖 ui-sidebar 在 shell.leading 的 occupant：
      // single 槽位「最低 priority 渲染」，于是本工具栏接管折叠态左上角。
      ctx.slots.inject(SLOT, function () {
        return ctx.slots.register(
          {
            name: SLOT,
            priority: -1,
            locale: NS,
            inject: function () {
              return {
                toggleSidebar: actions.toggleSidebar,
                startSession: actions.startSession,
                selectPanel: actions.selectPanel,
                backToSession: actions.backToSession,
                trackEntryClick: actions.trackEntryClick,
                hooks: {
                  shortcuts: ctx.shortcuts.catalog,
                  panels: panels.source,
                  layout: layout.observable,
                },
              };
            },
          },
          LeadingRail,
        );
      });

      // 展开态：返回按钮 + 「更多」行 chevron + 下方二级区。
      // 组件不渲染视觉内容，只对宿主侧栏 chrome 做增量增强。
      ctx.slots.inject('sidebar.footer.action', function () {
        return ctx.slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'fold-minimal.sidebar-chrome',
            locale: NS,
            inject: function () {
              return {
                backToSession: actions.backToSession,
                selectPanel: actions.selectPanel,
                trackEntryClick: actions.trackEntryClick,
                toggleTray: layoutActions.toggleTray,
                resetLayout: layoutActions.resetLayout,
                hooks: {
                  layout: layout.observable,
                  panels: panels.source,
                },
              };
            },
          },
          SidebarChrome,
        );
      });

      // 设置 → 通用：新部件的开关（默认关）。
      ctx.slots.inject('settings.general.item', function () {
        return ctx.slots.register(
          {
            name: 'settings.general.item',
            id: 'fold-minimal.panel-layout',
            order: 25,
            locale: NS,
            inject: function () {
              return {
                setLayoutEnabled: layoutActions.setLayoutEnabled,
                hooks: { layout: layout.observable },
              };
            },
          },
          PanelLayoutSettingsRow,
        );
      });

      // 「更多」按钮只在 panellist.actions 有注册时出现。新部件运行时注册一个
      // 空行，保证二级区的锚点存在；关闭开关就撤销，不改变关闭时的 UI。
      ctx.effect(function () {
        return ctx.slots.inject('sidebar.panellist.actions', function () {
          var dispose = null;
          var sync = function () {
            var enabled = layout.getSnapshot().enabled;
            if (enabled && !dispose) {
              dispose = ctx.slots.register(
                {
                  name: 'sidebar.panellist.actions',
                  id: 'fold-minimal.more-anchor',
                  locale: NS,
                },
                function () {
                  return null;
                },
              );
            } else if (!enabled && dispose) {
              dispose();
              dispose = null;
            }
          };
          var off = layout.subscribe(sync);
          sync();
          return function () {
            off();
            if (dispose) dispose();
          };
        });
      }, 'fold-minimal: more anchor');
    }

    return {
      inject: inject,
      apply: apply,
      // 仅供本地测试断言（不进入运行时渲染路径）。
      __test: {
        NS: NS,
        SLOT: SLOT,
        PANEL_SLOT: PANEL_SLOT,
        PANEL_SLOTS: PANEL_SLOTS,
        DRAG_COLLAPSE_OVERSHOOT: DRAG_COLLAPSE_OVERSHOOT,
        LONG_PRESS_MS: LONG_PRESS_MS,
        LONG_PRESS_SLOP: LONG_PRESS_SLOP,
        LAYOUT_COOKIE: LAYOUT_COOKIE,
        dictionaries: { zh: zh, en: en },
        labelOf: labelOf,
        buildPanels: buildPanels,
        samePanels: samePanels,
        splitPanels: splitPanels,
        mergePanelOrder: mergePanelOrder,
        moveVisibleOrder: moveVisibleOrder,
        replaceVisibleOrder: replaceVisibleOrder,
        replaceHiddenOrder: replaceHiddenOrder,
        panelsInOrder: panelsInOrder,
        panelIdsOf: panelIdsOf,
        sanitizeLayoutPrefs: sanitizeLayoutPrefs,
        createPanelLayoutStore: createPanelLayoutStore,
        dragOvershoot: dragOvershoot,
        installDragCollapse: installDragCollapse,
        installPanelDrag: installPanelDrag,
        installRailDrag: installRailDrag,
        createPanelLayoutStore: createPanelLayoutStore,
        isPanelActive: isPanelActive,
      },
    };
  },
});
