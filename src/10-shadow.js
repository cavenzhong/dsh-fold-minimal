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
