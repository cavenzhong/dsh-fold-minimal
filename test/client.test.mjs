/**
 * dsh-fold-minimal 的纯逻辑测试。
 *
 * client.js 是 `window.__ModuleLoader__` 的浏览器 bundle，这里用最小 window /
 * react 桩把它加载出来，只测不依赖 DOM 的纯函数与语言表。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const fakeReact = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  Fragment: Symbol('Fragment'),
  Component: class Component {},
  useRef: (initial) => ({ current: initial }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
};

let captured = null;
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured = definition;
    },
  },
};

await import('../client.js');

const { factory, id } = captured;
const exports = factory((name) => {
  assert.equal(name, 'react');
  return fakeReact;
});
const {
  NS,
  SLOT,
  PANEL_SLOT,
  PANEL_SLOTS,
  DRAG_COLLAPSE_OVERSHOOT,
  DRAG_START_DISTANCE,
  LAYOUT_COOKIE,
  dictionaries,
  labelOf,
  buildPanels,
  samePanels,
  splitPanels,
  mergePanelOrder,
  moveVisibleOrder,
  replaceVisibleOrder,
  replaceHiddenOrder,
  replaceBucketOrder,
  panelsInOrder,
  panelIdsOf,
  sanitizeLayoutPrefs,
  createPanelLayoutStore,
  createShadowPanel,
  createShadowManager,
  createPinsStore,
  readLayoutPrefs,
  placePanel,
  reorderBucket,
  dragOvershoot,
  insertionTargetAt,
  readBootRelease,
  parseVersion,
  compareVersions,
  hasOfficialMore,
  createCapabilities,
  splitOfficialPanels,
  hoverBridgeContains,
  hostPanelRow,
  hostPanelRowItem,
  pinnedIdsFromLabels,
  installPinnedObserver,
  installMenuReorder,
  menuRowForTarget,
  resolveOfficialSidebar,
  setOfficialPinned,
  officialDropPlan,
  installDragCollapse,
  installPanelDrag,
  installRailDrag,
  installSidebarMoreHover,
  isPanelActive,
} = exports.__test;

const EMPTY_LAYOUT = { enabled: false, order: [], hidden: [], trayOpen: false, backEnabled: true };

function makeCtx(entries) {
  return { slots: { entriesOfSlot: (name) => (name === PANEL_SLOT ? entries : []) } };
}

test('bundle id 与槽位常量', () => {
  assert.equal(id, 'dsh-fold-minimal');
  assert.equal(NS, 'fold-minimal');
  assert.equal(SLOT, 'shell.leading');
  assert.equal(PANEL_SLOT, 'sidebar.panellist');
  assert.deepEqual(exports.inject, ['slots', 'layout', 'uiWorkspace', 'locale', 'shortcuts']);
});

test('中英文语言表键集合一致且都有文案', () => {
  assert.deepEqual(Object.keys(dictionaries.zh).sort(), Object.keys(dictionaries.en).sort());
  for (const key of [
    'rail.label',
    'toggle.open',
    'session.new.label',
    'session.back.label',
    'panels.more',
    'layout.title',
    'layout.description',
    'layout.reset',
    'settings.toolbar.title',
    'settings.toolbar.desc',
    'tray.label',
    'tray.empty',
    'tray.expand',
    'tray.collapse',
    'rail.pinned',
    'rail.unpinned',
    'rail.pinHint',
    'rail.unpinHint',
  ]) {
    assert.ok(dictionaries.zh[key], `缺中文文案：${key}`);
    assert.ok(dictionaries.en[key], `缺英文文案：${key}`);
  }
});

test('isPanelActive 只在主区域被全局面板占用时为真', () => {
  assert.equal(isPanelActive({ activePanelId: 'plugins' }), true);
  assert.equal(isPanelActive({ activePanelId: 'sticky-notes' }), true);
  assert.equal(isPanelActive({ activePanelId: null }), false);
});

/**
 * 用最小客户端上下文跑一遍真实的 apply()，再渲染它注册到 shell.leading 的组件。
 * 覆盖 apply → slot 注册 → inject → LeadingRail 这条运行时链路（不需要 DOM）。
 */
function renderRail(panelInfo, panels = [], layoutSnapshot = EMPTY_LAYOUT, options = {}) {
  const selections = [];
  const registered = [];
  const ctx = {
    effect: (fn) => fn(),
    locale: {
      register: () => () => {},
      subscribe: () => () => {},
    },
    slots: {
      spec: () => undefined,
      entries: () => [],
      entriesOfSlot: () => [],
      subscribe: () => () => {},
      inject: (_slot, callback) => callback(),
      register: (options, component) => {
        registered.push({ options, component });
        return () => {};
      },
    },
    layout: {
      toggleSidebar: () => {},
      selectPanel: (id) => selections.push(id),
    },
    uiWorkspace: { startSession: () => {} },
    shortcuts: { catalog: { getSnapshot: () => [], subscribe: () => () => {} } },
    get: () => undefined,
  };
  const previousBoot = globalThis.window.__DSH_BOOT__;
  if (options.release) {
    globalThis.window.__DSH_BOOT__ = {
      release: { version: options.release },
      entries: options.entries ?? [],
    };
  }
  try {
    exports.apply(ctx);
  } finally {
    if (options.release) {
      if (previousBoot === undefined) delete globalThis.window.__DSH_BOOT__;
      else globalThis.window.__DSH_BOOT__ = previousBoot;
    }
  }
  const entry = registered.find((candidate) => candidate.options.name === SLOT);
  const injected = entry.options.inject();
  const tree = entry.component({
    ...injected,
    t: (key) => key,
    usePanelInfo: (selector) => selector(panelInfo),
    usePanels: (selector) => selector(panels),
    useShortcuts: () => undefined,
    useLayout: (selector) => selector(layoutSnapshot),
    usePins: (selector) => selector({ pinned: options.pinned ?? null }),
  });
  return { tree, selections, registered, injected };
}

function flatten(node, out = []) {
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out);
  } else if (node && typeof node === 'object') {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

function railButton(elements, testId) {
  return elements.find((element) => element.props.testId === testId);
}

test('面板活跃时在新建会话后渲染返回会话，点击走布局层 selectPanel(null)', () => {
  const active = renderRail({ activePanelId: 'plugins' });
  const elements = flatten(active.tree);
  const back = railButton(elements, 'back-session');
  assert.ok(back, '面板活跃时应渲染返回按钮');
  assert.equal(back.props.label, 'session.back.label');
  assert.equal(railButton(elements, 'new-session').props.label, 'session.new.label');
  assert.deepEqual(
    elements
      .filter((element) => element.props.testId === 'new-session' || element.props.testId === 'back-session')
      .map((element) => element.props.testId),
    ['new-session', 'back-session'],
  );
  back.props.onClick();
  assert.deepEqual(active.selections, [null]);

  const inSession = renderRail({ activePanelId: null });
  assert.equal(railButton(flatten(inSession.tree), 'back-session'), undefined, '会话中不应渲染返回按钮');
});

test('labelOf 支持 thunk、字符串与缺失回退 id', () => {
  assert.equal(labelOf({ id: 'plugins', label: () => '插件' }), '插件');
  assert.equal(labelOf({ id: 'plugins', label: 'Plugins' }), 'Plugins');
  assert.equal(labelOf({ id: 'custom-log' }), 'custom-log');
  assert.equal(
    labelOf({
      id: 'broken',
      label: () => {
        throw new Error('boom');
      },
    }),
    'broken',
  );
});

test('buildPanels 读取注册者并按 order 排序，保留插件自己的图标组件', () => {
  const IconA = () => null;
  const IconB = () => null;
  const panels = buildPanels(
    makeCtx([
      { options: { id: 'schedules', order: 10, label: () => '自动化任务' }, component: IconB },
      { options: { id: 'plugins', order: 0, label: () => '插件' }, component: IconA },
      { options: { id: 'sticky-notes', order: 3, label: 'Obsidian MEMO' }, component: IconA },
    ]),
  );
  assert.deepEqual(
    panels.map((panel) => panel.id),
    ['plugins', 'sticky-notes', 'schedules'],
  );
  assert.equal(panels[0].label, '插件');
  assert.equal(panels[1].label, 'Obsidian MEMO');
  assert.equal(panels[2].Icon, IconB);
});

test('buildPanels 忽略没有 id 的异常条目，order 非有限数按 0 处理', () => {
  assert.deepEqual(buildPanels(makeCtx([{ options: {}, component: () => null }])), []);
  const panels = buildPanels(
    makeCtx([
      { options: { id: 'late', order: 10, label: 'late' }, component: () => null },
      { options: { id: 'nan', order: Number.NaN, label: 'nan' }, component: () => null },
    ]),
  );
  assert.deepEqual(
    panels.map((panel) => panel.id),
    ['nan', 'late'],
  );
});

test('samePanels 对内容相同（图标组件引用相同）的快照返回 true', () => {
  const Icon = () => null;
  const a = [{ id: 'plugins', order: 0, label: '插件', Icon }];
  const b = [{ id: 'plugins', order: 0, label: '插件', Icon }];
  const changedIcon = [{ id: 'plugins', order: 0, label: '插件', Icon: () => null }];
  const changedLabel = [{ id: 'plugins', order: 0, label: 'Plugins', Icon }];
  assert.equal(samePanels(a, b), true);
  assert.equal(samePanels(a, changedIcon), false);
  assert.equal(samePanels(a, changedLabel), false);
  assert.equal(samePanels(a, []), false);
});

const fakePanels = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `panel-${index}`,
    order: index,
    label: `面板 ${index}`,
    Icon: () => null,
  }));

test('splitPanels：不超过 4 个时全部平铺，不需要「更多」', () => {
  assert.equal(PANEL_SLOTS, 4);
  for (const count of [0, 1, 3, 4]) {
    const { visible, overflow } = splitPanels(fakePanels(count));
    assert.equal(visible.length, count);
    assert.deepEqual(overflow, []);
  }
});

test('splitPanels：第 5 个出现时，第 4 格让给「更多」，被顶掉的面板进菜单', () => {
  const five = splitPanels(fakePanels(5));
  assert.deepEqual(
    five.visible.map((panel) => panel.id),
    ['panel-0', 'panel-1', 'panel-2'],
  );
  assert.deepEqual(
    five.overflow.map((panel) => panel.id),
    ['panel-3', 'panel-4'],
    '被「更多」顶掉的第 4 个面板必须留在菜单里，否则会丢掉入口',
  );

  const seven = splitPanels(fakePanels(7));
  assert.deepEqual(
    seven.visible.map((panel) => panel.id),
    ['panel-0', 'panel-1', 'panel-2'],
  );
  assert.deepEqual(
    seven.overflow.map((panel) => panel.id),
    ['panel-3', 'panel-4', 'panel-5', 'panel-6'],
  );
});

test('splitPanels：开启排序与折叠后，被收起的面板进「hidden」，More 始终保留入口', () => {
  const three = splitPanels(fakePanels(3), ['panel-1']);
  assert.deepEqual(
    three.visible.map((panel) => panel.id),
    ['panel-0', 'panel-2'],
  );
  assert.deepEqual(three.overflow, []);
  assert.deepEqual(
    three.hidden.map((panel) => panel.id),
    ['panel-1'],
  );

  const six = splitPanels(fakePanels(6), ['panel-0']);
  assert.deepEqual(
    six.visible.map((panel) => panel.id),
    ['panel-1', 'panel-2', 'panel-3'],
  );
  assert.deepEqual(
    six.overflow.map((panel) => panel.id),
    ['panel-4', 'panel-5'],
  );
  assert.deepEqual(
    six.hidden.map((panel) => panel.id),
    ['panel-0'],
  );

  const allHidden = splitPanels(fakePanels(2), ['panel-0', 'panel-1']);
  assert.deepEqual(allHidden.visible, []);
  assert.deepEqual(allHidden.overflow, []);
  assert.deepEqual(
    allHidden.hidden.map((panel) => panel.id),
    ['panel-0', 'panel-1'],
    '全部收起时仍要能通过 More 打开',
  );
});

test('mergePanelOrder：保留用户顺序、丢弃失效 id、新面板按宿主顺序追加', () => {
  assert.deepEqual(
    mergePanelOrder(['b', 'a'], ['a', 'b', 'c'], ['a', 'b', 'c']),
    ['b', 'a', 'c'],
  );
  assert.deepEqual(mergePanelOrder(['x', 'b'], ['a', 'b'], ['a', 'b']), ['b', 'a']);
  assert.deepEqual(mergePanelOrder([], ['a', 'b'], ['b', 'a']), ['b', 'a']);
  assert.deepEqual(mergePanelOrder(null, [], []), []);
});

test('moveVisibleOrder / replaceVisibleOrder / replaceHiddenOrder 保持收起项位置', () => {
  assert.deepEqual(moveVisibleOrder(['a', 'b', 'c'], 'c', 0), ['c', 'a', 'b']);
  assert.deepEqual(moveVisibleOrder(['a', 'b', 'c'], 'a', 2), ['b', 'c', 'a']);
  assert.deepEqual(moveVisibleOrder(['a', 'b'], 'a', -3), ['a', 'b']);
  assert.deepEqual(moveVisibleOrder(['a', 'b'], 'a', 9), ['b', 'a']);

  assert.deepEqual(
    replaceVisibleOrder(['a', 'h', 'b', 'c'], ['h'], ['c', 'a', 'b']),
    ['c', 'h', 'a', 'b'],
  );
  assert.deepEqual(
    replaceHiddenOrder(['a', 'h1', 'b', 'h2'], ['h1', 'h2'], ['h2', 'h1']),
    ['a', 'h2', 'b', 'h1'],
  );
});

test('panelsInOrder：按顺序重排，缺失项按原序补尾', () => {
  const panels = fakePanels(3);
  assert.deepEqual(
    panelsInOrder(panels, ['panel-2', 'panel-0']).map((panel) => panel.id),
    ['panel-2', 'panel-0', 'panel-1'],
  );
  assert.equal(panelsInOrder(panels, null), panels);
});

test('sanitizeLayoutPrefs：非法值回落到关闭，id 去重且丢弃空值', () => {
  assert.deepEqual(sanitizeLayoutPrefs(null), {
    enabled: false,
    order: [],
    hidden: [],
    toolbar: true,
    back: true,
  });
  assert.deepEqual(
    sanitizeLayoutPrefs({
      enabled: 'yes',
      order: ['a', 'a', '', 3, 'b'],
      hidden: ['c', null, 'c'],
    }),
    { enabled: false, order: ['a', 'b'], hidden: ['c'], toolbar: true, back: true },
  );
  assert.equal(sanitizeLayoutPrefs({ enabled: true }).enabled, true);
  assert.equal(sanitizeLayoutPrefs({ toolbar: false }).toolbar, false);
});

test('面板排序 store：开关/顺序/收起/重置，相同顺序不重复通知', () => {
  const store = createPanelLayoutStore({
    enabled: true,
    order: ['b'],
    hidden: ['a'],
  });
  assert.deepEqual(store.getSnapshot(), {
    enabled: true,
    toolbarEnabled: true,
    backEnabled: true,
    order: ['b'],
    hidden: ['a'],
    trayOpen: false,
    dragActive: false,
    dragPanelId: null,
  });
  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications += 1;
  });
  store.setEnabled(false);
  assert.equal(store.getSnapshot().enabled, false);
  store.setToolbarEnabled(false);
  assert.equal(store.getSnapshot().toolbarEnabled, false);
  store.hidePanel('c');
  assert.deepEqual(store.getSnapshot().hidden, ['a', 'c']);
  store.showPanel('a');
  assert.deepEqual(store.getSnapshot().hidden, ['c']);
  store.setOrder(['c', 'b']);
  assert.deepEqual(store.getSnapshot().order, ['c', 'b']);
  const before = notifications;
  store.setOrder(['c', 'b']);
  assert.equal(notifications, before, '相同顺序不应触发重渲染');
  store.setTrayOpen(true);
  assert.equal(store.getSnapshot().trayOpen, true);
  store.setDragActive(true);
  assert.equal(store.getSnapshot().dragActive, true);
  store.setDragActive(false);
  assert.equal(store.getSnapshot().dragActive, false);
  store.reset();
  assert.deepEqual(store.getSnapshot().order, []);
  assert.deepEqual(store.getSnapshot().hidden, []);
  assert.equal(notifications > 0, true);
  unsubscribe();
});

test('apply 注册展开态 chrome、插件页组件开关与工具栏 hooks', () => {
  const { registered } = renderRail({ activePanelId: null });
  const names = registered.map((candidate) => candidate.options.name);
  assert.ok(names.includes('sidebar.footer.action'), '缺少展开态 chrome 注册');
  assert.ok(names.includes('plugins.bundle.config'), '缺少插件页组件开关注册');
  const chrome = registered.find(
    (candidate) =>
      candidate.options.name === 'sidebar.footer.action' &&
      candidate.options.id === 'fold-minimal.sidebar-chrome',
  );
  assert.ok(chrome);
  const chromeProps = chrome.options.inject();
  assert.equal(typeof chromeProps.backToSession, 'function');
  assert.equal(typeof chromeProps.toggleTray, 'function');
  const settings = registered.find(
    (candidate) =>
      candidate.options.name === 'plugins.bundle.config' &&
      candidate.options.key === 'dsh-fold-minimal',
  );
  assert.ok(settings, '组件开关应注册到插件详情页 plugins.bundle.config');
  const settingsProps = settings.options.inject();
  assert.equal(typeof settingsProps.setToolbarEnabled, 'function');
  assert.equal(typeof settingsProps.setBackEnabled, 'function');
  assert.equal(typeof settingsProps.setLayoutEnabled, 'function');

  // 渲染三个开关行：折叠菜单（默认开）+ 返回会话（默认开）+ 面板挪位与折叠（默认关）。
  const changes = [];
  const injected = settings.options.inject();
  const tree = settings.component({
    ...injected,
    t: (key) => key,
    useLayout: (selector) => selector({ ...EMPTY_LAYOUT, toolbarEnabled: true, backEnabled: true }),
    setToolbarEnabled: (next) => changes.push(['toolbar', next]),
    setBackEnabled: (next) => changes.push(['back', next]),
    setLayoutEnabled: (next) => changes.push(['layout', next]),
  });
  const switches = flatten(tree).filter(
    (element) =>
      typeof element.type === 'function' &&
      element.props &&
      ['settings.toolbar.title', 'settings.back.title', 'layout.title'].includes(element.props.label),
  );
  assert.equal(switches.length, 3, '插件设置里应显示三个组件开关');
  const toolbarSwitch = switches.find((element) => element.props.label === 'settings.toolbar.title');
  const backSwitch = switches.find((element) => element.props.label === 'settings.back.title');
  const layoutSwitch = switches.find((element) => element.props.label === 'layout.title');
  assert.equal(toolbarSwitch.props.checked, true, '折叠菜单默认开启');
  assert.equal(backSwitch.props.checked, true, '返回会话默认开启');
  assert.equal(layoutSwitch.props.checked, false, '面板挪位与折叠默认关闭');
  toolbarSwitch.props.onChange(false);
  backSwitch.props.onChange(false);
  layoutSwitch.props.onChange(true);
  assert.deepEqual(changes, [
    ['toolbar', false],
    ['back', false],
    ['layout', true],
  ]);
});

test('插件设置：新版使用官方更多文案并显示检测到的 DSH 版本', () => {
  const { registered } = renderRail({ activePanelId: null });
  const settings = registered.find(
    (candidate) =>
      candidate.options.name === 'plugins.bundle.config' &&
      candidate.options.key === 'dsh-fold-minimal',
  );
  const tree = settings.component({
    ...settings.options.inject(),
    officialPins: true,
    releaseVersion: '0.2.2-rc.2',
    t: (key) => key,
    useLayout: (selector) => selector({ ...EMPTY_LAYOUT, enabled: true }),
    setToolbarEnabled: () => {},
    setBackEnabled: () => {},
    setLayoutEnabled: () => {},
  });
  const elements = flatten(tree);
  const labels = elements
    .filter((element) => element.type === 'div' && element.props.className === 'DFM_setTitle')
    .map((element) => element.children.join(''));
  assert.deepEqual(labels, ['settings.toolbar.title', 'settings.back.title', 'layout.title.new']);
  const note = elements.find((element) => element.props.className === 'DFM_compatNote');
  assert.equal(note.children.join(''), 'DSH 0.2.2-rc.2 · compat.official');
});

test('折叠态工具栏：开启排序与折叠后，收起项进 More；已提交顺序立即反映到工具栏', () => {
  const layout = {
    enabled: true,
    order: ['panel-2', 'panel-0', 'panel-1'],
    hidden: ['panel-1'],
    trayOpen: false,
  };
  const { tree } = renderRail({ activePanelId: null }, fakePanels(3), layout);
  const elements = flatten(tree);
  const buttons = elements.filter((element) => element.props.panel !== undefined);
  assert.deepEqual(
    buttons.map((element) => element.props.panel.id),
    ['panel-2', 'panel-0'],
  );
  const overflow = elements.find(
    (element) => typeof element.type === 'function' && Array.isArray(element.props.hiddenPanels),
  );
  assert.ok(overflow, '收起项应交给 More 菜单');
  assert.deepEqual(
    overflow.props.hiddenPanels.map((panel) => panel.id),
    ['panel-1'],
  );

  const dragging = {
    ...layout,
    order: ['panel-0', 'panel-2', 'panel-1'],
  };
  const during = flatten(renderRail({ activePanelId: null }, fakePanels(3), dragging).tree).filter(
    (element) => element.props.panel !== undefined,
  );
  assert.deepEqual(
    during.map((element) => element.props.panel.id),
    ['panel-0', 'panel-2'],
    '已提交顺序应立即反映到工具栏',
  );
});

test('折叠态工具栏：拖动时平铺全部面板并标明隐藏区，松手恢复紧凑布局', () => {
  const layout = {
    enabled: true,
    toolbarEnabled: true,
    order: [],
    hidden: ['panel-5'],
    trayOpen: false,
    dragActive: true,
  };
  const panels = fakePanels(6);
  const elements = flatten(renderRail({ activePanelId: null }, panels, layout).tree);
  const buttons = elements.filter((element) => element.props.panel !== undefined);
  assert.deepEqual(
    buttons.map((element) => element.props.panel.id),
    ['panel-0', 'panel-1', 'panel-2', 'panel-3', 'panel-4', 'panel-5'],
    '拖拽中应平铺全部面板，包括已收起项',
  );
  const zones = elements.filter((node) => node.props['data-dfm-rail-zone']);
  assert.deepEqual(zones.map((node) => node.props['data-dfm-rail-zone']), ['visible', 'hidden']);
  assert.deepEqual(flatten(zones[1]).filter((node) => node.props.panel).map((node) => node.props.panel.id), ['panel-5']);
  assert.ok(flatten(zones[1]).some((node) => node.children?.includes('rail.hide')), '隐藏区有文字提示');
  assert.equal(elements.some((node) => node.props.hiddenPanels), false, '拖动时不再保留重复的 More 菜单');

  const idle = flatten(
    renderRail({ activePanelId: null }, panels, { ...layout, dragActive: false }).tree,
  ).filter((element) => element.props.panel !== undefined);
  assert.deepEqual(
    idle.map((element) => element.props.panel.id),
    ['panel-0', 'panel-1', 'panel-2'],
    '松手后恢复 3 个图标 + More',
  );
});

test('dragOvershoot：只有越过最小宽度才算过冲', () => {
  // 侧栏最小宽度 264：拖到 264 就停住 —— 没有过冲。
  assert.equal(dragOvershoot(264, 280, 500, 484), 0);
  // 指针继续往左 24px，列宽被钳住 —— 过冲 24px，达到收起阈值。
  assert.equal(dragOvershoot(264, 280, 500, 460), 24);
  // 往右拖撞到最大宽度是负值，永远不会触发收起。
  assert.ok(dragOvershoot(420, 280, 500, 690) < 0);
});

test('折叠态工具栏：面板超过 4 个时保留 3 个图标 + 一个溢出菜单', () => {
  const { tree } = renderRail({ activePanelId: null }, fakePanels(5));
  const elements = flatten(tree);
  const buttons = elements.filter((element) => element.props.panel !== undefined);
  assert.deepEqual(
    buttons.map((element) => element.props.panel.id),
    ['panel-0', 'panel-1', 'panel-2'],
  );
  const overflow = elements.find(
    (element) => typeof element.type === 'function' && Array.isArray(element.props.panels),
  );
  assert.ok(overflow, '应把多出的面板交给「更多」菜单');
  assert.deepEqual(
    overflow.props.panels.map((panel) => panel.id),
    ['panel-3', 'panel-4'],
  );

  const four = flatten(renderRail({ activePanelId: null }, fakePanels(4)).tree);
  assert.equal(four.filter((element) => element.props.panel !== undefined).length, 4);
  assert.equal(
    four.some((element) => typeof element.type === 'function' && Array.isArray(element.props.panels)),
    false,
    '4 个面板时应全部直接显示，不出现「更多」',
  );
});

/**
 * 最小 document 替身：只实现拖拽收起用到的监听与平台属性。
 * 事件按真实顺序派发，用来验证 installDragCollapse 的判定与清理。
 */
function createDragEnv(platform) {
  const listeners = new Map();
  const attributes = new Map();
  const handle = { style: { left: '280px' }, isConnected: true };
  const env = {
    handle,
    target: { closest: (selector) => (selector === '[data-side="sidebar"]' ? handle : null) },
    listenerCount: () => [...listeners.values()].reduce((total, fns) => total + fns.length, 0),
    armed: () => attributes.has('data-dfm-collapse-armed'),
    dispatch(type, event) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn(event);
    },
  };
  globalThis.document = {
    documentElement: {
      getAttribute: (name) =>
        name === 'data-platform' ? platform : (attributes.get(name) ?? null),
      setAttribute: (name) => attributes.set(name, ''),
      removeAttribute: (name) => attributes.delete(name),
    },
    addEventListener(type, fn) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) ?? []).filter((candidate) => candidate !== fn));
    },
  };
  return env;
}

/** 没有 requestAnimationFrame 的 Node 里，installDragCollapse 会同步判过冲。 */
function settleDrag(env, toggles, { endX, startX = 500 }) {
  env.handle.style.left = '280px'; // 拖拽起点宽度
  env.dispatch('pointerdown', { button: 0, pointerId: 1, clientX: startX, target: env.target });
  env.handle.style.left = '264px'; // 宿主已把宽度钳在最小宽度
  env.dispatch('pointermove', { pointerId: 1, clientX: endX });
  env.dispatch('pointerup', { pointerId: 1, clientX: endX });
  return toggles;
}

test('拖拽收起：越过最小宽度超过阈值才折叠，松手后只剩 pointerdown 监听', () => {
  const previousDocument = globalThis.document;
  const env = createDragEnv('darwin');
  const toggles = [];
  // 起点 280px、渲染 264px 时：过冲 = (startX - endX) - 16，换算成对应的 endX。
  const endXFor = (overshoot, startX = 500) => startX - overshoot - 16;
  try {
    const dispose = installDragCollapse({ toggleSidebar: () => toggles.push('toggle') });

    settleDrag(env, toggles, { endX: endXFor(DRAG_COLLAPSE_OVERSHOOT + 4) });
    assert.deepEqual(toggles, ['toggle']);
    assert.equal(env.listenerCount(), 1, '松手后应移除本次拖拽的临时监听');

    settleDrag(env, toggles, { endX: endXFor(DRAG_COLLAPSE_OVERSHOOT - 4) }); // 差一点 → 不折叠
    assert.deepEqual(toggles, ['toggle']);

    settleDrag(env, toggles, {
      startX: 600,
      endX: endXFor(DRAG_COLLAPSE_OVERSHOOT + 4, 600),
    }); // 起点不同，规则相同
    assert.deepEqual(toggles, ['toggle', 'toggle']);

    dispose();
    assert.equal(env.listenerCount(), 0, '卸载后不应留下任何监听');
  } finally {
    globalThis.document = previousDocument;
  }
});

test('拖拽收起：越过阈值时指针切到「松手折叠」，回退或松手后复原', () => {
  const previousDocument = globalThis.document;
  const env = createDragEnv('darwin');
  const toggles = [];
  const endXFor = (overshoot, startX = 500) => startX - overshoot - 16;
  try {
    const dispose = installDragCollapse({ toggleSidebar: () => toggles.push('toggle') });
    env.handle.style.left = '280px';
    env.dispatch('pointerdown', { button: 0, pointerId: 1, clientX: 500, target: env.target });
    env.handle.style.left = '264px';

    env.dispatch('pointermove', { pointerId: 1, clientX: endXFor(DRAG_COLLAPSE_OVERSHOOT - 8) });
    assert.equal(env.armed(), false, '未达阈值不应切换指针');

    env.dispatch('pointermove', { pointerId: 1, clientX: endXFor(DRAG_COLLAPSE_OVERSHOOT + 8) });
    assert.equal(env.armed(), true, '越过阈值应切换为折叠指针');

    env.dispatch('pointermove', { pointerId: 1, clientX: endXFor(DRAG_COLLAPSE_OVERSHOOT - 8) });
    assert.equal(env.armed(), false, '拖回阈值内应复原指针');

    env.dispatch('pointermove', { pointerId: 1, clientX: endXFor(DRAG_COLLAPSE_OVERSHOOT + 8) });
    env.dispatch('pointerup', { pointerId: 1, clientX: endXFor(DRAG_COLLAPSE_OVERSHOOT + 8) });
    assert.equal(env.armed(), false, '松手后必须复原指针');
    assert.deepEqual(toggles, ['toggle']);
    dispose();
  } finally {
    globalThis.document = previousDocument;
  }
});

test('拖拽收起：非 darwin 平台与右侧栏手柄都不接管', () => {
  const previousDocument = globalThis.document;
  try {
    const win32 = createDragEnv('win32');
    const toggles = [];
    const disposeWin32 = installDragCollapse({ toggleSidebar: () => toggles.push('toggle') });
    settleDrag(win32, toggles, { endX: 400 });
    assert.deepEqual(toggles, [], '非 darwin 不接管拖拽语义');
    disposeWin32();

    const darwin = createDragEnv('darwin');
    darwin.target.closest = () => null; // 右侧栏手柄：不是 sidebar
    const disposeDarwin = installDragCollapse({ toggleSidebar: () => toggles.push('toggle') });
    settleDrag(darwin, toggles, { endX: 400 });
    assert.deepEqual(toggles, [], '右侧栏拖拽不应折叠左侧栏');
    disposeDarwin();
  } finally {
    globalThis.document = previousDocument;
  }
});

/**
 * 面板拖拽控制器的最小 document 替身：只实现安装/快速点击/清理路径所需的
 * 属性、监听表和行几何，用来验证不会在 setup/teardown 阶段抛错。
 */
function createPanelEnv(platform) {
  const attributes = new Map();
  const listeners = new Map();
  const rect = { top: 0, left: 0, right: 100, bottom: 32, width: 100, height: 32 };
  const style = { removeProperty() {}, setProperty() {} };
  const classList = { add() {}, remove() {} };
  const nav = {};
  const row = {
    style,
    classList,
    getAttribute: () => null,
    parentElement: nav,
    closest: (selector) => selector === 'nav' ? nav : selector === 'button' ? row : null,
    getBoundingClientRect: () => rect,
  };
  const marker = {
    nodeType: 1,
    getAttribute: (name) => (name === 'data-dfm-id' ? 'panel-0' : null),
    closest: (selector) =>
      selector === '[data-dfm-id]' ? marker : selector === 'button' ? row : null,
    parentElement: null,
  };
  const rail = {
    querySelectorAll: () => [railButton],
    getBoundingClientRect: () => rect,
  };
  const railButton = {
    nodeType: 1,
    style,
    classList,
    getAttribute: (name) =>
      name === 'data-panel-id'
        ? 'panel-0'
        : name === 'data-fold-minimal'
          ? 'panel'
          : null,
    closest: (selector) =>
      selector === '[data-fold-minimal="rail"]'
        ? rail
        : selector === '[data-fold-minimal="panel"][data-panel-id]'
          ? railButton
          : null,
    getBoundingClientRect: () => rect,
    parentElement: null,
  };
  const document = {
    documentElement: {
      getAttribute: (name) =>
        name === 'data-platform' ? platform : (attributes.get(name) ?? null),
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: (name) => attributes.delete(name),
      hasAttribute: (name) => attributes.has(name),
    },
    addEventListener(type, fn) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener(type, fn) {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((candidate) => candidate !== fn),
      );
    },
    querySelector(selector) {
      if (selector === '[data-fold-minimal="rail"]') return rail;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-dfm-id]') return [marker];
      if (selector === '[data-fold-minimal="rail"] [data-fold-minimal="panel"][data-panel-id]') {
        return [railButton];
      }
      return [];
    },
  };
  return {
    document,
    marker,
    rail,
    railButton,
    listenerCount: () => [...listeners.values()].reduce((total, fns) => total + fns.length, 0),
    dispatch(type, event) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn(event);
    },
  };
}

test('面板拖拽控制器：安装、快速点击、卸载都干净地增删监听', () => {
  const previousDocument = globalThis.document;
  try {
    const panelsSource = { getSnapshot: () => fakePanels(2) };

    const expanded = createPanelEnv('darwin');
    globalThis.document = expanded.document;
    const layout = createPanelLayoutStore({ enabled: true, order: [], hidden: [] });
    const disposeExpanded = installPanelDrag(layout, panelsSource);
    const base = expanded.listenerCount();
    assert.equal(base, 1, '只应常驻一个 pointerdown 监听');
    expanded.dispatch('pointerdown', {
      button: 0,
      pointerId: 1,
      clientX: 50,
      clientY: 10,
      target: expanded.marker,
    });
    assert.equal(expanded.listenerCount(), base + 4, '拖拽期间临时挂指针与 Esc 监听');
    expanded.dispatch('pointerup', { pointerId: 1, clientX: 50, clientY: 10 });
    assert.equal(expanded.listenerCount(), base, '快速点击后撤掉临时监听');
    disposeExpanded();
    assert.equal(expanded.listenerCount(), 0);

    const rail = createPanelEnv('darwin');
    globalThis.document = rail.document;
    const disposeRail = installRailDrag(layout, panelsSource);
    rail.dispatch('pointerdown', {
      button: 0,
      pointerId: 2,
      clientX: 20,
      clientY: 14,
      target: rail.railButton,
    });
    rail.dispatch('pointerup', { pointerId: 2, clientX: 20, clientY: 14 });
    assert.equal(rail.listenerCount(), 1, '快速点击后只剩常驻 pointerdown');
    disposeRail();
    assert.equal(rail.listenerCount(), 0);

    const disabled = createPanelEnv('darwin');
    globalThis.document = disabled.document;
    const off = createPanelLayoutStore({ enabled: false, order: [], hidden: [] });
    const disposeOff = installPanelDrag(off, panelsSource);
    disabled.dispatch('pointerdown', {
      button: 0,
      pointerId: 3,
      clientX: 50,
      clientY: 10,
      target: disabled.marker,
    });
    assert.equal(disabled.listenerCount(), 1, '开关关闭时不应进入拖拽会话');
    disposeOff();
  } finally {
    globalThis.document = previousDocument;
  }
});

test('收起面板只隐藏宿主主列表行，二级列表、浮层和工具栏复用图标时仍可见', () => {
  const store = createPanelLayoutStore({ enabled: true, hidden: ['panel-0'] });
  const Shadow = createShadowPanel('panel-0', () => null, store);
  const nav = {};
  const savedRef = fakeReact.useRef;
  const savedEffect = fakeReact.useLayoutEffect;
  try {
    for (const location of ['host', 'tray', 'popup', 'rail']) {
      const parent = location === 'host' ? nav : {};
      const attrs = new Map();
      const row = {
        style: {},
        parentElement: parent,
        closest: (selector) => selector === 'nav' && location !== 'popup' && location !== 'rail' ? nav : null,
        setAttribute: (name, value) => attrs.set(name, value),
      };
      const marker = { closest: (selector) => selector === 'button' ? row : null };
      fakeReact.useRef = () => ({ current: marker });
      fakeReact.useLayoutEffect = (effect) => effect();
      Shadow({ size: 16 });
      assert.equal(row.style.display, location === 'host' ? 'none' : undefined, location);
      assert.equal(attrs.has('data-dfm-row-id'), location === 'host', location);
    }
  } finally {
    fakeReact.useRef = savedRef;
    fakeReact.useLayoutEffect = savedEffect;
  }
});

test('原生更多分组在固定动作之前注册；收起时显示隐藏项，展开二级区或拖动时不重复显示', () => {
  const { registered } = renderRail({ activePanelId: null });
  const settings = registered.find((item) => item.options.name === 'plugins.bundle.config');
  settings.options.inject().setLayoutEnabled(true);
  const entry = registered.find((item) => item.options.id === 'fold-minimal.more-anchor');
  assert.ok(entry.options.order < 0);
  assert.ok(entry.options.inject().hooks.panels);
  const layout = { enabled: true, hidden: ['panel-1', 'panel-2'], order: ['panel-2', 'panel-0', 'panel-1'] };
  function items(state) {
    return flatten(entry.component({
      useLayout: (select) => select(state),
      usePanels: (select) => select(fakePanels(3)),
      usePanelInfo: (select) => select({ activePanelId: null }),
    })).filter((node) => node.props?.trayItem).map((node) => node.props.panel.id);
  }
  assert.deepEqual(items(layout), ['panel-2', 'panel-1']);
  assert.deepEqual(items({ ...layout, trayOpen: true }), []);
  assert.deepEqual(items({ ...layout, dragActive: true }), []);
  assert.deepEqual(items({ ...layout, enabled: false }), []);
});

test('跨组放置一次提交顺序与显隐，恢复到指定位置时没有中间状态', () => {
  const panels = fakePanels(5);
  const store = createPanelLayoutStore({ enabled: true, hidden: ['panel-3', 'panel-4'] });
  const snapshots = [];
  store.subscribe(() => snapshots.push(store.getSnapshot()));
  placePanel(store, panels, 'panel-4', 0, false);
  assert.equal(snapshots.length, 1);
  assert.deepEqual(snapshots[0].order, ['panel-4', 'panel-0', 'panel-1', 'panel-3', 'panel-2']);
  assert.deepEqual(snapshots[0].hidden, ['panel-3']);
  placePanel(store, panels, 'panel-0', 0, true);
  assert.equal(snapshots.length, 2);
  const state = store.getSnapshot();
  const split = splitPanels(panelsInOrder(panels, state.order), state.hidden);
  assert.deepEqual(split.hidden.map((panel) => panel.id), ['panel-0', 'panel-3']);
  assert.deepEqual(split.visible.map((panel) => panel.id), ['panel-4', 'panel-1', 'panel-2']);
  placePanel(store, panels, 'removed-panel', 0, false);
  assert.equal(snapshots.length, 2, '失效面板不应被加回顺序');
});

test('从更多拖出面板时所有收起项保留在隐藏区，松手前不修改状态', () => {
  const layout = { enabled: true, hidden: ['panel-3', 'panel-4'], order: [], dragActive: true, dragPanelId: 'panel-4' };
  const elements = flatten(renderRail({ activePanelId: null }, fakePanels(5), layout).tree);
  assert.deepEqual(elements.filter((node) => node.props?.panel).map((node) => node.props.panel.id),
    ['panel-0', 'panel-1', 'panel-2', 'panel-3', 'panel-4']);
  assert.deepEqual(layout.hidden, ['panel-3', 'panel-4']);
  const hidden = elements.find((node) => node.props['data-dfm-rail-zone'] === 'hidden');
  assert.deepEqual(flatten(hidden).filter((node) => node.props.panel).map((node) => node.props.panel.id), ['panel-3', 'panel-4']);
});

test('拖拽取消、关闭开关和无效落点均保留布局并清除拖动状态', () => {
  const previousDocument = globalThis.document;
  try {
    for (const ending of ['pointercancel', 'disable', 'outside']) {
      const env = createPanelEnv('darwin');
      globalThis.document = env.document;
      const store = createPanelLayoutStore({ enabled: true, hidden: ['panel-1'], order: ['panel-0', 'panel-1'] });
      const dispose = installRailDrag(store, { getSnapshot: () => fakePanels(2) });
      env.dispatch('pointerdown', { button: 0, pointerId: 1, clientX: 20, clientY: 14, target: env.railButton });
      env.dispatch('pointermove', { pointerId: 1, clientX: 30, clientY: 14 });
      assert.equal(store.getSnapshot().dragActive, true);
      assert.equal(store.getSnapshot().dragPanelId, 'panel-0');
      if (ending === 'disable') store.setEnabled(false);
      else env.dispatch(ending === 'outside' ? 'pointerup' : 'pointercancel', { pointerId: 1, clientX: 500, clientY: 500 });
      assert.equal(store.getSnapshot().dragActive, false, ending);
      assert.equal(store.getSnapshot().dragPanelId, null, ending);
      assert.deepEqual(store.getSnapshot().order, ['panel-0', 'panel-1']);
      assert.deepEqual(store.getSnapshot().hidden, ['panel-1']);
      assert.equal(env.document.documentElement.hasAttribute('data-dfm-row-drag'), false);
      dispose();
    }
  } finally {
    globalThis.document = previousDocument;
  }
});

test('更多悬浮菜单：跨入浮层保持打开，二级区展开立即关闭且禁止再次打开', () => {
  const previousDocument = globalThis.document;
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const timers = new Map();
  let nextTimer = 0;
  const events = () => ({
    listeners: new Map(),
    addEventListener(name, fn) { this.listeners.set(name, fn); },
    removeEventListener(name) { this.listeners.delete(name); },
  });
  const anchor = { ...events(), contains: (node) => node === anchor || node === button };
  const menu = { contains: (node) => node === menu };
  let expanded = false;
  const button = {
    ...events(),
    getAttribute: () => String(expanded),
    click() {
      let stopped = false;
      this.listeners.get('click')?.({ preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
      if (!stopped) expanded = !expanded;
    },
  };
  const doc = {
    ...events(),
    querySelector: () => ({ closest: () => menu }),
  };
  const flushTimers = () => {
    const pending = [...timers.values()];
    timers.clear();
    for (const fn of pending) fn();
  };
  try {
    globalThis.document = doc;
    globalThis.setTimeout = (fn) => { timers.set(++nextTimer, fn); return nextTimer; };
    globalThis.clearTimeout = (id) => timers.delete(id);
    const store = createPanelLayoutStore({ enabled: true });
    const dispose = installSidebarMoreHover(button, anchor, store);
    anchor.listeners.get('pointerenter')();
    flushTimers();
    assert.equal(expanded, true);
    anchor.listeners.get('pointerleave')({ relatedTarget: menu });
    flushTimers();
    assert.equal(expanded, true, '跨过入口进入浮层时保留菜单');
    store.setTrayOpen(true);
    assert.equal(expanded, false, '展开二级区立即关闭浮层');
    anchor.listeners.get('pointerenter')();
    flushTimers();
    button.click();
    assert.equal(expanded, false, '展开时悬停和点击均不能重新打开浮层');
    store.setTrayOpen(false);
    anchor.listeners.get('pointerenter')();
    flushTimers();
    assert.equal(expanded, true);
    store.setDragActive(true, 'panel-0');
    assert.equal(expanded, false, '拖拽期间浮层让位');
    dispose();
    assert.equal(timers.size, 0);
    assert.equal(doc.listeners.size + button.listeners.size + anchor.listeners.size, 0);
  } finally {
    globalThis.document = previousDocument;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
  }
});

test('折叠工具栏跨区拖放：隐藏、恢复、隐藏区内排序和空分区都按落点提交', () => {
  const previousDocument = globalThis.document;
  const cases = [
    { hidden: ['panel-2', 'panel-3'], id: 'panel-0', x: 100, shown: ['panel-1'], folded: ['panel-0', 'panel-2', 'panel-3'] },
    { hidden: ['panel-2', 'panel-3'], id: 'panel-3', x: 1, shown: ['panel-3', 'panel-0', 'panel-1'], folded: ['panel-2'] },
    { hidden: ['panel-2', 'panel-3'], id: 'panel-3', x: 140, shown: ['panel-0', 'panel-1'], folded: ['panel-3', 'panel-2'] },
    { hidden: [], id: 'panel-0', x: 100, shown: ['panel-1', 'panel-2', 'panel-3'], folded: ['panel-0'] },
    { hidden: ['panel-0', 'panel-1', 'panel-2', 'panel-3'], id: 'panel-2', x: 10, shown: ['panel-2'], folded: ['panel-0', 'panel-1', 'panel-3'] },
    { hidden: ['panel-2', 'panel-3'], id: 'panel-0', x: 250, shown: ['panel-0', 'panel-1'], folded: ['panel-2', 'panel-3'] },
  ];
  try {
    for (const scenario of cases) {
      const env = createPanelEnv('darwin');
      globalThis.document = env.document;
      const panels = fakePanels(4);
      const store = createPanelLayoutStore({ enabled: true, hidden: scenario.hidden });
      const nodes = new Map();
      function zone(ids, left, right, firstIcon) {
        const rows = ids.map((id, index) => {
          const x = firstIcon + index * 30;
          const button = {
            classList: { add() {}, remove() {} },
            getAttribute: (name) => name === 'data-panel-id' ? id : null,
            closest: (selector) => selector === '[data-fold-minimal="rail"]' ? env.rail :
              selector === '[data-fold-minimal="panel"][data-panel-id]' ? button : null,
            getBoundingClientRect: () => ({ left: x, right: x + 28, top: 0, bottom: 28, width: 28, height: 28 }),
          };
          nodes.set(id, button);
          return button;
        });
        return {
          querySelectorAll: () => rows,
          getBoundingClientRect: () => ({ left, right, top: 0, bottom: 28, width: right - left, height: 28 }),
        };
      }
      const visible = zone(panels.filter((panel) => !scenario.hidden.includes(panel.id)).map((panel) => panel.id), 0, 70, 0);
      const hidden = zone(scenario.hidden, 80, 220, 140);
      env.rail.querySelector = (selector) => selector === '[data-dfm-rail-zone="visible"]' ? visible : hidden;
      const dispose = installRailDrag(store, { getSnapshot: () => panels });
      const button = nodes.get(scenario.id);
      const start = button.getBoundingClientRect().left + 14;
      env.dispatch('pointerdown', { button: 0, pointerId: 10, clientX: start, clientY: 14, target: button });
      env.dispatch('pointermove', { pointerId: 10, clientX: start + 8, clientY: 14 });
      env.dispatch('pointermove', { pointerId: 10, clientX: scenario.x, clientY: 14 });
      assert.deepEqual(store.getSnapshot().hidden, scenario.hidden, '松手前不改变分组');
      env.dispatch('pointerup', { pointerId: 10, clientX: scenario.x, clientY: 14 });
      const state = store.getSnapshot();
      const ordered = panelsInOrder(panels, state.order);
      assert.deepEqual(ordered.filter((panel) => !state.hidden.includes(panel.id)).map((panel) => panel.id), scenario.shown);
      assert.deepEqual(ordered.filter((panel) => state.hidden.includes(panel.id)).map((panel) => panel.id), scenario.folded);
      dispose();
    }
  } finally {
    globalThis.document = previousDocument;
  }
});

test('布局状态去重：重复开关/顺序/显隐不写存储，临时拖动状态只通知', () => {
  const storage = Object.getOwnPropertyDescriptor(window, 'localStorage');
  const previousDocument = globalThis.document;
  let writes = 0;
  let cookieWrites = 0;
  try {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: { setItem() { writes += 1; } } });
    globalThis.document = { set cookie(value) { cookieWrites += 1; } };
    const store = createPanelLayoutStore({ enabled: true, order: ['a', 'b'], hidden: ['b'] });
    let notifications = 0;
    store.subscribe(() => { notifications += 1; });
    const original = store.getSnapshot();
    store.setEnabled(true);
    store.setToolbarEnabled(true);
    store.setOrder(['a', 'b', 'a']);
    store.setHidden(['b']);
    store.setPlacement(['a', 'b'], ['b']);
    store.setTrayOpen(false);
    store.setDragActive(false);
    assert.equal(store.getSnapshot(), original, '没有变化时保留快照引用');
    assert.deepEqual([notifications, writes, cookieWrites], [0, 0, 0]);
    store.setTrayOpen(true);
    store.setTrayOpen(true);
    store.setDragActive(true, 'a');
    store.setDragActive(true, 'a');
    store.setDragActive(false);
    assert.deepEqual([notifications, writes, cookieWrites], [3, 0, 0]);
    store.setPlacement(['b', 'a'], []);
    assert.deepEqual([notifications, writes, cookieWrites], [4, 1, 1]);
  } finally {
    if (storage) Object.defineProperty(window, 'localStorage', storage);
    else delete window.localStorage;
    globalThis.document = previousDocument;
  }
});

test('存储受限：cookie/localStorage 属性读取或写入抛错不阻止加载与内存更新', () => {
  const storage = Object.getOwnPropertyDescriptor(window, 'localStorage');
  const previousDocument = globalThis.document;
  const fallback = { enabled: true, toolbar: false, back: true, order: ['b', 'a'], hidden: ['b'] };
  try {
    globalThis.document = { get cookie() { throw new Error('cookie blocked'); }, set cookie(value) { throw new Error('cookie blocked'); } };
    Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify(fallback) } });
    assert.deepEqual(readLayoutPrefs(), fallback, 'cookie 不可读时仍尝试 localStorage');
    globalThis.document = { cookie: `${LAYOUT_COOKIE}=%broken` };
    assert.deepEqual(readLayoutPrefs(), fallback, '损坏 cookie 不影响镜像回退');
    globalThis.document = { cookie: `${LAYOUT_COOKIE}=${encodeURIComponent(JSON.stringify({ enabled: false }))}` };
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('storage blocked'); } });
    assert.equal(readLayoutPrefs().enabled, false, '有效 cookie 优先，不触碰镜像');
    globalThis.document = { get cookie() { throw new Error('cookie blocked'); }, set cookie(value) { throw new Error('cookie blocked'); } };
    assert.deepEqual(readLayoutPrefs(), { enabled: false, toolbar: true, back: true, order: [], hidden: [] });
    const store = createPanelLayoutStore(readLayoutPrefs());
    assert.doesNotThrow(() => store.setEnabled(true));
    assert.equal(store.getSnapshot().enabled, true);
  } finally {
    if (storage) Object.defineProperty(window, 'localStorage', storage);
    else delete window.localStorage;
    globalThis.document = previousDocument;
  }
});

test('面板 id 与对象原型同名时，排序/收起/影子注册仍覆盖全部面板', () => {
  const ids = ['__proto__', 'constructor', 'toString', 'panel'];
  const panels = ids.map((id, order) => ({ id, order, label: id, Icon: () => null }));
  assert.deepEqual(mergePanelOrder([], ids, ids), ids);
  assert.deepEqual(splitPanels(panels, ['panel']).hidden.map((panel) => panel.id), ['panel']);
  assert.deepEqual(panelIdsOf(panelsInOrder(panels, [...ids].reverse())), [...ids].reverse());
  assert.deepEqual(replaceVisibleOrder(ids, ['panel'], ids.slice(0, 3).reverse()), ['toString', 'constructor', '__proto__', 'panel']);
  assert.deepEqual(replaceHiddenOrder(ids, ids.slice(0, 3), ids.slice(0, 3).reverse()), ['toString', 'constructor', '__proto__', 'panel']);
  const registered = [];
  const manager = createShadowManager({ slots: {
    entries: () => panels.map((panel) => ({ options: panel, component: panel.Icon })),
    register(options) { registered.push(options.id); return () => {}; },
  } }, createPanelLayoutStore({ enabled: true }));
  manager.sync();
  assert.deepEqual(registered, ids);
  manager.dispose();
});

test('影子账本：读取失败保留现状，重排序复用包装，移除/关闭后完整清理', () => {
  const Icon = () => null;
  const inject = () => ({});
  const original = { options: { id: 'a', label: 'A', order: 0, priority: 2 }, component: Icon, inject, locale: 'test' };
  let originals = [original];
  let failRead = false;
  let failRegister = false;
  const registrations = [];
  const active = new Set();
  const store = createPanelLayoutStore({ enabled: true });
  const manager = createShadowManager({ slots: {
    entries() { if (failRead) throw new Error('unavailable'); return originals; },
    register(options, component) {
      if (failRegister) throw new Error('unavailable');
      const entry = { options, component };
      registrations.push(entry);
      active.add(entry);
      return () => active.delete(entry);
    },
  } }, store);
  try {
    manager.sync();
    assert.equal(active.size, 1);
    assert.equal(registrations[0].options.priority, 1);
    assert.equal(registrations[0].options.inject, inject);
    manager.sync();
    assert.equal(registrations.length, 1, '未变化时不重复注册');
    failRead = true;
    assert.doesNotThrow(() => manager.sync());
    assert.equal(active.size, 1, '暂时读取失败不撤销现有影子');
    failRead = false;
    originals = [original, { options: { id: 'b', order: 1 }, component: Icon }];
    store.setOrder(['b', 'a']);
    manager.sync();
    assert.equal(active.size, 2);
    const currentA = [...active].find((entry) => entry.options.id === 'a');
    assert.equal(currentA.component, registrations[0].component, '纯顺序变化保留组件身份');
    originals = [original];
    manager.sync();
    assert.equal(active.size, 1, '原始面板移除时撤销其影子');
    store.setEnabled(false);
    manager.sync();
    assert.equal(active.size, 0);
    store.setEnabled(true);
    failRegister = true;
    assert.doesNotThrow(() => manager.sync());
    assert.equal(active.size, 0);
    failRegister = false;
    manager.sync();
    assert.equal(active.size, 1, '注册恢复后可重试');
  } finally { manager.dispose(); }
  assert.equal(active.size, 0);
});

function mockAnimationFrames(t) {
  const pending = new Map();
  let nextId = 0;
  t.mock.method(globalThis, 'requestAnimationFrame', (callback) => { pending.set(++nextId, callback); return nextId; });
  t.mock.method(globalThis, 'cancelAnimationFrame', (id) => pending.delete(id));
  return {
    pending,
    flush() { const callbacks = [...pending.values()]; pending.clear(); for (const callback of callbacks) callback(); },
  };
}

test('拖拽收起：停用/失焦取消待执行帧，正在拖动时失焦清理指针与监听', (t) => {
  const previousDocument = globalThis.document;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame ??= () => 0;
  globalThis.cancelAnimationFrame ??= () => {};
  const frames = mockAnimationFrames(t);
  const events = new Map();
  window.addEventListener = (name, fn) => events.set(name, fn);
  window.removeEventListener = (name) => events.delete(name);
  try {
    for (const ending of ['dispose', 'blur', 'active-blur', 'settle']) {
      const env = createDragEnv('darwin');
      let toggles = 0;
      const dispose = installDragCollapse({ toggleSidebar() { toggles += 1; } });
      env.dispatch('pointerdown', { button: 0, pointerId: 1, clientX: 500, target: env.target });
      env.handle.style.left = '264px';
      env.dispatch('pointermove', { pointerId: 1, clientX: 380 });
      assert.equal(env.armed(), true);
      if (ending !== 'active-blur') {
        env.dispatch('pointerup', { pointerId: 1, clientX: 380 });
        assert.equal(frames.pending.size, 1);
      }
      if (ending === 'dispose') dispose();
      else if (ending !== 'settle') events.get('blur')();
      frames.flush();
      assert.equal(toggles, ending === 'settle' ? 1 : 0, ending);
      assert.equal(env.armed(), false);
      dispose();
      assert.equal(env.listenerCount(), 0);
      assert.equal(events.size, 0);
      assert.equal(frames.pending.size, 0);
    }
  } finally {
    delete window.addEventListener;
    delete window.removeEventListener;
    t.mock.restoreAll();
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCancel;
    globalThis.document = previousDocument;
  }
});

test('拖拽测量按帧合并：同帧 100 次 pointermove 只测量一次，取消后没有残余帧', (t) => {
  const previousDocument = globalThis.document;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame ??= () => 0;
  globalThis.cancelAnimationFrame ??= () => {};
  const frames = mockAnimationFrames(t);
  try {
    for (const install of [installPanelDrag, installRailDrag]) {
      const env = createPanelEnv('darwin');
      globalThis.document = env.document;
      let measurements = 0;
      const query = env.document.querySelector.bind(env.document);
      env.document.querySelector = (selector) => { measurements += 1; return query(selector); };
      const store = createPanelLayoutStore({ enabled: true });
      const dispose = install(store, { getSnapshot: () => fakePanels(2) });
      env.dispatch('pointerdown', { button: 0, pointerId: 1, clientX: 20, clientY: 14, target: install === installPanelDrag ? env.marker : env.railButton });
      for (let index = 0; index < 100; index += 1) env.dispatch('pointermove', { pointerId: 1, clientX: 30 + index, clientY: 14 });
      assert.equal(measurements, 0, '提交动画帧前不做布局查询');
      assert.equal(frames.pending.size, 1);
      frames.flush();
      const firstFrameReads = measurements;
      assert.ok(firstFrameReads > 0);
      for (let index = 0; index < 100; index += 1) env.dispatch('pointermove', { pointerId: 1, clientX: 40 + index, clientY: 14 });
      assert.equal(measurements, firstFrameReads);
      assert.equal(frames.pending.size, 1);
      env.dispatch('pointercancel', { pointerId: 1 });
      assert.equal(frames.pending.size, 0);
      frames.flush();
      assert.equal(store.getSnapshot().dragActive, false);
      dispose();
      assert.equal(env.listenerCount(), 0);
    }
  } finally {
    t.mock.restoreAll();
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCancel;
    globalThis.document = previousDocument;
  }
});

test('apply 组件生命周期：默认不装排序监听，重复开关不重复注册，关闭/卸载清空资源', () => {
  const previousDocument = globalThis.document;
  const env = createPanelEnv('darwin');
  globalThis.document = env.document;
  const effects = [];
  const entries = new Set();
  let totalRegistrations = 0;
  const effect = (callback) => { const dispose = callback(); if (typeof dispose === 'function') effects.push(dispose); return dispose; };
  const ctx = {
    effect,
    locale: { register: () => () => {}, subscribe: () => () => {} },
    slots: {
      entries: () => [], entriesOfSlot: () => [], subscribe: () => () => {},
      inject: (_name, callback) => effect(callback),
      register(options, component) {
        totalRegistrations += 1;
        const entry = { options, component };
        entries.add(entry);
        return () => entries.delete(entry);
      },
    },
    layout: { toggleSidebar() {}, selectPanel() {} },
    uiWorkspace: { startSession() {} },
    shortcuts: { catalog: { getSnapshot: () => [], subscribe: () => () => {} } },
    get: () => undefined,
  };
  try {
    exports.apply(ctx);
    const settings = [...entries].find((entry) => entry.options.name === 'plugins.bundle.config').options.inject();
    assert.equal(env.listenerCount(), 1, '默认只安装拖到最小收起的监听');
    const initialRegistrations = totalRegistrations;
    settings.setLayoutEnabled(true);
    assert.equal(env.listenerCount(), 3, '开启排序后安装两处 pointerdown');
    const enabledRegistrations = totalRegistrations;
    assert.equal(enabledRegistrations, initialRegistrations + 1, '更多动作仅注册一次');
    settings.setLayoutEnabled(true);
    assert.equal(totalRegistrations, enabledRegistrations);
    settings.setToolbarEnabled(false);
    assert.equal(env.listenerCount(), 2);
    assert.equal([...entries].some((entry) => entry.options.name === SLOT), false);
    settings.setLayoutEnabled(false);
    assert.equal(env.listenerCount(), 0, '两个组件都关闭后无拖拽监听');
    assert.equal([...entries].some((entry) => entry.options.id === 'fold-minimal.more-anchor'), false);
    settings.setLayoutEnabled(true);
    settings.setToolbarEnabled(true);
    assert.equal(env.listenerCount(), 3, '重新启用只恢复一组监听');
    while (effects.length) effects.pop()();
    assert.equal(env.listenerCount(), 0);
    assert.equal(entries.size, 0);
  } finally {
    while (effects.length) effects.pop()();
    globalThis.document = previousDocument;
  }
});

test('影子图标只订阅自己的隐藏布尔值，拖拽/二级区/顺序变化保持选中快照稳定', () => {
  const store = createPanelLayoutStore({ enabled: true, hidden: ['b'] });
  const Shadow = createShadowPanel('a', () => null, store);
  const previousHook = fakeReact.useSyncExternalStore;
  const snapshots = [];
  let unsubscribe;
  fakeReact.useSyncExternalStore = (subscribe, getSnapshot) => {
    snapshots.push(getSnapshot());
    unsubscribe = subscribe(() => snapshots.push(getSnapshot()));
    return getSnapshot();
  };
  try {
    Shadow({ size: 16 });
    store.setDragActive(true, 'a');
    store.setTrayOpen(true);
    store.setOrder(['b', 'a']);
    assert.deepEqual(snapshots, [false, false, false, false]);
    store.hidePanel('a');
    assert.equal(snapshots.at(-1), true);
    store.showPanel('a');
    assert.equal(snapshots.at(-1), false);
  } finally {
    unsubscribe?.();
    fakeReact.useSyncExternalStore = previousHook;
  }
});


/* ─────────────── 0.2.2 官方固定菜单兼容：新增纯逻辑 ─────────────── */

test('版本检测：prerelease 比较、boot release 与官方 entry-customization 探测', () => {
  assert.equal(compareVersions('0.2.2-rc.2', '0.2.2-rc.1') > 0, true);
  assert.equal(compareVersions('0.2.2', '0.2.2-rc.9') > 0, true);
  assert.equal(compareVersions('0.2.1', '0.2.2-rc.2') < 0, true);
  assert.equal(compareVersions('0.2.2-rc.2', '0.2.2-rc.2'), 0);
  assert.deepEqual(parseVersion('v0.2.2-rc.2'), { parts: [0, 2, 2], pre: ['rc', '2'] });
  assert.equal(parseVersion('dev'), null);

  const previous = globalThis.window.__DSH_BOOT__;
  try {
    globalThis.window.__DSH_BOOT__ = {
      release: { version: '0.2.2-rc.2' },
      entries: [{ id: '@deepseek-ai/dsh-client-ui-entry-customization' }],
    };
    assert.deepEqual(readBootRelease(), { version: '0.2.2-rc.2', commit: undefined });
    const caps = createCapabilities(makeCtx([]));
    assert.equal(caps.officialPins, true);
    assert.equal(caps.releaseVersion, '0.2.2-rc.2');

    globalThis.window.__DSH_BOOT__ = {
      release: { version: '0.2.2-rc.1' },
      entries: [],
    };
    assert.equal(createCapabilities(makeCtx([])).officialPins, false);
    assert.equal(hasOfficialMore({ slots: { entriesOfSlot: () => [{ options: { id: 'entry-customization' } }] } }), true);
  } finally {
    if (previous === undefined) delete globalThis.window.__DSH_BOOT__;
    else globalThis.window.__DSH_BOOT__ = previous;
  }
});

test('新版切分：只平铺固定项，未固定项与溢出项一起进「更多」', () => {
  const panels = fakePanels(6);
  const fivePinned = splitOfficialPanels(panels.slice(0, 5), panels.slice(0, 5).map((panel) => panel.id), 4);
  assert.deepEqual(fivePinned.visible.map((panel) => panel.id), ['panel-0', 'panel-1', 'panel-2']);
  assert.deepEqual(fivePinned.more.map((panel) => panel.id), ['panel-3', 'panel-4']);

  const mixed = splitOfficialPanels(panels, ['panel-0', 'panel-1', 'panel-2', 'panel-3'], 4);
  assert.deepEqual(mixed.visible.map((panel) => panel.id), ['panel-0', 'panel-1', 'panel-2']);
  assert.deepEqual(mixed.more.map((panel) => panel.id), ['panel-3', 'panel-4', 'panel-5']);
  assert.deepEqual(mixed.unpinned.map((panel) => panel.id), ['panel-4', 'panel-5']);

  const spare = splitOfficialPanels(panels.slice(0, 3), ['panel-0', 'panel-1'], 4);
  assert.deepEqual(spare.visible.map((panel) => panel.id), ['panel-0', 'panel-1']);
  assert.deepEqual(spare.more.map((panel) => panel.id), ['panel-2']);

  const unknown = splitOfficialPanels(panels.slice(0, 5), null, 4);
  assert.deepEqual(unknown.visible.map((panel) => panel.id), ['panel-0', 'panel-1', 'panel-2']);
  assert.deepEqual(unknown.more.map((panel) => panel.id), ['panel-3', 'panel-4']);

  const nonePinned = splitOfficialPanels(panels.slice(0, 3), [], 4);
  assert.deepEqual(nonePinned.visible, []);
  assert.deepEqual(nonePinned.more.map((panel) => panel.id), ['panel-0', 'panel-1', 'panel-2']);
});

test('分组换位：只改目标分组，组外位置不动', () => {
  assert.deepEqual(
    replaceBucketOrder(['a', 'b', 'c', 'd', 'e'], ['a', 'c', 'e'], ['e', 'a', 'c']),
    ['e', 'b', 'a', 'd', 'c'],
  );
  assert.deepEqual(replaceBucketOrder(['a', 'b'], ['a'], ['a', 'b']), ['a', 'b']);

  const store = createPanelLayoutStore({ enabled: true, order: [], hidden: [] });
  const panels = fakePanels(4);
  assert.equal(reorderBucket(store, panels, ['panel-0', 'panel-2'], 'panel-2', 0), true);
  assert.deepEqual(store.getSnapshot().order, ['panel-2', 'panel-1', 'panel-0', 'panel-3']);
  assert.equal(reorderBucket(store, panels, ['missing'], 'panel-0', 0), false);
});

test('固定状态 store：官方 entries 权威回写、DOM 回写和去重', () => {
  const pins = createPinsStore();
  assert.equal(pins.getPinned(), null);
  const panels = fakePanels(3);
  pins.setFromEntries([
    { id: 'panel-0', pinned: true },
    { id: 'panel-1', pinned: false },
    { id: 'panel-2', pinned: true },
  ], panels);
  assert.deepEqual(pins.getPinned(), ['panel-0', 'panel-2']);
  pins.setFromDom(panels, ['panel-0', 'panel-1']);
  assert.deepEqual(pins.getPinned(), ['panel-0', 'panel-1']);
  pins.setPinned(['panel-0', 'panel-0', '', null, 'panel-1']);
  assert.deepEqual(pins.getPinned(), ['panel-0', 'panel-1']);
});

test('悬停走廊：按钮与 portal 浮层之间的 6px 间隙仍算命中', () => {
  const button = { left: 0, right: 28, top: 0, bottom: 28 };
  const menu = { left: 0, right: 180, top: 34, bottom: 100 };
  assert.equal(hoverBridgeContains(14, 31, button, menu), true);
  assert.equal(hoverBridgeContains(14, 14, button, menu), true);
  assert.equal(hoverBridgeContains(14, 60, button, menu), true);
  assert.equal(hoverBridgeContains(200, 60, button, menu), false);
  assert.equal(hoverBridgeContains(14, 200, button, menu), false);
});

test('宿主行识别兼容 0.2.2 的 panelEntry 包装，提交排序时仍以按钮为行', () => {
  const nav = { tagName: 'NAV', parentElement: null };
  const wrapper = { tagName: 'DIV', parentElement: nav };
  const button = {
    tagName: 'BUTTON',
    parentElement: wrapper,
    closest(selector) {
      if (selector === 'button') return button;
      if (selector === 'nav') return nav;
      return null;
    },
  };
  const marker = {
    closest(selector) {
      return selector === 'button' ? button : null;
    },
  };
  assert.equal(hostPanelRow(marker), button);
  assert.equal(hostPanelRowItem(marker), wrapper);
});

test('新版折叠工具栏：只平铺官方固定项，未固定项进「更多」', () => {
  const layout = { enabled: true, order: [], hidden: [], trayOpen: false, backEnabled: true };
  const panels = fakePanels(5);
  const pinned = ['panel-0', 'panel-2', 'panel-3', 'panel-4'];
  const { tree, registered } = renderRail(
    { activePanelId: null },
    panels,
    layout,
    { release: '0.2.2-rc.2', pinned },
  );
  const elements = flatten(tree);
  const buttons = elements.filter((element) => element.props.panel !== undefined);
  assert.deepEqual(
    buttons.map((element) => element.props.panel.id),
    ['panel-0', 'panel-2', 'panel-3'],
    '固定项超过 4 个时保留前 3 个平铺',
  );
  const overflow = elements.find(
    (element) => typeof element.type === 'function' && Array.isArray(element.props.hiddenPanels),
  );
  assert.ok(overflow, '新版应保留「更多」入口');
  assert.equal(overflow.props.officialPins, true);
  assert.deepEqual(overflow.props.hiddenPanels, [], '新版不再维护插件自己的隐藏项');
  assert.deepEqual(
    overflow.props.panels.map((panel) => panel.id),
    ['panel-4'],
    '固定溢出项单独放在前组',
  );
  assert.deepEqual(overflow.props.unpinnedPanels.map((panel) => panel.id), ['panel-1']);

  const moreObserver = registered.find(
    (candidate) =>
      candidate.options.name === 'sidebar.panellist.actions' &&
      candidate.options.id === 'fold-minimal.more-observer',
  );
  assert.ok(moreObserver, '新版应在官方「更多」注册无渲染探针');
  const oldAnchor = registered.find(
    (candidate) =>
      candidate.options.name === 'sidebar.panellist.actions' &&
      candidate.options.id === 'fold-minimal.more-anchor',
  );
  assert.equal(oldAnchor, undefined, '新版不应再注册插件自己的收起分组');
});

test('返回会话独立开关：关闭后折叠态与展开态入口都隐藏', () => {
  const panels = fakePanels(2);
  const active = renderRail(
    { activePanelId: 'plugins' },
    panels,
    { enabled: false, order: [], hidden: [], backEnabled: false },
  );
  assert.equal(railButton(flatten(active.tree), 'back-session'), undefined);

  const enabled = renderRail(
    { activePanelId: 'plugins' },
    panels,
    { enabled: false, order: [], hidden: [], backEnabled: true },
  );
  assert.ok(railButton(flatten(enabled.tree), 'back-session'));
});

test('新版固定状态未知时先按全部固定展示，观测到后再收进「更多」', () => {
  const panels = fakePanels(4);
  const layout = { enabled: true, order: [], hidden: [], backEnabled: true };
  const unknown = flatten(
    renderRail({ activePanelId: null }, panels, layout, {
      release: '0.2.2-rc.2',
      pinned: null,
    }).tree,
  ).filter((element) => element.props.panel !== undefined);
  assert.deepEqual(
    unknown.map((element) => element.props.panel.id),
    ['panel-0', 'panel-1', 'panel-2', 'panel-3'],
  );
  const known = flatten(
    renderRail({ activePanelId: null }, panels, layout, {
      release: '0.2.2-rc.2',
      pinned: ['panel-0', 'panel-1', 'panel-2'],
    }).tree,
  ).filter((element) => element.props.panel !== undefined);
  assert.deepEqual(
    known.map((element) => element.props.panel.id),
    ['panel-0', 'panel-1', 'panel-2'],
  );
});


test('无影子标记时按 aria-label 与面板顺序反推固定项', () => {
  const button = (label, popup) => ({
    tagName: 'BUTTON',
    getAttribute(name) {
      if (name === 'aria-label') return label;
      if (name === 'aria-haspopup') return popup;
      return null;
    },
  });
  const item = (child) => ({ tagName: 'DIV', querySelector: () => child });
  const nav = {
    children: [
      item(button('插件')),
      item(button('自动化任务')),
      item(button('更多面板', 'menu')),
    ],
  };
  const panels = [
    { id: 'plugins', label: '插件' },
    { id: 'obsidian', label: 'Obsidian MEMO' },
    { id: 'schedules', label: '自动化任务' },
  ];
  assert.deepEqual(pinnedIdsFromLabels(nav, panels), ['plugins', 'schedules']);
  nav.children = [item(button('插件')), item(button('Obsidian MEMO')), item(button('自动化任务'))];
  assert.deepEqual(pinnedIdsFromLabels(nav, panels), ['plugins', 'obsidian', 'schedules']);
});


test('官方「更多」整行命中：标题/空白可拖，图钉按钮不触发', () => {
  const marker = {
    getAttribute: (name) => (name === 'data-dfm-id' ? 'panel-0' : null),
  };
  const row = {
    contains: () => true,
    matches: () => false,
    querySelector: () => marker,
    getAttribute: () => null,
    parentElement: null,
  };
  const menu = { contains: (node) => node === row || node === pin };
  const label = {
    closest: (selector) => (selector === 'button' ? row : null),
  };
  assert.deepEqual(menuRowForTarget(label, menu, 'data-dfm-id'), { row, id: 'panel-0' });

  const pin = {
    contains: () => false,
    matches: () => false,
    querySelector: () => null,
    parentElement: null,
    closest: (selector) => (selector === 'button' ? pin : null),
  };
  assert.equal(menuRowForTarget(pin, menu, 'data-dfm-id'), null);
});

test('从官方 shell.leading 注册项解析 setPinned，失败时返回 null', () => {
  const setPinned = () => {};
  const ctx = {
    slots: {
      entries: () => [
        { options: { inject: () => { throw new Error('bad'); } } },
        { options: { inject: () => ({ toggleSidebar() {} }) } },
        { options: { inject: () => ({ setPinned, hooks: { entryPins: {} } }) } },
      ],
    },
  };
  assert.equal(resolveOfficialSidebar(ctx).setPinned, setPinned);
  assert.equal(resolveOfficialSidebar({ slots: { entries: () => [] } }), null);
  assert.equal(resolveOfficialSidebar({}), null);
});

test('跨固定边界落点：固定/取消固定意图与目标分组', () => {
  const all = ['p0', 'u1', 'p2', 'u3'];
  const pinnedSet = Object.create(null);
  pinnedSet.p0 = true;
  pinnedSet.p2 = true;

  assert.deepEqual(officialDropPlan(all, pinnedSet, 'u1', true), {
    bucket: ['p0', 'u1', 'p2'],
    pinChange: true,
    currentPinned: false,
  });
  assert.deepEqual(officialDropPlan(all, pinnedSet, 'p2', false), {
    bucket: ['u1', 'p2', 'u3'],
    pinChange: true,
    currentPinned: true,
  });
  assert.deepEqual(officialDropPlan(all, pinnedSet, 'p0', true), {
    bucket: ['p0', 'p2'],
    pinChange: false,
    currentPinned: true,
  });
  assert.deepEqual(officialDropPlan(all, null, 'u1', false), {
    bucket: ['u1'],
    pinChange: true,
    currentPinned: true,
  });
});

test('新版拖拽平铺：固定区与未固定区分组展示，不再渲染竖向「更多」', () => {
  const panels = fakePanels(4);
  const layout = {
    enabled: true,
    order: [],
    hidden: [],
    backEnabled: true,
    dragActive: true,
    dragPanelId: 'panel-1',
  };
  const { tree } = renderRail(
    { activePanelId: null },
    panels,
    layout,
    { release: '0.2.2-rc.2', pinned: ['panel-0', 'panel-2'] },
  );
  const elements = flatten(tree);
  const pinnedZone = elements.find((element) => element.props['data-dfm-rail-zone'] === 'pinned');
  const unpinnedZone = elements.find((element) => element.props['data-dfm-rail-zone'] === 'unpinned');
  assert.ok(pinnedZone && unpinnedZone);
  assert.deepEqual(
    flatten(pinnedZone).filter((element) => element.props.panel !== undefined).map((element) => element.props.panel.id),
    ['panel-0', 'panel-2'],
  );
  assert.deepEqual(
    flatten(unpinnedZone).filter((element) => element.props.panel !== undefined).map((element) => element.props.panel.id),
    ['panel-1', 'panel-3'],
  );
  assert.equal(
    elements.some((element) => typeof element.type === 'function' && element.props.testId === 'more-panels'),
    false,
  );
});

test('插入线始终位于实际行间：拖动首项、中间项、末项和唯一项均不穿行', () => {
  for (const horizontal of [false, true]) {
    const entries = [0, 1, 2].map((id) => ({
      id: String(id),
      rect: { top: id * 36, bottom: id * 36 + 32, left: id * 36, right: id * 36 + 32 },
    }));
    for (const draggedId of ['0', '1', '2', 'external']) {
      for (let coordinate = -10; coordinate <= 115; coordinate += 1) {
        const target = insertionTargetAt(entries, coordinate, draggedId, horizontal);
        const start = horizontal ? 'left' : 'top';
        const end = horizontal ? 'right' : 'bottom';
        assert.equal(entries.some(({ rect }) => target.position > rect[start] && target.position < rect[end]), false);
        const expected = entries.filter(({ id, rect }) => id !== draggedId && coordinate > (rect[start] + rect[end]) / 2).length;
        assert.equal(target.index, expected);
      }
    }
    assert.deepEqual(insertionTargetAt(entries, 42, '1', horizontal), { index: 1, position: 34 });
    assert.deepEqual(insertionTargetAt(entries, 62, '1', horizontal), { index: 1, position: 70 });
    assert.deepEqual(insertionTargetAt(entries.slice(0, 1), 20, '0', horizontal), { index: 0, position: 34 });
    assert.equal(insertionTargetAt([], 20, '0', horizontal), null);
  }
});

function attachDragBody(env) {
  const nodes = [];
  const body = {
    appendChild(node) { nodes.push(node); node.parentNode = body; },
    removeChild(node) { nodes.splice(nodes.indexOf(node), 1); node.parentNode = null; },
  };
  env.document.body = body;
  env.document.createElement = () => ({
    style: {}, setAttribute() {}, appendChild() {},
  });
  return nodes;
}

test('展开侧栏拖动只显示插入线；折叠工具栏才创建并清理跟随图标', () => {
  const previousDocument = globalThis.document;
  const previousRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = undefined;
  try {
    for (const install of [installPanelDrag, installRailDrag]) {
      const env = createPanelEnv('darwin');
      const nodes = attachDragBody(env);
      globalThis.document = env.document;
      const store = createPanelLayoutStore({ enabled: true });
      const target = install === installPanelDrag ? env.marker : env.railButton;
      env.railButton.querySelector = () => null;
      const dispose = install(store, { getSnapshot: () => fakePanels(2) });
      env.dispatch('pointerdown', { button: 0, pointerId: 1, clientX: 20, clientY: 14, target });
      env.dispatch('pointermove', { pointerId: 1, clientX: 28, clientY: 14 });
      assert.equal(nodes.filter((node) => node.className === 'DFM_dragGhost').length, install === installRailDrag ? 1 : 0);
      if (install === installPanelDrag) {
        const line = nodes.find((node) => node.className === 'DFM_indicator');
        assert.equal(line.style.display, 'block');
        assert.equal(Number.parseFloat(line.style.top) + 6, -2);
      }
      env.dispatch('pointercancel', { pointerId: 1 });
      assert.equal(nodes.filter((node) => node.className === 'DFM_dragGhost').length, 0);
      dispose();
      assert.equal(nodes.length, 0);
    }
  } finally {
    globalThis.document = previousDocument;
    globalThis.requestAnimationFrame = previousRaf;
  }
});

test('官方更多：菜单外松手不提交，菜单内插入线和落点一致，非 macOS 不接管', () => {
  const previousDocument = globalThis.document;
  const previousRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = undefined;
  try {
    for (const platform of ['darwin', 'linux']) {
      const env = createPanelEnv(platform);
      const nodes = attachDragBody(env);
      globalThis.document = env.document;
      let down;
      const rows = [0, 1, 2].map((index) => {
        const row = {
          classList: { add() {}, remove() {} },
          getAttribute: () => 'panel-' + index,
          matches: () => true,
          closest: () => row,
          getBoundingClientRect: () => ({ left: 0, right: 100, top: index * 36, bottom: index * 36 + 32, width: 100, height: 32 }),
        };
        return row;
      });
      const menu = {
        contains: (row) => rows.includes(row),
        querySelectorAll: () => rows,
        getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 104 }),
        addEventListener: (_type, fn) => { down = fn; },
        removeEventListener() {},
      };
      const commits = [];
      const dispose = installMenuReorder(menu, 'data-dfm-id', (...args) => commits.push(args));
      const begin = () => down({ button: 0, pointerId: 1, clientX: 50, clientY: 48, target: rows[1] });
      begin();
      env.dispatch('pointermove', { pointerId: 1, clientX: 50, clientY: 42 });
      if (platform === 'darwin') {
        assert.equal(Number.parseFloat(nodes[0].style.top) + 6, 34);
      } else {
        assert.equal(env.listenerCount(), 0);
      }
      env.dispatch('pointerup', { pointerId: 1, clientX: 400, clientY: 90 });
      assert.deepEqual(commits, []);
      begin();
      env.dispatch('pointermove', { pointerId: 1, clientX: 50, clientY: 90 });
      env.dispatch('pointerup', { pointerId: 1, clientX: 50, clientY: 90 });
      assert.deepEqual(commits, platform === 'darwin' ? [['panel-1', 2]] : []);
      dispose();
      assert.equal(nodes.length, 0);
    }
  } finally {
    globalThis.document = previousDocument;
    globalThis.requestAnimationFrame = previousRaf;
  }
});

test('宿主行识别排除真实挂在 nav 下的插件二级区，避免隐藏整个 tray', () => {
  const nav = {};
  const tray = { parentElement: nav, style: {} };
  const row = {
    parentElement: tray,
    closest: (selector) => selector === 'nav' ? nav : selector === 'button' ? row : tray,
  };
  const marker = { closest: () => row };
  assert.equal(hostPanelRow(marker), null);
  assert.equal(hostPanelRowItem(marker), null);
  assert.equal(tray.style.display, undefined);
});

test('固定状态直接订阅官方未固定源：不依赖 DOM、同名标签或侧栏重挂载，卸载清理订阅', () => {
  const previousDocument = globalThis.document;
  globalThis.document = undefined;
  const pinListeners = new Set();
  const panelListeners = new Set();
  let unpinned = ['panel-1'];
  let panels = fakePanels(3).map((panel) => ({ ...panel, label: '同名菜单' }));
  const source = {
    getSnapshot: () => unpinned,
    subscribe: (fn) => { pinListeners.add(fn); return () => pinListeners.delete(fn); },
  };
  const panelsSource = {
    getSnapshot: () => panels,
    subscribe: (fn) => { panelListeners.add(fn); return () => panelListeners.delete(fn); },
  };
  const ctx = { slots: { entries: () => [{ inject: () => ({ setPinned() {}, hooks: { entryPins: source } }) }] } };
  const pins = createPinsStore();
  let dispose;
  try {
    dispose = installPinnedObserver(pins, panelsSource, ctx);
    assert.deepEqual(pins.getPinned(), ['panel-0', 'panel-2']);
    unpinned = panels.map((panel) => panel.id);
    pinListeners.forEach((fn) => fn());
    assert.deepEqual(pins.getPinned(), []);
    panels = [...panels, ...fakePanels(4).slice(3)];
    panelListeners.forEach((fn) => fn());
    assert.deepEqual(pins.getPinned(), ['panel-3']);
    unpinned = [];
    pinListeners.forEach((fn) => fn());
    assert.deepEqual(pins.getPinned(), panels.map((panel) => panel.id));
  } finally {
    dispose?.();
    globalThis.document = previousDocument;
  }
  assert.equal(pinListeners.size, 0);
  assert.equal(panelListeners.size, 0);
});

test('版本兜底：未知版本不误判为新版，semver build metadata 不影响兼容判断', () => {
  const previous = window.__DSH_BOOT__;
  try {
    for (const version of ['dev', '0.2.1+local.1', '0.2.2-rc.1+local.1']) {
      window.__DSH_BOOT__ = { release: { version } };
      assert.equal(createCapabilities(makeCtx([])).officialPins, false, version);
    }
    window.__DSH_BOOT__ = { release: { version: '0.2.2-rc.2+local.1' } };
    assert.equal(createCapabilities(makeCtx([])).officialPins, true);
    assert.equal(compareVersions('0.2.2+build.1', '0.2.2'), 0);
    window.__DSH_BOOT__ = { release: { version: 'dev' }, entries: [{ id: '@deepseek-ai/dsh-client-ui-entry-customization' }] };
    assert.equal(createCapabilities(makeCtx([])).officialPins, true);
  } finally {
    window.__DSH_BOOT__ = previous;
  }
});

test('折叠更多按固定溢出/未固定分组：显示分割线和说明，各组顺序、选中与点击保持正确', () => {
  const previousUseState = fakeReact.useState;
  try {
    const panels = fakePanels(5);
    for (const scenario of [
      { pinned: ['panel-0', 'panel-2', 'panel-3', 'panel-4'], ids: ['panel-4', 'panel-1'], divider: 1, label: true },
      { pinned: panels.map((panel) => panel.id), ids: ['panel-3', 'panel-4'], divider: 0, label: false },
      { pinned: ['panel-0', 'panel-1', 'panel-2'], ids: ['panel-3', 'panel-4'], divider: 0, label: true },
      { pinned: [], ids: panels.map((panel) => panel.id), divider: 0, label: true },
    ]) {
      fakeReact.useState = previousUseState;
      const { tree, selections } = renderRail({ activePanelId: scenario.ids.at(-1) }, panels, EMPTY_LAYOUT, {
        release: '0.2.2-rc.2', pinned: scenario.pinned,
      });
      const overflow = flatten(tree).find((node) => Array.isArray(node.props.unpinnedPanels));
      let stateIndex = 0;
      fakeReact.useState = (initial) => [stateIndex++ === 0 ? true : initial, () => {}];
      const menu = flatten(overflow.type(overflow.props));
      const items = menu.filter((node) => node.props.panel);
      assert.deepEqual(items.map((node) => node.props.panel.id), scenario.ids);
      assert.equal(menu.filter((node) => node.props.role === 'separator').length, scenario.divider);
      const labels = menu.filter((node) => node.props.className === 'DFM_menuGroup');
      assert.deepEqual(labels.map((node) => node.children[0]), scenario.label ? ['panels.unpinned'] : []);
      assert.equal(menu.find((node) => node.props.testId === 'more-panels').props.active, true);
      items.at(-1).props.onSelect(items.at(-1).props.panel);
      assert.deepEqual(selections, [scenario.ids.at(-1)]);
    }
  } finally {
    fakeReact.useState = previousUseState;
  }
});

test('固定状态 DOM 兜底跟随侧栏根替换、空固定列表与面板变化，卸载取消待执行帧', () => {
  const previousDocument = globalThis.document;
  const previousObserver = globalThis.MutationObserver;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  const frames = new Map();
  const panelListeners = new Set();
  let nextFrame = 0;
  let mutation;
  let disconnected = false;
  const button = (label, popup) => ({
    tagName: 'BUTTON',
    getAttribute: (name) => name === 'aria-label' ? label : name === 'aria-haspopup' ? popup : null,
  });
  const makeRoot = (ids) => {
    const nav = { tagName: 'NAV', children: [...ids.map((id) => button(id)), button('更多', 'menu')], querySelectorAll: () => [] };
    return { children: [nav] };
  };
  let root = makeRoot(['panel-0', 'panel-2']);
  globalThis.document = {
    documentElement: {},
    querySelector: () => ({ closest: () => ({ parentElement: root }) }),
  };
  globalThis.requestAnimationFrame = (fn) => { frames.set(++nextFrame, fn); return nextFrame; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  globalThis.MutationObserver = class {
    constructor(fn) { mutation = fn; }
    observe(target) { assert.equal(target, document.documentElement); }
    disconnect() { disconnected = true; }
  };
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((fn) => fn()); };
  const pins = createPinsStore();
  const panelsSource = {
    getSnapshot: () => fakePanels(3).map((panel) => ({ ...panel, label: panel.id })),
    subscribe: (fn) => { panelListeners.add(fn); return () => panelListeners.delete(fn); },
  };
  let dispose;
  try {
    dispose = installPinnedObserver(pins, panelsSource);
    flush();
    assert.deepEqual(pins.getPinned(), ['panel-0', 'panel-2']);
    root = makeRoot(['panel-1']);
    mutation(); flush();
    assert.deepEqual(pins.getPinned(), ['panel-1']);
    root = makeRoot([]);
    panelListeners.forEach((fn) => fn()); flush();
    assert.deepEqual(pins.getPinned(), []);
    mutation();
    assert.equal(frames.size, 1);
  } finally {
    dispose?.();
    globalThis.document = previousDocument;
    globalThis.MutationObserver = previousObserver;
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCancel;
  }
  assert.equal(frames.size, 0);
  assert.equal(panelListeners.size, 0);
  assert.equal(disconnected, true);
});

test('官方固定动作以提交后的状态确认成功，拒绝取消固定和动作异常均返回失败', () => {
  let unpinned = [];
  const official = {
    setPinned(id, pinned) {
      if (id === 'plugins') return;
      unpinned = pinned ? unpinned.filter((item) => item !== id) : [...unpinned, id];
    },
    hooks: { entryPins: { getSnapshot: () => unpinned } },
  };
  const ctx = { slots: { entries: () => [{ inject: () => official }] } };
  assert.equal(setOfficialPinned(ctx, 'plugins', false), false);
  assert.deepEqual(unpinned, []);
  assert.equal(setOfficialPinned(ctx, 'panel-1', false), true);
  assert.deepEqual(unpinned, ['panel-1']);
  assert.equal(setOfficialPinned(ctx, 'panel-1', true), true);
  assert.deepEqual(unpinned, []);
  official.setPinned = () => { throw new Error('unavailable'); };
  assert.equal(setOfficialPinned(ctx, 'panel-1', false), false);
  assert.equal(setOfficialPinned({}, 'panel-1', false), false);
});
