    /**
     * 可被 slot 渲染器绑成 `usePanels` 的 observable source。
     * @param ctx - 客户端根上下文。
     * @returns `{ source, sync }`；source 的订阅者在面板账本或语言变化时收到通知。
     */
    function createPanelsSource(ctx) {
      var snapshot = [];
      var listeners = [];
      var sync = function () {
        var next = buildPanels(ctx);
        if (samePanels(snapshot, next)) return;
        snapshot = next;
        var current = listeners.slice();
        for (var index = 0; index < current.length; index += 1) current[index]();
      };
      return {
        source: {
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
        sync: sync,
      };
    }

    /**
     * 订阅一个 observable source；优先用 React 18 的 useSyncExternalStore。
     * 测试桩没有这个 hook 时退化为快照读取（不订阅），保证纯逻辑测试可跑。
     * @param store - `{ getSnapshot, subscribe }`。
     * @param selector - 返回可稳定比较的选中值。
     * @returns 选中的快照字段。
     */
    function useObservedSnapshot(store, selector) {
      var read = function () { return selector(store.getSnapshot()); };
      if (typeof React.useSyncExternalStore === 'function') {
        return React.useSyncExternalStore(store.subscribe, read);
      }
      if (typeof React.useState === 'function' && typeof React.useEffect === 'function') {
        var pair = React.useState(read);
        React.useEffect(function () {
          return store.subscribe(function () {
            pair[1](read());
          });
        }, [store, selector]);
        return pair[0];
      }
      return read();
    }
