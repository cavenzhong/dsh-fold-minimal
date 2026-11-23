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

    /**
     * 页面级固定回填状态（见 `PIN_PAGE_STATE`）。
     * 拿不到 window 时返回 null，调用方退化为每个实例回填一次。
     * @returns `{ source }` 或 null。
     */
    function pinPageState() {
      if (typeof window === 'undefined') return null;
      try {
        var current = window[PIN_PAGE_STATE];
        if (current && typeof current === 'object') return current;
        var created = { source: null };
        Object.defineProperty(window, PIN_PAGE_STATE, { configurable: true, value: created });
        return created;
      } catch (error) {
        return null;
      }
    }

    /**
     * 把官方固定状态镜像到本机存储，并在下次启动时回填。
     *
     * 官方 ui-sidebar 的 pin 列表是纯内存的（`panel-pins.ts` 注释为
     * "In-memory pin choices"），退出 DSH 就回到「全部固定」。插件既然已经把
     * 顺序存下来了，也顺手把官方未固定 id 存一份；启动时在官方 sidebar 注册
     * 后逐项调用 `setPinned(id, false)`，折叠工具栏与官方「更多」就会恢复上次
     * 的分组，不需要用户重新取消固定。
     *
     * 时序必须是「先回填、再订阅保存」：否则启动时读到官方默认的全部固定，
     * 会立刻把存档覆盖成空列表。同一页面里同一个官方 source 只回填一次：
     * 插件 HMR / 停用后重新启用时官方状态才是最新的，旧存档不能反过来撤销用户
     * 停用期间的操作；官方 sidebar 重建（source 变化）或整页重载才再次回填。
     * @param ctx - 客户端根上下文。
     * @param layout - 布局 store（提供 `unpinned` 存档与 `setUnpinned`）。
     * @returns 清理函数。
     */
    function installOfficialPinsPersistence(ctx, layout) {
      var disposed = false;
      var official = null;
      var source = null;
      var offSource = null;
      var offSlot = null;

      var save = function () {
        try {
          if (!source || typeof source.getSnapshot !== 'function') return;
          var current = source.getSnapshot();
          if (!Array.isArray(current)) return;
          layout.setUnpinned(current);
        } catch (error) {
          // 存储或 layout 订阅者异常不能冒泡回官方 setPinned，
          // 否则跨边界拖拽会把“pin 已成功”误判成官方拒绝并放弃排序。
        }
      };

      var restore = function () {
        var saved = layout.getSnapshot().unpinned;
        if (!Array.isArray(saved) || !official) return;
        var current = source && typeof source.getSnapshot === 'function' ? source.getSnapshot() : [];
        var active = Object.create(null);
        if (Array.isArray(current)) {
          for (var index = 0; index < current.length; index += 1) active[current[index]] = true;
        }
        for (var scan = 0; scan < saved.length; scan += 1) {
          var id = saved[scan];
          // plugins 始终固定；已经未固定的项不必重复提交。
          if (typeof id !== 'string' || id.length === 0 || id === FIXED_PANEL_ID || active[id]) continue;
          try {
            official.setPinned(id, false);
          } catch (error) {
            // 官方拒绝时跳过；当前已知的拒绝只有 plugins，已在上面提前跳过。
          }
        }
      };

      var connect = function () {
        if (disposed) return;
        var candidate = resolveOfficialSidebar(ctx);
        if (!candidate || !candidate.hooks || !candidate.hooks.entryPins) return;
        var next = candidate.hooks.entryPins;
        if (next === source) return;
        if (offSource) {
          offSource();
          offSource = null;
        }
        official = candidate;
        source = next;
        var page = pinPageState();
        if (!page || page.source !== source) {
          restore();
          if (page) page.source = source;
        }
        if (typeof source.subscribe === 'function') {
          try {
            offSource = source.subscribe(save);
          } catch (error) {
            offSource = null;
          }
        }
        // 回填之后的实际状态（或同一 source 再次启用时的官方状态）才是要保存的状态。
        save();
      };

      connect();
      // 官方 sidebar 可能晚于本插件注册，也可能被整体重建；槽位变化时重新对账。
      if (ctx && ctx.slots && typeof ctx.slots.subscribe === 'function') {
        try {
          offSlot = ctx.slots.subscribe(SLOT, connect);
        } catch (error) {
          offSlot = null;
        }
        // subscribe 与 connect 之间若有注册到达，补一次。
        connect();
      }
      return function () {
        disposed = true;
        if (offSource) offSource();
        offSource = null;
        if (offSlot) offSlot();
        offSlot = null;
        official = null;
        source = null;
      };
    }
