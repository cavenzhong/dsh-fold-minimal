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
      var morePanels = officialPins ? split.more : split.overflow;
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
