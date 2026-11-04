/**
 * dsh-fold-minimal 的纯逻辑测试。
 *
 * client.js 是 `window.__ModuleLoader__` 的浏览器 bundle，这里用最小 window /
 * react 桩把它加载出来，只测不依赖 DOM 的纯函数与语言表。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const fakeReact = {
  createElement: () => null,
  Component: class Component {},
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
  for (const key of ['rail.label', 'toggle.open', 'session.new.label']) {
    assert.ok(dictionaries.zh[key]);
    assert.ok(dictionaries.en[key]);
  }
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
