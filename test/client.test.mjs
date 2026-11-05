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
  Component: class Component {},
  useRef: (initial) => ({ current: initial }),
  useLayoutEffect: () => {},
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
  dictionaries,
  labelOf,
  buildPanels,
  samePanels,
  splitPanels,
  dragOvershoot,
  installDragCollapse,
  isPanelActive,
} = exports.__test;

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
  ]) {
    assert.ok(dictionaries.zh[key]);
    assert.ok(dictionaries.en[key]);
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
function renderRail(panelInfo, panels = []) {
  const selections = [];
  const registered = [];
  const ctx = {
    effect: (fn) => fn(),
    locale: {
      register: () => () => {},
      subscribe: () => () => {},
    },
    slots: {
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
  exports.apply(ctx);
  const entry = registered.find((candidate) => candidate.options.name === SLOT);
  const injected = entry.options.inject();
  const tree = entry.component({
    ...injected,
    t: (key) => key,
    usePanelInfo: (selector) => selector(panelInfo),
    usePanels: (selector) => selector(panels),
    useShortcuts: () => undefined,
  });
  return { tree, selections };
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
