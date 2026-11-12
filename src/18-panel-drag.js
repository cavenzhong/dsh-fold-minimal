    /**
     * 展开侧栏的拖拽换位：按下后移动超过约 4px 立即进入拖拽（不再长按等待），
     * 拖动期间列表保持不动，只用一条蓝色插入线提示落点，松手才写 store。
     * 拖到「更多」行或二级区上松手 = 收起；二级区里的行拖回主区 = 恢复；
     * 二级区内上下拖 = 调整收起项顺序。
     * @param store - 排序状态 store。
     * @param panelsSource - 当前面板快照（提供生效顺序）。
     * @returns 清理函数。
     */
    function installPanelDrag(store, panelsSource, officialPins) {
      if (typeof document === 'undefined') return undefined;
      var session = null;
      var indicator = createInsertionIndicator();
      var frame = null;

      function platformOk() {
        var root = document.documentElement;
        return !!root && root.getAttribute('data-platform') === 'darwin';
      }

      function hiddenIds() {
        return officialPins ? [] : store.getSnapshot().hidden;
      }

      function hiddenSetOf(ids) {
        var set = Object.create(null);
        for (var index = 0; index < ids.length; index += 1) set[ids[index]] = true;
        return set;
      }

      /** 可见的宿主面板行（按视觉位置从上到下）。 */
      function mainMarkers() {
        var nodes = document.querySelectorAll('[' + MARKER_ATTR + ']');
        var hidden = hiddenSetOf(hiddenIds());
        var result = [];
        for (var index = 0; index < nodes.length; index += 1) {
          var marker = nodes[index];
          var id = marker.getAttribute(MARKER_ATTR);
          if (!id || hidden[id]) continue;
          var row = hostPanelRow(marker);
          if (!row) continue;
          var rect = row.getBoundingClientRect();
          if (rect.height <= 0 || rect.width <= 0) continue;
          result.push({ id: id, row: row, rect: rect });
        }
        result.sort(function (left, right) {
          return left.rect.top - right.rect.top;
        });
        return result;
      }

      /** 二级区里的行（按视觉位置从上到下）。 */
      function trayRows() {
        var nodes = document.querySelectorAll('[' + TRAY_ID_ATTR + ']');
        var result = [];
        for (var index = 0; index < nodes.length; index += 1) {
          var row = nodes[index];
          var id = row.getAttribute(TRAY_ID_ATTR);
          if (!id) continue;
          var rect = row.getBoundingClientRect();
          if (rect.height <= 0) continue;
          result.push({ id: id, row: row, rect: rect });
        }
        result.sort(function (left, right) {
          return left.rect.top - right.rect.top;
        });
        return result;
      }

      function trayElement() {
        return document.querySelector('[' + TRAY_ATTR + ']');
      }

      function moreRowElement() {
        return document.querySelector('[' + MORE_ROW_ATTR + ']');
      }

      function rectOf(element) {
        return element ? element.getBoundingClientRect() : null;
      }

      function overElement(element, x, y) {
        var rect = rectOf(element);
        return rect ? rectContains(rect, x, y) : false;
      }

      function setTrayHighlight(on) {
        var tray = trayElement();
        if (!tray) return;
        if (on) tray.setAttribute(DROP_ATTR, 'true');
        else tray.removeAttribute(DROP_ATTR);
      }

      function setMoreHighlight(on) {
        var more = moreRowElement();
        if (!more) return;
        if (on) more.setAttribute(DROP_ATTR, 'true');
        else more.removeAttribute(DROP_ATTR);
      }

      function clearHighlights() {
        setTrayHighlight(false);
        setMoreHighlight(false);
        if (indicator) indicator.hide();
      }

      /** 主区插入点：index 是「去掉被拖行后」序列里的落点，lineY 是蓝线位置。 */
      function mainTargetAt(y, draggedId) {
        var markers = mainMarkers();
        if (!markers.length) {
          var moreRect = rectOf(moreRowElement());
          return moreRect ? { index: 0, lineY: moreRect.top - 2, left: moreRect.left, width: moreRect.width } : null;
        }
        var target = insertionTargetAt(markers, y, draggedId);
        return {
          index: target.index,
          lineY: target.position,
          left: markers[0].rect.left,
          width: markers[0].rect.width,
        };
      }

      /** 二级区插入点。 */
      function trayTargetAt(y, draggedId) {
        var rows = trayRows();
        if (!rows.length) return null;
        var target = insertionTargetAt(rows, y, draggedId);
        return {
          index: target.index,
          lineY: target.position,
          left: rows[0].rect.left,
          width: rows[0].rect.width,
        };
      }

      /** 指针是否落在面板列表的主区（含行间空隙；全收起时以「更多」为下界）。 */
      function overMainZone(x, y) {
        var markers = mainMarkers();
        if (markers.length > 0) {
          return (
            x >= markers[0].rect.left && x < markers[0].rect.right &&
            y >= markers[0].rect.top - 18 && y <= markers[markers.length - 1].rect.bottom + 18
          );
        }
        var more = moreRowElement();
        var moreRect = rectOf(more);
        return !!moreRect && x >= moreRect.left && x < moreRect.right && y >= moreRect.top - 36 && y < moreRect.top;
      }

      function resetSession() {
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', onPointerCancel, true);
        document.removeEventListener('keydown', onKeyDown, true);
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        clearHighlights();
        if (typeof document !== 'undefined') {
          document.documentElement.removeAttribute(DRAG_ROOT_ATTR);
        }
        if (session && session.row && session.row.classList) {
          session.row.classList.remove('DFM_rowDragging');
        }
        session = null;
        store.setDragActive(false);
      }

      function updateDrag(x, y) {
        if (!session) return;
        // 新版没有插件自己的隐藏区：只在固定面板行之间画插入线，
        // 拖到官方「更多」行不触发「收起」，收纳由官方菜单负责。
        if (officialPins) {
          clearHighlights();
          if (overMainZone(x, y)) {
            var officialTarget = mainTargetAt(y, session.id);
            if (officialTarget && indicator) {
              indicator.showVertical(officialTarget.left, officialTarget.width, officialTarget.lineY);
            }
          }
          return;
        }
        var snapshot = store.getSnapshot();
        var tray = trayElement();
        var overTray = overElement(tray, x, y);
        var more = moreRowElement();
        var overMore = overElement(more, x, y);
        clearHighlights();

        if (session.fromTray) {
          if (overTray) {
            var trayTarget = trayTargetAt(y, session.id);
            if (trayTarget && indicator) {
              indicator.showVertical(trayTarget.left, trayTarget.width, trayTarget.lineY);
            }
            return;
          }
          if (overMainZone(x, y)) {
            var restoreTarget = mainTargetAt(y, session.id);
            if (restoreTarget && indicator) {
              indicator.showVertical(restoreTarget.left, restoreTarget.width, restoreTarget.lineY);
            }
          }
          return;
        }

        // 拖到「更多」行或已展开的二级区上：提示松手会收起。
        if (overTray) {
          setTrayHighlight(true);
          var insertTarget = trayTargetAt(y, session.id);
          if (insertTarget && indicator) indicator.showVertical(insertTarget.left, insertTarget.width, insertTarget.lineY);
          return;
        }
        if (overMore) {
          setMoreHighlight(true);
          setTrayHighlight(true);
          if (!snapshot.trayOpen) store.setTrayOpen(true);
          return;
        }
        // 靠近「更多」时自动展开二级区；这里只在指针仍在主区内时画插入线。
        if (!snapshot.trayOpen && overMainZone(x, y)) {
          var moreRect = rectOf(more);
          if (moreRect && y > moreRect.top - 44) store.setTrayOpen(true);
        }
        if (overMainZone(x, y)) {
          var target = mainTargetAt(y, session.id);
          if (target && indicator) {
            indicator.showVertical(target.left, target.width, target.lineY);
          }
        }
      }

      function onPointerMove(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        if (!session.active) {
          var dx = event.clientX - session.startX;
          var dy = event.clientY - session.startY;
          if (Math.abs(dx) + Math.abs(dy) < DRAG_START_DISTANCE) return;
          session.active = true;
          store.setDragActive(true, session.id);
          document.documentElement.setAttribute(DRAG_ROOT_ATTR, '');
          if (session.row && session.row.classList) session.row.classList.add('DFM_rowDragging');
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
        var x = event.clientX;
        var y = event.clientY;
        var active = drag.active;
        if (officialPins) {
          var bucket = mainMarkers().map(function (entry) { return entry.id; });
          var officialTarget = overMainZone(x, y) ? mainTargetAt(y, drag.id) : null;
          resetSession();
          if (!active) return;
          suppressNextClick();
          if (officialTarget) {
            reorderBucket(store, panelsSource.getSnapshot(), bucket, drag.id, officialTarget.index);
          }
          return;
        }
        var overTray = overElement(trayElement(), x, y);
        var overMore = overElement(moreRowElement(), x, y);
        resetSession();
        if (!active) return;
        suppressNextClick();
        if (drag.fromTray) {
          if (overTray) {
            var trayTarget = trayTargetAt(y, drag.id);
            if (trayTarget) placePanel(store, panelsSource.getSnapshot(), drag.id, trayTarget.index, true);
          } else if (overMainZone(x, y)) {
            var restoreTarget = mainTargetAt(y, drag.id);
            // 全部面板都收起时主区没有行可参考，恢复到可见列表第 0 位。
            placePanel(store, panelsSource.getSnapshot(), drag.id, restoreTarget ? restoreTarget.index : 0, false);
          }
          return;
        }
        if (overTray || overMore) {
          var insert = trayTargetAt(y, drag.id);
          var hiddenCount = splitPanels(panelsSource.getSnapshot(), hiddenIds()).hidden.length;
          placePanel(store, panelsSource.getSnapshot(), drag.id, insert ? insert.index : hiddenCount, true);
          // 保证松手后二级区展开，用户马上能看到拖进去的项。
          store.setTrayOpen(true);
          return;
        }
        if (overMainZone(x, y)) {
          var target = mainTargetAt(y, drag.id);
          if (target) placePanel(store, panelsSource.getSnapshot(), drag.id, target.index, false);
        }
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
        if (!platformOk()) return;
        if (document.documentElement.hasAttribute(DRAG_ROOT_ATTR)) return;
        var target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        var trayRow = closestMarked(target, TRAY_ID_ATTR);
        var marker = trayRow ? null : closestMarked(target, MARKER_ATTR);
        // 图标外层有 data-dfm-id 包装；整行其他地方用影子组件给宿主行打的
        // data-dfm-row-id 兜底，这样点行内任意位置（标题、空白）都能拖。
        var hostRow = trayRow || marker ? null : target.closest('[data-dfm-row-id]');
        if (!trayRow && !marker && !hostRow) return;
        var row = trayRow || (marker ? marker.closest('button') : hostRow);
        if (!row || (!trayRow && row !== hostPanelRow(marker || row))) return;
        // 点行内的固定/取消固定按钮时不要启动整行拖拽。
        var hitButton = target.closest('button');
        if (hitButton && !trayRow && hitButton !== row) return;
        var id = trayRow
          ? row.getAttribute(TRAY_ID_ATTR)
          : marker
            ? marker.getAttribute(MARKER_ATTR)
            : row.getAttribute('data-dfm-row-id');
        if (!id) return;
        session = {
          pointerId: event.pointerId,
          id: id,
          row: row,
          fromTray: trayRow !== null,
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
        if (session && !store.getSnapshot().enabled) resetSession();
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
