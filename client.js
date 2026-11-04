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
 *    （`{ size, active }`），顺序沿用其 order；「更多」菜单不渲染。
 *  - 只 require 平台基座里的 react；不 import 任何 DSH Client 包。
 *  - 折叠态按工具栏实测宽度改写 `--dsh-frame-leading-clearance`，让会话标题
 *    让位；展开/卸载时移除。
 *
 * @module dsh-fold-minimal/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-fold-minimal',
  factory: function (require) {
    var React = require('react');
    var h = React.createElement;

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

    var zh = {
      'rail.label': '折叠态工具栏',
      'toggle.open': '打开侧边栏',
      'session.new.label': '新建会话',
      'session.back.label': '返回会话',
    };

    var en = {
      'rail.label': 'Collapsed toolbar',
      'toggle.open': 'Open sidebar',
      'session.new.label': 'New session',
      'session.back.label': 'Back to session',
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
     * @param props - label / shortcut / active / onClick / testId / panelId / children。
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
          'data-fold-minimal': props.testId,
          'data-panel-id': props.panelId,
          onClick: props.onClick,
        },
        props.children,
        h(
          'span',
          { className: 'DFM_tip', 'aria-hidden': 'true' },
          props.label,
          keys && keys.length > 0 ? h('kbd', { className: 'DFM_kbd' }, keys.join('')) : null,
        ),
      );
    }

    /**
     * 一个左侧面板图标：直接渲染该插件自己注册的图标组件（`{ size, active }`），
     * 点击切到对应主面板，选中态与展开态一致。
     * @param props - panel / selectPanel / trackEntryClick / usePanelInfo。
     */
    function PanelButton(props) {
      var panel = props.panel;
      var active = props.usePanelInfo(function (info) {
        return info.activePanelId === panel.id;
      });
      var Icon = panel.Icon;
      var glyph =
        typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null)
          ? h(
              IconBoundary,
              { icon: Icon, fallback: h(FallbackPanelIcon, { size: ICON_SIZE }) },
              h(Icon, { size: ICON_SIZE, active: active }),
            )
          : h(FallbackPanelIcon, { size: ICON_SIZE });
      return h(
        RailButton,
        {
          label: panel.label,
          active: active,
          testId: 'panel',
          panelId: panel.id,
          onClick: function () {
            var menuName = OFFICIAL_PANEL_ANALYTICS[panel.id];
            if (typeof menuName === 'string') {
              props.trackEntryClick({ menu_name: menuName, position: 'titlebar' });
            }
            props.selectPanel(panel.id);
          },
        },
        glyph,
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
      var panelActive = usePanelInfo(isPanelActive);
      var toggleShortcut = props.useShortcuts(shortcutFinder('sidebar.left.toggle'));
      var newShortcut = props.useShortcuts(shortcutFinder('session.new'));

      var railRef = React.useRef(null);
      useLeadingClearance(railRef);

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

      if (panels.length > 0) {
        children.push(h(Divider, { key: 'rail:divider-panels' }));
        for (var index = 0; index < panels.length; index += 1) {
          children.push(
            h(PanelButton, {
              key: 'panel:' + panels[index].id,
              panel: panels[index],
              selectPanel: props.selectPanel,
              trackEntryClick: props.trackEntryClick,
              usePanelInfo: usePanelInfo,
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

      var panels = createPanelsSource(ctx);
      ctx.effect(function () {
        return ctx.slots.subscribe(PANEL_SLOT, panels.sync);
      }, 'fold-minimal: panel ledger');
      ctx.effect(function () {
        return ctx.locale.subscribe(panels.sync);
      }, 'fold-minimal: panel labels');
      panels.sync();

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
                hooks: {
                  shortcuts: ctx.shortcuts.catalog,
                  panels: panels.source,
                },
              };
            },
          },
          LeadingRail,
        );
      });
    }

    return {
      inject: inject,
      apply: apply,
      // 仅供本地测试断言（不进入运行时渲染路径）。
      __test: {
        NS: NS,
        SLOT: SLOT,
        PANEL_SLOT: PANEL_SLOT,
        dictionaries: { zh: zh, en: en },
        labelOf: labelOf,
        buildPanels: buildPanels,
        samePanels: samePanels,
        isPanelActive: isPanelActive,
      },
    };
  },
});
