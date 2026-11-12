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
