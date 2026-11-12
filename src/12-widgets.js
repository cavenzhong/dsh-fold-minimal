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
