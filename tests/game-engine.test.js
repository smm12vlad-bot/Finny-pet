import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  GameEngine,
  TASK_RESET_INTERVAL_MS,
  calculatePeriodScore,
  getLevel,
  getLevelProgress,
  getPetStage,
  getPeriodActuals,
  getPeriodRequirements,
  getTestAvailability,
  getTestsForBlock,
  getTasksForPeriod,
  getUnlockedGoals
} from '../src/core/engine.js';
import { normalizeState } from '../src/core/state.js';
import { GameStorage, MemoryStorage } from '../src/core/storage.js';

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

function makeEngine(options = {}) {
  return new GameEngine(content, new GameStorage(new MemoryStorage()), options);
}

function makeProfile(engine) {
  engine.completeOnboarding();
  return engine.createProfile({ nickname: 'Следопыт', petName: 'Финни', fur: 'sunset', accessory: 'leaf' });
}

function makeBudget(engine, plan = { essential: 45, optional: 30, savings: 20 }) {
  return engine.confirmBudget(plan);
}

function correctAnswer(question) {
  return question.type === 'amount'
    ? question.correctAmount
    : question.options.find((option) => option.correct).id;
}

function answersFor(test, wrongQuestionIds = []) {
  return test.questions.map((question) => ({
    questionId: question.id,
    answer: wrongQuestionIds.includes(question.id)
      ? (question.type === 'amount'
          ? question.correctAmount + 1
          : question.options.find((option) => !option.correct).id)
      : correctAnswer(question)
  }));
}

function passTest(engine, testId) {
  const currentTest = content.tasks.find((entry) => entry.id === testId);
  if (!engine.state.readTheoryBlockIds.includes(currentTest.blockId)) {
    assert.equal(engine.completeTheory(currentTest.blockId).ok, true);
  }
  if (currentTest.testType === 'practice') {
    const theoryTest = content.tasks.find((entry) => entry.blockId === currentTest.blockId && entry.testType === 'theory');
    if (!engine.state.completedTestIds.includes(theoryTest.id)) passTest(engine, theoryTest.id);
  }
  const answers = answersFor(currentTest);
  if (currentTest.requiresTestId && !engine.state.completedTestIds.includes(currentTest.requiresTestId)) passTest(engine, currentTest.requiresTestId);
  for (const entry of answers) {
    assert.equal(engine.answerTestQuestion(testId, entry.questionId, entry.answer).ok, true);
  }
  const result = engine.completeTestAttempt(testId, answers);
  assert.equal(result.ok, true);
  assert.equal(result.passed, true);
  return result;
}

function completeCurrentPeriod(engine) {
  const period = content.periods[engine.state.period - 1];
  for (const objective of period.objectives.filter((entry) => entry.type === 'theory')) {
    for (const blockId of objective.blockIds) {
      if (!engine.state.readTheoryBlockIds.includes(blockId)) assert.equal(engine.completeTheory(blockId).ok, true);
    }
  }
  for (const currentTest of getTasksForPeriod(content, engine.state.period)) {
    if (!engine.state.completedTestIds.includes(currentTest.id)) passTest(engine, currentTest.id);
  }

  const essentialCount = period.objectives.find((entry) => entry.type === 'purchase' && entry.category === 'essential')?.count || 0;
  const optionalCount = period.objectives.find((entry) => entry.type === 'purchase' && entry.category === 'optional')?.count || 0;
  const depositAmount = period.objectives.find((entry) => entry.type === 'deposit')?.amount || 1;
  if (!engine.state.plan.confirmed) {
    assert.equal(engine.confirmBudget({
      essential: Math.max(1, essentialCount * 16),
      optional: Math.max(1, optionalCount * 24),
      savings: depositAmount
    }).ok, true);
  }

  const currentPurchases = () => engine.state.purchases.filter((entry) => entry.period === engine.state.period);
  for (const objective of period.objectives.filter((entry) => entry.type === 'purchase' && entry.itemId)) {
    if (!currentPurchases().some((entry) => entry.itemId === objective.itemId)) assert.equal(engine.purchase(objective.itemId).ok, true);
  }
  while (currentPurchases().filter((entry) => entry.category === 'essential').length < essentialCount) assert.equal(engine.purchase('care').ok, true);
  while (currentPurchases().filter((entry) => entry.category === 'optional').length < optionalCount) assert.equal(engine.purchase('ball').ok, true);
  if (engine.state.periodSavingsDeposited < depositAmount) assert.equal(engine.deposit(depositAmount - engine.state.periodSavingsDeposited).ok, true);

  if (period.objectives.some((entry) => entry.type === 'goal_owned') && engine.state.ownedGoalIds.length === 0) {
    const goal = getUnlockedGoals(content, engine.state.period).find((entry) => !engine.state.ownedGoalIds.includes(entry.id));
    if (engine.state.savings < goal.cost) assert.equal(engine.deposit(goal.cost - engine.state.savings).ok, true);
    assert.equal(engine.claimGoal(goal.id).ok, true);
  }
  if (period.objectives.some((entry) => entry.type === 'goal_used')) {
    const goalId = engine.state.ownedGoalIds.find((id) => engine.state.goalUsagePeriods[id] !== engine.state.period);
    if (goalId) assert.equal(engine.useGoal(goalId).ok, true);
  }

  return engine.finishPeriod();
}

test('контент содержит пять блоков, пятнадцать тестов и 75 вопросов', () => {
  assert.equal(content.lessons.length, 5);
  assert.equal(content.tasks.length, 15);
  assert.equal(content.tasks.reduce((sum, currentTest) => sum + currentTest.questions.length, 0), 75);
  assert.equal(content.items.length, 12);
  assert.equal(content.goals.length, 5);
  assert.equal(content.periods.length, 5);
  assert.equal(new Set(content.tasks.map((task) => task.theme)).size, 5);
  assert.deepEqual(new Set(content.tasks.map((task) => task.difficulty)), new Set(['easy', 'medium', 'hard']));
  assert.ok(content.tasks.flatMap((currentTest) => currentTest.questions).some((question) => question.type === 'amount'));
  for (const theme of ['budget', 'savings', 'household', 'utilities', 'purchases']) {
    const tasks = content.tasks.filter((task) => task.theme === theme).sort((a, b) => a.reward - b.reward);
    assert.equal(tasks.length, 3);
    assert.deepEqual(new Set(tasks.map((task) => task.testType)), new Set(['theory', 'practice']));
    assert.ok(tasks.every((task, index) => index === 0 || task.reward > tasks[index - 1].reward));
    assert.ok(tasks.every((task, index) => index === 0 || task.xp > tasks[index - 1].xp));
  }
  for (const period of content.periods) {
    assert.ok(getTasksForPeriod(content, period.id).length >= 1);
    assert.ok(period.objectives.length >= 4);
    assert.ok(content.goals.some((goal) => goal.unlockPeriod === period.id));
  }
  for (const goal of content.goals) {
    assert.ok(goal.actionLabel);
    assert.ok(goal.effectDescription);
    assert.ok(goal.effect && typeof goal.effect === 'object');
  }
});

test('создание профиля добавляет стартовый доход и не требует персональных данных', () => {
  const engine = makeEngine();
  const result = makeProfile(engine);
  assert.equal(result.ok, true);
  assert.equal(engine.state.profile.nickname, 'Следопыт');
  assert.equal(engine.state.balance, 120);
  assert.equal(engine.state.incomes[0].source, content.periods[0].incomeSource);
  assert.equal(engine.state.food, 1);
  assert.ok(engine.state.taskResetAt > 0);
});

test('слишком короткие игровые имена отклоняются', () => {
  const engine = makeEngine();
  const result = engine.createProfile({ nickname: 'Я', petName: 'Ф', fur: 'sunset', accessory: 'leaf' });
  assert.equal(result.ok, false);
  assert.equal(engine.state.profile, null);
});

test('план требует все три категории', () => {
  const engine = makeEngine();
  makeProfile(engine);
  const result = engine.confirmBudget({ essential: 50, optional: 0, savings: 20 });
  assert.equal(result.ok, false);
  assert.equal(engine.state.plan.confirmed, false);
});

test('план не может превышать доступный баланс', () => {
  const engine = makeEngine();
  makeProfile(engine);
  const result = engine.confirmBudget({ essential: 80, optional: 50, savings: 30 });
  assert.equal(result.ok, false);
  assert.match(result.message, /больше бюджета/i);
});

test('корректный план подтверждается один раз', () => {
  const engine = makeEngine();
  makeProfile(engine);
  assert.equal(makeBudget(engine).ok, true);
  assert.equal(engine.state.plan.confirmed, true);
  assert.equal(makeBudget(engine).ok, false);
});

test('покупка до подтверждения бюджета блокируется', () => {
  const engine = makeEngine();
  makeProfile(engine);
  const result = engine.purchase('porridge');
  assert.equal(result.ok, false);
  assert.equal(engine.state.balance, 120);
});

test('обязательная покупка уменьшает баланс и добавляет запас еды', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  const beforeSatiety = engine.state.satiety;
  const result = engine.purchase('porridge');
  assert.equal(result.ok, true);
  assert.equal(engine.state.balance, 102);
  assert.equal(engine.state.food, 2);
  assert.ok(engine.state.satiety > beforeSatiety);
  assert.equal(engine.state.purchases[0].category, 'essential');
});

test('дорогая покупка при нехватке средств не меняет состояние', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  const before = JSON.stringify(engine.state);
  const result = engine.purchase('play_house');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'insufficient');
  assert.equal(JSON.stringify(engine.state), before);
});

test('серия покупок никогда не создаёт отрицательный баланс', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  for (let index = 0; index < 10; index += 1) engine.purchase('decoration');
  assert.ok(engine.state.balance >= 0);
});

test('кормление использует один запас и повышает сытость', () => {
  const engine = makeEngine();
  makeProfile(engine);
  engine.state.satiety = 50;
  const result = engine.feedPet();
  assert.equal(result.ok, true);
  assert.equal(engine.state.food, 0);
  assert.equal(engine.state.satiety, 68);
});

test('нельзя кормить без запаса еды', () => {
  const engine = makeEngine();
  makeProfile(engine);
  engine.state.food = 0;
  assert.equal(engine.feedPet().ok, false);
});

test('цели накопления открываются вместе с новыми периодами', () => {
  const engine = makeEngine();
  makeProfile(engine);
  assert.equal(engine.selectGoal('picnic').ok, true);
  assert.equal(engine.selectGoal('skates').ok, false);
  assert.equal(engine.selectGoal('scooter').ok, false);
  assert.deepEqual(getUnlockedGoals(content, 1).map((goal) => goal.id), ['picnic']);
  assert.deepEqual(getUnlockedGoals(content, 3).map((goal) => goal.id), ['picnic', 'skates', 'backpack']);
});

test('цель нельзя получить, пока в копилке не собрана её стоимость', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  engine.deposit(20);
  const result = engine.claimGoal('picnic');
  assert.equal(result.ok, false);
  assert.equal(engine.state.savings, 20);
  assert.deepEqual(engine.state.ownedGoalIds, []);
});

test('получение цели списывает её стоимость и добавляет предмет в коллекцию', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  engine.deposit(120);
  const result = engine.claimGoal('picnic');
  assert.equal(result.ok, true);
  assert.equal(engine.state.savings, 0);
  assert.deepEqual(engine.state.ownedGoalIds, ['picnic']);
  assert.equal(engine.state.goalHistory[0].cost, 120);
  assert.equal(engine.state.selectedGoalId, 'picnic');
  assert.match(result.message, /периоде 2/i);
});

test('полученную цель можно использовать один раз за каждый игровой период', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  engine.deposit(120);
  engine.claimGoal('picnic');

  const before = { satiety: engine.state.satiety, mood: engine.state.mood };
  const firstUse = engine.useGoal('picnic');
  assert.equal(firstUse.ok, true);
  assert.equal(engine.state.satiety, Math.min(100, before.satiety + 18));
  assert.equal(engine.state.mood, Math.min(100, before.mood + 12));
  assert.equal(engine.useGoal('picnic').ok, false);

  assert.equal(completeCurrentPeriod(engine).ok, true);
  assert.equal(engine.state.period, 2);
  assert.equal(engine.useGoal('picnic').ok, true);
});

test('уже полученную цель нельзя снова выбрать или купить', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  engine.deposit(120);
  engine.claimGoal('picnic');
  assert.equal(engine.selectGoal('picnic').ok, false);
  assert.equal(engine.claimGoal('picnic').ok, false);
});

test('пополнение перемещает деньги с баланса в накопления', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  const result = engine.deposit(20);
  assert.equal(result.ok, true);
  assert.equal(engine.state.balance, 100);
  assert.equal(engine.state.savings, 20);
  assert.equal(engine.state.periodSavingsDeposited, 20);
});

test('нельзя отложить больше доступного баланса', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  const result = engine.deposit(999);
  assert.equal(result.ok, false);
  assert.equal(engine.state.savings, 0);
});

test('снятие возвращает деньги на баланс и увеличивает расстояние до цели', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  engine.deposit(20);
  const result = engine.withdraw(5);
  assert.equal(result.ok, true);
  assert.equal(engine.state.balance, 105);
  assert.equal(engine.state.savings, 15);
  assert.match(result.message, /примерно/i);
});

test('нельзя снять отсутствующую сумму', () => {
  const engine = makeEngine();
  makeProfile(engine);
  assert.equal(engine.withdraw(1).ok, false);
  assert.equal(engine.state.balance, 120);
});

test('тест закрыт, пока теория блока не изучена', () => {
  const engine = makeEngine();
  makeProfile(engine);
  const testEntry = content.tasks.find((entry) => entry.id === 'budget_theory');
  assert.equal(getTestAvailability(engine.state, content, testEntry).unlocked, false);
  assert.match(engine.canStartTest(testEntry.id).message, /теорию/i);
  assert.equal(engine.completeTheory('budget').ok, true);
  assert.equal(engine.canStartTest(testEntry.id).ok, true);
});

test('практика открывается только после теоретического теста блока', () => {
  const engine = makeEngine();
  makeProfile(engine);
  engine.state.period = 2;
  engine.completeTheory('budget');
  assert.equal(engine.canStartTest('budget_practice').ok, false);
  passTest(engine, 'budget_theory');
  assert.equal(engine.canStartTest('budget_practice').ok, true);
  assert.equal(getTestsForBlock(content, 'budget').length, 3);
});

test('неверный ответ даёт подробное объяснение без штрафа', () => {
  const engine = makeEngine();
  makeProfile(engine);
  engine.completeTheory('budget');
  const balance = engine.state.balance;
  const result = engine.answerTestQuestion('budget_theory', 'budget_t_1', 'toy');
  assert.equal(result.ok, true);
  assert.equal(result.correct, false);
  assert.equal(engine.state.balance, balance);
  assert.match(result.message, /план/i);
});

test('тест из пяти вопросов засчитывается с результатом 4 из 5', () => {
  const engine = makeEngine();
  makeProfile(engine);
  engine.completeTheory('budget');
  const testEntry = content.tasks.find((entry) => entry.id === 'budget_theory');
  const answers = answersFor(testEntry, ['budget_t_1']);
  for (const entry of answers) engine.answerTestQuestion(testEntry.id, entry.questionId, entry.answer);
  const result = engine.completeTestAttempt(testEntry.id, answers);
  assert.equal(result.passed, true);
  assert.equal(result.score, 4);
  assert.deepEqual(engine.state.completedTestIds, ['budget_theory']);
});

test('результат 3 из 5 не завершает тест и не выдаёт награду', () => {
  const engine = makeEngine();
  makeProfile(engine);
  engine.completeTheory('budget');
  const testEntry = content.tasks.find((entry) => entry.id === 'budget_theory');
  const answers = answersFor(testEntry, ['budget_t_1', 'budget_t_2']);
  const balance = engine.state.balance;
  const result = engine.completeTestAttempt(testEntry.id, answers);
  assert.equal(result.passed, false);
  assert.equal(result.score, 3);
  assert.equal(engine.state.balance, balance);
  assert.deepEqual(engine.state.completedTestIds, []);
});

test('сданный тест выдаёт награду только один раз за цикл', () => {
  const engine = makeEngine();
  makeProfile(engine);
  engine.completeTheory('budget');
  const testEntry = content.tasks.find((entry) => entry.id === 'budget_theory');
  const answers = answersFor(testEntry);
  const first = engine.completeTestAttempt(testEntry.id, answers);
  const balanceAfterFirst = engine.state.balance;
  const second = engine.completeTestAttempt(testEntry.id, answers);
  assert.equal(first.reward, 30);
  assert.equal(first.xpReward, 40);
  assert.equal(second.reward, 0);
  assert.equal(second.xpReward, 0);
  assert.equal(engine.state.balance, balanceAfterFirst);
});

test('через 12 часов обновляется награда, но учебный прогресс сохраняется', () => {
  assert.equal(TASK_RESET_INTERVAL_MS, 12 * 60 * 60 * 1000);
  let now = 1_000_000;
  const engine = makeEngine({ now: () => now });
  makeProfile(engine);
  assert.equal(engine.state.taskResetAt, now + TASK_RESET_INTERVAL_MS);

  const first = passTest(engine, 'budget_theory');
  const balanceAfterFirst = engine.state.balance;
  const xpAfterFirst = engine.state.xp;
  assert.equal(first.reward, 30);
  assert.deepEqual(engine.state.completedTaskIds, ['budget_theory']);
  assert.deepEqual(engine.state.completedTestIds, ['budget_theory']);

  now += TASK_RESET_INTERVAL_MS - 1;
  assert.equal(engine.refreshTasksIfDue(), false);
  assert.deepEqual(engine.state.completedTaskIds, ['budget_theory']);

  now += 1;
  assert.equal(engine.refreshTasksIfDue(), true);
  assert.deepEqual(engine.state.completedTaskIds, []);
  assert.deepEqual(engine.state.completedTestIds, ['budget_theory']);
  assert.deepEqual(engine.state.masteredTaskIds, ['budget_theory']);
  assert.equal(engine.state.taskCycle, 2);
  assert.equal(engine.state.taskHistory.length, 5);
  assert.equal(engine.state.xp, xpAfterFirst);

  const repeated = passTest(engine, 'budget_theory');
  assert.equal(repeated.reward, 30);
  assert.equal(engine.state.balance, balanceAfterFirst + 30);
  assert.equal(engine.state.taskHistory.length, 10);
});

test('старое сохранение получает новый таймер без потери выполненных заданий', () => {
  const memory = new MemoryStorage();
  memory.setItem('finny-pet-state-v1', JSON.stringify({
    onboardingComplete: true,
    profile: { nickname: 'Игрок', petName: 'Финни', fur: 'sunset', accessory: 'leaf' },
    completedTaskIds: ['budget_theory'],
    completedTestIds: ['budget_theory'],
    taskResetAt: 0
  }));
  const now = 5_000_000;
  const engine = new GameEngine(content, new GameStorage(memory), { now: () => now });
  assert.deepEqual(engine.state.completedTaskIds, ['budget_theory']);
  assert.deepEqual(engine.state.completedTestIds, ['budget_theory']);
  assert.deepEqual(engine.state.masteredTaskIds, ['budget_theory']);
  assert.equal(engine.state.taskResetAt, now + TASK_RESET_INTERVAL_MS);
});

test('числовой вопрос проверяет введённую сумму', () => {
  const engine = makeEngine();
  makeProfile(engine);
  engine.completeTheory('budget');
  assert.equal(engine.answerTestQuestion('budget_theory', 'budget_t_3', 24).correct, false);
  assert.equal(engine.answerTestQuestion('budget_theory', 'budget_t_3', 25).correct, true);
});

test('тест будущего периода нельзя выполнить раньше времени', () => {
  const engine = makeEngine();
  makeProfile(engine);
  const balance = engine.state.balance;
  const result = engine.answerTestQuestion('purchases_practice', 'purchases_p_1', 15);
  assert.equal(result.ok, false);
  assert.match(result.message, /периоде 5/i);
  assert.equal(engine.state.balance, balance);
});

test('период нельзя закончить без плана', () => {
  const engine = makeEngine();
  makeProfile(engine);
  const result = engine.finishPeriod();
  assert.equal(result.ok, false);
  assert.equal(engine.state.period, 1);
  assert.ok(result.remainingRequirements.length >= 1);
});

test('переход блокируется, пока не выполнен каждый пункт чек-листа', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  const requirements = getPeriodRequirements(engine.state, content);
  assert.equal(requirements.find((entry) => entry.type === 'plan').done, true);
  assert.equal(requirements.find((entry) => entry.type === 'purchase').done, false);
  const result = engine.finishPeriod();
  assert.equal(result.ok, false);
  assert.equal(engine.state.period, 1);
  assert.ok(result.remainingRequirements.some((entry) => entry.type === 'tests'));
});

test('план и факт считаются отдельно для трёх направлений', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  engine.purchase('porridge');
  engine.purchase('ball');
  engine.deposit(20);
  assert.deepEqual(getPeriodActuals(engine.state), { essential: 18, optional: 24, savings: 20 });
  assert.equal(calculatePeriodScore(engine.state), 80);
});

test('завершение периода сохраняет итог и начисляет следующий доход', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  engine.purchase('porridge');
  engine.purchase('ball');
  engine.deposit(20);
  engine.completeTheory('budget');
  passTest(engine, 'budget_theory');
  passTest(engine, 'budget_practice');
  assert.equal(engine.finishPeriod().ok, false);
  passTest(engine, 'budget_hard');
  const result = engine.finishPeriod();
  assert.equal(result.ok, true);
  assert.equal(engine.state.period, 2);
  assert.equal(engine.state.periodHistory.length, 1);
  assert.equal(engine.state.plan.confirmed, false);
  assert.equal(engine.state.incomes.at(-1).amount, 130);
});

test('питомец растёт после каждых двух завершённых периодов', () => {
  const engine = makeEngine();
  makeProfile(engine);
  for (let index = 0; index < 4; index += 1) {
    assert.equal(completeCurrentPeriod(engine).ok, true);
    assert.equal(getPetStage(engine.state).id, [1, 2, 2, 3][index]);
  }

  assert.equal(engine.state.growthPoints, 4);
  assert.equal(getPetStage(engine.state).id, 3);
});

test('всю игру можно последовательно пройти без тупиков в экономике', () => {
  const engine = makeEngine();
  makeProfile(engine);
  for (let period = 1; period <= 5; period += 1) {
    const result = completeCurrentPeriod(engine);
    assert.equal(result.ok, true, `период ${period} должен завершаться`);
  }
  assert.equal(engine.state.courseComplete, true);
  assert.equal(engine.state.periodHistory.length, 5);
  assert.ok(engine.state.ownedGoalIds.length >= 1);
});

test('сложный тест требует практику, повторение не ускоряет взросление', () => {
  const engine = makeEngine();
  makeProfile(engine);
  passTest(engine, 'budget_theory');
  assert.equal(engine.canStartTest('budget_hard').ok, false);
  passTest(engine, 'budget_practice');
  assert.equal(engine.canStartTest('budget_hard').ok, true);
  passTest(engine, 'budget_hard');
  passTest(engine, 'budget_hard');
  assert.equal(getPetStage(engine.state).id, 1);
});

test('старый таймер переносится один раз с сохранением денег и прогресса', () => {
  const start = 1_800_000_000_000;
  let now = start + 3 * 3600000;
  const storage = new GameStorage(new MemoryStorage());
  const first = new GameEngine(content, storage, { now: () => start });
  makeProfile(first);
  passTest(first, 'budget_theory');
  const legacy = structuredClone(first.state);
  delete legacy.taskResetIntervalMs;
  legacy.taskResetAt = start + 24 * 3600000;
  storage.save(legacy);
  let restored = new GameEngine(content, storage, { now: () => now });
  assert.equal(restored.state.taskResetAt, start + TASK_RESET_INTERVAL_MS);
  assert.equal(restored.state.balance, legacy.balance);
  assert.deepEqual(restored.state.completedTestIds, legacy.completedTestIds);
  restored = new GameEngine(content, storage, { now: () => now });
  assert.equal(restored.state.taskResetAt, start + TASK_RESET_INTERVAL_MS);
  now = start + TASK_RESET_INTERVAL_MS - 1;
  assert.equal(restored.refreshTasksIfDue(), false);
  now += 1;
  assert.equal(restored.refreshTasksIfDue(), true);
  assert.deepEqual(restored.state.completedTaskIds, []);
  assert.deepEqual(restored.state.completedTestIds, legacy.completedTestIds);
  assert.deepEqual(restored.state.answerHistory, legacy.answerHistory);
  assert.equal(restored.state.balance, legacy.balance);
  now = start + 5 * TASK_RESET_INTERVAL_MS + 100;
  assert.equal(restored.refreshTasksIfDue(), true);
  assert.equal(restored.state.taskResetAt, start + 6 * TASK_RESET_INTERVAL_MS);
});

test('бытовые нужды и счета имеют отдельные требования и не дают еду', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  assert.equal(engine.purchase('home_supplies').ok, false);
  assert.equal(engine.purchase('utility_bill').ok, false);
  engine.state.period = 4;
  engine.purchase('care');
  assert.equal(getPeriodRequirements(engine.state, content).find(x => x.id === 'household').done, false);
  const food = engine.state.food;
  assert.equal(engine.purchase('home_supplies').ok, true);
  assert.equal(engine.purchase('utility_bill').ok, true);
  assert.equal(engine.state.food, food);
  assert.equal(getPeriodRequirements(engine.state, content).find(x => x.id === 'utilities').done, true);
  const balance = engine.state.balance;
  assert.equal(engine.purchase('utility_bill').ok, false);
  assert.equal(engine.state.balance, balance);
  engine.state.period = 5;
  assert.equal(getPeriodRequirements(engine.state, content).find(x => x.id === 'utilities').done, false);
  assert.equal(engine.purchase('utility_bill').ok, true);
});

test('уровень и прогресс опыта рассчитываются детерминированно', () => {
  assert.equal(getLevel(0), 1);
  assert.equal(getLevel(199), 2);
  assert.deepEqual(getLevelProgress(245), { current: 45, target: 100 });
});

test('состояние сохраняется и восстанавливается после перезапуска', () => {
  const memory = new MemoryStorage();
  const storage = new GameStorage(memory);
  const first = new GameEngine(content, storage);
  makeProfile(first);
  makeBudget(first);
  first.deposit(15);

  const restored = new GameEngine(content, new GameStorage(memory));
  assert.equal(restored.state.profile.petName, 'Финни');
  assert.equal(restored.state.savings, 15);
  assert.equal(restored.state.plan.confirmed, true);
});

test('резервная копия используется при повреждении основного сохранения', () => {
  const memory = new MemoryStorage();
  memory.setItem('finny-pet-state-v1', '{broken');
  memory.setItem('finny-pet-state-v1-backup', JSON.stringify({ balance: 77, onboardingComplete: true }));
  const storage = new GameStorage(memory);
  assert.equal(storage.load().balance, 77);
});

test('некорректные числовые поля нормализуются в безопасные границы', () => {
  const state = normalizeState({ balance: -50, savings: 'bad', satiety: 999, mood: -20, period: 99 });
  assert.equal(state.balance, 0);
  assert.equal(state.savings, 0);
  assert.equal(state.satiety, 100);
  assert.equal(state.mood, 0);
  assert.equal(state.period, 5);
});

test('сброс удаляет профиль и весь игровой прогресс', () => {
  const engine = makeEngine();
  makeProfile(engine);
  makeBudget(engine);
  engine.deposit(10);
  engine.resetProfile();
  assert.equal(engine.state.profile, null);
  assert.equal(engine.state.balance, 0);
  assert.equal(engine.state.savings, 0);
  assert.equal(engine.state.onboardingComplete, false);
});
