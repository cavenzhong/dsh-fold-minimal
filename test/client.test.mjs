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
  dictionaries,
  labelOf,
  buildPanels,
  samePanels,
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
  for (const key of ['rail.label', 'toggle.open', 'session.new.label', 'session.back.label']) {
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
function renderRail(panelInfo) {
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
    usePanels: (selector) => selector([]),
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
