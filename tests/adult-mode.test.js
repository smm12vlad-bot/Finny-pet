import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../src/core/engine.js';
import * as templates from '../src/ui/templates.js';
import * as helpers from '../src/ui/helpers.js';
import { GameStorage, MemoryStorage } from '../src/core/storage.js';

const content = Object.fromEntries(['lessons', 'tasks', 'items', 'goals', 'periods'].map(k => [k, JSON.parse(fs.readFileSync(new URL(`../content/${k}.json`, import.meta.url)))]));

test('adult gate, wrong answer, unlock, exit and re-entry use actual main handlers', async () => {
  const store = new GameStorage(new MemoryStorage());
  const game = new engine.GameEngine(content, store);
  game.completeOnboarding();
  game.createProfile({ nickname: 'Tester', petName: 'Finny', fur: 'sunset', accessory: 'leaf' });
  const listeners = {};
  const root = { innerHTML: '', querySelector: () => null, classList: { add() {}, remove() {} } };
  const context = vm.createContext({ ...engine, ...templates, ...helpers,
    loadContent: async () => content, GameStorage: class { constructor() { return store; } },
    mountPetScene() {}, destroyPetScene() {}, requestAnimationFrame() {},
    setInterval() {}, setTimeout() {}, clearTimeout() {}, console,
    FormData: class { constructor(form) { this.form = form; } get(key) { return this.form[key]; } },
    document: { getElementById: () => root, addEventListener: (type, fn) => { listeners[type] = fn; } }
  });
  vm.runInContext(fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, ''), context);
  await new Promise(resolve => setImmediate(resolve));
  const click = dataset => listeners.click({ preventDefault() {}, target: { closest: s => s === '[data-route]' ? (dataset.route ? { dataset } : null) : { dataset } } });
  click({ route: 'adult' });
  assert.match(root.innerHTML, /adult-gate-form/);
  listeners.submit({ preventDefault() {}, target: { id: 'adult-gate-form', answer: -1 } });
  assert.match(root.innerHTML, /adult-gate-form/);
  const answer = vm.runInContext('ui.challenge.answer', context);
  listeners.submit({ preventDefault() {}, target: { id: 'adult-gate-form', answer } });
  assert.match(root.innerHTML, /Просветительские цели по блокам/);
  assert.match(root.innerHTML, /Нет ответов/);
  click({ action: 'lock-adult' });
  click({ route: 'adult' });
  assert.match(root.innerHTML, /adult-gate-form/);
  click({ action: 'reset-profile' });
  assert.ok(store.load().profile, 'locked adult action cannot delete profile');
  assert.equal(vm.runInContext('ui.adultUnlocked', context), false);
});

test('progress counts completed periods and curriculum tests, not reward resets', () => {
  const store = new GameStorage(new MemoryStorage());
  const game = new engine.GameEngine(content, store);
  game.state.periodHistory = [{ period: 1 }, { period: 1 }];
  game.state.completedTestIds = [content.tasks[0].id];
  game.state.completedTaskIds = [];
  game.state.readTheoryBlockIds = [content.lessons[0].id];
  const html = templates.adultDashboardTemplate(game.state, content);
  assert.match(html, /<span>Периоды<\/span><strong>1\/5/);
  assert.match(html, /<span>Сдано тестов<\/span><strong>1\/15/);
  assert.match(html, /Что обсудить вместе/);
});
