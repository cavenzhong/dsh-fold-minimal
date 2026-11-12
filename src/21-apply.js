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
      // 可能在侧栏折叠时晚挂载；这里直接盯宿主 nav，保证切换折叠时状态已就绪。
      if (caps.officialPins) {
        ctx.effect(function () {
          return installPinnedObserver(pins, panels.source);
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
      var setOfficialPinned = function (id, pinned) {
        var action = resolveOfficialSetPinned(ctx);
        if (!action) return false;
        try {
          action(id, pinned);
          return true;
        } catch (error) {
          return false;
        }
      };
      ctx.effect(function () {
        return watchLayoutFlag(layout, 'enabled', function () {
          return installRailDrag(layout, panels.source, {
            officialPins: caps.officialPins,
            pins: pins,
            setPinned: setOfficialPinned,
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

      // 插件详情页（Plugins → dsh-fold-minimal）里的两个组件开关。
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
