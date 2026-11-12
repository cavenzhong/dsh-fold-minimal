    /* ───────────────────────────── 图标 ───────────────────────────── */

    /** 侧栏开合图标（与 chrome 原按钮同一套路径）。 */
    function PanelLeftIcon(props) {
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          className: 'DFM_svg',
          strokeWidth: 1,
        },
        h('path', {
          d: 'M13.5 1.5H2.5C1.94772 1.5 1.5 1.94772 1.5 2.5V13.5C1.5 14.0523 1.94772 14.5 2.5 14.5H13.5C14.0523 14.5 14.5 14.0523 14.5 13.5V2.5C14.5 1.94772 14.0523 1.5 13.5 1.5Z',
          stroke: 'currentColor',
        }),
        h('path', { d: 'M5.5 1.5V14.5', stroke: 'currentColor' }),
      );
    }

    /** 新建会话图标（与 chrome 原按钮同一套路径）。 */
    function NewChatIcon(props) {
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          className: 'DFM_svg',
          strokeWidth: 1,
        },
        h('path', {
          d: 'M2.37091 11.2501C1.58745 9.89288 1.32067 8.29835 1.61969 6.76006C1.91872 5.22177 2.76342 3.8433 3.99826 2.87846C5.2331 1.91362 6.77494 1.42737 8.33988 1.50925C9.90482 1.59113 11.3875 2.23562 12.5149 3.32406C13.6425 4.41269 14.3387 5.87206 14.4754 7.4334C14.612 8.99474 14.18 10.5529 13.2587 11.8209C12.3375 13.0888 10.9891 13.9813 9.46194 14.3337C8.18691 14.628 6.85895 14.5294 5.64989 14.0605C5.1712 13.8748 4.76962 13.4932 4.26534 13.3967C3.67413 13.2835 2.95257 13.5598 2.03794 14.3337',
          stroke: 'currentColor',
        }),
        h('path', { d: 'M8 5V11', stroke: 'currentColor' }),
        h('path', { d: 'M5 8H11', stroke: 'currentColor' }),
      );
    }

    /** 返回会话图标（左箭头，线条与工具栏原按钮一致）。 */
    function BackIcon(props) {
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          className: 'DFM_svg',
          strokeWidth: 1,
        },
        h('path', { d: 'M12.5 8H3.5', stroke: 'currentColor' }),
        h('path', { d: 'M7.25 4.25 3.5 8l3.75 3.75', stroke: 'currentColor' }),
      );
    }

    /** 「更多面板」图标：向下箭头，提示第 4 格这里还收着面板。 */
    function MorePanelsIcon(props) {
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          className: 'DFM_svg',
          strokeWidth: 1,
        },
        h('path', { d: 'M4.25 6.25 8 10 11.75 6.25', stroke: 'currentColor' }),
      );
    }

    /** 插件图标不可用/崩溃时的兜底图标（原创：圆角面板 + 中心点）。 */
    function FallbackPanelIcon(props) {
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          className: 'DFM_svg',
        },
        h('rect', {
          x: 2.25,
          y: 2.25,
          width: 11.5,
          height: 11.5,
          rx: 2.75,
          stroke: 'currentColor',
          strokeWidth: 1.2,
        }),
        h('circle', { cx: 8, cy: 8, r: 1.7, fill: 'currentColor' }),
      );
    }

    /**
     * 单个插件图标崩溃时退化为兜底图标：我们直接渲染别的插件注册的组件，
     * 一个坏图标不应该让整条工具栏 abdicate 回官方按钮。
     */
    class IconBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false, icon: props.icon };
      }

      static getDerivedStateFromError() {
        return { failed: true };
      }

      // 图标组件被重新注册（插件更新 / HMR）时重新尝试，避免永久停在兜底图标。
      static getDerivedStateFromProps(props, state) {
        if (props.icon !== state.icon) return { failed: false, icon: props.icon };
        return null;
      }

      render() {
        return this.state.failed ? this.props.fallback : this.props.children;
      }
    }
