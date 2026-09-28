import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { GameEngine } from '../src/core/engine.js';
import { GameStorage, MemoryStorage } from '../src/core/storage.js';
import { formatTaskTime, renderRoute } from '../src/ui/templates.js';

async function json(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
}

const content = {
  lessons: await json('../content/lessons.json'),
  tasks: await json('../content/tasks.json'),
  items: await json('../content/items.json'),
  goals: await json('../content/goals.json'),
  periods: await json('../content/periods.json')
};

function setup() {
  const engine = new GameEngine(content, new GameStorage(new MemoryStorage()));
  engine.completeOnboarding();
  engine.createProfile({ nickname: '<Следопыт>', petName: '<Финни>', fur: 'sunset', accessory: 'leaf' });
  return engine;
}

const ui = {
  onboardingPage: 0,
  selectedBlockId: 'budget',
  selectedTestId: 'budget_theory',
  testSession: {
    testId: 'budget_theory',
    questionIndex: 0,
    answers: [],
    feedback: null,
    summary: null
  },
  tasksNotice: null,
  adultUnlocked: false,
  challenge: { a: 8, b: 5, answer: 13 }
};

test('все основные маршруты создают непустой экран', () => {
  const engine = setup();
  for (const route of ['home', 'budget', 'tasks', 'theory', 'test', 'shop', 'savings', 'progress', 'more', 'help', 'adult']) {
    const html = renderRoute(route, engine.state, content, ui);
    assert.ok(html.length > 300, `${route} должен содержать экран`);
    assert.match(html, /main|welcome-screen/);
  }
});

test('главный экран содержит обязательные показатели', () => {
  const engine = setup();
  const html = renderRoute('home', engine.state, content, ui);
  for (const text of ['Доступно', 'Накоплено', 'Текущая цель', 'Активное обучение', 'Цели периода 1', 'Сытость', 'Настроение', 'Уверенность']) {
    assert.ok(html.includes(text), `на главном экране отсутствует «${text}»`);
  }
});

test('пользовательские имена экранируются перед выводом', () => {
  const engine = setup();
  const html = renderRoute('home', engine.state, content, ui);
  assert.ok(!html.includes('<Следопыт>'));
  assert.ok(html.includes('&lt;Следопыт&gt;'));
});

test('экран магазина показывает обе категории и все товары', () => {
  const engine = setup();
  const html = renderRoute('shop', engine.state, content, ui);
  assert.ok(html.includes('Сначала важное'));
  assert.ok(html.includes('Потом желания'));
  for (const item of content.items) assert.equal(html.includes(item.name), (item.unlockPeriod || 1) <= 1);
  engine.state.period = 5;
  const finalShop = renderRoute('shop', engine.state, content, ui);
  for (const item of content.items) assert.ok(finalShop.includes(item.name));
});

test('экран обучения показывает пять периодов, теорию и заблокированные этапы', () => {
  const engine = setup();
  const html = renderRoute('tasks', engine.state, content, ui);
  for (const text of ['Награды каждые 12 часов', 'Пройдено тестов', 'Период 1 из 5', 'Сначала изучить теорию', 'Бюджет без путаницы', '5 вопросов']) {
    assert.ok(html.includes(text), `на экране обучения отсутствует «${text}»`);
  }
  assert.ok(html.includes('Откроется в периоде 2'));
  assert.ok(html.includes('Откроется в периоде 4'));
  assert.equal(formatTaskTime(3_661_000), '01:01:01');
});

test('экран теории содержит формулу, пример и памятку', () => {
  const engine = setup();
  const html = renderRoute('theory', engine.state, content, ui);
  for (const text of ['Теория перед тестом', 'Формула', 'Разберём пример', 'Запомни главное', 'Теорию прочитал']) {
    assert.ok(html.includes(text));
  }
});

test('экран теста показывает один из пяти вопросов и награду', () => {
  const engine = setup();
  engine.completeTheory('budget');
  const html = renderRoute('test', engine.state, content, ui);
  assert.ok(html.includes('Вопрос 1 из 5'));
  assert.ok(html.includes('Что такое бюджет?'));
  assert.ok(html.includes('+30'));
  assert.ok(html.includes('+40 XP'));
});

test('будущие цели накопления показаны заблокированными', () => {
  const engine = setup();
  const html = renderRoute('savings', engine.state, content, ui);
  assert.ok(html.includes('Откроется в периоде 2'));
  assert.ok(html.includes('Откроется в периоде 5'));
});

test('достигнутую цель можно получить и использовать из коллекции', () => {
  const engine = setup();
  engine.confirmBudget({ essential: 1, optional: 1, savings: 118 });
  engine.deposit(120);
  const reached = renderRoute('savings', engine.state, content, ui);
  assert.ok(reached.includes('Получить за 120 монет'));
  assert.ok(reached.includes('Монеты не пропадут впустую'));

  engine.claimGoal('picnic');
  const collected = renderRoute('savings', engine.state, content, ui);
  assert.ok(collected.includes('Мои полученные цели'));
  assert.ok(collected.includes('Устроить пикник'));

  engine.useGoal('picnic');
  const used = renderRoute('savings', engine.state, content, ui);
  assert.ok(used.includes('Использовано'));
});

test('сообщение о сданном тесте отображается после возврата к блокам', () => {
  const engine = setup();
  const html = renderRoute('tasks', engine.state, content, {
    ...ui,
    tasksNotice: { message: 'Тест сдан. Награда: +30 монет и +40 опыта.' }
  });
  assert.ok(html.includes('Готово!'));
  assert.ok(html.includes('+30 монет'));
});

test('раздел взрослого закрыт, пока не решён пример', () => {
  const engine = setup();
  const locked = renderRoute('adult', engine.state, content, ui);
  const unlocked = renderRoute('adult', engine.state, content, { ...ui, adultUnlocked: true });
  assert.ok(locked.includes('Проверка для взрослого'));
  assert.ok(!locked.includes('Удалить локальный профиль'));
  assert.ok(unlocked.includes('Удалить локальный профиль'));
});
