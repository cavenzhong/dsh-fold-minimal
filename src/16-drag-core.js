    /**
     * 拖拽过冲量：松手时的渲染列宽减去「指针期望的列宽」。
     * 差值越大，说明指针已经越过宿主的最小宽度越多；宿主的最小宽度不需要写死。
     * @param width - 松手那一帧渲染出的侧栏列宽。
     * @param startWidth - 拖拽起点列宽。
     * @param startX - 按下时的指针 x。
     * @param endX - 松手时的指针 x。
     * @returns 过冲像素；往右拖为负。
     */
    function dragOvershoot(width, startWidth, startX, endX) {
      return width - (startWidth + (endX - startX));
    }

    /**
     * 按仍占位的完整列表确定视觉边界，再换算成移除被拖项后的插入下标。
     * 不能先排除被拖项再平均两侧坐标，否则提示线会穿过它的原行/图标。
     * @param entries - 按视觉顺序排列的 `{ id, rect }[]`。
     * @param coordinate - 指针所在轴的坐标。
     * @param draggedId - 被拖项 id（跨区时可以不在列表里）。
     * @param horizontal - 横向图标列表；默认纵向行列表。
     * @returns `{ index, position }`，空列表返回 null。
     */
    function insertionTargetAt(entries, coordinate, draggedId, horizontal) {
      if (!entries.length) return null;
      var start = horizontal ? 'left' : 'top';
      var end = horizontal ? 'right' : 'bottom';
      var slot = 0;
      var index = 0;
      while (slot < entries.length) {
        var entry = entries[slot];
        if (coordinate <= (entry.rect[start] + entry.rect[end]) / 2) break;
        if (entry.id !== draggedId) index += 1;
        slot += 1;
      }
      var position = slot === 0
        ? entries[0].rect[start] - 2
        : slot === entries.length
          ? entries[slot - 1].rect[end] + 2
          : (entries[slot - 1].rect[end] + entries[slot].rect[start]) / 2;
      return { index: index, position: position };
    }

    /** 一次提交分组与落点，避免恢复面板时先闪回旧位置。 */
    function placePanel(store, panels, id, index, intoTray) {
      var snapshot = store.getSnapshot();
      var all = panelIdsOf(panelsInOrder(panels, snapshot.order));
      if (all.indexOf(id) === -1) return;
      var hidden = snapshot.hidden.filter(function (panelId) { return panelId !== id; });
      if (intoTray) hidden.push(id);
      var bucket = all.filter(function (panelId) { return (hidden.indexOf(panelId) !== -1) === intoTray; });
      var moved = moveVisibleOrder(bucket, id, index);
      var order = intoTray ? replaceHiddenOrder(all, hidden, moved) : replaceVisibleOrder(all, hidden, moved);
      store.setPlacement(order, hidden);
    }


    /** 指针替身在原行/浮层卸载后仍保留，直到松手或取消。 */
    function createDragGhost(row) {
      if (!document.body) return null;
      var ghost = document.createElement('div');
      ghost.className = 'DFM_dragGhost';
      ghost.setAttribute('aria-hidden', 'true');
      var glyph = row.querySelector('svg') || row.firstElementChild;
      if (glyph) ghost.appendChild(glyph.cloneNode(true));
      document.body.appendChild(ghost);
      return {
        move: function (x, y) {
          ghost.style.left = x + 12 + 'px';
          ghost.style.top = y + 12 + 'px';
        },
        dispose: function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); },
      };
    }

    /** 点是否落在 rect 内。 */
    function rectContains(rect, x, y) {
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        x >= rect.left &&
        x < rect.right &&
        y >= rect.top &&
        y < rect.bottom
      );
    }

    /** 吞掉拖拽结束后紧跟的一次 click（避免松手顺便打开面板）。 */
    function suppressNextClick() {
      if (typeof document === 'undefined') return;
      var ownerDocument = document;
      var handler = function (event) {
        event.preventDefault();
        event.stopPropagation();
        ownerDocument.removeEventListener('click', handler, true);
      };
      ownerDocument.addEventListener('click', handler, true);
      setTimeout(function () {
        ownerDocument.removeEventListener('click', handler, true);
      }, 0);
    }

    /**
     * 原生箭头与蓝线组成的插入提示。固定定位在 body 上，不参与布局，
     * 所以宿主行与工具栏图标都不会在拖动中跳动。
     * @returns `{ showVertical, showHorizontal, hide, dispose }`；没有 body 时返回 null。
     */
    function createInsertionIndicator() {
      if (typeof document === 'undefined' || !document.body) return null;
      var line = document.createElement('div');
      line.className = 'DFM_indicator';
      line.setAttribute('aria-hidden', 'true');
      line.style.display = 'none';
      document.body.appendChild(line);
      var show = function (axis, left, top, width, height) {
        line.setAttribute('data-axis', axis);
        line.style.left = left + 'px';
        line.style.top = top + 'px';
        line.style.width = width + 'px';
        line.style.height = height + 'px';
        line.style.display = 'block';
      };
      return {
        showVertical: function (left, width, y) {
          show('vertical', left, y - 6, width, 12);
        },
        showHorizontal: function (x, top, height) {
          // 以左上角旋转后，原图形 y=6 的蓝线仍精确落在插入点 x 上。
          show('horizontal', x + 6, top, height, 12);
        },
        hide: function () {
          line.style.display = 'none';
        },
        dispose: function () {
          if (line.parentNode) line.parentNode.removeChild(line);
        },
      };
    }
