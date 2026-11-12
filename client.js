/**
 * dsh-fold-minimal — browser half.
 *
 * GENERATED FILE — edit src/*.js and run `npm run build`.
 * The shipped artifact is still one zero-dependency client.js.
 */
window.__ModuleLoader__.load({
  id: 'dsh-fold-minimal',
  factory: function (require) {
    /* ── src/00-runtime.js — React/ReactDOM and factory runtime ── */
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

    /* ── src/01-constants.js — Constants, attribute names, timing, cursors ── */
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
     * 0.2.2 起官方在侧栏「更多」里管理面板的固定/取消固定。这个注册者由
     * `@deepseek-ai/dsh-client-ui-entry-customization` 提供；它存在时，
     * 「收纳」由官方负责，本插件不再维护第二套隐藏状态。
     */
    var OFFICIAL_MORE_ID = 'entry-customization';
    /** 官方固定菜单「更多」首次随该版本交付；用作无法读取 boot 信息时的兜底。 */
    var OFFICIAL_MORE_RELEASE = '0.2.2-rc.2';
    /** 提供官方「更多」固定/取消固定的 Client 包；boot 图里出现它即说明是新版。 */
    var OFFICIAL_MORE_PACKAGE = '@deepseek-ai/dsh-client-ui-entry-customization';
    /**
     * 拖拽过冲阈值（px）：松手时的渲染列宽比指针期望列宽还大这么多，才算
     * 「已经拖到最小、还想继续往左」。取 80 让「拖到最小」和「触发折叠」之
     * 间留出明显的距离，避免贴边时误触；不写死宿主的最小宽度，宿主改范围也不失效。
     */
    var DRAG_COLLAPSE_OVERSHOOT = 80;
    /** 悬停意图：进入时的展开延迟与离开时的收回延迟（ms）。 */
    var MENU_OPEN_DELAY = 80;
    var MENU_CLOSE_DELAY = 180;
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

    /**
     * 拖拽启动阈值（px）：按下后移动超过这个距离就立即进入换位状态并显示
     * 蓝色插入指示线，不再需要长按等待；未超过则保持普通点击。
     */
    var DRAG_START_DISTANCE = 4;

    /** 影子组件挂在宿主面板行图标外层的包装标记。 */
    var MARKER_ATTR = 'data-dfm-id';
    /** 展开侧栏「更多」行下方自绘的二级区。 */
    var TRAY_ATTR = 'data-dfm-tray';
    /** 二级区里每一行的面板 id。 */
    var TRAY_ID_ATTR = 'data-dfm-tray-id';
    /** 宿主「更多」行（nav 直接子元素）上的标记，用来定位二级区与 chevron。 */
    var MORE_ROW_ATTR = 'data-dfm-more-row';
    /** 折叠工具栏「更多」浮层里每一行的面板 id（portal 后仍能作为拖动起点）。 */
    var RAIL_MENU_ID_ATTR = 'data-dfm-rail-menu-id';
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

    /* ── src/02-locales.js — Chinese and English UI copy ── */
    var zh = {
      'rail.label': '折叠态工具栏',
      'rail.hide': '拖到这里隐藏',
      'rail.restore': '拖到这里显示',
      'rail.pinned': '固定面板',
      'rail.unpinned': '未固定面板',
      'rail.pinHint': '拖到这里固定',
      'rail.unpinHint': '拖到这里取消固定',
      'toggle.open': '打开侧边栏',
      'session.new.label': '新建会话',
      'session.back.label': '返回会话',
      'panels.more': '更多面板',
      'panels.unpinned': '未固定到侧栏',
      'layout.title': '面板挪位与折叠',
      'layout.description': '按住拖动面板调整顺序，蓝色插入线提示落点；展开侧栏与折叠工具栏同步；把面板拖进「更多」可收起，再拖回恢复。',
      'layout.title.new': '面板挪位',
      'layout.description.new': '按住拖动面板调整顺序，蓝色插入线提示落点；展开侧栏、折叠工具栏与官方「更多」共享同一顺序。折叠工具栏拖动时会整体展开并跟随一个图标 ghost，拖过固定边界即可固定或取消固定；收纳由官方状态负责，本插件不维护第二套隐藏状态。',
      'settings.toolbar.title': '折叠菜单',
      'settings.toolbar.desc': '折叠侧栏后在窗口左上角显示面板工具栏；拖到最窄继续左拖可收起侧栏。',
      'settings.back.title': '返回会话按钮',
      'settings.back.desc': '打开全局面板时，在折叠工具栏和展开侧栏顶部显示「返回会话」；回到会话后自动隐藏。关闭后两处入口一起隐藏，其余按钮不受影响。',
      'compat.official': '兼容模式：官方固定菜单与「更多」',
      'compat.legacy': '兼容模式：旧版插件隐藏与「更多」二级区',
      'layout.reset': '恢复默认排序',
      'tray.label': '已收起的面板',
      'tray.empty': '把上面的面板拖到这里收起',
      'tray.expand': '展开已收起的面板',
      'tray.collapse': '收起已收起的面板列表',
    };

    var en = {
      'rail.label': 'Collapsed toolbar',
      'rail.hide': 'Drag here to hide',
      'rail.restore': 'Drag here to show',
      'rail.pinned': 'Pinned panels',
      'rail.unpinned': 'Unpinned panels',
      'rail.pinHint': 'Drag here to pin',
      'rail.unpinHint': 'Drag here to unpin',
      'toggle.open': 'Open sidebar',
      'session.new.label': 'New session',
      'session.back.label': 'Back to session',
      'panels.more': 'More panels',
      'panels.unpinned': 'Not pinned to sidebar',
      'layout.title': 'Panel reorder & fold',
      'layout.description': 'Drag a panel to reorder it (a blue insertion line shows the drop position); the expanded list and the collapsed toolbar share one order. Drag a panel into More to put it away, and drag it back to restore.',
      'layout.title.new': 'Panel reorder',
      'layout.description.new': 'Drag a panel to reorder it (a blue insertion line shows the drop position); the expanded list, collapsed toolbar, and the official More menu share one order. Dragging in the collapsed toolbar expands it and follows one ghost icon; crossing the pin boundary pins or unpins through the official state. The plugin keeps no second hidden state.',
      'settings.toolbar.title': 'Collapsed menu',
      'settings.toolbar.desc': 'Map panel icons to the top-left toolbar when the sidebar is collapsed; drag past the minimum width to collapse it.',
      'settings.back.title': 'Back-to-session button',
      'settings.back.desc': 'While a global panel is open, show Back to session in the collapsed toolbar and at the top of the expanded sidebar. It hides in a session, and turning this off hides both entries without affecting other controls.',
      'compat.official': 'Compatibility mode: official pinned menu and More',
      'compat.legacy': 'Compatibility mode: legacy plugin hide and More tray',
      'layout.reset': 'Reset panel order',
      'tray.label': 'Hidden panels',
      'tray.empty': 'Drag a panel here to put it away',
      'tray.expand': 'Show hidden panels',
      'tray.collapse': 'Hide the hidden-panel list',
    };

    /* ── src/03-styles.js — CSS tokens and style injection ── */
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
      '.DFM_menuItem[' + RAIL_MENU_ID_ATTR + ']{cursor:grab}',
      '.DFM_menuItem.DFM_rowDragging{opacity:.5}',
      // 折叠工具栏的「更多」浮层挂到 body：避免被主面板的层叠上下文/标题栏裁切，
      // 也让悬停区域不再依赖按钮自身的盒子。
      '.DFM_menu[data-dfm-menu-portal="true"]{position:fixed;z-index:100010;max-height:min(60vh,420px);overflow:auto}',
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
      '--dfm-tray-border:color-mix(in srgb,var(--dsw-alias-label-tertiary,#9ca3af) 25%,white);',
      'margin:0 0 4px 14px;padding:4px;border:1px dashed var(--dfm-tray-border);',
      'border-radius:var(--dsw-radius-md);max-height:320px;overflow:auto}',
      '.DFM_tray:empty{display:none}',
      '.DFM_tray[hidden]{display:none}',
      '.DFM_tray[data-dfm-drop="true"]{background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_trayRow{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;',
      'min-height:32px;margin:0;padding:4px 10px;border:none;border-radius:var(--dsw-radius-sm);',
      'background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;',
      'line-height:18px;text-align:left;cursor:grab}',
      '.DFM_trayRow:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_trayRow:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      '.DFM_trayRow[data-dfm-dragging="true"]{opacity:.5}',
      '.DFM_trayLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.DFM_trayEmpty{box-sizing:border-box;margin:0;padding:8px 10px;color:var(--dsw-alias-label-tertiary);',
      'font-size:12px;line-height:18px}',
      '.DFM_trayFooter{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:2px 2px 4px}',
      '.DFM_linkButton{border:none;background:transparent;color:var(--dsw-alias-brand-primary);',
      'font:inherit;font-size:12px;line-height:18px;padding:2px 4px;border-radius:var(--dsw-radius-sm);cursor:pointer}',
      '.DFM_linkButton:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      // 「更多」菜单里被拆分出来的分组。
      '.DFM_menuDivider{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l2);opacity:.7}',
      '.DFM_menuGroup{padding:4px 8px 2px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}',
      // 插件详情页组件开关行（版式与宿主偏好行一致）。
      '.DFM_pluginSettings{width:100%}',
      '.DFM_setRow{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;',
      'gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}',
      '.DFM_setRowLast{border-bottom:none}',
      '.DFM_setText{min-width:0}',
      '.DFM_setTitle{font-size:14px;line-height:20px}',
      '.DFM_setDesc{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.DFM_compatNote{margin-top:12px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
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
      // 与宿主工作区的 dropBefore/dropAfter 共用绘制参数：12px 箭头 + 2px 线。
      // 折叠工具栏把同一图形旋转 90°，只改变朝向，不改变箭头大小和线宽。
      '.DFM_indicator{position:fixed;z-index:99999;pointer-events:none;',
      'transform-origin:0 0;background:',
      'linear-gradient(55deg,transparent calc(50% - 1px),var(--dsw-alias-state-business-primary) ',
      'calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat,',
      'linear-gradient(125deg,transparent calc(50% - 1px),var(--dsw-alias-state-business-primary) ',
      'calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat,',
      'linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat}',
      '.DFM_indicator[data-axis="horizontal"]{transform:rotate(90deg)}',
      // 拖动时把显示区与隐藏区分隔开，隐藏区用浅色说明提示用途。
      '.DFM_railZone{display:flex;flex:none;align-items:center;gap:2px;min-width:28px;min-height:28px}',
      '.DFM_railHidden{padding-right:8px}',
      '.DFM_railZone + .DFM_divider{background:var(--dsw-alias-border-l3,var(--dsw-alias-label-tertiary,#9ca3af));opacity:.7}',
      '.DFM_railHint{padding:0 6px;color:var(--dsw-alias-label-tertiary,#9ca3af);',
      'font-size:11px;line-height:16px;white-space:nowrap}',
      '.DFM_railHidden .DFM_button{color:var(--dsw-alias-label-tertiary,#9ca3af)}',
      // 「更多」按钮只变底色；虚线边框只出现在下方二级区。
      '[' + MORE_ROW_ATTR + '][' + DROP_ATTR + '="true"]{background:var(--dsw-alias-interactive-bg-hover);',
      'border-radius:var(--dsw-radius-md)}',
      // 拖拽面板行时的全局指针/选区状态。
      'html[' + DRAG_ROOT_ATTR + ']{user-select:none}',
      'html[' + DRAG_ROOT_ATTR + '] *{cursor:grabbing !important}',
      '.DFM_rowDragging{opacity:.5}',
      '.DFM_dragGhost{position:fixed;z-index:100000;pointer-events:none;display:flex;',
      'align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--dsw-radius-sm);',
      'background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay));color:var(--dsw-alias-label-primary);',
      'box-shadow:var(--dsw-elevation-prominent,0 6px 16px rgba(0,0,0,.18))}',
      '.DFM_dragGhost svg{width:16px;height:16px}',
      'html[' + DRAG_ROOT_ATTR + '] .DFM_tip{display:none}',
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

    /* ── src/04-panels.js — Panel snapshot, order merge, splitting, grouping ── */
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
      var hiddenSet = Object.create(null);
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
      var known = Object.create(null);
      for (var index = 0; index < ids.length; index += 1) known[ids[index]] = true;
      var seen = Object.create(null);
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
      var hiddenSet = Object.create(null);
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
      var hiddenSet = Object.create(null);
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
      var byId = Object.create(null);
      for (var index = 0; index < panels.length; index += 1) byId[panels[index].id] = panels[index];
      var seen = Object.create(null);
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

    /* ── src/05-storage.js — Cookie/localStorage layout store and component flags ── */
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
        // 原有「折叠菜单」组件默认开启；只有显式保存为 false 才关闭。
        toolbar: source.toolbar !== false,
        // 「返回会话」独立开关，默认开启；旧存档没有该字段时按开启处理。
        back: source.back !== false,
      };
    }

    /** 从 cookie 读取排序状态；没有 document 或解析失败时返回 null。 */
    function readLayoutCookie() {
      if (typeof document === 'undefined') return null;
      try {
        return parseLayoutCookie(document.cookie);
      } catch (error) {
        return null;
      }
    }

    function parseLayoutCookie(cookie) {
      if (typeof cookie !== 'string') return null;
      var prefix = LAYOUT_COOKIE + '=';
      var parts = cookie.split(';');
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
      if (typeof document === 'undefined') return;
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
      if (typeof window === 'undefined') return null;
      try {
        var raw = window.localStorage && window.localStorage.getItem(LAYOUT_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    }

    /** 写回 localStorage 镜像；异常时忽略。 */
    function writeLayoutStorage(prefs) {
      if (typeof window === 'undefined') return;
      try {
        if (window.localStorage) window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(prefs));
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
     * `dragActive` / `dragPanelId`（拖拽中的临时状态，不持久化）。
     * @param initial - `readLayoutPrefs()` 的结果。
     * @returns store：`subscribe/getSnapshot` + 动作。
     */
    function createPanelLayoutStore(initial) {
      var prefs = sanitizeLayoutPrefs(initial);
      var snapshot = {
        enabled: prefs.enabled,
        toolbarEnabled: prefs.toolbar,
        backEnabled: prefs.back,
        order: prefs.order,
        hidden: prefs.hidden,
        trayOpen: false,
        dragActive: false,
        dragPanelId: null,
      };
      var listeners = [];
      var notify = function () {
        var current = listeners.slice();
        for (var index = 0; index < current.length; index += 1) current[index]();
      };
      var patch = function (changes, persist) {
        var next = null;
        for (var key in changes) {
          if (!Object.prototype.hasOwnProperty.call(changes, key)) continue;
          var value = changes[key];
          var previous = snapshot[key];
          if (value === previous || (Array.isArray(value) && Array.isArray(previous) &&
              value.length === previous.length && value.every(function (item, index) {
                return item === previous[index];
              }))) continue;
          if (next === null) next = Object.assign({}, snapshot);
          next[key] = value;
        }
        if (next === null) return;
        snapshot = next;
        if (persist) {
          writeLayoutPrefs({
            enabled: next.enabled,
            order: next.order,
            hidden: next.hidden,
            toolbar: next.toolbarEnabled,
            back: next.backEnabled,
          });
        }
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
          patch({ enabled: enabled === true, trayOpen: enabled === true ? snapshot.trayOpen : false }, true);
        },
        setToolbarEnabled: function (enabled) {
          patch({ toolbarEnabled: enabled === true }, true);
        },
        setBackEnabled: function (enabled) {
          patch({ backEnabled: enabled === true }, true);
        },
        setOrder: function (order) {
          patch({ order: sanitizeLayoutPrefs({ order: order }).order }, true);
        },
        setHidden: function (hidden) {
          patch({ hidden: sanitizeLayoutPrefs({ hidden: hidden }).hidden }, true);
        },
        setPlacement: function (order, hidden) {
          var next = sanitizeLayoutPrefs({ order: order, hidden: hidden });
          patch({ order: next.order, hidden: next.hidden }, true);
        },
        setTrayOpen: function (open) {
          patch({ trayOpen: open === true }, false);
        },
        /** 拖拽活跃标记（不持久化）：折叠工具栏据此临时把全部图标平铺。 */
        setDragActive: function (active, id) {
          var panelId = active === true && typeof id === 'string' ? id : null;
          if (snapshot.dragActive === (active === true) && snapshot.dragPanelId === panelId) return;
          patch({ dragActive: active === true, dragPanelId: panelId }, false);
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
          patch({ order: [], hidden: [] }, true);
        },
      };
    }

    /** 仅在对应组件开启时安装副作用；开关关闭与插件卸载共用同一条清理路径。 */
    function watchLayoutFlag(store, key, install) {
      var enabled = false;
      var dispose = null;
      var sync = function () {
        var next = store.getSnapshot()[key] === true;
        if (next === enabled) return;
        enabled = next;
        if (dispose) dispose();
        dispose = next ? install() : null;
      };
      var off = store.subscribe(sync);
      try { sync(); } catch (error) { off(); throw error; }
      return function () {
        off();
        if (dispose) dispose();
        dispose = null;
      };
    }

    /* ── src/06-version.js — DSH release/capability detection and official setPinned resolution ── */
    /* ─────────────── 版本检测：官方固定菜单 / 「更多」兼容模式 ─────────────── */

    /**
     * 读取 Host 注入的 release 信息。
     *
     * `window.__DSH_BOOT__` 是 Web 启动协议里的公开入口，`release.version`
     * 由 Host 在打包时写入；开发态或自定义组合可能没有，此时返回 undefined。
     * @returns `{ version, commit? }` 或 undefined。
     */
    function readBootRelease() {
      try {
        var boot = typeof window !== 'undefined' ? window.__DSH_BOOT__ : undefined;
        var release = boot && boot.release;
        if (release && typeof release.version === 'string' && release.version.length > 0) {
          return {
            version: release.version,
            commit: typeof release.commit === 'string' ? release.commit : undefined,
          };
        }
      } catch (error) {
        // 启动协议被替换时不要影响插件加载。
      }
      return undefined;
    }

    /**
     * boot 图里是否加载了官方「更多」实现包。
     * 这比 release.version 更直接：自定义版本号或开发构建也能判定。
     * @returns 是否出现 entry-customization。
     */
    function bootHasOfficialMore() {
      try {
        var boot = typeof window !== 'undefined' ? window.__DSH_BOOT__ : undefined;
        var entries = boot && Array.isArray(boot.entries) ? boot.entries : [];
        for (var index = 0; index < entries.length; index += 1) {
          var entry = entries[index];
          if (entry && entry.id === OFFICIAL_MORE_PACKAGE) return true;
        }
      } catch (error) {
        // 启动图不可读时交给注册者/版本兜底。
      }
      return false;
    }

    /**
     * 解析 `major.minor.patch[-pre]`；无法解析时返回 null。
     * @param value - 版本字符串。
     * @returns `{ parts, pre }`。
     */
    function parseVersion(value) {
      if (typeof value !== 'string') return null;
      var match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value.trim());
      if (!match) return null;
      return {
        parts: [Number(match[1]), Number(match[2]), Number(match[3])],
        pre: match[4] ? match[4].split('.') : [],
      };
    }

    /**
     * 比较两个 semver 字符串（含 prerelease），用于版本兜底判断。
     * @param left - 左侧版本。
     * @param right - 右侧版本。
     * @returns <0 / 0 / >0；无法解析时按 0 处理。
     */
    function compareVersions(left, right) {
      var a = parseVersion(left);
      var b = parseVersion(right);
      if (!a || !b) return 0;
      for (var index = 0; index < 3; index += 1) {
        if (a.parts[index] !== b.parts[index]) return a.parts[index] - b.parts[index];
      }
      // 没有 prerelease 的正式版高于同号 prerelease。
      if (a.pre.length === 0 && b.pre.length === 0) return 0;
      if (a.pre.length === 0) return 1;
      if (b.pre.length === 0) return -1;
      var length = Math.max(a.pre.length, b.pre.length);
      for (var preIndex = 0; preIndex < length; preIndex += 1) {
        var x = a.pre[preIndex];
        var y = b.pre[preIndex];
        if (x === undefined) return -1;
        if (y === undefined) return 1;
        var xNumber = /^\d+$/.test(x);
        var yNumber = /^\d+$/.test(y);
        if (xNumber && yNumber) {
          if (Number(x) !== Number(y)) return Number(x) - Number(y);
        } else if (xNumber !== yNumber) {
          return xNumber ? -1 : 1;
        } else if (x !== y) {
          return x < y ? -1 : 1;
        }
      }
      return 0;
    }

    /**
     * 官方「更多」注册者是否已出现。
     * @param ctx - 客户端根上下文。
     * @returns 是否找到 entry-customization。
     */
    function hasOfficialMore(ctx) {
      try {
        if (typeof ctx.slots.spec === 'function' && !ctx.slots.spec('sidebar.panellist.actions')) {
          return false;
        }
        var entries = ctx.slots.entriesOfSlot('sidebar.panellist.actions');
        for (var index = 0; index < entries.length; index += 1) {
          var options = entries[index] && entries[index].options;
          if (options && options.id === OFFICIAL_MORE_ID) return true;
        }
      } catch (error) {
        // 槽位尚未声明或读取失败时由版本号兜底。
      }
      return false;
    }

    /**
     * 判定运行环境的面板收纳来源。
     *
     * - 官方 0.2.2+：固定菜单与「更多」由官方维护，本插件只同步显示与排序；
     * - 旧版：保留插件自己的隐藏 / 二级区。
     *
     * 优先看 boot release，其次看官方 entry-customization 注册者；两者任一命中
     * 都走新版。这样开发构建缺 release 时仍能靠 API 探测降级/升级。
     * @param ctx - 客户端根上下文。
     * @returns `{ releaseVersion, officialPins }`。
     */
    function createCapabilities(ctx) {
      var release = readBootRelease();
      var officialPins = false;
      if (release && parseVersion(release.version)) officialPins = compareVersions(release.version, OFFICIAL_MORE_RELEASE) >= 0;
      if (!officialPins) officialPins = bootHasOfficialMore();
      if (!officialPins && hasOfficialMore(ctx)) officialPins = true;
      return {
        releaseVersion: release ? release.version : null,
        officialPins: officialPins,
      };
    }

    /**
     * 从官方 shell.leading 注册项里取 `setPinned` 与 `hooks.entryPins`。
     *
     * `ui-sidebar` 把 `{ setPinned, hooks.entryPins }` 放在它自己的 inject 结果里；
     * 折叠工具栏的拖动需要跨固定边界时，直接调用这个函数，不模拟点击、不维护
     * 第二套固定状态。找不到时返回 null，调用方降级为区内排序。
     * @param ctx - 客户端根上下文。
     * @returns 官方注入属性，或 null。
     */
    function resolveOfficialSidebar(ctx) {
      try {
        if (!ctx.slots || typeof ctx.slots.entries !== 'function') return null;
        var entries = ctx.slots.entries(SLOT);
        for (var index = 0; index < entries.length; index += 1) {
          var entry = entries[index];
          if (!entry) continue;
          var inject = typeof entry.inject === 'function'
            ? entry.inject
            : entry.options && typeof entry.options.inject === 'function'
              ? entry.options.inject
              : null;
          if (!inject) continue;
          var injected;
          try {
            injected = inject();
          } catch (error) {
            continue;
          }
          if (
            injected &&
            typeof injected.setPinned === 'function' &&
            injected.hooks &&
            injected.hooks.entryPins
          ) {
            return injected;
          }
        }
      } catch (error) {
        // 自定义组合可能没有官方侧栏；降级为区内排序。
      }
      return null;
    }

    /** 官方拒绝变更（例如 plugins 始终固定）时，不提交跨区排序。 */
    function setOfficialPinned(ctx, id, pinned) {
      var official = resolveOfficialSidebar(ctx);
      if (!official) return false;
      try {
        official.setPinned(id, pinned);
        var source = official.hooks.entryPins;
        if (source && typeof source.getSnapshot === 'function') {
          var unpinned = source.getSnapshot();
          if (Array.isArray(unpinned)) return (unpinned.indexOf(id) === -1) === pinned;
        }
        return true;
      } catch (error) {
        return false;
      }
    }

    /**
     * 新版折叠工具栏切分：只平铺官方固定（pinned）的面板，未固定面板与溢出项
     * 一起进「更多」。这样折叠菜单与展开侧栏看到的固定集合一致。
     * @param panels - 已按生效顺序排列的面板快照。
     * @param pinnedIds - 当前固定面板 id；`null` 表示尚未观测到，先按全部固定处理。
     * @param slots - 工具栏格数。
     * @returns `{ visible, more, pinned, unpinned }`。
     */
    function splitOfficialPanels(panels, pinnedIds, slots) {
      var limit = Number.isFinite(slots) ? slots : PANEL_SLOTS;
      var known = Array.isArray(pinnedIds);
      var pinnedSet = Object.create(null);
      if (known) {
        for (var pinnedIndex = 0; pinnedIndex < pinnedIds.length; pinnedIndex += 1) {
          pinnedSet[pinnedIds[pinnedIndex]] = true;
        }
      }
      var pinned = [];
      var unpinned = [];
      for (var index = 0; index < panels.length; index += 1) {
        if (!known || pinnedSet[panels[index].id]) pinned.push(panels[index]);
        else unpinned.push(panels[index]);
      }
      var needsMore = pinned.length > limit || unpinned.length > 0;
      var visible = needsMore ? pinned.slice(0, Math.max(0, limit - 1)) : pinned;
      var visibleSet = Object.create(null);
      for (var visibleIndex = 0; visibleIndex < visible.length; visibleIndex += 1) {
        visibleSet[visible[visibleIndex].id] = true;
      }
      var more = [];
      for (var scan = 0; scan < panels.length; scan += 1) {
        if (!visibleSet[panels[scan].id]) more.push(panels[scan]);
      }
      return { visible: visible, more: more, pinned: pinned, unpinned: unpinned };
    }

    /**
     * 用新的分组顺序替换完整顺序里同一组的位置，组外项保持原位置。
     * @param allOrder - 完整顺序。
     * @param bucketIds - 被重排的分组 id。
     * @param bucketOrder - 分组的新顺序。
     * @returns 新完整顺序；长度对不上时原样返回。
     */
    function replaceBucketOrder(allOrder, bucketIds, bucketOrder) {
      var bucketSet = Object.create(null);
      for (var index = 0; index < bucketIds.length; index += 1) bucketSet[bucketIds[index]] = true;
      var next = [];
      var cursor = 0;
      for (var scan = 0; scan < allOrder.length; scan += 1) {
        var id = allOrder[scan];
        if (!bucketSet[id]) {
          next.push(id);
          continue;
        }
        if (cursor >= bucketOrder.length) return allOrder.slice();
        next.push(bucketOrder[cursor]);
        cursor += 1;
      }
      return cursor === bucketOrder.length ? next : allOrder.slice();
    }

    /**
     * 在某个分组内移动一项并写回完整顺序。展开侧栏、折叠工具栏和「更多」
     * 浮层都通过它提交，避免各自维护一套顺序。
     * @param store - 布局 store。
     * @param panels - 面板快照。
     * @param bucketIds - 参与本次排序的分组 id。
     * @param id - 被拖拽的 id。
     * @param index - 目标下标（移除被拖项后的序列）。
     * @returns 是否提交。
     */
    function reorderBucket(store, panels, bucketIds, id, index) {
      var all = panelIdsOf(panelsInOrder(panels, store.getSnapshot().order));
      var bucket = [];
      for (var indexScan = 0; indexScan < all.length; indexScan += 1) {
        if (bucketIds.indexOf(all[indexScan]) !== -1) bucket.push(all[indexScan]);
      }
      if (bucket.indexOf(id) === -1) return false;
      var moved = moveVisibleOrder(bucket, id, index);
      var next = replaceBucketOrder(all, bucket, moved);
      store.setOrder(next);
      return true;
    }

    /**
     * 计算一次跨区落点要修改的 pin 意图与目标分组。
     *
     * `pinnedSet === null` 表示固定状态未知，先按全部固定处理。返回的 bucket
     * 可以直接交给 `reorderBucket`。
     * @param allIds - 完整顺序。
     * @param pinnedSet - 当前固定集合，或 null。
     * @param draggedId - 被拖拽的面板 id。
     * @param destinationPinned - 目标区是否固定。
     * @returns `{ bucket, pinChange, currentPinned }`。
     */
    function officialDropPlan(allIds, pinnedSet, draggedId, destinationPinned) {
      var currentPinned = pinnedSet === null ? true : pinnedSet[draggedId] === true;
      var bucket = [];
      for (var scan = 0; scan < allIds.length; scan += 1) {
        var id = allIds[scan];
        var pinnedFor = id === draggedId
          ? destinationPinned
          : pinnedSet === null
            ? true
            : pinnedSet[id] === true;
        if (pinnedFor === destinationPinned) bucket.push(id);
      }
      return {
        bucket: bucket,
        pinChange: currentPinned !== destinationPinned,
        currentPinned: currentPinned,
      };
    }

    /**
     * 官方固定状态的小型 observable store。
     *
     * `pinned === null` 表示尚未观测到（折叠工具栏先按全部显示）；
     * 观测到之后，`pinned` 是当前固定的 id 数组。
     * @returns `{ observable, getPinned, setPinned, setFromEntries }`。
     */

    /* ── src/07-pins.js — Official pinned-state store ── */
    function createPinsStore() {
      var snapshot = { pinned: null };
      var listeners = [];
      var notify = function () {
        var current = listeners.slice();
        for (var index = 0; index < current.length; index += 1) current[index]();
      };
      var same = function (left, right) {
        if (left === right) return true;
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
        for (var index = 0; index < left.length; index += 1) {
          if (left[index] !== right[index]) return false;
        }
        return true;
      };
      var setPinned = function (ids) {
        if (!Array.isArray(ids)) return;
        var clean = [];
        var seen = Object.create(null);
        for (var index = 0; index < ids.length; index += 1) {
          var id = ids[index];
          if (typeof id !== 'string' || id.length === 0 || seen[id]) continue;
          seen[id] = true;
          clean.push(id);
        }
        if (same(snapshot.pinned, clean)) return;
        snapshot = { pinned: clean };
        notify();
      };
      return {
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
        getPinned: function () {
          return snapshot.pinned;
        },
        setPinned: setPinned,
        /**
         * 用官方「更多」的 entries（权威固定状态）回写。
         * @param entries - `{ id, pinned }[]`。
         * @param allPanels - 全部面板快照。
         */
        setFromEntries: function (entries, allPanels) {
          if (!Array.isArray(entries) || !Array.isArray(allPanels)) return;
          var unpinned = Object.create(null);
          for (var index = 0; index < entries.length; index += 1) {
            if (entries[index] && entries[index].pinned === false) unpinned[entries[index].id] = true;
          }
          var pinned = [];
          for (var scan = 0; scan < allPanels.length; scan += 1) {
            if (!unpinned[allPanels[scan].id]) pinned.push(allPanels[scan].id);
          }
          setPinned(pinned);
        },
        /**
         * 用宿主 nav 里实际渲染的行回写；行不存在即未固定。
         * @param allPanels - 全部面板快照。
         * @param seenIds - nav 中实际渲染的 id。
         */
        setFromDom: function (allPanels, seenIds) {
          if (!Array.isArray(allPanels) || !Array.isArray(seenIds) || seenIds.length === 0) return;
          var seen = Object.create(null);
          for (var index = 0; index < seenIds.length; index += 1) seen[seenIds[index]] = true;
          var pinned = [];
          for (var scan = 0; scan < allPanels.length; scan += 1) {
            if (seen[allPanels[scan].id]) pinned.push(allPanels[scan].id);
          }
          setPinned(pinned);
        },
      };
    }

    /* ── src/08-dom.js — Host row/nav helpers and pinned-state observer ── */
    /**
     * 从事件目标向上找最近的带某个属性的元素（含自身）。
     * @param node - 事件目标。
     * @param attribute - 属性名。
     * @returns 命中的元素，或 null。
     */
    function closestMarked(node, attribute) {
      return node && typeof node.closest === 'function' ? node.closest('[' + attribute + ']') : null;
    }

    /** 只匹配宿主 nav 内的面板按钮，排除复用影子图标的所有自绘入口。 */
    function hostPanelRow(marker) {
      var row = marker && marker.closest ? marker.closest('button') : null;
      var nav = row && row.closest ? row.closest('nav') : null;
      if (!row || !nav) return null;
      if (row.closest('[' + TRAY_ATTR + '],[' + TRAY_ID_ATTR + '],[data-fold-minimal="rail"],[role="menu"]')) return null;
      // 0.2.2 起 PanelRow 多了一层行容器（承载 pin 按钮），按钮不再是 nav 的
      // 直接子元素；向上找到 nav 的直接子元素来确认这是主列表行。
      var item = row;
      while (item.parentElement && item.parentElement !== nav) item = item.parentElement;
      return item.parentElement === nav ? row : null;
    }

    /** 宿主 nav 里的整行容器（可能是按钮，也可能是包住按钮的 `.panelEntry`）。 */
    function hostPanelRowItem(marker) {
      var row = hostPanelRow(marker);
      if (!row) return null;
      var nav = row.closest('nav');
      var item = row;
      while (item.parentElement && item.parentElement !== nav) item = item.parentElement;
      return item.parentElement === nav ? item : null;
    }

    /** 侧栏根节点：`[data-sidebar-toggle]` 所在的标题条父级。 */
    function sidebarRootElement() {
      if (typeof document === 'undefined') return null;
      var toggle = document.querySelector('[data-sidebar-toggle]');
      var strip = toggle && toggle.closest ? toggle.closest('[data-window-drag]') : null;
      return strip ? strip.parentElement : null;
    }

    /** 侧栏根节点里的面板 nav（优先直接子元素，其次在子树内查找）。 */
    function sidebarNavElement(root) {
      var scope = root || sidebarRootElement();
      if (!scope) return null;
      for (var index = 0; index < scope.children.length; index += 1) {
        if (scope.children[index].tagName === 'NAV') return scope.children[index];
      }
      // 0.2.2 起面板 nav 位于 scrollRegion/scrollArea 内部，不再是根节点的直接子元素。
      return typeof scope.querySelector === 'function' ? scope.querySelector('nav') : null;
    }

    /**
     * 没有影子标记时，用宿主行按钮的 aria-label 反推固定项。
     *
     * 拖拽排序关闭时不会注册影子，但 nav 里仍然只渲染固定项；按面板顺序
     * 与行顺序做一次顺序匹配，能覆盖官方固定/取消固定后的集合变化。
     * @param nav - 宿主面板 nav。
     * @param panels - 当前面板快照（按顺序）。
     * @returns 固定 id 数组；无法可靠匹配时返回 null。
     */
    function pinnedIdsFromLabels(nav, panels) {
      if (!nav || !Array.isArray(panels)) return null;
      var rows = [];
      var hasMore = false;
      for (var index = 0; index < nav.children.length; index += 1) {
        var item = nav.children[index];
        var button = null;
        if (item.tagName === 'BUTTON') button = item;
        else if (typeof item.querySelector === 'function') button = item.querySelector('button[aria-label]');
        if (!button) continue;
        if (button.getAttribute('aria-haspopup') === 'menu') { hasMore = true; continue; }
        var label = button.getAttribute('aria-label');
        if (typeof label !== 'string' || label.length === 0) continue;
        rows.push(label);
      }
      if (rows.length === 0) return hasMore ? [] : null;
      var pinned = [];
      var cursor = 0;
      for (var panelIndex = 0; panelIndex < panels.length && cursor < rows.length; panelIndex += 1) {
        if (panels[panelIndex].label === rows[cursor]) {
          pinned.push(panels[panelIndex].id);
          cursor += 1;
        }
      }
      // 只有把当前渲染的固定行全部对上才采用；否则保持上一次状态。
      return cursor === rows.length ? pinned : null;
    }

    /**
     * 观测宿主 nav 的固定集合，与组件生命周期解耦。
     *
     * `SidebarChrome` 是无渲染组件，但在某些布局下可能晚挂载/重挂载；固定状态用
     * 独立的 plugin effect 观察更可靠。优先订阅官方 entryPins（快照为未固定 id），
     * 不依赖侧栏是否挂载、标签是否重名；缺少该能力时才回退 DOM 观测。
     * @param pinStore - 固定状态 store。
     * @param panelsSource - 面板 observable source。
     * @returns 清理函数。
     */
    function installPinnedObserver(pinStore, panelsSource, ctx) {
      var official = ctx ? resolveOfficialSidebar(ctx) : null;
      var source = official && official.hooks.entryPins;
      if (source && typeof source.getSnapshot === 'function' && typeof source.subscribe === 'function') {
        var sync = function () {
          var unpinned = source.getSnapshot();
          if (!Array.isArray(unpinned)) return;
          var panels = panelsSource.getSnapshot();
          pinStore.setPinned(panelIdsOf(panels).filter(function (id) {
            return unpinned.indexOf(id) === -1;
          }));
        };
        var offPins = source.subscribe(sync);
        var offPanels = panelsSource.subscribe(sync);
        sync();
        return function () { offPanels(); offPins(); };
      }
      if (typeof document === 'undefined') return undefined;
      var observer = null;
      var frame = null;
      var scheduled = false;
      var read = function () {
        scheduled = false;
        frame = null;
        var nav = sidebarNavElement();
        if (!nav) return;
        var panels = panelsSource.getSnapshot();
        var fromLabels = pinnedIdsFromLabels(nav, panels);
        if (fromLabels) {
          pinStore.setPinned(fromLabels);
          return;
        }
        // 排序开启时影子包装会给出更精确的固定行；标签匹配失败时兜底。
        var markers = nav.querySelectorAll('[' + MARKER_ATTR + ']');
        var seen = [];
        for (var index = 0; index < markers.length; index += 1) {
          var id = markers[index].getAttribute(MARKER_ATTR);
          if (id && seen.indexOf(id) === -1 && hostPanelRow(markers[index])) seen.push(id);
        }
        if (seen.length > 0) pinStore.setFromDom(panels, seen);
      };
      var schedule = function () {
        if (scheduled) return;
        scheduled = true;
        if (typeof requestAnimationFrame === 'function') {
          frame = requestAnimationFrame(read);
        } else {
          frame = setTimeout(read, 0);
        }
      };
      if (typeof MutationObserver === 'function') {
        observer = new MutationObserver(schedule);
        // 兼容路径需要观测侧栏根节点自身被替换的情况。
        observer.observe(document.documentElement, {
          childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', MARKER_ATTR],
        });
      }
      var offPanelsFallback = panelsSource.subscribe(schedule);
      schedule();
      return function () {
        offPanelsFallback();
        if (observer) observer.disconnect();
        if (frame !== null) {
          if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
          else clearTimeout(frame);
        }
      };
    }

    /* ── src/09-data.js — Panel observable source and React subscription helper ── */
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
     * @param selector - 返回可稳定比较的选中值。
     * @returns 选中的快照字段。
     */
    function useObservedSnapshot(store, selector) {
      var read = function () { return selector(store.getSnapshot()); };
      if (typeof React.useSyncExternalStore === 'function') {
        return React.useSyncExternalStore(store.subscribe, read);
      }
      if (typeof React.useState === 'function' && typeof React.useEffect === 'function') {
        var pair = React.useState(read);
        React.useEffect(function () {
          return store.subscribe(function () {
            pair[1](read());
          });
        }, [store, selector]);
        return pair[0];
      }
      return read();
    }

    /* ── src/10-shadow.js — Shadow registration for ordering and row markers ── */
    /**
     * 生成一个面板的「影子组件」。
     *
     * 宿主 PanelRow 把 panellist 条目渲染在行图标里；影子注册沿用原组件，
     * 外面包一层 `data-dfm-id` 的 display:contents 包装。包装负责两件事：
     *  - 把用户收起的面板的宿主行设成 display:none（不占 Tab 序、不改宿主 pin）；
     *  - 给拖拽事件委托提供稳定的 id 锚点。
     * @param id - 面板 id。
     * @param Icon - 原插件注册的图标组件。
     * @param store - 排序状态 store。
     * @returns 包装组件。
     */
    function createShadowPanel(id, Icon, store, hideEnabled) {
      var selectHidden = function (snapshot) {
        return hideEnabled !== false && snapshot.hidden.indexOf(id) !== -1;
      };
      function ShadowPanel(props) {
        var hidden = useObservedSnapshot(store, selectHidden);
        var markerRef = React.useRef(null);
        React.useLayoutEffect(function () {
          var marker = markerRef.current;
          // 图标也会在二级区、悬浮菜单和工具栏复用；只能隐藏宿主 nav 的主列表行。
          var row = hostPanelRow(marker);
          if (!row) return undefined;
          var item = hostPanelRowItem(marker) || row;
          row.setAttribute('data-dfm-row-id', id);
          if (hidden) item.style.display = 'none';
          return function () {
            item.style.removeProperty('display');
            if (row.getAttribute('data-dfm-row-id') === id) row.removeAttribute('data-dfm-row-id');
          };
        }, [hidden]);
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
    function createShadowManager(ctx, store, officialPins) {
      var shadows = Object.create(null);
      var syncing = false;
      var pending = false;

      var disposeShadow = function (id) {
        var record = shadows[id];
        if (!record) return;
        delete shadows[id];
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
          return null;
        }
        var winners = Object.create(null);
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
          if (!originals) return;
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
            var wrapper = reuseWrapper ? record.wrapper : createShadowPanel(id, winner.entry.component, store, !officialPins);
            if (record) disposeShadow(id);
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
              // 注册失败时保留宿主原条目，下次账本变化再尝试。
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

    /* ── src/11-icons.js — Icons and icon error boundary ── */
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

    /* ── src/12-widgets.js — Buttons, panel menu rows, collapsed More popover ── */
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
          className: 'DFM_button' + (props.active ? ' DFM_active' : '') + (props.dragging ? ' DFM_rowDragging' : ''),
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
          dragging: props.dragging,
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
          'data-dfm-rail-menu-id': props.railItem ? panel.id : undefined,
          'data-dfm-tray-id': props.trayItem ? panel.id : undefined,
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
     * 折叠工具栏的最后一格「更多」。
     *
     * 浮层通过 `react-dom` portal 到 body：折叠工具栏位于窗口标题栏的层叠上下文里，
     * 主面板（尤其插件页）的整页容器可能盖在它上面；留在原地时鼠标移动到浮层上
     * 实际命中的是主面板，`pointerleave` 会立刻触发，菜单看起来“一离开就消失”。
     * portal + fixed 定位让浮层始终在最上层，再用几何走廊连接按钮与浮层，
     * 穿过 6px 间隙时也不会误关。
     *
     * 旧版仍在此列出被收起的面板；新版这些行由官方「更多」负责，只列固定项溢出
     * 与未固定项。
     * @param props - panels（固定溢出项）/ unpinnedPanels / hiddenPanels /
     *   t / usePanelInfo / onSelect / dragActive。
     */
    function PanelOverflowMenu(props) {
      var panels = Array.isArray(props.panels) ? props.panels : [];
      var unpinnedPanels = Array.isArray(props.unpinnedPanels) ? props.unpinnedPanels : [];
      var hiddenPanels = Array.isArray(props.hiddenPanels) ? props.hiddenPanels : [];
      var openState = React.useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      var stickyState = React.useState(false);
      var sticky = stickyState[0];
      var setSticky = stickyState[1];
      var posState = React.useState({ left: 0, top: 0 });
      var pos = posState[0];
      var setPos = posState[1];
      var anchorRef = React.useRef(null);
      var menuRef = React.useRef(null);
      var timer = React.useRef(null);
      var frame = React.useRef(null);
      var tRef = React.useRef(props.t);
      tRef.current = props.t;
      var dragRef = React.useRef(props.dragActive);
      dragRef.current = props.dragActive;
      var stickyRef = React.useRef(sticky);
      stickyRef.current = sticky;

      var cancel = function () {
        if (timer.current !== null) {
          clearTimeout(timer.current);
          timer.current = null;
        }
        if (frame.current !== null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(frame.current);
          frame.current = null;
        }
      };
      var schedule = function (next, delay) {
        cancel();
        timer.current = setTimeout(function () {
          timer.current = null;
          setOpen(next);
          if (!next) setSticky(false);
        }, delay);
      };
      var close = function () {
        cancel();
        setOpen(false);
        setSticky(false);
      };
      var place = function () {
        var anchor = anchorRef.current;
        if (!anchor || typeof anchor.getBoundingClientRect !== 'function') return;
        var rect = anchor.getBoundingClientRect();
        var width = window.innerWidth || 0;
        var left = Math.max(8, Math.min(rect.left, width - 220));
        var menu = menuRef.current;
        if (menu && typeof menu.getBoundingClientRect === 'function') {
          var menuRect = menu.getBoundingClientRect();
          left = Math.max(8, Math.min(left, width - menuRect.width - 8));
        }
        var next = { left: left, top: rect.bottom + 6 };
        if (pos.left === next.left && pos.top === next.top) return;
        setPos(next);
      };
      var measureSoon = function () {
        if (frame.current !== null) return;
        if (typeof requestAnimationFrame !== 'function') {
          place();
          return;
        }
        frame.current = requestAnimationFrame(function () {
          frame.current = null;
          place();
        });
      };
      var openHover = function () {
        if (dragRef.current) return;
        cancel();
        timer.current = setTimeout(function () {
          timer.current = null;
          place();
          setOpen(true);
          setSticky(false);
        }, MENU_OPEN_DELAY);
      };
      var leaveHover = function () {
        if (stickyRef.current) return;
        schedule(false, MENU_CLOSE_DELAY);
      };
      var ownsPoint = function (x, y) {
        var anchor = anchorRef.current;
        var menu = menuRef.current;
        if (!anchor) return false;
        return hoverBridgeContains(
          x,
          y,
          anchor.getBoundingClientRect(),
          menu && typeof menu.getBoundingClientRect === 'function' ? menu.getBoundingClientRect() : null,
        );
      };

      React.useEffect(function () {
        return cancel;
      }, []);
      React.useLayoutEffect(function () {
        if (props.dragActive) close();
      }, [props.dragActive]);
      React.useLayoutEffect(function () {
        if (!open) return undefined;
        place();
        // 展开后菜单首次挂载，再按实际宽度钳一次。
        measureSoon();
        return undefined;
      }, [open]);

      React.useEffect(function () {
        if (!open || typeof document === 'undefined') return undefined;
        var onMove = function (event) {
          if (ownsPoint(event.clientX, event.clientY)) cancel();
          else if (!stickyRef.current) schedule(false, MENU_CLOSE_DELAY);
        };
        var onDown = function (event) {
          var target = event.target;
          var anchor = anchorRef.current;
          var menu = menuRef.current;
          if (anchor && anchor.contains(target)) return;
          if (menu && menu.contains(target)) return;
          close();
        };
        var onKey = function (event) {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          close();
        };
        var onViewport = function () {
          if (menuRef.current) place();
          else close();
        };
        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('scroll', onViewport, true);
        window.addEventListener('resize', onViewport);
        window.addEventListener('blur', close);
        return function () {
          document.removeEventListener('pointermove', onMove, true);
          document.removeEventListener('pointerdown', onDown, true);
          document.removeEventListener('keydown', onKey, true);
          document.removeEventListener('scroll', onViewport, true);
          window.removeEventListener('resize', onViewport);
          window.removeEventListener('blur', close);
        };
      }, [open]);

      var active = props.usePanelInfo(function (info) {
        for (var index = 0; index < panels.length; index += 1) {
          if (panels[index].id === info.activePanelId) return true;
        }
        for (var hiddenIndex = 0; hiddenIndex < hiddenPanels.length; hiddenIndex += 1) {
          if (hiddenPanels[hiddenIndex].id === info.activePanelId) return true;
        }
        for (var unpinnedIndex = 0; unpinnedIndex < unpinnedPanels.length; unpinnedIndex += 1) {
          if (unpinnedPanels[unpinnedIndex].id === info.activePanelId) return true;
        }
        return false;
      });
      var menuItem = function (panel) {
        return h(PanelMenuItem, {
          key: 'panel:' + panel.id,
          panel: panel,
          railItem: true,
          usePanelInfo: props.usePanelInfo,
          onSelect: function (selected) {
            close();
            props.onSelect(selected);
          },
        });
      };
      var rows = panels.map(menuItem);
      if (unpinnedPanels.length > 0) {
        if (rows.length > 0) rows.push(h('div', {
          key: 'fold-minimal:unpinned-divider', className: 'DFM_menuDivider', role: 'separator',
        }));
        rows.push(h('div', {
          key: 'fold-minimal:unpinned-label', className: 'DFM_menuGroup',
        }, props.t('panels.unpinned')));
        for (var unpinnedIndex = 0; unpinnedIndex < unpinnedPanels.length; unpinnedIndex += 1) {
          rows.push(menuItem(unpinnedPanels[unpinnedIndex]));
        }
      }
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
          rows.push(menuItem(hiddenPanels[hiddenIndex]));
        }
      }

      var canPortal =
        props.officialPins === true &&
        ReactDOM &&
        typeof ReactDOM.createPortal === 'function' &&
        typeof document !== 'undefined' &&
        !!document.body;
      var menuNode = h(
        'div',
        {
          ref: menuRef,
          className: 'DFM_menu',
          role: 'menu',
          'aria-label': props.t('panels.more'),
          'data-dfm-menu-portal': canPortal ? 'true' : undefined,
          style: canPortal ? { left: pos.left + 'px', top: pos.top + 'px' } : undefined,
          onPointerEnter: function () {
            cancel();
          },
          onPointerDown: function () {
            // 在浮层里按下（包括开始拖动换位）后改为粘性打开，
            // 避免拖到边缘时被 hover 关闭逻辑收走。
            setSticky(true);
          },
          onPointerLeave: function () {
            leaveHover();
          },
          onBlur: function (event) {
            var next = event.relatedTarget;
            var anchor = anchorRef.current;
            if (next && (event.currentTarget.contains(next) || (anchor && anchor.contains(next)))) return;
            close();
          },
        },
        rows,
      );
      var button = h(
        RailButton,
        {
          label: props.t('panels.more'),
          active: active,
          testId: 'more-panels',
          hideTip: true,
          hasPopup: 'menu',
          expanded: open,
          onClick: function () {
            if (props.dragActive) return;
            cancel();
            if (!open) {
              place();
              setOpen(true);
              setSticky(true);
            } else if (sticky) {
              close();
            } else {
              setSticky(true);
            }
          },
        },
        h(MorePanelsIcon, { size: ICON_SIZE }),
      );
      var anchor = h(
        'div',
        {
          className: 'DFM_more',
          ref: anchorRef,
          onPointerEnter: openHover,
          onPointerLeave: leaveHover,
          onKeyDown: function (event) {
            if (event.key !== 'Escape' || !open) return;
            event.stopPropagation();
            close();
          },
        },
        button,
        !canPortal && open && !props.dragActive ? menuNode : null,
      );
      if (!open || props.dragActive) return anchor;
      if (!canPortal) return anchor;
      return h(
        React.Fragment,
        null,
        anchor,
        ReactDOM.createPortal(menuNode, document.body),
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

    /* ── src/13-menus.js — Official More observer and hover geometry ── */
    /**
     * 指针是否在「按钮 → 浮层」的悬停走廊里。
     * 浮层 portal 到 body 后不再与按钮共享祖先，靠几何把两者连起来，
     * 防止鼠标穿过 6px 间隙时浮层被延迟关闭。
     * @param x - 指针 x。
     * @param y - 指针 y。
     * @param button - 按钮 rect。
     * @param menu - 浮层 rect。
     * @returns 是否仍在走廊内。
     */
    function hoverBridgeContains(x, y, button, menu) {
      if (!button || !menu) return false;
      var pad = 6;
      var inside = function (rect) {
        return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
      };
      if (inside(button) || inside(menu)) return true;
      var left = Math.min(button.left, menu.left);
      var right = Math.max(button.right, menu.right);
      var top = Math.min(button.bottom, menu.top);
      var bottom = Math.max(button.bottom, menu.top);
      return x >= left - pad && x <= right + pad && y >= top - pad && y <= bottom + pad;
    }

    function SidebarMoreItems(props) {
      var layout = props.useLayout(function (snapshot) { return snapshot; });
      var panels = props.usePanels(function (snapshot) { return snapshot; });
      var hidden = splitPanels(panelsInOrder(panels, layout.order), layout.hidden).hidden;
      var rows = [];
      if (layout.enabled && !layout.trayOpen && !layout.dragActive) {
        rows = hidden.map(function (panel) {
          return h(PanelMenuItem, {
            key: panel.id,
            panel: panel,
            trayItem: true,
            usePanelInfo: props.usePanelInfo,
            onSelect: function (selected) {
              if (props.onDismiss) props.onDismiss();
              openPanel(selected, props.selectPanel, props.trackEntryClick);
            },
          });
        });
        if (rows.length) rows.push(h('div', { key: 'divider', className: 'DFM_menuDivider', role: 'separator' }));
      }
      return h('div', { 'data-dfm-sidebar-menu': '', style: { display: 'contents' } }, rows);
    }

    /**
     * 新版官方「更多」菜单里的无渲染探针。
     *
     * 1. 官方 entries 是固定状态的权威来源，菜单每次渲染都把它回写到 pin store，
     *    折叠工具栏据此只显示固定项。
     * 2. 菜单里的未固定行可以原地拖动换位，提交到与展开/折叠菜单相同的 order；
     *    行由官方渲染，这里只用 `data-dfm-id` 锚点做事件委托。
     * @param props - entries / pinStore / panelsSource / layoutStore / t。
     */
    function MoreMenuObserver(props) {
      var markerRef = React.useRef(null);
      var entriesRef = React.useRef(props.entries);
      entriesRef.current = props.entries;
      var enabled = props.useLayout(function (snapshot) {
        return snapshot.enabled === true;
      });
      React.useLayoutEffect(function () {
        props.pinStore.setFromEntries(props.entries, props.panelsSource.getSnapshot());
      }, [props.entries]);
      React.useLayoutEffect(function () {
        if (!enabled) return undefined;
        var marker = markerRef.current;
        if (!marker || typeof document === 'undefined') return undefined;
        var menu = marker.closest ? marker.closest('[role="menu"]') : null;
        if (!menu) return undefined;
        return installMenuReorder(menu, MARKER_ATTR, function (id, index) {
          if (!props.layoutStore.getSnapshot().enabled) return;
          var entries = entriesRef.current || [];
          var bucket = [];
          for (var entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
            if (entries[entryIndex] && entries[entryIndex].pinned === false) bucket.push(entries[entryIndex].id);
          }
          reorderBucket(props.layoutStore, props.panelsSource.getSnapshot(), bucket, id, index);
        });
      }, [enabled]);
      return h('span', {
        ref: markerRef,
        'data-dfm-more-observer': '',
        style: { display: 'contents' },
      });
    }

    /** 用宿主按钮打开/关闭原生浮层；二级区展开或拖动时禁止浮层抢占操作。 */
    function installSidebarMoreHover(button, anchor, store) {
      if (!button || !store) return function () {};
      var timer = null;
      var toggling = false;
      var menu = null;
      function cancel() {
        if (timer !== null) clearTimeout(timer);
        timer = null;
      }
      function blocked() {
        var state = store.getSnapshot();
        return !state.enabled || state.trayOpen || state.dragActive;
      }
      function toggle() {
        toggling = true;
        try { button.click(); } finally { toggling = false; }
      }
      function close() {
        cancel();
        if (button.getAttribute('aria-expanded') === 'true') toggle();
      }
      function popup() {
        if (button.getAttribute('aria-expanded') !== 'true') { menu = null; return null; }
        if (menu && menu.isConnected) return menu;
        var marker = document.querySelector('[data-dfm-sidebar-menu]');
        menu = marker && marker.closest('[role="menu"]');
        return menu;
      }
      function owns(node) {
        var menu = popup();
        return !!node && (anchor.contains(node) || !!menu && menu.contains(node));
      }
      function enter() {
        cancel();
        if (blocked()) return;
        timer = setTimeout(function () {
          timer = null;
          if (!blocked() && button.getAttribute('aria-expanded') !== 'true') toggle();
        }, MENU_OPEN_DELAY);
      }
      function leave(event) {
        if (owns(event.relatedTarget)) return;
        cancel();
        timer = setTimeout(close, MENU_CLOSE_DELAY);
      }
      function over(event) {
        var menu = popup();
        if (menu && menu.contains(event.target)) cancel();
      }
      function out(event) {
        var menu = popup();
        if (menu && menu.contains(event.target)) leave(event);
      }
      function click(event) {
        if (toggling || !blocked()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      var off = store.subscribe(function () { if (blocked()) close(); });
      anchor.addEventListener('pointerenter', enter);
      anchor.addEventListener('pointerleave', leave);
      button.addEventListener('click', click, true);
      document.addEventListener('pointerover', over);
      document.addEventListener('pointerout', out);
      return function () {
        off();
        close();
        anchor.removeEventListener('pointerenter', enter);
        anchor.removeEventListener('pointerleave', leave);
        button.removeEventListener('click', click, true);
        document.removeEventListener('pointerover', over);
        document.removeEventListener('pointerout', out);
      };
    }

    /**
     * 在浮层里把一次指针命中解析成“包含该面板标记的整行按钮”。
     *
     * 官方「更多」把图标渲染在行按钮内部，所以按标题/空白时不能直接 closest
     * 到标记；这里先找指针所在的按钮，再检查按钮内部是否有面板标记。
     * 行内的图钉按钮是独立按钮，不包含标记，因此不会误触发整行拖动。
     * @param target - pointerdown 目标。
     * @param menu - 浮层根节点。
     * @param idAttr - 面板 id 属性名。
     * @returns `{ row, id }` 或 null。
     */
    function menuRowForTarget(target, menu, idAttr) {
      if (!target || typeof target.closest !== 'function' || !menu) return null;
      var selector = '[' + idAttr + ']';
      var button = target.closest('button');
      while (button && menu.contains(button)) {
        var marker = null;
        if (typeof button.matches === 'function' && button.matches(selector)) marker = button;
        else if (typeof button.querySelector === 'function') marker = button.querySelector(selector);
        if (marker) {
          var id = marker.getAttribute(idAttr);
          if (id) return { row: button, id: id };
        }
        var parent = button.parentElement;
        button = parent && typeof parent.closest === 'function' ? parent.closest('button') : null;
      }
      return null;
    }

    /**
     * 在任意浮层菜单里做纵向换位：浮层由宿主 portal 渲染，行也由宿主渲染，
     * 这里只按 `idAttr` 找到行、画插入线，松手后把新顺序交给调用方。
     * 官方「更多」在菜单内排序；折叠工具栏「更多」由 installRailDrag 接管。
     * @param menu - 浮层根节点。
     * @param idAttr - 行上的面板 id 属性（`data-dfm-id` / `data-dfm-rail-menu-id`）。
     * @param onReorder - `(id, index) => void`，index 为移除被拖行后的落点。
     * @returns 清理函数。
     */
    function installMenuReorder(menu, idAttr, onReorder) {
      if (!menu || typeof onReorder !== 'function') return function () {};
      var session = null;
      var indicator = createInsertionIndicator();
      var frame = null;
      var selector = '[' + idAttr + ']';

      function rowsAt() {
        var markers = menu.querySelectorAll(selector);
        var result = [];
        var seen = [];
        for (var index = 0; index < markers.length; index += 1) {
          var marker = markers[index];
          var id = marker.getAttribute(idAttr);
          if (!id) continue;
          var row = marker.closest ? marker.closest('button') : null;
          if (!row || !menu.contains(row) || seen.indexOf(row) !== -1) continue;
          var rect = row.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          seen.push(row);
          result.push({ id: id, row: row, rect: rect });
        }
        result.sort(function (left, right) {
          return left.rect.top - right.rect.top;
        });
        return result;
      }

      function targetAt(y, draggedId) {
        var rows = rowsAt();
        if (!rows.length) return null;
        var target = insertionTargetAt(rows, y, draggedId);
        return {
          index: target.index,
          lineY: target.position,
          left: rows[0].rect.left,
          width: rows[0].rect.width,
        };
      }

      function dropTargetAt(x, y, draggedId) {
        var rect = menu.getBoundingClientRect();
        if (x < rect.left - 12 || x > rect.right + 12 || y < rect.top - 12 || y > rect.bottom + 12) return null;
        return targetAt(y, draggedId);
      }

      function resetSession() {
        if (!session) return;
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', onPointerCancel, true);
        document.removeEventListener('keydown', onKeyDown, true);
        if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
        frame = null;
        if (indicator) indicator.hide();
        if (typeof document !== 'undefined') document.documentElement.removeAttribute(DRAG_ROOT_ATTR);
        if (session.row && session.row.classList) session.row.classList.remove('DFM_rowDragging');
        session = null;
      }

      function updateDrag(x, y) {
        if (!session || !session.active) return;
        var target = dropTargetAt(x, y, session.id);
        if (target && indicator) indicator.showVertical(target.left, target.width, target.lineY);
        else if (indicator) indicator.hide();
      }

      function onPointerMove(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        if (!session.active) {
          var dx = event.clientX - session.startX;
          var dy = event.clientY - session.startY;
          if (Math.abs(dx) + Math.abs(dy) < DRAG_START_DISTANCE) return;
          session.active = true;
          session.row.classList.add('DFM_rowDragging');
          document.documentElement.setAttribute(DRAG_ROOT_ATTR, '');
          if (event.cancelable) event.preventDefault();
        } else if (event.cancelable) {
          event.preventDefault();
        }
        session.x = event.clientX;
        session.y = event.clientY;
        if (frame !== null) return;
        if (typeof requestAnimationFrame === 'function') {
          frame = requestAnimationFrame(function () {
            frame = null;
            if (!session || !session.active) return;
            updateDrag(session.x, session.y);
          });
        } else {
          updateDrag(session.x, session.y);
        }
      }

      function onPointerUp(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        var drag = session;
        var target = drag.active ? dropTargetAt(event.clientX, event.clientY, drag.id) : null;
        var active = drag.active;
        resetSession();
        if (!active) return;
        suppressNextClick();
        if (target) onReorder(drag.id, target.index);
      }

      function onPointerCancel(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        resetSession();
      }

      function onKeyDown(event) {
        if (event.key !== 'Escape' || !session) return;
        event.preventDefault();
        if (session.active) suppressNextClick();
        resetSession();
      }

      function onPointerDown(event) {
        if (event.button !== 0 || session) return;
        if (document.documentElement.getAttribute('data-platform') !== 'darwin' ||
            document.documentElement.hasAttribute(DRAG_ROOT_ATTR)) return;
        var hit = menuRowForTarget(event.target, menu, idAttr);
        if (!hit) return;
        session = {
          pointerId: event.pointerId,
          id: hit.id,
          row: hit.row,
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          active: false,
        };
        document.addEventListener('pointermove', onPointerMove, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('pointercancel', onPointerCancel, true);
        document.addEventListener('keydown', onKeyDown, true);
      }

      var onBlur = function () {
        if (session) resetSession();
      };
      if (typeof window.addEventListener === 'function') window.addEventListener('blur', onBlur);
      menu.addEventListener('pointerdown', onPointerDown, true);
      return function () {
        if (typeof window.removeEventListener === 'function') window.removeEventListener('blur', onBlur);
        resetSession();
        if (indicator) indicator.dispose();
        menu.removeEventListener('pointerdown', onPointerDown, true);
      };
    }

    /* ── src/14-settings.js — Plugin detail page switches ── */
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
     * 插件详情页（`plugins.bundle.config`）里的三个组件开关：
     *  - 「折叠菜单」：原有的折叠态工具栏 / 拖拽收起，默认开；
     *  - 「返回会话按钮」：折叠态与展开态的两处返回入口，默认开；
     *  - 「面板挪位与折叠 / 面板挪位」：排序；新版收纳交给官方「更多」。
     * @param props - t / useLayout / 三个 setter / officialPins / releaseVersion。
     */
    function PluginSettingsSection(props) {
      var snapshot = props.useLayout(function (state) {
        return state;
      });
      var toolbarTitle = props.t('settings.toolbar.title');
      var backTitle = props.t('settings.back.title');
      var layoutTitle = props.t(props.officialPins ? 'layout.title.new' : 'layout.title');
      var layoutDescription = props.t(
        props.officialPins ? 'layout.description.new' : 'layout.description',
      );
      var compat = props.officialPins
        ? props.releaseVersion
          ? 'DSH ' + props.releaseVersion + ' · ' + props.t('compat.official')
          : props.t('compat.official')
        : props.t('compat.legacy');
      return h(
        'div',
        { className: 'DFM_pluginSettings' },
        h(
          'div',
          { className: 'DFM_setRow' },
          h(
            'div',
            { className: 'DFM_setText' },
            h('div', { className: 'DFM_setTitle' }, toolbarTitle),
            h('div', { className: 'DFM_setDesc' }, props.t('settings.toolbar.desc')),
          ),
          h(Switch, {
            checked: snapshot.toolbarEnabled !== false,
            label: toolbarTitle,
            onChange: function (next) {
              props.setToolbarEnabled(next);
            },
          }),
        ),
        h(
          'div',
          { className: 'DFM_setRow' },
          h(
            'div',
            { className: 'DFM_setText' },
            h('div', { className: 'DFM_setTitle' }, backTitle),
            h('div', { className: 'DFM_setDesc' }, props.t('settings.back.desc')),
          ),
          h(Switch, {
            checked: snapshot.backEnabled !== false,
            label: backTitle,
            onChange: function (next) {
              props.setBackEnabled(next);
            },
          }),
        ),
        h(
          'div',
          { className: 'DFM_setRow DFM_setRowLast' },
          h(
            'div',
            { className: 'DFM_setText' },
            h('div', { className: 'DFM_setTitle' }, layoutTitle),
            h('div', { className: 'DFM_setDesc' }, layoutDescription),
          ),
          h(Switch, {
            checked: snapshot.enabled === true,
            label: layoutTitle,
            onChange: function (next) {
              props.setLayoutEnabled(next);
            },
          }),
        ),
        h('div', { className: 'DFM_compatNote' }, compat),
      );
    }

    /** 原生「更多」浮层的前置分组，后面的宿主固定动作仍由宿主渲染。 */

    /* ── src/15-chrome.js — Expanded back button, legacy tray, SidebarChrome ── */
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
      var officialPins = props.officialPins === true;
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
      var activePanelId = props.usePanelInfo(function (info) {
        return info.activePanelId;
      });
      var panelActive = activePanelId !== null;
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

      // 1) 展开态返回按钮：仅在「侧栏展开 + 面板打开 + 返回按钮开关开启」时插入宿主顶栏。
      React.useLayoutEffect(function () {
        if (typeof document === 'undefined' || !wide || !panelActive) return undefined;
        if (layout.backEnabled === false) return undefined;
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
      }, [wide, panelActive, layout.backEnabled]);

      // 2) 「更多」行 chevron + 二级区容器：仅旧版、开关开启时出现。
      React.useLayoutEffect(function () {
        if (typeof document === 'undefined' || !wide || !layout.enabled || officialPins) return undefined;
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
        var disposeHover = null;

        var ensure = function () {
          var toggleNode = document.querySelector('[data-sidebar-toggle]');
          var stripNode =
            toggleNode && toggleNode.closest ? toggleNode.closest('[data-window-drag]') : null;
          var sidebarRoot = stripNode ? stripNode.parentElement : null;
          var nav = sidebarNavElement(sidebarRoot);
          var moreButton = nav ? nav.querySelector('button[aria-haspopup="menu"]') : null;
          var moreRow = moreButton;
          while (moreRow && moreRow.parentElement !== nav) moreRow = moreRow.parentElement;
          if (!nav || !moreRow) {
            if (disposeHover) disposeHover();
            disposeHover = null;
            if (chevron.parentNode) chevron.parentNode.removeChild(chevron);
            if (tray.parentNode) tray.parentNode.removeChild(tray);
            moreRowRef.current = null;
            return;
          }
          if (moreRowRef.current !== moreRow) {
            if (disposeHover) disposeHover();
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
            disposeHover = installSidebarMoreHover(moreButton, moreRow, props.layoutStore);
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
          if (disposeHover) disposeHover();
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
      }, [wide, layout.enabled, officialPins]);

      // 3) chevron 的朝向/文案跟随二级区展开状态。
      React.useLayoutEffect(function () {
        var chevron = chevronRef.current;
        if (!chevron) return;
        var open = layout.trayOpen === true;
        if (container) container.hidden = !open;
        chevron.setAttribute('data-open', open ? 'true' : 'false');
        chevron.setAttribute('aria-expanded', open ? 'true' : 'false');
        var label = tRef.current(open ? 'tray.collapse' : 'tray.expand');
        chevron.setAttribute('aria-label', label);
        chevron.setAttribute('title', label);
      }, [layout.trayOpen, layout.enabled, container]);

      // 4) 把二级区内容 portal 进宿主 nav 里我们创建的容器。
      if (!container || !layout.enabled || !wide || !ReactDOM || typeof ReactDOM.createPortal !== 'function') {
        return null;
      }
      var ordered = panelsInOrder(panels, layout.order);
      var hiddenSet = Object.create(null);
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

    /* ── src/16-drag-core.js — Drag geometry, ghost, insertion indicator, legacy tray placement ── */
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
     * 按仍占位的完整列表确定视觉边界，再换算成移除被拖项后的插入下标。
     * 不能先排除被拖项再平均两侧坐标，否则提示线会穿过它的原行/图标。
     * @param entries - 按视觉顺序排列的 `{ id, rect }[]`。
     * @param coordinate - 指针所在轴的坐标。
     * @param draggedId - 被拖项 id（跨区时可以不在列表里）。
     * @param horizontal - 横向图标列表；默认纵向行列表。
     * @returns `{ index, position }`，空列表返回 null。
     */
    function insertionTargetAt(entries, coordinate, draggedId, horizontal) {
      if (!entries.length) return null;
      var start = horizontal ? 'left' : 'top';
      var end = horizontal ? 'right' : 'bottom';
      var slot = 0;
      var index = 0;
      while (slot < entries.length) {
        var entry = entries[slot];
        if (coordinate <= (entry.rect[start] + entry.rect[end]) / 2) break;
        if (entry.id !== draggedId) index += 1;
        slot += 1;
      }
      var position = slot === 0
        ? entries[0].rect[start] - 2
        : slot === entries.length
          ? entries[slot - 1].rect[end] + 2
          : (entries[slot - 1].rect[end] + entries[slot].rect[start]) / 2;
      return { index: index, position: position };
    }

    /** 一次提交分组与落点，避免恢复面板时先闪回旧位置。 */
    function placePanel(store, panels, id, index, intoTray) {
      var snapshot = store.getSnapshot();
      var all = panelIdsOf(panelsInOrder(panels, snapshot.order));
      if (all.indexOf(id) === -1) return;
      var hidden = snapshot.hidden.filter(function (panelId) { return panelId !== id; });
      if (intoTray) hidden.push(id);
      var bucket = all.filter(function (panelId) { return (hidden.indexOf(panelId) !== -1) === intoTray; });
      var moved = moveVisibleOrder(bucket, id, index);
      var order = intoTray ? replaceHiddenOrder(all, hidden, moved) : replaceVisibleOrder(all, hidden, moved);
      store.setPlacement(order, hidden);
    }


    /** 指针替身在原行/浮层卸载后仍保留，直到松手或取消。 */
    function createDragGhost(row) {
      if (!document.body) return null;
      var ghost = document.createElement('div');
      ghost.className = 'DFM_dragGhost';
      ghost.setAttribute('aria-hidden', 'true');
      var glyph = row.querySelector('svg') || row.firstElementChild;
      if (glyph) ghost.appendChild(glyph.cloneNode(true));
      document.body.appendChild(ghost);
      return {
        move: function (x, y) {
          ghost.style.left = x + 12 + 'px';
          ghost.style.top = y + 12 + 'px';
        },
        dispose: function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); },
      };
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
      var ownerDocument = document;
      var handler = function (event) {
        event.preventDefault();
        event.stopPropagation();
        ownerDocument.removeEventListener('click', handler, true);
      };
      ownerDocument.addEventListener('click', handler, true);
      setTimeout(function () {
        ownerDocument.removeEventListener('click', handler, true);
      }, 0);
    }

    /**
     * 原生箭头与蓝线组成的插入提示。固定定位在 body 上，不参与布局，
     * 所以宿主行与工具栏图标都不会在拖动中跳动。
     * @returns `{ showVertical, showHorizontal, hide, dispose }`；没有 body 时返回 null。
     */
    function createInsertionIndicator() {
      if (typeof document === 'undefined' || !document.body) return null;
      var line = document.createElement('div');
      line.className = 'DFM_indicator';
      line.setAttribute('aria-hidden', 'true');
      line.style.display = 'none';
      document.body.appendChild(line);
      var show = function (axis, left, top, width, height) {
        line.setAttribute('data-axis', axis);
        line.style.left = left + 'px';
        line.style.top = top + 'px';
        line.style.width = width + 'px';
        line.style.height = height + 'px';
        line.style.display = 'block';
      };
      return {
        showVertical: function (left, width, y) {
          show('vertical', left, y - 6, width, 12);
        },
        showHorizontal: function (x, top, height) {
          // 以左上角旋转后，原图形 y=6 的蓝线仍精确落在插入点 x 上。
          show('horizontal', x + 6, top, height, 12);
        },
        hide: function () {
          line.style.display = 'none';
        },
        dispose: function () {
          if (line.parentNode) line.parentNode.removeChild(line);
        },
      };
    }

    /* ── src/17-collapse-drag.js — Drag the sidebar past its minimum width to collapse it ── */
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
      var settleFrame = null;
      var disposed = false;

      function cancelSettle() {
        if (settleFrame !== null) cancelAnimationFrame(settleFrame);
        settleFrame = null;
      }

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
        if (disposed || !drag.handle.isConnected) return;
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
          settleFrame = requestAnimationFrame(function () {
            settleFrame = null;
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
        cancelSettle();
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

      var onBlur = function () { cancelSettle(); cleanup(); };
      if (typeof window.addEventListener === 'function') window.addEventListener('blur', onBlur);
      document.addEventListener('pointerdown', onPointerDown);
      return function () {
        disposed = true;
        cancelSettle();
        cleanup();
        if (typeof window.removeEventListener === 'function') window.removeEventListener('blur', onBlur);
        document.removeEventListener('pointerdown', onPointerDown);
      };
    }

    /* ── src/18-panel-drag.js — Expanded sidebar row reordering and legacy tray drop ── */
    /**
     * 展开侧栏的拖拽换位：按下后移动超过约 4px 立即进入拖拽（不再长按等待），
     * 拖动期间列表保持不动，只用一条蓝色插入线提示落点，松手才写 store。
     * 拖到「更多」行或二级区上松手 = 收起；二级区里的行拖回主区 = 恢复；
     * 二级区内上下拖 = 调整收起项顺序。
     * @param store - 排序状态 store。
     * @param panelsSource - 当前面板快照（提供生效顺序）。
     * @returns 清理函数。
     */
    function installPanelDrag(store, panelsSource, officialPins) {
      if (typeof document === 'undefined') return undefined;
      var session = null;
      var indicator = createInsertionIndicator();
      var frame = null;

      function platformOk() {
        var root = document.documentElement;
        return !!root && root.getAttribute('data-platform') === 'darwin';
      }

      function hiddenIds() {
        return officialPins ? [] : store.getSnapshot().hidden;
      }

      function hiddenSetOf(ids) {
        var set = Object.create(null);
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
          var row = hostPanelRow(marker);
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

      function rectOf(element) {
        return element ? element.getBoundingClientRect() : null;
      }

      function overElement(element, x, y) {
        var rect = rectOf(element);
        return rect ? rectContains(rect, x, y) : false;
      }

      function setTrayHighlight(on) {
        var tray = trayElement();
        if (!tray) return;
        if (on) tray.setAttribute(DROP_ATTR, 'true');
        else tray.removeAttribute(DROP_ATTR);
      }

      function setMoreHighlight(on) {
        var more = moreRowElement();
        if (!more) return;
        if (on) more.setAttribute(DROP_ATTR, 'true');
        else more.removeAttribute(DROP_ATTR);
      }

      function clearHighlights() {
        setTrayHighlight(false);
        setMoreHighlight(false);
        if (indicator) indicator.hide();
      }

      /** 主区插入点：index 是「去掉被拖行后」序列里的落点，lineY 是蓝线位置。 */
      function mainTargetAt(y, draggedId) {
        var markers = mainMarkers();
        if (!markers.length) {
          var moreRect = rectOf(moreRowElement());
          return moreRect ? { index: 0, lineY: moreRect.top - 2, left: moreRect.left, width: moreRect.width } : null;
        }
        var target = insertionTargetAt(markers, y, draggedId);
        return {
          index: target.index,
          lineY: target.position,
          left: markers[0].rect.left,
          width: markers[0].rect.width,
        };
      }

      /** 二级区插入点。 */
      function trayTargetAt(y, draggedId) {
        var rows = trayRows();
        if (!rows.length) return null;
        var target = insertionTargetAt(rows, y, draggedId);
        return {
          index: target.index,
          lineY: target.position,
          left: rows[0].rect.left,
          width: rows[0].rect.width,
        };
      }

      /** 指针是否落在面板列表的主区（含行间空隙；全收起时以「更多」为下界）。 */
      function overMainZone(x, y) {
        var markers = mainMarkers();
        if (markers.length > 0) {
          return (
            x >= markers[0].rect.left && x < markers[0].rect.right &&
            y >= markers[0].rect.top - 18 && y <= markers[markers.length - 1].rect.bottom + 18
          );
        }
        var more = moreRowElement();
        var moreRect = rectOf(more);
        return !!moreRect && x >= moreRect.left && x < moreRect.right && y >= moreRect.top - 36 && y < moreRect.top;
      }

      function resetSession() {
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', onPointerCancel, true);
        document.removeEventListener('keydown', onKeyDown, true);
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        clearHighlights();
        if (typeof document !== 'undefined') {
          document.documentElement.removeAttribute(DRAG_ROOT_ATTR);
        }
        if (session && session.row && session.row.classList) {
          session.row.classList.remove('DFM_rowDragging');
        }
        session = null;
        store.setDragActive(false);
      }

      function updateDrag(x, y) {
        if (!session) return;
        // 新版没有插件自己的隐藏区：只在固定面板行之间画插入线，
        // 拖到官方「更多」行不触发「收起」，收纳由官方菜单负责。
        if (officialPins) {
          clearHighlights();
          if (overMainZone(x, y)) {
            var officialTarget = mainTargetAt(y, session.id);
            if (officialTarget && indicator) {
              indicator.showVertical(officialTarget.left, officialTarget.width, officialTarget.lineY);
            }
          }
          return;
        }
        var snapshot = store.getSnapshot();
        var tray = trayElement();
        var overTray = overElement(tray, x, y);
        var more = moreRowElement();
        var overMore = overElement(more, x, y);
        clearHighlights();

        if (session.fromTray) {
          if (overTray) {
            var trayTarget = trayTargetAt(y, session.id);
            if (trayTarget && indicator) {
              indicator.showVertical(trayTarget.left, trayTarget.width, trayTarget.lineY);
            }
            return;
          }
          if (overMainZone(x, y)) {
            var restoreTarget = mainTargetAt(y, session.id);
            if (restoreTarget && indicator) {
              indicator.showVertical(restoreTarget.left, restoreTarget.width, restoreTarget.lineY);
            }
          }
          return;
        }

        // 拖到「更多」行或已展开的二级区上：提示松手会收起。
        if (overTray) {
          setTrayHighlight(true);
          var insertTarget = trayTargetAt(y, session.id);
          if (insertTarget && indicator) indicator.showVertical(insertTarget.left, insertTarget.width, insertTarget.lineY);
          return;
        }
        if (overMore) {
          setMoreHighlight(true);
          setTrayHighlight(true);
          if (!snapshot.trayOpen) store.setTrayOpen(true);
          return;
        }
        // 靠近「更多」时自动展开二级区；这里只在指针仍在主区内时画插入线。
        if (!snapshot.trayOpen && overMainZone(x, y)) {
          var moreRect = rectOf(more);
          if (moreRect && y > moreRect.top - 44) store.setTrayOpen(true);
        }
        if (overMainZone(x, y)) {
          var target = mainTargetAt(y, session.id);
          if (target && indicator) {
            indicator.showVertical(target.left, target.width, target.lineY);
          }
        }
      }

      function onPointerMove(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        if (!session.active) {
          var dx = event.clientX - session.startX;
          var dy = event.clientY - session.startY;
          if (Math.abs(dx) + Math.abs(dy) < DRAG_START_DISTANCE) return;
          session.active = true;
          store.setDragActive(true, session.id);
          document.documentElement.setAttribute(DRAG_ROOT_ATTR, '');
          if (session.row && session.row.classList) session.row.classList.add('DFM_rowDragging');
          if (event.cancelable) event.preventDefault();
        } else if (event.cancelable) {
          event.preventDefault();
        }
        session.x = event.clientX;
        session.y = event.clientY;
        if (frame !== null) return;
        if (typeof requestAnimationFrame === 'function') {
          frame = requestAnimationFrame(function () {
            frame = null;
            if (!session || !session.active) return;
            updateDrag(session.x, session.y);
          });
        } else {
          updateDrag(session.x, session.y);
        }
      }

      function onPointerUp(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        var drag = session;
        var x = event.clientX;
        var y = event.clientY;
        var active = drag.active;
        if (officialPins) {
          var bucket = mainMarkers().map(function (entry) { return entry.id; });
          var officialTarget = overMainZone(x, y) ? mainTargetAt(y, drag.id) : null;
          resetSession();
          if (!active) return;
          suppressNextClick();
          if (officialTarget) {
            reorderBucket(store, panelsSource.getSnapshot(), bucket, drag.id, officialTarget.index);
          }
          return;
        }
        var overTray = overElement(trayElement(), x, y);
        var overMore = overElement(moreRowElement(), x, y);
        resetSession();
        if (!active) return;
        suppressNextClick();
        if (drag.fromTray) {
          if (overTray) {
            var trayTarget = trayTargetAt(y, drag.id);
            if (trayTarget) placePanel(store, panelsSource.getSnapshot(), drag.id, trayTarget.index, true);
          } else if (overMainZone(x, y)) {
            var restoreTarget = mainTargetAt(y, drag.id);
            // 全部面板都收起时主区没有行可参考，恢复到可见列表第 0 位。
            placePanel(store, panelsSource.getSnapshot(), drag.id, restoreTarget ? restoreTarget.index : 0, false);
          }
          return;
        }
        if (overTray || overMore) {
          var insert = trayTargetAt(y, drag.id);
          var hiddenCount = splitPanels(panelsSource.getSnapshot(), hiddenIds()).hidden.length;
          placePanel(store, panelsSource.getSnapshot(), drag.id, insert ? insert.index : hiddenCount, true);
          // 保证松手后二级区展开，用户马上能看到拖进去的项。
          store.setTrayOpen(true);
          return;
        }
        if (overMainZone(x, y)) {
          var target = mainTargetAt(y, drag.id);
          if (target) placePanel(store, panelsSource.getSnapshot(), drag.id, target.index, false);
        }
      }

      function onPointerCancel(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        resetSession();
      }

      function onKeyDown(event) {
        if (event.key !== 'Escape' || !session) return;
        event.preventDefault();
        if (session.active) suppressNextClick();
        resetSession();
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
        // 图标外层有 data-dfm-id 包装；整行其他地方用影子组件给宿主行打的
        // data-dfm-row-id 兜底，这样点行内任意位置（标题、空白）都能拖。
        var hostRow = trayRow || marker ? null : target.closest('[data-dfm-row-id]');
        if (!trayRow && !marker && !hostRow) return;
        var row = trayRow || (marker ? marker.closest('button') : hostRow);
        if (!row || (!trayRow && row !== hostPanelRow(marker || row))) return;
        // 点行内的固定/取消固定按钮时不要启动整行拖拽。
        var hitButton = target.closest('button');
        if (hitButton && !trayRow && hitButton !== row) return;
        var id = trayRow
          ? row.getAttribute(TRAY_ID_ATTR)
          : marker
            ? marker.getAttribute(MARKER_ATTR)
            : row.getAttribute('data-dfm-row-id');
        if (!id) return;
        session = {
          pointerId: event.pointerId,
          id: id,
          row: row,
          fromTray: trayRow !== null,
          startX: event.clientX,
          startY: event.clientY,
          active: false,
        };
        document.addEventListener('pointermove', onPointerMove, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('pointercancel', onPointerCancel, true);
        document.addEventListener('keydown', onKeyDown, true);
      }

      var offStore = store.subscribe(function () {
        if (session && !store.getSnapshot().enabled) resetSession();
      });
      var onBlur = function () { if (session) resetSession(); };
      if (typeof window.addEventListener === 'function') window.addEventListener('blur', onBlur);
      document.addEventListener('pointerdown', onPointerDown, true);
      return function () {
        offStore();
        if (typeof window.removeEventListener === 'function') window.removeEventListener('blur', onBlur);
        resetSession();
        if (indicator) indicator.dispose();
        document.removeEventListener('pointerdown', onPointerDown, true);
      };
    }

    /* ── src/19-rail-drag.js — Collapsed toolbar drag, ghost, pin/unpin crossing ── */
    /* ───────────── 折叠工具栏：拖拽排序（与展开侧栏同序）───────────── */

    /**
     * 折叠工具栏上的拖拽换位：移动超过约 4px 立即进入换位，拖动时图标不跳动，
     * 用一条蓝色竖线提示落点，松手才写回同一份顺序。
     * @param store - 排序状态 store。
     * @param panelsSource - 当前面板快照。
     * @returns 清理函数。
     */
    function installRailDrag(store, panelsSource, options) {
      if (typeof document === 'undefined') return undefined;
      if (typeof options === 'boolean') options = { officialPins: options };
      options = options || {};
      var officialPins = options.officialPins === true;
      var pins = options.pins || null;
      var setPinned = typeof options.setPinned === 'function' ? options.setPinned : null;
      var session = null;
      var indicator = createInsertionIndicator();
      var frame = null;

      function platformOk() {
        var root = document.documentElement;
        return !!root && root.getAttribute('data-platform') === 'darwin';
      }

      function railElement() {
        return document.querySelector('[data-fold-minimal="rail"]');
      }

      function pinSet() {
        if (!pins || typeof pins.getPinned !== 'function') return null;
        var ids = pins.getPinned();
        if (!Array.isArray(ids)) return null;
        var set = Object.create(null);
        for (var index = 0; index < ids.length; index += 1) set[ids[index]] = true;
        return set;
      }

      function isPinnedId(id, set) {
        return set === null ? true : set[id] === true;
      }

      function zoneContains(rect, x, y, pad) {
        var gap = Number.isFinite(pad) ? pad : 6;
        return x >= rect.left - gap && x <= rect.right + gap &&
          y >= rect.top - 12 && y <= rect.bottom + 12;
      }

      function officialTargetAt(x, y, id) {
        var rail = railElement();
        if (!rail) return null;
        var pinnedZone = rail.querySelector('[data-dfm-rail-zone="pinned"]');
        var unpinnedZone = rail.querySelector('[data-dfm-rail-zone="unpinned"]');
        if (!pinnedZone || !unpinnedZone) return null;
        var pinnedRect = pinnedZone.getBoundingClientRect();
        var unpinnedRect = unpinnedZone.getBoundingClientRect();
        var intoPinned = null;
        if (zoneContains(pinnedRect, x, y, 6)) intoPinned = true;
        else if (zoneContains(unpinnedRect, x, y, 6)) intoPinned = false;
        if (intoPinned === null) return null;
        var target = targetAt(x, id, intoPinned ? pinnedZone : unpinnedZone);
        target.intoPinned = intoPinned;
        return target;
      }

      function railButtons(zone) {
        var nodes = zone.querySelectorAll('[data-fold-minimal="panel"][data-panel-id]');
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

      function targetAt(x, draggedId, zone) {
        var buttons = railButtons(zone);
        var zoneRect = zone.getBoundingClientRect();
        if (!buttons.length) return {
          index: 0, lineX: zoneRect.right - 4, top: zoneRect.top - 2, height: zoneRect.height + 4,
        };
        var target = insertionTargetAt(buttons, x, draggedId, true);
        var first = buttons[0].rect;
        return {
          index: target.index,
          lineX: target.position,
          top: first.top - 2,
          height: first.height + 4,
        };
      }

      function resetSession() {
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', onPointerCancel, true);
        document.removeEventListener('keydown', onKeyDown, true);
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        if (indicator) indicator.hide();
        document.documentElement.removeAttribute(DRAG_ROOT_ATTR);
        if (session && session.row && session.row.classList) {
          session.row.classList.remove('DFM_rowDragging');
        }
        if (session && session.ghost) session.ghost.dispose();
        session = null;
        store.setDragActive(false);
      }

      function updateDrag() {
        if (!session || !session.active) return;
        if (session.ghost) session.ghost.move(session.x, session.y);
        var target = officialPins
          ? officialTargetAt(session.x, session.y, session.id)
          : dropTargetAt(session.x, session.y, session.id);
        if (target && indicator) {
          indicator.showHorizontal(target.lineX, target.top, target.height);
        } else if (indicator) indicator.hide();
      }

      function onPointerMove(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        session.x = event.clientX;
        session.y = event.clientY;
        if (!session.active) {
          var dx = event.clientX - session.startX;
          var dy = event.clientY - session.startY;
          if (Math.abs(dx) + Math.abs(dy) < DRAG_START_DISTANCE) return;
          session.active = true;
          session.ghost = createDragGhost(session.row);
          store.setDragActive(true, session.id);
          document.documentElement.setAttribute(DRAG_ROOT_ATTR, '');
          if (session.row && session.row.classList) session.row.classList.add('DFM_rowDragging');
          if (event.cancelable) event.preventDefault();
        } else if (event.cancelable) {
          event.preventDefault();
        }
        // 同一帧的 pointermove 合并为一次测量；React 提交平铺后再读取几何。
        if (frame === null && typeof requestAnimationFrame === 'function') {
          frame = requestAnimationFrame(function () { frame = null; updateDrag(); });
        } else if (typeof requestAnimationFrame !== 'function') {
          updateDrag();
        }
      }

      function dropTargetAt(x, y, id) {
        var rail = railElement();
        if (!rail || typeof rail.querySelector !== 'function') return null;
        var visible = rail.querySelector('[data-dfm-rail-zone="visible"]');
        var hidden = rail.querySelector('[data-dfm-rail-zone="hidden"]');
        // 平铺提交前不使用旧菜单的位置，避免显示错误落点。
        if (!visible || !hidden) return null;
        var visibleRect = visible.getBoundingClientRect();
        var hiddenRect = hidden.getBoundingClientRect();
        if (y < visibleRect.top - 12 || y > visibleRect.bottom + 12 ||
            x < visibleRect.left - 6 || x > hiddenRect.right + 6) return null;
        var intoTray = x >= hiddenRect.left;
        var target = targetAt(x, id, intoTray ? hidden : visible);
        target.intoTray = intoTray;
        return target;
      }

      function onPointerUp(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        var drag = session;
        var x = event.clientX;
        var y = event.clientY;
        var active = drag.active;
        if (officialPins) {
          var currentSet = pinSet();
          var currentPinned = isPinnedId(drag.id, currentSet);
          var officialTarget = active ? officialTargetAt(x, y, drag.id) : null;
          var destinationPinned = officialTarget ? officialTarget.intoPinned : currentPinned;
          var plan = officialDropPlan(
            panelIdsOf(panelsInOrder(panelsSource.getSnapshot(), store.getSnapshot().order)),
            currentSet,
            drag.id,
            destinationPinned,
          );
          resetSession();
          if (!active) return;
          suppressNextClick();
          if (!officialTarget) return;
          // 跨固定边界时调用官方 setPinned；拿不到官方动作就取消跨区落点，
          // 不假装改变了固定状态。
          if (plan.pinChange && (!setPinned || !setPinned(drag.id, destinationPinned))) return;
          reorderBucket(store, panelsSource.getSnapshot(), plan.bucket, drag.id, officialTarget.index);
          return;
        }
        var target = active ? dropTargetAt(x, y, drag.id) : null;
        resetSession();
        if (!active) return;
        suppressNextClick();
        if (target) placePanel(store, panelsSource.getSnapshot(), drag.id, target.index, target.intoTray);
      }

      function onPointerCancel(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        resetSession();
      }

      function onKeyDown(event) {
        if (event.key !== 'Escape' || !session) return;
        event.preventDefault();
        if (session.active) suppressNextClick();
        resetSession();
      }

      function onPointerDown(event) {
        if (event.button !== 0 || session) return;
        if (!store.getSnapshot().enabled) return;
        if (!platformOk() || document.documentElement.hasAttribute(DRAG_ROOT_ATTR)) return;
        var target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        var button = target.closest('[data-fold-minimal="panel"][data-panel-id]') ||
          target.closest('[data-dfm-rail-menu-id]');
        if (!button) return;
        var isMenuRow = typeof button.hasAttribute === 'function' && button.hasAttribute('data-dfm-rail-menu-id');
        var rail = button.closest('[data-fold-minimal="rail"]');
        // 新版「更多」浮层 portal 到 body，菜单行不在 rail 内；仍要能作为拖动起点。
        if (!rail && !isMenuRow) return;
        var id = button.getAttribute('data-panel-id') || button.getAttribute('data-dfm-rail-menu-id');
        if (!id) return;
        session = {
          pointerId: event.pointerId,
          id: id,
          row: button,
          startX: event.clientX,
          startY: event.clientY,
          active: false,
        };
        document.addEventListener('pointermove', onPointerMove, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('pointercancel', onPointerCancel, true);
        document.addEventListener('keydown', onKeyDown, true);
      }

      var offStore = store.subscribe(function () {
        var state = store.getSnapshot();
        if (session && (!state.enabled || state.toolbarEnabled === false)) resetSession();
      });
      var onBlur = function () { if (session) resetSession(); };
      if (typeof window.addEventListener === 'function') window.addEventListener('blur', onBlur);
      document.addEventListener('pointerdown', onPointerDown, true);
      return function () {
        offStore();
        if (typeof window.removeEventListener === 'function') window.removeEventListener('blur', onBlur);
        resetSession();
        if (indicator) indicator.dispose();
        document.removeEventListener('pointerdown', onPointerDown, true);
      };
    }

    /* ── src/20-rail.js — Collapsed toolbar component ── */
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
      var officialPins = props.officialPins === true;
      var usePanelInfo = props.usePanelInfo;
      var panels = props.usePanels(function (snapshot) {
        return snapshot;
      });
      var layoutState = props.useLayout(function (snapshot) {
        return snapshot;
      });
      var pinnedIds = props.usePins(function (snapshot) {
        return snapshot.pinned;
      });
      var panelActive = usePanelInfo(isPanelActive);
      var toggleShortcut = props.useShortcuts(shortcutFinder('sidebar.left.toggle'));
      var newShortcut = props.useShortcuts(shortcutFinder('session.new'));

      var railRef = React.useRef(null);
      useLeadingClearance(railRef);

      var enabled = layoutState.enabled === true;
      var hiddenIds = enabled && !officialPins && Array.isArray(layoutState.hidden) ? layoutState.hidden : [];
      // 影子注册会把宿主账本顺序改成保存的顺序；这里再兜一层，保证账本
      // 尚未刷新或影子尚未重建时工具栏也按同一顺序渲染。
      var orderSource = layoutState.order;
      var effectivePanels = enabled && orderSource ? panelsInOrder(panels, orderSource) : panels;
      var split = officialPins
        ? splitOfficialPanels(effectivePanels, pinnedIds, PANEL_SLOTS)
        : splitPanels(effectivePanels, hiddenIds);
      // 拖动时整条工具栏展开：旧版是「显示 / 隐藏」两区，新版是「固定 / 未固定」两区。
      var flattenRail = enabled && layoutState.dragActive === true;
      var pinSet = null;
      var flatPinned = [];
      var flatUnpinned = [];
      if (flattenRail && officialPins) {
        if (Array.isArray(pinnedIds)) {
          pinSet = Object.create(null);
          for (var pinIndex = 0; pinIndex < pinnedIds.length; pinIndex += 1) pinSet[pinnedIds[pinIndex]] = true;
        }
        for (var flatIndex = 0; flatIndex < effectivePanels.length; flatIndex += 1) {
          var flatPanel = effectivePanels[flatIndex];
          if (pinSet === null || pinSet[flatPanel.id]) flatPinned.push(flatPanel);
          else flatUnpinned.push(flatPanel);
        }
      }
      var visiblePanels = flattenRail
        ? officialPins
          ? flatPinned
          : effectivePanels.filter(function (panel) { return hiddenIds.indexOf(panel.id) === -1; })
        : split.visible;
      var needsMore = !flattenRail && (officialPins
        ? split.more.length > 0
        : split.overflow.length > 0 || split.hidden.length > 0);
      var morePanels = officialPins ? split.pinned.slice(split.visible.length) : split.overflow;
      var unpinnedPanels = officialPins ? split.unpinned : [];
      var hiddenPanels = officialPins ? [] : split.hidden;
      var panelButton = function (panel) {
        return h(PanelButton, {
          key: 'panel:' + panel.id,
          panel: panel,
          dragging: flattenRail && panel.id === layoutState.dragPanelId,
          selectPanel: props.selectPanel,
          trackEntryClick: props.trackEntryClick,
          usePanelInfo: usePanelInfo,
        });
      };

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
        if (flattenRail) {
          if (officialPins) {
            children.push(h('div', {
              key: 'rail:pinned-zone', className: 'DFM_railZone',
              'data-dfm-rail-zone': 'pinned', role: 'group', 'aria-label': t('rail.pinned'),
            }, flatPinned.length ? flatPinned.map(panelButton) :
              h('span', { className: 'DFM_railHint' }, t('rail.pinHint'))));
            children.push(h(Divider, { key: 'rail:divider-unpinned' }));
            children.push(h('div', {
              key: 'rail:unpinned-zone', className: 'DFM_railZone DFM_railHidden',
              'data-dfm-rail-zone': 'unpinned', role: 'group', 'aria-label': t('rail.unpinned'),
            }, h('span', { className: 'DFM_railHint' }, t('rail.unpinHint')), flatUnpinned.map(panelButton)));
          } else {
            children.push(h('div', {
              key: 'rail:visible-zone', className: 'DFM_railZone',
              'data-dfm-rail-zone': 'visible', role: 'group', 'aria-label': t('rail.restore'),
            }, visiblePanels.length ? visiblePanels.map(panelButton) :
              h('span', { className: 'DFM_railHint' }, t('rail.restore'))));
            children.push(h(Divider, { key: 'rail:divider-hidden' }));
            children.push(h('div', {
              key: 'rail:hidden-zone', className: 'DFM_railZone DFM_railHidden',
              'data-dfm-rail-zone': 'hidden', role: 'group', 'aria-label': t('rail.hide'),
            }, h('span', { className: 'DFM_railHint' }, t('rail.hide')), split.hidden.map(panelButton)));
          }
        } else {
          for (var index = 0; index < visiblePanels.length; index += 1) children.push(panelButton(visiblePanels[index]));
        }
        if (needsMore) {
          children.push(
            h(PanelOverflowMenu, {
              key: 'rail:more-panels',
              panels: morePanels,
              unpinnedPanels: unpinnedPanels,
              hiddenPanels: hiddenPanels,
              officialPins: officialPins,
              dragActive: flattenRail,
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
      // 它是独立组件开关，关闭后折叠态与展开态的两处入口一起消失。
      if (panelActive && layoutState.backEnabled !== false) {
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

    /* ── src/21-apply.js — Client plugin registration and lifecycle ── */
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

      var panels = createPanelsSource(ctx);
      var layout = createPanelLayoutStore(readLayoutPrefs());
      var caps = createCapabilities(ctx);
      var pins = createPinsStore();
      var shadows = createShadowManager(ctx, layout, caps.officialPins);

      // 新版固定状态独立于组件生命周期观测：Rail 在外层 chrome，SidebarChrome
      // 可能在侧栏折叠时晚挂载；优先直接订阅官方状态，不依赖 nav 的挂载时机。
      if (caps.officialPins) {
        ctx.effect(function () {
          return installPinnedObserver(pins, panels.source, ctx);
        }, 'fold-minimal: pinned observer');
      }

      var syncAll = function () {
        panels.sync();
        shadows.sync();
      };

      // 面板账本 + 影子注册跟随 `sidebar.panellist` 声明生命周期：
      // 侧栏插件卸载/重载时重新对账，不会留下指向已消失声明的影子记录。
      ctx.effect(function () {
        return ctx.slots.inject(PANEL_SLOT, function () {
          var offSlot = ctx.slots.subscribe(PANEL_SLOT, syncAll);
          // 只有开关/顺序变化才需要重建影子；临时拖动状态变化不必。
          var lastShadowEnabled = layout.getSnapshot().enabled;
          var lastShadowOrder = layout.getSnapshot().order;
          var syncShadowsIfChanged = function () {
            var snapshot = layout.getSnapshot();
            if (snapshot.enabled === lastShadowEnabled && snapshot.order === lastShadowOrder) return;
            lastShadowEnabled = snapshot.enabled;
            lastShadowOrder = snapshot.order;
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

      // 两处拖拽（展开侧栏行 / 折叠工具栏图标）共用一个状态 store。
      ctx.effect(function () {
        return watchLayoutFlag(layout, 'enabled', function () {
          return installPanelDrag(layout, panels.source, caps.officialPins);
        });
      }, 'fold-minimal: expanded panel drag');
      ctx.effect(function () {
        return watchLayoutFlag(layout, 'enabled', function () {
          return installRailDrag(layout, panels.source, {
            officialPins: caps.officialPins,
            pins: pins,
            setPinned: function (id, pinned) { return setOfficialPinned(ctx, id, pinned); },
          });
        });
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
        setToolbarEnabled: function (enabled) {
          layout.setToolbarEnabled(enabled);
        },
        setBackEnabled: function (enabled) {
          layout.setBackEnabled(enabled);
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

      // 原有「折叠菜单」组件的生命周期：插件设置里关闭时撤销 shell.leading
      // 注册，宿主官方按钮自动回来；拖拽收起也属于这个组件。
      ctx.effect(function () {
        return watchLayoutFlag(layout, 'toolbarEnabled', function () {
          return ctx.slots.inject(SLOT, function () {
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
                    officialPins: caps.officialPins,
                    releaseVersion: caps.releaseVersion,
                    hooks: {
                      shortcuts: ctx.shortcuts.catalog,
                      panels: panels.source,
                      layout: layout.observable,
                      pins: pins.observable,
                    },
                  };
                },
              },
              LeadingRail,
            );
          });
        });
      }, 'fold-minimal: toolbar component');

      // 拖拽收起只在 darwin 生效（installDragCollapse 内部判定），
      // 且跟随「折叠菜单」组件的开关。
      ctx.effect(function () {
        return watchLayoutFlag(layout, 'toolbarEnabled', function () { return installDragCollapse(ctx.layout); });
      }, 'fold-minimal: drag to collapse');

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
                layoutStore: layout,
                officialPins: caps.officialPins,
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

      // 插件详情页（Plugins → dsh-fold-minimal）里的三个组件开关。
      ctx.slots.inject('plugins.bundle.config', function () {
        return ctx.slots.register(
          {
            name: 'plugins.bundle.config',
            key: 'dsh-fold-minimal',
            locale: NS,
            inject: function () {
              return {
                setToolbarEnabled: layoutActions.setToolbarEnabled,
                setBackEnabled: layoutActions.setBackEnabled,
                setLayoutEnabled: layoutActions.setLayoutEnabled,
                officialPins: caps.officialPins,
                releaseVersion: caps.releaseVersion,
                hooks: { layout: layout.observable },
              };
            },
          },
          PluginSettingsSection,
        );
      });

      // 「更多」按钮只在 panellist.actions 有注册时出现。
      // 新版：官方「更多」已存在，这里只放一个无渲染探针：同步固定状态、
      // 在官方浮层里支持拖动换位；不再插入第二套收起分组。
      // 旧版：保留原来的前置分组与二级区。
      ctx.effect(function () {
        return ctx.slots.inject('sidebar.panellist.actions', function () {
          if (caps.officialPins) {
            return ctx.slots.register(
              {
                name: 'sidebar.panellist.actions',
                id: 'fold-minimal.more-observer',
                order: -1000000,
                locale: NS,
                inject: function () {
                  return {
                    pinStore: pins,
                    panelsSource: panels.source,
                    layoutStore: layout,
                    hooks: { layout: layout.observable },
                  };
                },
              },
              MoreMenuObserver,
            );
          }
          return watchLayoutFlag(layout, 'enabled', function () {
            return ctx.slots.register(
              {
                name: 'sidebar.panellist.actions',
                id: 'fold-minimal.more-anchor',
                order: -1000000,
                locale: NS,
                inject: function () {
                  return {
                    selectPanel: actions.selectPanel,
                    trackEntryClick: actions.trackEntryClick,
                    hooks: { layout: layout.observable, panels: panels.source },
                  };
                },
              },
              SidebarMoreItems,
            );
          });
        });
      }, 'fold-minimal: more anchor');
    }

    /* ── src/99-exports.js — Public and test exports ── */
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
        DRAG_START_DISTANCE: DRAG_START_DISTANCE,
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
        replaceBucketOrder: replaceBucketOrder,
        panelsInOrder: panelsInOrder,
        panelIdsOf: panelIdsOf,
        sanitizeLayoutPrefs: sanitizeLayoutPrefs,
        createPanelLayoutStore: createPanelLayoutStore,
        createShadowPanel: createShadowPanel,
        createShadowManager: createShadowManager,
        createPinsStore: createPinsStore,
        officialDropPlan: officialDropPlan,
        readLayoutPrefs: readLayoutPrefs,
        placePanel: placePanel,
        reorderBucket: reorderBucket,
        dragOvershoot: dragOvershoot,
        insertionTargetAt: insertionTargetAt,
        readBootRelease: readBootRelease,
        parseVersion: parseVersion,
        compareVersions: compareVersions,
        hasOfficialMore: hasOfficialMore,
        createCapabilities: createCapabilities,
        splitOfficialPanels: splitOfficialPanels,
        hoverBridgeContains: hoverBridgeContains,
        hostPanelRow: hostPanelRow,
        hostPanelRowItem: hostPanelRowItem,
        pinnedIdsFromLabels: pinnedIdsFromLabels,
        installPinnedObserver: installPinnedObserver,
        installDragCollapse: installDragCollapse,
        installPanelDrag: installPanelDrag,
        installRailDrag: installRailDrag,
        installMenuReorder: installMenuReorder,
        menuRowForTarget: menuRowForTarget,
        resolveOfficialSidebar: resolveOfficialSidebar,
        setOfficialPinned: setOfficialPinned,
        installSidebarMoreHover: installSidebarMoreHover,
        isPanelActive: isPanelActive,
      },
    };
  },
});
