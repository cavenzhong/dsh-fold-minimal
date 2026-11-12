    /**
     * 把任意读到的值收成合法的排序/隐藏状态。
     * @param value - 来自 cookie / localStorage 的 JSON。
     * @returns `{ enabled, order, hidden }`；无效值回落到默认关闭。
     */
    function sanitizeLayoutPrefs(value) {
      var source = value && typeof value === 'object' ? value : {};
      var clean = function (list) {
        var result = [];
        if (!Array.isArray(list)) return result;
        for (var index = 0; index < list.length; index += 1) {
          var entry = list[index];
          if (typeof entry === 'string' && entry.length > 0 && result.indexOf(entry) === -1) result.push(entry);
        }
        return result;
      };
      return {
        enabled: source.enabled === true,
        order: clean(source.order),
        hidden: clean(source.hidden),
        // 原有「折叠菜单」组件默认开启；只有显式保存为 false 才关闭。
        toolbar: source.toolbar !== false,
        // 「返回会话」独立开关，默认开启；旧存档没有该字段时按开启处理。
        back: source.back !== false,
      };
    }

    /** 从 cookie 读取排序状态；没有 document 或解析失败时返回 null。 */
    function readLayoutCookie() {
      if (typeof document === 'undefined') return null;
      try {
        return parseLayoutCookie(document.cookie);
      } catch (error) {
        return null;
      }
    }

    function parseLayoutCookie(cookie) {
      if (typeof cookie !== 'string') return null;
      var prefix = LAYOUT_COOKIE + '=';
      var parts = cookie.split(';');
      for (var index = 0; index < parts.length; index += 1) {
        var part = parts[index].replace(/^\s+/, '');
        if (part.indexOf(prefix) !== 0) continue;
        try {
          return JSON.parse(decodeURIComponent(part.slice(prefix.length)));
        } catch (error) {
          return null;
        }
      }
      return null;
    }

    /** 写入 cookie；失败（隐私模式/超长）不影响功能。 */
    function writeLayoutCookie(prefs) {
      if (typeof document === 'undefined') return;
      try {
        var value = encodeURIComponent(JSON.stringify(prefs));
        document.cookie =
          LAYOUT_COOKIE +
          '=' +
          value +
          '; Max-Age=' +
          LAYOUT_COOKIE_MAX_AGE +
          '; Path=/; SameSite=Lax';
      } catch (error) {
        // 忽略：状态仍保存在内存里，不打断拖拽。
      }
    }

    /** 读取 localStorage 镜像；异常时返回 null。 */
    function readLayoutStorage() {
      if (typeof window === 'undefined') return null;
      try {
        var raw = window.localStorage && window.localStorage.getItem(LAYOUT_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    }

    /** 写回 localStorage 镜像；异常时忽略。 */
    function writeLayoutStorage(prefs) {
      if (typeof window === 'undefined') return;
      try {
        if (window.localStorage) window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(prefs));
      } catch (error) {
        // 忽略：cookie 仍是跨重启的主存储。
      }
    }

    /**
     * 读取启动状态：cookie 优先（跨端口），localStorage 仅作兜底。
     * @returns `{ enabled, order, hidden }`。
     */
    function readLayoutPrefs() {
      var cookie = readLayoutCookie();
      if (cookie) return sanitizeLayoutPrefs(cookie);
      return sanitizeLayoutPrefs(readLayoutStorage());
    }

    /** 持久化排序状态（cookie + localStorage 镜像）。 */
    function writeLayoutPrefs(prefs) {
      var clean = sanitizeLayoutPrefs(prefs);
      writeLayoutCookie(clean);
      writeLayoutStorage(clean);
    }

    /**
     * 排序/显隐状态的小型 observable store。
     *
     * 快照字段：`enabled`（设置开关）、`order`（保存的 id 顺序）、
     * `hidden`（收起的 id）、`trayOpen`（二级区展开，不持久化）、
     * `dragActive` / `dragPanelId`（拖拽中的临时状态，不持久化）。
     * @param initial - `readLayoutPrefs()` 的结果。
     * @returns store：`subscribe/getSnapshot` + 动作。
     */
    function createPanelLayoutStore(initial) {
      var prefs = sanitizeLayoutPrefs(initial);
      var snapshot = {
        enabled: prefs.enabled,
        toolbarEnabled: prefs.toolbar,
        backEnabled: prefs.back,
        order: prefs.order,
        hidden: prefs.hidden,
        trayOpen: false,
        dragActive: false,
        dragPanelId: null,
      };
      var listeners = [];
      var notify = function () {
        var current = listeners.slice();
        for (var index = 0; index < current.length; index += 1) current[index]();
      };
      var patch = function (changes, persist) {
        var next = null;
        for (var key in changes) {
          if (!Object.prototype.hasOwnProperty.call(changes, key)) continue;
          var value = changes[key];
          var previous = snapshot[key];
          if (value === previous || (Array.isArray(value) && Array.isArray(previous) &&
              value.length === previous.length && value.every(function (item, index) {
                return item === previous[index];
              }))) continue;
          if (next === null) next = Object.assign({}, snapshot);
          next[key] = value;
        }
        if (next === null) return;
        snapshot = next;
        if (persist) {
          writeLayoutPrefs({
            enabled: next.enabled,
            order: next.order,
            hidden: next.hidden,
            toolbar: next.toolbarEnabled,
            back: next.backEnabled,
          });
        }
        notify();
      };
      return {
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
        setEnabled: function (enabled) {
          patch({ enabled: enabled === true, trayOpen: enabled === true ? snapshot.trayOpen : false }, true);
        },
        setToolbarEnabled: function (enabled) {
          patch({ toolbarEnabled: enabled === true }, true);
        },
        setBackEnabled: function (enabled) {
          patch({ backEnabled: enabled === true }, true);
        },
        setOrder: function (order) {
          patch({ order: sanitizeLayoutPrefs({ order: order }).order }, true);
        },
        setHidden: function (hidden) {
          patch({ hidden: sanitizeLayoutPrefs({ hidden: hidden }).hidden }, true);
        },
        setPlacement: function (order, hidden) {
          var next = sanitizeLayoutPrefs({ order: order, hidden: hidden });
          patch({ order: next.order, hidden: next.hidden }, true);
        },
        setTrayOpen: function (open) {
          patch({ trayOpen: open === true }, false);
        },
        /** 拖拽活跃标记（不持久化）：折叠工具栏据此临时把全部图标平铺。 */
        setDragActive: function (active, id) {
          var panelId = active === true && typeof id === 'string' ? id : null;
          if (snapshot.dragActive === (active === true) && snapshot.dragPanelId === panelId) return;
          patch({ dragActive: active === true, dragPanelId: panelId }, false);
        },
        hidePanel: function (id) {
          if (snapshot.hidden.indexOf(id) !== -1) return;
          patch({ hidden: snapshot.hidden.concat([id]) }, true);
        },
        showPanel: function (id) {
          var index = snapshot.hidden.indexOf(id);
          if (index === -1) return;
          var hidden = snapshot.hidden.slice();
          hidden.splice(index, 1);
          patch({ hidden: hidden }, true);
        },
        reset: function () {
          patch({ order: [], hidden: [] }, true);
        },
      };
    }

    /** 仅在对应组件开启时安装副作用；开关关闭与插件卸载共用同一条清理路径。 */
    function watchLayoutFlag(store, key, install) {
      var enabled = false;
      var dispose = null;
      var sync = function () {
        var next = store.getSnapshot()[key] === true;
        if (next === enabled) return;
        enabled = next;
        if (dispose) dispose();
        dispose = next ? install() : null;
      };
      var off = store.subscribe(sync);
      try { sync(); } catch (error) { off(); throw error; }
      return function () {
        off();
        if (dispose) dispose();
        dispose = null;
      };
    }
