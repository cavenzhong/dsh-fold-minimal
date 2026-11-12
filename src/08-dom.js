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
      for (var index = 0; index < nav.children.length; index += 1) {
        var item = nav.children[index];
        var button = null;
        if (item.tagName === 'BUTTON') button = item;
        else if (typeof item.querySelector === 'function') button = item.querySelector('button[aria-label]');
        if (!button) continue;
        if (button.getAttribute('aria-haspopup') === 'menu') continue;
        var label = button.getAttribute('aria-label');
        if (typeof label !== 'string' || label.length === 0) continue;
        rows.push(label);
      }
      if (rows.length === 0) return null;
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
     * 独立的 plugin effect 观察更可靠。优先用 nav 行 aria-label 与面板顺序匹配，
     * 匹配不上再退回影子标记，避免一次错误的标记集合覆盖正确结果。
     * @param pinStore - 固定状态 store。
     * @param panelsSource - 面板 observable source。
     * @returns 清理函数。
     */
    function installPinnedObserver(pinStore, panelsSource) {
      if (typeof document === 'undefined') return undefined;
      var root = null;
      var observer = null;
      var frame = null;
      var scheduled = false;
      var read = function () {
        scheduled = false;
        var nav = sidebarNavElement(root);
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
      var attach = function () {
        if (typeof MutationObserver !== 'function') return;
        if (observer) observer.disconnect();
        root = sidebarRootElement();
        observer = new MutationObserver(schedule);
        observer.observe(root || document.documentElement, { childList: true, subtree: true });
      };
      attach();
      schedule();
      return function () {
        if (observer) observer.disconnect();
        if (frame !== null) {
          if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
          else clearTimeout(frame);
        }
      };
    }
