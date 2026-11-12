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
