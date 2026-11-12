    function createPinsStore() {
      var snapshot = { pinned: null };
      var listeners = [];
      var notify = function () {
        var current = listeners.slice();
        for (var index = 0; index < current.length; index += 1) current[index]();
      };
      var same = function (left, right) {
        if (left === right) return true;
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
        for (var index = 0; index < left.length; index += 1) {
          if (left[index] !== right[index]) return false;
        }
        return true;
      };
      var setPinned = function (ids) {
        if (!Array.isArray(ids)) return;
        var clean = [];
        var seen = Object.create(null);
        for (var index = 0; index < ids.length; index += 1) {
          var id = ids[index];
          if (typeof id !== 'string' || id.length === 0 || seen[id]) continue;
          seen[id] = true;
          clean.push(id);
        }
        if (same(snapshot.pinned, clean)) return;
        snapshot = { pinned: clean };
        notify();
      };
      return {
        observable: {
          getSnapshot: function () {
            return snapshot;
          },
          subscribe: function (listener) {
            listeners.push(listener);
            return function () {
              var index = listeners.indexOf(listener);
              if (index !== -1) listeners.splice(index, 1);
            };
          },
        },
        getPinned: function () {
          return snapshot.pinned;
        },
        setPinned: setPinned,
        /**
         * 用官方「更多」的 entries（权威固定状态）回写。
         * @param entries - `{ id, pinned }[]`。
         * @param allPanels - 全部面板快照。
         */
        setFromEntries: function (entries, allPanels) {
          if (!Array.isArray(entries) || !Array.isArray(allPanels)) return;
          var unpinned = Object.create(null);
          for (var index = 0; index < entries.length; index += 1) {
            if (entries[index] && entries[index].pinned === false) unpinned[entries[index].id] = true;
          }
          var pinned = [];
          for (var scan = 0; scan < allPanels.length; scan += 1) {
            if (!unpinned[allPanels[scan].id]) pinned.push(allPanels[scan].id);
          }
          setPinned(pinned);
        },
        /**
         * 用宿主 nav 里实际渲染的行回写；行不存在即未固定。
         * @param allPanels - 全部面板快照。
         * @param seenIds - nav 中实际渲染的 id。
         */
        setFromDom: function (allPanels, seenIds) {
          if (!Array.isArray(allPanels) || !Array.isArray(seenIds) || seenIds.length === 0) return;
          var seen = Object.create(null);
          for (var index = 0; index < seenIds.length; index += 1) seen[seenIds[index]] = true;
          var pinned = [];
          for (var scan = 0; scan < allPanels.length; scan += 1) {
            if (seen[allPanels[scan].id]) pinned.push(allPanels[scan].id);
          }
          setPinned(pinned);
        },
      };
    }
