    function Switch(props) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': props.checked === true,
          'aria-label': props.label,
          className: 'DFM_switch',
          onClick: function () {
            props.onChange(props.checked !== true);
          },
        },
        h('span', { className: 'DFM_switchThumb' }),
      );
    }

    /**
     * 插件详情页（`plugins.bundle.config`）里的三个组件开关：
     *  - 「折叠菜单」：原有的折叠态工具栏 / 拖拽收起，默认开；
     *  - 「返回会话按钮」：折叠态与展开态的两处返回入口，默认开；
     *  - 「面板挪位与折叠 / 面板挪位」：排序；新版收纳交给官方「更多」。
     * @param props - t / useLayout / 三个 setter / officialPins / releaseVersion。
     */
    function PluginSettingsSection(props) {
      var snapshot = props.useLayout(function (state) {
        return state;
      });
      var toolbarTitle = props.t('settings.toolbar.title');
      var backTitle = props.t('settings.back.title');
      var layoutTitle = props.t(props.officialPins ? 'layout.title.new' : 'layout.title');
      var layoutDescription = props.t(
        props.officialPins ? 'layout.description.new' : 'layout.description',
      );
      var compat = props.officialPins
        ? props.releaseVersion
          ? 'DSH ' + props.releaseVersion + ' · ' + props.t('compat.official')
          : props.t('compat.official')
        : props.t('compat.legacy');
      return h(
        'div',
        { className: 'DFM_pluginSettings' },
        h(
          'div',
          { className: 'DFM_setRow' },
          h(
            'div',
            { className: 'DFM_setText' },
            h('div', { className: 'DFM_setTitle' }, toolbarTitle),
            h('div', { className: 'DFM_setDesc' }, props.t('settings.toolbar.desc')),
          ),
          h(Switch, {
            checked: snapshot.toolbarEnabled !== false,
            label: toolbarTitle,
            onChange: function (next) {
              props.setToolbarEnabled(next);
            },
          }),
        ),
        h(
          'div',
          { className: 'DFM_setRow' },
          h(
            'div',
            { className: 'DFM_setText' },
            h('div', { className: 'DFM_setTitle' }, backTitle),
            h('div', { className: 'DFM_setDesc' }, props.t('settings.back.desc')),
          ),
          h(Switch, {
            checked: snapshot.backEnabled !== false,
            label: backTitle,
            onChange: function (next) {
              props.setBackEnabled(next);
            },
          }),
        ),
        h(
          'div',
          { className: 'DFM_setRow DFM_setRowLast' },
          h(
            'div',
            { className: 'DFM_setText' },
            h('div', { className: 'DFM_setTitle' }, layoutTitle),
            h('div', { className: 'DFM_setDesc' }, layoutDescription),
          ),
          h(Switch, {
            checked: snapshot.enabled === true,
            label: layoutTitle,
            onChange: function (next) {
              props.setLayoutEnabled(next);
            },
          }),
        ),
        h('div', { className: 'DFM_compatNote' }, compat),
      );
    }

    /** 原生「更多」浮层的前置分组，后面的宿主固定动作仍由宿主渲染。 */
