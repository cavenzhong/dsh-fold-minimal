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
