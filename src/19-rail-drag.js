    /* ───────────── 折叠工具栏：拖拽排序（与展开侧栏同序）───────────── */

    /**
     * 折叠工具栏上的拖拽换位：移动超过约 4px 立即进入换位，拖动时图标不跳动，
     * 用一条蓝色竖线提示落点，松手才写回同一份顺序。
     * @param store - 排序状态 store。
     * @param panelsSource - 当前面板快照。
     * @returns 清理函数。
     */
    function installRailDrag(store, panelsSource, options) {
      if (typeof document === 'undefined') return undefined;
      if (typeof options === 'boolean') options = { officialPins: options };
      options = options || {};
      var officialPins = options.officialPins === true;
      var pins = options.pins || null;
      var setPinned = typeof options.setPinned === 'function' ? options.setPinned : null;
      var session = null;
      var indicator = createInsertionIndicator();
      var frame = null;

      function platformOk() {
        var root = document.documentElement;
        return !!root && root.getAttribute('data-platform') === 'darwin';
      }

      function railElement() {
        return document.querySelector('[data-fold-minimal="rail"]');
      }

      function pinSet() {
        if (!pins || typeof pins.getPinned !== 'function') return null;
        var ids = pins.getPinned();
        if (!Array.isArray(ids)) return null;
        var set = Object.create(null);
        for (var index = 0; index < ids.length; index += 1) set[ids[index]] = true;
        return set;
      }

      function isPinnedId(id, set) {
        return set === null ? true : set[id] === true;
      }

      function zoneContains(rect, x, y, pad) {
        var gap = Number.isFinite(pad) ? pad : 6;
        return x >= rect.left - gap && x <= rect.right + gap &&
          y >= rect.top - 12 && y <= rect.bottom + 12;
      }

      function officialTargetAt(x, y, id) {
        var rail = railElement();
        if (!rail) return null;
        var pinnedZone = rail.querySelector('[data-dfm-rail-zone="pinned"]');
        var unpinnedZone = rail.querySelector('[data-dfm-rail-zone="unpinned"]');
        if (!pinnedZone || !unpinnedZone) return null;
        var pinnedRect = pinnedZone.getBoundingClientRect();
        var unpinnedRect = unpinnedZone.getBoundingClientRect();
        var intoPinned = null;
        if (zoneContains(pinnedRect, x, y, 6)) intoPinned = true;
        else if (zoneContains(unpinnedRect, x, y, 6)) intoPinned = false;
        if (intoPinned === null) return null;
        var target = targetAt(x, id, intoPinned ? pinnedZone : unpinnedZone);
        target.intoPinned = intoPinned;
        return target;
      }

      function railButtons(zone) {
        var nodes = zone.querySelectorAll('[data-fold-minimal="panel"][data-panel-id]');
        var result = [];
        for (var index = 0; index < nodes.length; index += 1) {
          var rect = nodes[index].getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          result.push({ id: nodes[index].getAttribute('data-panel-id'), row: nodes[index], rect: rect });
        }
        result.sort(function (left, right) {
          return left.rect.left - right.rect.left;
        });
        return result;
      }

      function targetAt(x, draggedId, zone) {
        var buttons = railButtons(zone);
        var zoneRect = zone.getBoundingClientRect();
        if (!buttons.length) return {
          index: 0, lineX: zoneRect.right - 4, top: zoneRect.top - 2, height: zoneRect.height + 4,
        };
        var target = insertionTargetAt(buttons, x, draggedId, true);
        var first = buttons[0].rect;
        return {
          index: target.index,
          lineX: target.position,
          top: first.top - 2,
          height: first.height + 4,
        };
      }

      function resetSession() {
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', onPointerCancel, true);
        document.removeEventListener('keydown', onKeyDown, true);
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        if (indicator) indicator.hide();
        document.documentElement.removeAttribute(DRAG_ROOT_ATTR);
        if (session && session.row && session.row.classList) {
          session.row.classList.remove('DFM_rowDragging');
        }
        if (session && session.ghost) session.ghost.dispose();
        session = null;
        store.setDragActive(false);
      }

      function updateDrag() {
        if (!session || !session.active) return;
        if (session.ghost) session.ghost.move(session.x, session.y);
        var target = officialPins
          ? officialTargetAt(session.x, session.y, session.id)
          : dropTargetAt(session.x, session.y, session.id);
        if (target && indicator) {
          indicator.showHorizontal(target.lineX, target.top, target.height);
        } else if (indicator) indicator.hide();
      }

      function onPointerMove(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        session.x = event.clientX;
        session.y = event.clientY;
        if (!session.active) {
          var dx = event.clientX - session.startX;
          var dy = event.clientY - session.startY;
          if (Math.abs(dx) + Math.abs(dy) < DRAG_START_DISTANCE) return;
          session.active = true;
          session.ghost = createDragGhost(session.row);
          store.setDragActive(true, session.id);
          document.documentElement.setAttribute(DRAG_ROOT_ATTR, '');
          if (session.row && session.row.classList) session.row.classList.add('DFM_rowDragging');
          if (event.cancelable) event.preventDefault();
        } else if (event.cancelable) {
          event.preventDefault();
        }
        // 同一帧的 pointermove 合并为一次测量；React 提交平铺后再读取几何。
        if (frame === null && typeof requestAnimationFrame === 'function') {
          frame = requestAnimationFrame(function () { frame = null; updateDrag(); });
        } else if (typeof requestAnimationFrame !== 'function') {
          updateDrag();
        }
      }

      function dropTargetAt(x, y, id) {
        var rail = railElement();
        if (!rail || typeof rail.querySelector !== 'function') return null;
        var visible = rail.querySelector('[data-dfm-rail-zone="visible"]');
        var hidden = rail.querySelector('[data-dfm-rail-zone="hidden"]');
        // 平铺提交前不使用旧菜单的位置，避免显示错误落点。
        if (!visible || !hidden) return null;
        var visibleRect = visible.getBoundingClientRect();
        var hiddenRect = hidden.getBoundingClientRect();
        if (y < visibleRect.top - 12 || y > visibleRect.bottom + 12 ||
            x < visibleRect.left - 6 || x > hiddenRect.right + 6) return null;
        var intoTray = x >= hiddenRect.left;
        var target = targetAt(x, id, intoTray ? hidden : visible);
        target.intoTray = intoTray;
        return target;
      }

      function onPointerUp(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        var drag = session;
        var x = event.clientX;
        var y = event.clientY;
        var active = drag.active;
        if (officialPins) {
          var currentSet = pinSet();
          var currentPinned = isPinnedId(drag.id, currentSet);
          var officialTarget = active ? officialTargetAt(x, y, drag.id) : null;
          var destinationPinned = officialTarget ? officialTarget.intoPinned : currentPinned;
          var plan = officialDropPlan(
            panelIdsOf(panelsInOrder(panelsSource.getSnapshot(), store.getSnapshot().order)),
            currentSet,
            drag.id,
            destinationPinned,
          );
          resetSession();
          if (!active) return;
          suppressNextClick();
          if (!officialTarget) return;
          // 跨固定边界时调用官方 setPinned；拿不到官方动作就取消跨区落点，
          // 不假装改变了固定状态。
          if (plan.pinChange && (!setPinned || !setPinned(drag.id, destinationPinned))) return;
          reorderBucket(store, panelsSource.getSnapshot(), plan.bucket, drag.id, officialTarget.index);
          return;
        }
        var target = active ? dropTargetAt(x, y, drag.id) : null;
        resetSession();
        if (!active) return;
        suppressNextClick();
        if (target) placePanel(store, panelsSource.getSnapshot(), drag.id, target.index, target.intoTray);
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
        if (!store.getSnapshot().enabled) return;
        if (!platformOk() || document.documentElement.hasAttribute(DRAG_ROOT_ATTR)) return;
        var target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        var button = target.closest('[data-fold-minimal="panel"][data-panel-id]') ||
          target.closest('[data-dfm-rail-menu-id]');
        if (!button) return;
        var isMenuRow = typeof button.hasAttribute === 'function' && button.hasAttribute('data-dfm-rail-menu-id');
        var rail = button.closest('[data-fold-minimal="rail"]');
        // 新版「更多」浮层 portal 到 body，菜单行不在 rail 内；仍要能作为拖动起点。
        if (!rail && !isMenuRow) return;
        var id = button.getAttribute('data-panel-id') || button.getAttribute('data-dfm-rail-menu-id');
        if (!id) return;
        session = {
          pointerId: event.pointerId,
          id: id,
          row: button,
          startX: event.clientX,
          startY: event.clientY,
          active: false,
        };
        document.addEventListener('pointermove', onPointerMove, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('pointercancel', onPointerCancel, true);
        document.addEventListener('keydown', onKeyDown, true);
      }

      var offStore = store.subscribe(function () {
        var state = store.getSnapshot();
        if (session && (!state.enabled || state.toolbarEnabled === false)) resetSession();
      });
      var onBlur = function () { if (session) resetSession(); };
      if (typeof window.addEventListener === 'function') window.addEventListener('blur', onBlur);
      document.addEventListener('pointerdown', onPointerDown, true);
      return function () {
        offStore();
        if (typeof window.removeEventListener === 'function') window.removeEventListener('blur', onBlur);
        resetSession();
        if (indicator) indicator.dispose();
        document.removeEventListener('pointerdown', onPointerDown, true);
      };
    }
