    /* ─────────────────────────── 面板数据源 ─────────────────────────── */

    /**
     * 读取一个注册条目的展示文案（thunk 会跟随当前语言）。
     * @param options - panellist 注册选项。
     * @returns 非空字符串；缺失时回退到 id。
     */
    function labelOf(options) {
      var value = options.label;
      var text;
      try {
        text = typeof value === 'function' ? value() : value;
      } catch (error) {
        text = undefined;
      }
      if (typeof text === 'string' && text.length > 0) return text;
      return options.id;
    }

    /**
     * 把 `sidebar.panellist` 的当前注册者折成不可变快照。
     * @param ctx - 客户端根上下文（用 slots 服务读账本）。
     * @returns `{ id, order, label, Icon }[]`，按左侧菜单的 order 升序。
     */
    function buildPanels(ctx) {
      var entries = ctx.slots.entriesOfSlot(PANEL_SLOT);
      var panels = [];
      for (var index = 0; index < entries.length; index += 1) {
        var entry = entries[index];
        var options = entry && entry.options ? entry.options : {};
        var id = options.id;
        if (typeof id !== 'string' || id.length === 0) continue;
        panels.push({
          id: id,
          order: Number.isFinite(options.order) ? options.order : 0,
          label: labelOf(options),
          Icon: entry.component,
        });
      }
      panels.sort(function (left, right) {
        return left.order - right.order;
      });
      return panels;
    }

    /** 面板快照的浅比较；引用不变时下游不重渲染。 */
    function samePanels(left, right) {
      if (left.length !== right.length) return false;
      for (var index = 0; index < left.length; index += 1) {
        var a = left[index];
        var b = right[index];
        if (a.id !== b.id || a.order !== b.order || a.label !== b.label || a.Icon !== b.Icon) return false;
      }
      return true;
    }

    /**
     * 把按 order 排好的面板切成「直接平铺」与「收进更多菜单」两段。
     *
     * 关闭「排序与折叠」时规则与 v0.3 相同：不超过 `PANEL_SLOTS` 个时全部平铺；
     * 超出时保留前 `PANEL_SLOTS - 1` 个、其余进菜单。开启后，被用户收起的
     * 面板也从主区移除、并保证「更多」按钮始终出现（否则收起的入口会消失）。
     * @param panels - `buildPanels` 的快照（已按 order 升序）。
     * @param hiddenIds - 被收起的面板 id（可选）。
     * @returns `{ visible, overflow, hidden }`；`hidden` 只含「排序与折叠」开启时的收起项。
     */
    function splitPanels(panels, hiddenIds) {
      var hidden = Array.isArray(hiddenIds) ? hiddenIds : [];
      if (hidden.length === 0) {
        if (panels.length <= PANEL_SLOTS) return { visible: panels, overflow: [], hidden: [] };
        return {
          visible: panels.slice(0, PANEL_SLOTS - 1),
          overflow: panels.slice(PANEL_SLOTS - 1),
          hidden: [],
        };
      }
      var hiddenSet = Object.create(null);
      for (var index = 0; index < hidden.length; index += 1) hiddenSet[hidden[index]] = true;
      var flat = [];
      var folded = [];
      for (var scan = 0; scan < panels.length; scan += 1) {
        if (hiddenSet[panels[scan].id]) folded.push(panels[scan]);
        else flat.push(panels[scan]);
      }
      var needsMore = flat.length > PANEL_SLOTS || folded.length > 0;
      if (!needsMore) return { visible: flat, overflow: [], hidden: [] };
      return {
        visible: flat.slice(0, PANEL_SLOTS - 1),
        overflow: flat.slice(PANEL_SLOTS - 1),
        hidden: folded,
      };
    }

    /**
     * 把用户保存的顺序与当前面板集合合并：先按保存顺序挑出仍然存在的 id，
     * 再按宿主当前顺序补上新增面板（追加在末尾），保证结果覆盖且只覆盖当前面板。
     * @param savedOrder - 已保存的 id 顺序（可能为空/含失效 id）。
     * @param ids - 当前全部面板 id。
     * @param fallbackIds - 宿主默认顺序的面板 id（用于新增项的位置）。
     * @returns 完整顺序数组。
     */
    function mergePanelOrder(savedOrder, ids, fallbackIds) {
      var known = Object.create(null);
      for (var index = 0; index < ids.length; index += 1) known[ids[index]] = true;
      var seen = Object.create(null);
      var result = [];
      var append = function (id) {
        if (!known[id] || seen[id]) return;
        seen[id] = true;
        result.push(id);
      };
      var saved = Array.isArray(savedOrder) ? savedOrder : [];
      for (var savedIndex = 0; savedIndex < saved.length; savedIndex += 1) append(saved[savedIndex]);
      var fallback = Array.isArray(fallbackIds) ? fallbackIds : [];
      for (var fallbackIndex = 0; fallbackIndex < fallback.length; fallbackIndex += 1) {
        append(fallback[fallbackIndex]);
      }
      for (var idIndex = 0; idIndex < ids.length; idIndex += 1) append(ids[idIndex]);
      return result;
    }

    /**
     * 把 `id` 从可见序列里取出，插到 `index` 位置。
     * @param visibleIds - 当前可见顺序。
     * @param id - 被拖拽的 id。
     * @param index - 移除后序列里的目标插入下标（越界自动钳住）。
     * @returns 新可见顺序。
     */
    function moveVisibleOrder(visibleIds, id, index) {
      var without = [];
      for (var scan = 0; scan < visibleIds.length; scan += 1) {
        if (visibleIds[scan] !== id) without.push(visibleIds[scan]);
      }
      var target = Math.max(0, Math.min(index, without.length));
      without.splice(target, 0, id);
      return without;
    }

    /**
     * 用新的可见顺序替换完整顺序中的可见位，保持被收起项的相对位置不变，
     * 这样排序时被收起的面板不会因为不可见而乱跳。
     * @param allOrder - 完整顺序（通常来自当前面板快照）。
     * @param hiddenIds - 被收起的面板 id。
     * @param visibleIds - 新的可见顺序。
     * @returns 新完整顺序；长度对不上时原样返回 `allOrder`（保护异常输入）。
     */
    function replaceVisibleOrder(allOrder, hiddenIds, visibleIds) {
      var hiddenSet = Object.create(null);
      for (var index = 0; index < hiddenIds.length; index += 1) hiddenSet[hiddenIds[index]] = true;
      var next = [];
      var cursor = 0;
      for (var scan = 0; scan < allOrder.length; scan += 1) {
        var id = allOrder[scan];
        if (hiddenSet[id]) next.push(id);
        else if (cursor < visibleIds.length) next.push(visibleIds[cursor++]);
        else return allOrder.slice();
      }
      return cursor === visibleIds.length ? next : allOrder.slice();
    }

    /**
     * 用新的收起项顺序替换完整顺序中的收起位，保持可见项的相对位置不变。
     * @param allOrder - 完整顺序。
     * @param hiddenIds - 被收起的面板 id。
     * @param hiddenOrder - 新的收起项顺序。
     * @returns 新完整顺序；长度对不上时原样返回 `allOrder`。
     */
    function replaceHiddenOrder(allOrder, hiddenIds, hiddenOrder) {
      var hiddenSet = Object.create(null);
      for (var index = 0; index < hiddenIds.length; index += 1) hiddenSet[hiddenIds[index]] = true;
      var next = [];
      var cursor = 0;
      for (var scan = 0; scan < allOrder.length; scan += 1) {
        var id = allOrder[scan];
        if (!hiddenSet[id]) next.push(id);
        else if (cursor < hiddenOrder.length) next.push(hiddenOrder[cursor++]);
        else return allOrder.slice();
      }
      return cursor === hiddenOrder.length ? next : allOrder.slice();
    }

    /** 读取当前全部面板 id（快照顺序即当前生效顺序）。 */
    function panelIdsOf(panels) {
      var ids = [];
      for (var index = 0; index < panels.length; index += 1) ids.push(panels[index].id);
      return ids;
    }

    /**
     * 按给定 id 顺序重排面板对象；不在顺序里的面板按原快照顺序补在末尾。
     * @param panels - 面板快照。
     * @param order - id 顺序（可为 null，表示沿用快照顺序）。
     * @returns 新数组。
     */
    function panelsInOrder(panels, order) {
      if (!Array.isArray(order)) return panels;
      var byId = Object.create(null);
      for (var index = 0; index < panels.length; index += 1) byId[panels[index].id] = panels[index];
      var seen = Object.create(null);
      var result = [];
      for (var orderIndex = 0; orderIndex < order.length; orderIndex += 1) {
        var panel = byId[order[orderIndex]];
        if (panel && !seen[panel.id]) {
          seen[panel.id] = true;
          result.push(panel);
        }
      }
      for (var scan = 0; scan < panels.length; scan += 1) {
        if (!seen[panels[scan].id]) result.push(panels[scan]);
      }
      return result;
    }
