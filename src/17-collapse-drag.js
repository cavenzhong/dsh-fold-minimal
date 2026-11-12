    /* ─────────────────────── 拖到底继续左拖 → 收起 ─────────────────────── */

    /**
     * 旁听宿主侧栏的拖拽：拖到最小宽度后继续往左拖，松手时收起侧栏。
     *
     * 宿主的拖拽手柄带 `data-side="sidebar"`，指针捕获只把事件目标改到手柄，
     * 事件仍冒泡到 document，所以这里只读不改宿主。判定放在 pointerup 之后
     * 的一帧：那时宿主已经把最终宽度写进 DOM，用「渲染宽度 − 指针期望宽度」
     * 判过冲，既不用写死最小宽度，也不会在拖拽中途和宿主抢着写宽度。
     *
     * @param layout - 布局服务（`toggleSidebar`）。
     * @returns 清理函数。
     */
    function installDragCollapse(layout) {
      if (typeof document === 'undefined' || !layout) return undefined;

      var session = null;
      var settleFrame = null;
      var disposed = false;

      function cancelSettle() {
        if (settleFrame !== null) cancelAnimationFrame(settleFrame);
        settleFrame = null;
      }

      /** 切换「松手即折叠」的指针提示；只影响指针样式，失败也不影响拖拽本身。 */
      function setArmed(armed) {
        var root = document.documentElement;
        if (!root) return;
        if (armed) root.setAttribute(ARMED_ATTR, '');
        else root.removeAttribute(ARMED_ATTR);
      }

      function onPointerMove(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        session.endX = event.clientX;
        // 拖动中实时提示：过冲量达到阈值就把指针换成「向左收起」形状。
        var width = parseFloat(session.handle.style.left);
        if (!Number.isFinite(width)) return;
        var armed =
          dragOvershoot(width, session.startWidth, session.startX, event.clientX) >=
          DRAG_COLLAPSE_OVERSHOOT;
        if (armed === session.armed) return;
        session.armed = armed;
        setArmed(armed);
      }

      function cleanup() {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerCancel);
        setArmed(false);
        session = null;
      }

      function settle(drag) {
        if (disposed || !drag.handle.isConnected) return;
        var width = parseFloat(drag.handle.style.left);
        var overshoot = Number.isFinite(width)
          ? dragOvershoot(width, drag.startWidth, drag.startX, drag.endX)
          : Number.NEGATIVE_INFINITY;
        // 指针已经提示「松手折叠」时以提示为准：快速拖动时宽度有一帧滞后，
        // 否则会出现「指针说会折叠、松手却没折」的不一致。
        if (drag.armed || overshoot >= DRAG_COLLAPSE_OVERSHOOT) layout.toggleSidebar();
      }

      function onPointerUp(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        var drag = session;
        drag.endX = event.clientX;
        cleanup();
        if (typeof requestAnimationFrame === 'function') {
          settleFrame = requestAnimationFrame(function () {
            settleFrame = null;
            settle(drag);
          });
        } else {
          settle(drag);
        }
      }

      function onPointerCancel(event) {
        if (!session || event.pointerId !== session.pointerId) return;
        cleanup();
      }

      function onPointerDown(event) {
        if (event.button !== 0 || session) return;
        // 本插件只服务 macOS 桌面折叠态；其它平台不接管拖拽语义。
        // 每个 pointerdown 现查平台属性，避免插件先于桌面 preload 启动时静默失效。
        if (document.documentElement.getAttribute('data-platform') !== 'darwin') return;
        var target = event.target;
        var handle =
          target && typeof target.closest === 'function' ? target.closest('[data-side="sidebar"]') : null;
        if (!handle) return;
        var startWidth = parseFloat(handle.style.left);
        if (!Number.isFinite(startWidth)) return;
        cancelSettle();
        session = {
          pointerId: event.pointerId,
          startX: event.clientX,
          endX: event.clientX,
          startWidth: startWidth,
          handle: handle,
          armed: false,
        };
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerCancel);
      }

      var onBlur = function () { cancelSettle(); cleanup(); };
      if (typeof window.addEventListener === 'function') window.addEventListener('blur', onBlur);
      document.addEventListener('pointerdown', onPointerDown);
      return function () {
        disposed = true;
        cancelSettle();
        cleanup();
        if (typeof window.removeEventListener === 'function') window.removeEventListener('blur', onBlur);
        document.removeEventListener('pointerdown', onPointerDown);
      };
    }
