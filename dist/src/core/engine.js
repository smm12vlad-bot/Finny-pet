import { cloneState, createDefaultState, createEmptyPlan, normalizeState } from './state.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Math.round(value)));
const integer = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0;
export const TASK_RESET_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const SATIETY_DECAY_MS = 5 * 60 * 1000;
export const MOOD_DECAY_MS = 5 * 60 * 1000;
export const PET_NEED_DECAY_AMOUNT = 2;

export function getLevel(xp) {
  return Math.max(1, Math.floor(Math.max(0, xp) / 100) + 1);
}

export function getLevelProgress(xp) {
  const safeXp = Math.max(0, integer(xp));
  return { current: safeXp % 100, target: 100 };
}

export function getPetStage(state) {
  if (state.period >= 5) return { id: 3, title: 'Мастер планирования', scale: 1.12 };
  if (state.period >= 3) return { id: 2, title: 'Уверенный исследователь', scale: 1.03 };
  return { id: 1, title: 'Любознательный малыш', scale: 0.92 };
}

export function getPetExplanation(state) {
  const reasons = [];
  if (state.satiety < 45) reasons.push('нужна полезная еда');
  if (state.mood < 45) reasons.push('поможет пройденный тест или забота');
  if (state.confidence < 45) reasons.push('уверенность растёт, когда план соблюдается');
  if (reasons.length) return `Финни немного грустит: ${reasons.join(', ')}.`;
  if (state.satiety >= 75 && state.mood >= 75) return 'Финни бодр и доволен: важные расходы учтены, а решения приносят результат.';
  return 'Финни чувствует себя спокойно. Продолжай следить за планом и целью.';
}

export function getPeriodActuals(state) {
  const current = state.purchases.filter((record) => record.period === state.period);
  return {
    essential: current.filter((record) => record.category === 'essential').reduce((sum, record) => sum + record.price, 0),
    optional: current.filter((record) => record.category === 'optional').reduce((sum, record) => sum + record.price, 0),
    savings: state.periodSavingsDeposited
  };
}

export function getTasksForPeriod(content, period) {
  return content.tasks.filter((task) => integer(task.unlockPeriod || 1) === integer(period));
}

export function getTestsForBlock(content, blockId) {
  const typeOrder = { theory: 0, practice: 1 };
  return content.tasks
    .filter((test) => test.blockId === blockId)
    .sort((a, b) => typeOrder[a.testType] - typeOrder[b.testType] || a.reward - b.reward);
}

export function getTestAvailability(state, content, test) {
  if (!test) return { unlocked: false, reason: 'Тест не найден.' };
  if (state.demoMode) return { unlocked: true, reason: '' };
  if (integer(test.unlockPeriod || 1) > state.period) {
    return { unlocked: false, reason: `Откроется в периоде ${test.unlockPeriod}.` };
  }
  if (!state.readTheoryBlockIds.includes(test.blockId)) {
    return { unlocked: false, reason: 'Сначала изучи теорию этого блока.' };
  }
  if (test.requiresTestId && !state.completedTestIds.includes(test.requiresTestId)) {
    return { unlocked: false, reason: 'Сначала сдай обычный практический тест этого периода.' };
  }
  if (test.testType === 'practice') {
    const theoryTest = content.tasks.find((entry) => entry.blockId === test.blockId && entry.testType === 'theory');
    if (theoryTest && !state.completedTestIds.includes(theoryTest.id)) {
      return { unlocked: false, reason: 'Сначала сдай теоретический тест.' };
    }
  }
  return { unlocked: true, reason: '' };
}

export function getUnlockedGoals(content, period) {
  return content.goals.filter((goal) => integer(goal.unlockPeriod || 1) <= integer(period));
}

export function getPeriodRequirements(state, content) {
  const period = content.periods.find((entry) => entry.id === state.period) || content.periods[state.period - 1];
  if (!period) return [];
  const purchases = state.purchases.filter((entry) => entry.period === state.period);
  const usedGoals = Object.values(state.goalUsagePeriods || {}).filter((usedPeriod) => usedPeriod === state.period).length;

  return (period.objectives || []).map((objective) => {
    let current = 0;
    let target = 1;

    if (objective.type === 'plan') current = state.plan.confirmed ? 1 : 0;
    if (objective.type === 'purchase') {
      target = Math.max(1, integer(objective.count || 1));
      current = purchases.filter((entry) => entry.category === objective.category && (!objective.itemId || entry.itemId === objective.itemId)).length;
    }
    if (objective.type === 'deposit') {
      target = Math.max(1, integer(objective.amount || 1));
      current = state.periodSavingsDeposited;
    }
    if (objective.type === 'theory') {
      const blockIds = Array.isArray(objective.blockIds) ? objective.blockIds : [];
      target = Math.max(1, integer(objective.count || blockIds.length || 1));
      current = blockIds.filter((blockId) => state.readTheoryBlockIds.includes(blockId)).length;
    }
    if (objective.type === 'tests') {
      const testIds = Array.isArray(objective.testIds) ? objective.testIds : [];
      target = Math.max(1, integer(objective.count || testIds.length || 1));
      current = testIds.filter((testId) => state.completedTestIds.includes(testId)).length;
    }
    if (objective.type === 'goal_owned') {
      target = Math.max(1, integer(objective.count || 1));
      current = state.ownedGoalIds.length;
    }
    if (objective.type === 'goal_used') {
      target = Math.max(1, integer(objective.count || 1));
      current = usedGoals;
    }

    return {
      ...objective,
      current: Math.min(current, target),
      target,
      done: current >= target
    };
  });
}

export function calculatePeriodScore(state) {
  const actual = getPeriodActuals(state);
  const plan = state.plan;
  const hasCurrentTask = state.testHistory.some((entry) => entry.period === state.period && entry.passed);
  let score = 10;

  if (actual.essential > 0) score += 25;
  if (actual.optional > 0 && actual.optional <= plan.optional) score += 20;
  else if (actual.optional === 0) score += 10;
  else score += 5;

  if (actual.savings >= plan.savings) score += 25;
  else if (actual.savings > 0) score += 15;
  if (hasCurrentTask) score += 20;

  return clamp(score, 0, 100);
}

export class GameEngine {
  constructor(content, storage, { now } = {}) {
    this.content = content;
    this.storage = storage;
    this.now = typeof now === 'function' ? now : () => Date.now();
    this.state = normalizeState(storage.load());
    this.refreshPetNeeds({ silent: true });
    this.refreshTasksIfDue({ silent: true });
  }

  commit(nextState) {
    this.state = normalizeState(nextState);
    this.storage.save(this.state);
    return this.state;
  }

  result(ok, message, extra = {}) {
    return { ok, message, ...extra };
  }

  refreshPetNeeds({ silent = false } = {}) {
    if (!this.state.profile || this.state.demoMode) return false;

    const now = this.now();
    const next = cloneState(this.state);

    let satietyUpdatedAt = Number(next.satietyUpdatedAt) || 0;
    let moodUpdatedAt = Number(next.moodUpdatedAt) || 0;

    // Старые сохранения не наказываем за время до обновления игры.
    if (satietyUpdatedAt <= 0 || moodUpdatedAt <= 0) {
      next.satietyUpdatedAt = now;
      next.moodUpdatedAt = now;
      this.commit(next);
      return false;
    }

    // Если системные часы перевели назад, просто начинаем отсчёт заново.
    if (now < satietyUpdatedAt || now < moodUpdatedAt) {
      next.satietyUpdatedAt = now;
      next.moodUpdatedAt = now;
      this.commit(next);
      return false;
    }

    const satietyTicks = Math.floor((now - satietyUpdatedAt) / SATIETY_DECAY_MS);
    const moodTicks = Math.floor((now - moodUpdatedAt) / MOOD_DECAY_MS);

    if (satietyTicks <= 0 && moodTicks <= 0) return false;

    if (satietyTicks > 0) {
      next.satiety = clamp(next.satiety - satietyTicks * PET_NEED_DECAY_AMOUNT, 0, 100);
      next.satietyUpdatedAt = satietyUpdatedAt + satietyTicks * SATIETY_DECAY_MS;
    }

    if (moodTicks > 0) {
      next.mood = clamp(next.mood - moodTicks * PET_NEED_DECAY_AMOUNT, 0, 100);
      next.moodUpdatedAt = moodUpdatedAt + moodTicks * MOOD_DECAY_MS;
    }

    if (!silent) {
      next.feedback = getPetExplanation(next);
    }

    this.commit(next);
    return true;
  }

  getTaskResetRemaining() {
    if (this.state.demoMode) return 0;
    if (!this.state.profile || !this.state.taskResetAt) return TASK_RESET_INTERVAL_MS;
    return Math.max(0, this.state.taskResetAt - this.now());
  }

  refreshTasksIfDue({ silent = false } = {}) {
    if (!this.state.profile || this.state.demoMode) return false;
    const now = this.now();
    let currentResetAt = Number(this.state.taskResetAt) || 0;
    const next = cloneState(this.state);
    const migrated = next.taskResetIntervalMs !== TASK_RESET_INTERVAL_MS;
    if (migrated) {
      // Old releases used 24h. Preserve cycle start and migrate only once.
      if (currentResetAt > 0) currentResetAt = Math.max(1, currentResetAt - (24 * 60 * 60 * 1000 - TASK_RESET_INTERVAL_MS));
      next.taskResetIntervalMs = TASK_RESET_INTERVAL_MS;
      next.taskResetAt = currentResetAt;
    }

    if (currentResetAt <= 0) {
      next.taskResetAt = now + TASK_RESET_INTERVAL_MS;
      this.commit(next);
      return false;
    }
    if (now < currentResetAt) {
      if (migrated) this.commit(next);
      return false;
    }

    const passedCycles = Math.floor((now - currentResetAt) / TASK_RESET_INTERVAL_MS) + 1;
    next.completedTaskIds = [];
    next.taskCycle = Math.max(1, next.taskCycle + passedCycles);
    next.taskResetAt = currentResetAt + passedCycles * TASK_RESET_INTERVAL_MS;
    if (!silent) next.feedback = 'Награды за тесты обновились. Пройденные блоки остались в учебном прогрессе.';
    this.commit(next);
    return true;
  }

  completeOnboarding() {
    const next = cloneState(this.state);
    next.onboardingComplete = true;
    next.feedback = 'Теперь создай игрового питомца. Настоящие имя, телефон и e-mail не нужны.';
    this.commit(next);
  }

  createProfile({ nickname, petName, fur, accessory, accessoryColor }) {
    const cleanNickname = String(nickname || '').trim().slice(0, 16);
    const cleanPetName = 'Финни';
    if (cleanNickname.length < 2 || cleanPetName.length < 2) {
      return this.result(false, 'Придумай игровой ник и имя питомца — минимум по 2 символа.');
    }

    const next = createDefaultState();
    next.onboardingComplete = true;
    next.profile = {
      nickname: cleanNickname,
      petName: cleanPetName,
      fur: ['sunset', 'honey', 'berry'].includes(fur) ? fur : 'sunset',
      accessory: ['leaf', 'bow', 'star'].includes(accessory) ? accessory : 'leaf',
      accessoryColor: ['green', 'pink', 'blue'].includes(accessoryColor) ? accessoryColor : 'green'
    };
    next.balance = this.content.periods[0].income;
    next.food = 1;
    next.taskCycle = 1;
    next.satietyUpdatedAt = this.now();
    next.moodUpdatedAt = this.now();
    next.taskResetAt = this.now() + TASK_RESET_INTERVAL_MS;
    next.taskResetIntervalMs = TASK_RESET_INTERVAL_MS;
    next.selectedGoalId = this.content.goals[0].id;
    next.incomes = [{
      source: this.content.periods[0].incomeSource,
      amount: this.content.periods[0].income,
      period: 1
    }];
    next.feedback = `Получено ${next.balance} бамбунчинок: ${this.content.periods[0].incomeSource}. Сначала составь бюджет.`;
    this.commit(next);
    return this.result(true, next.feedback);
  }

  loadDemoProfile() {
    const previousState = this.state.demoMode && this.state.demoBackup
      ? cloneState(this.state.demoBackup)
      : cloneState(this.state);
    previousState.demoMode = false;
    delete previousState.demoBackup;

    const result = this.createProfile({ nickname: 'Эксперт', petName: 'Финни', fur: 'sunset', accessory: 'leaf', accessoryColor: 'green' });
    if (!result.ok) return result;
    const next = cloneState(this.state);
    next.demoMode = true;
    next.demoBackup = previousState;
    next.taskResetAt = 0;
    next.taskResetIntervalMs = 0;
    next.feedback = 'Тестовый режим для экспертов включён. Все тесты доступны, валюта безлимитная, ожидание времени отключено.';
    this.commit(next);
    return this.result(true, 'Тестовый режим включён: все тесты открыты, валюта безлимитная.');
  }

  exitDemoProfile() {
    if (!this.state.demoMode) return this.result(false, 'Тестовый режим уже выключен.');

    const backup = this.state.demoBackup && typeof this.state.demoBackup === 'object'
      ? cloneState(this.state.demoBackup)
      : createDefaultState();
    backup.demoMode = false;
    delete backup.demoBackup;
    backup.feedback = backup.profile
      ? 'Вы вышли из тестового режима. Обычный прогресс восстановлен.'
      : 'Вы вышли из тестового режима.';
    this.commit(backup);
    return this.result(true, 'Тестовый режим выключен.');
  }

  confirmBudget({ essential, optional, savings }) {
    if (this.state.plan.confirmed) {
      return this.result(false, 'План уже подтверждён. Новый план появится в следующем периоде.');
    }

    const values = [integer(essential), integer(optional), integer(savings)];
    if (values.some((value) => value <= 0)) {
      return this.result(false, 'Распредели хотя бы одну бамбунчинку на каждое из трёх направлений.');
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!this.state.demoMode && total > this.state.balance) {
      return this.result(false, `План больше бюджета на ${total - this.state.balance} бамбунчинок. Уменьши одну из сумм.`);
    }

    const next = cloneState(this.state);
    next.plan = { essential: values[0], optional: values[1], savings: values[2], confirmed: true };
    next.confidence = clamp(next.confidence + 4, 0, 100);
    next.feedback = this.state.demoMode
      ? `План подтверждён: ${values[0]} на важное, ${values[1]} на желания, ${values[2]} в накопления. В демо-режиме доступная валюта не ограничена.`
      : `План подтверждён: ${values[0]} на важное, ${values[1]} на желания, ${values[2]} в накопления. Остаток ${this.state.balance - total}.`;
    this.commit(next);
    return this.result(true, next.feedback);
  }

  purchase(itemId) {
    const item = this.content.items.find((entry) => entry.id === itemId);
    if (!item) return this.result(false, 'Товар не найден.');
    if ((item.unlockPeriod || 1) > this.state.period) return this.result(false, `Откроется в периоде ${item.unlockPeriod}.`);
    if (item.oncePerPeriod && this.state.purchases.some((entry) => entry.itemId === item.id && entry.period === this.state.period)) {
      return this.result(false, 'Этот счёт уже оплачен в текущем периоде.');
    }
    if (!this.state.plan.confirmed) return this.result(false, 'Сначала составь и подтверди бюджет.');
    if (!this.state.demoMode && this.state.balance < item.price) {
      return this.result(false, `Не хватает ${item.price - this.state.balance} бамбунчинок. Пройди тест, выбери более доступный товар или отложи покупку.`, { reason: 'insufficient' });
    }

    const next = cloneState(this.state);
    if (!next.demoMode) next.balance -= item.price;
    // Покупка еды только пополняет запас. Сытость меняется только после кормления.
    next.mood = clamp(next.mood + item.moodDelta, 0, 100);
    if (item.kind === 'food') next.food = clamp(next.food + 1, 0, 99);
    next.purchases.push({
      id: `${Date.now()}-${item.id}`,
      itemId: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      period: next.period
    });
    const actual = getPeriodActuals(next);
    const categoryActual = actual[item.category];
    const categoryPlan = next.plan[item.category];
    const planNote = categoryActual > categoryPlan
      ? 'Расход выше плана — это увидим в итогах периода.'
      : 'Покупка пока укладывается в план.';
    next.feedback = next.demoMode
      ? `${item.name}: покупка выполнена. В демо-режиме бамбунчинки не заканчиваются. ${planNote}`
      : `${item.name}: −${item.price} бамбунчинок. ${planNote}`;
    this.commit(next);
    return this.result(true, next.feedback);
  }

  feedPet() {
    this.refreshPetNeeds({ silent: true });
    if (this.state.food <= 0) return this.result(false, 'Запас еды закончился. Выбери полезную еду в магазине.');
    if (this.state.satiety >= 96) return this.result(false, `${this.state.profile?.petName || 'Финни'} уже сыт. Еду можно сохранить на потом.`);
    const next = cloneState(this.state);
    next.food -= 1;
    next.satiety = clamp(next.satiety + 18, 0, 100);
    next.mood = clamp(next.mood + 3, 0, 100);
    next.feedback = `${next.profile?.petName || 'Финни'} поел и стал бодрее. Запас еды: ${next.food}.`;
    this.commit(next);
    return this.result(true, next.feedback);
  }

  selectGoal(goalId) {
    const goal = this.content.goals.find((entry) => entry.id === goalId);
    if (!goal) return this.result(false, 'Цель не найдена.');
    if (integer(goal.unlockPeriod || 1) > this.state.period) {
      return this.result(false, `Цель «${goal.title}» откроется в периоде ${goal.unlockPeriod}.`);
    }
    if (this.state.ownedGoalIds.includes(goal.id)) {
      return this.result(false, `Цель «${goal.title}» уже получена. Её можно использовать в коллекции.`);
    }
    const next = cloneState(this.state);
    next.selectedGoalId = goal.id;
    next.feedback = `Цель «${goal.title}» выбрана. До неё осталось ${Math.max(0, goal.cost - next.savings)} бамбунчинок.`;
    this.commit(next);
    return this.result(true, next.feedback);
  }

  claimGoal(goalId = this.state.selectedGoalId) {
    const goal = this.content.goals.find((entry) => entry.id === goalId);
    if (!goal) return this.result(false, 'Цель не найдена.');
    if (integer(goal.unlockPeriod || 1) > this.state.period) {
      return this.result(false, `Эта цель откроется в периоде ${goal.unlockPeriod}.`);
    }
    if (this.state.ownedGoalIds.includes(goal.id)) return this.result(false, `Цель «${goal.title}» уже есть в коллекции.`);
    if (this.state.savings < goal.cost) {
      return this.result(false, `До цели не хватает ${goal.cost - this.state.savings} бамбунчинок.`);
    }

    const next = cloneState(this.state);
    next.savings -= goal.cost;
    next.ownedGoalIds.push(goal.id);
    next.goalHistory.push({
      id: `${this.now()}-${goal.id}`,
      goalId: goal.id,
      name: goal.title,
      cost: goal.cost,
      period: next.period,
      acquiredAt: new Date(this.now()).toISOString()
    });
    next.confidence = clamp(next.confidence + 8, 0, 100);
    next.mood = clamp(next.mood + 4, 0, 100);
    const nextGoal = getUnlockedGoals(this.content, next.period).find((entry) => !next.ownedGoalIds.includes(entry.id));
    const futureGoal = this.content.goals.find((entry) => integer(entry.unlockPeriod || 1) > next.period && !next.ownedGoalIds.includes(entry.id));
    if (nextGoal) next.selectedGoalId = nextGoal.id;
    next.feedback = nextGoal
      ? `Цель «${goal.title}» получена и добавлена в коллекцию. Следующая цель — «${nextGoal.title}».`
      : futureGoal
        ? `Цель «${goal.title}» получена. Новая цель откроется в периоде ${futureGoal.unlockPeriod}.`
        : `Цель «${goal.title}» получена. Вся коллекция целей собрана!`;
    this.commit(next);
    return this.result(true, next.feedback, { goal, nextGoalId: nextGoal?.id || null, savingsAfter: next.savings });
  }

  useGoal(goalId) {
    const goal = this.content.goals.find((entry) => entry.id === goalId);
    if (!goal) return this.result(false, 'Цель не найдена.');
    if (!this.state.ownedGoalIds.includes(goal.id)) return this.result(false, 'Сначала накопи на эту цель и получи её.');
    if (this.state.goalUsagePeriods[goal.id] === this.state.period) {
      return this.result(false, `«${goal.title}» уже использована в этом периоде. Снова будет доступна в следующем.`);
    }

    const next = cloneState(this.state);
    const effect = goal.effect || {};
    next.satiety = clamp(next.satiety + integer(effect.satiety), 0, 100);
    next.mood = clamp(next.mood + integer(effect.mood), 0, 100);
    next.confidence = clamp(next.confidence + integer(effect.confidence), 0, 100);
    next.goalUsagePeriods[goal.id] = next.period;
    next.feedback = `${goal.actionLabel}: ${goal.effectDescription}. Повторно использовать цель можно в следующем периоде.`;
    this.commit(next);
    return this.result(true, next.feedback, { goal });
  }

  deposit(amount) {
    const value = integer(amount);
    if (!this.state.plan.confirmed) return this.result(false, 'Сначала подтверди бюджет.');
    if (value <= 0) return this.result(false, 'Сумма пополнения должна быть больше нуля.');
    if (!this.state.demoMode && value > this.state.balance) return this.result(false, `На балансе не хватает ${value - this.state.balance} бамбунчинок.`);
    const next = cloneState(this.state);
    if (!next.demoMode) next.balance -= value;
    next.savings += value;
    next.periodSavingsDeposited += value;
    next.confidence = clamp(next.confidence + 3, 0, 100);
    const unlockedGoal = getUnlockedGoals(this.content, next.period)
      .find((entry) => entry.id === next.selectedGoalId && !next.ownedGoalIds.includes(entry.id))
      || getUnlockedGoals(this.content, next.period).find((entry) => !next.ownedGoalIds.includes(entry.id));
    const nextLockedGoal = this.content.goals.find((entry) => integer(entry.unlockPeriod || 1) > next.period);
    next.feedback = unlockedGoal
      ? `В копилку добавлено ${value}. До цели осталось ${Math.max(0, unlockedGoal.cost - next.savings)} бамбунчинок.${next.demoMode ? ' Доступный баланс в демо-режиме не уменьшается.' : ''}`
      : nextLockedGoal
        ? `В копилку добавлено ${value}. Ты копишь заранее: новая цель откроется в периоде ${nextLockedGoal.unlockPeriod}.`
        : `В копилку добавлено ${value}. Все доступные цели уже собраны.`;
    this.commit(next);
    return this.result(true, next.feedback);
  }

  withdraw(amount) {
    const value = integer(amount);
    if (value <= 0 || value > this.state.savings) return this.result(false, 'Укажи сумму, которая действительно есть в копилке.');
    const next = cloneState(this.state);
    next.balance += value;
    next.savings -= value;
    next.periodSavingsDeposited = Math.max(0, next.periodSavingsDeposited - value);
    const goal = getUnlockedGoals(this.content, next.period)
      .find((entry) => entry.id === next.selectedGoalId && !next.ownedGoalIds.includes(entry.id))
      || getUnlockedGoals(this.content, next.period).find((entry) => !next.ownedGoalIds.includes(entry.id));
    const remaining = goal ? Math.max(0, goal.cost - next.savings) : 0;
    const regular = Math.max(1, next.plan.savings || 10);
    const estimate = Math.ceil(remaining / regular);
    next.feedback = goal
      ? `Из копилки возвращено ${value} бамбунчинок. До цели осталось ${remaining}; при взносе ${regular} понадобится примерно ${estimate} периодов.`
      : `Из копилки возвращено ${value} бамбунчинок. Все открытые цели уже собраны.`;
    this.commit(next);
    return this.result(true, next.feedback);
  }

  completeTheory(blockId) {
    const lesson = this.content.lessons.find((entry) => entry.id === blockId);
    if (!lesson) return this.result(false, 'Учебный блок не найден.');
    if (!this.state.demoMode && integer(lesson.unlockPeriod || 1) > this.state.period) {
      return this.result(false, `Этот блок откроется в периоде ${lesson.unlockPeriod}.`);
    }
    const next = cloneState(this.state);
    const alreadyRead = next.readTheoryBlockIds.includes(blockId);
    if (!alreadyRead) next.readTheoryBlockIds.push(blockId);
    next.feedback = alreadyRead
      ? `Теория «${lesson.title}» повторена. Можно перейти к тестам.`
      : `Теория «${lesson.title}» изучена. Теперь открыт теоретический тест.`;
    this.commit(next);
    return this.result(true, next.feedback, { lesson, alreadyRead });
  }

  canStartTest(testId) {
    const test = this.content.tasks.find((entry) => entry.id === testId);
    const availability = getTestAvailability(this.state, this.content, test);
    return this.result(availability.unlocked, availability.reason || 'Тест доступен.', { test, ...availability });
  }

  answerTestQuestion(testId, questionId, answer) {
    this.refreshTasksIfDue();
    const test = this.content.tasks.find((entry) => entry.id === testId);
    const availability = getTestAvailability(this.state, this.content, test);
    if (!availability.unlocked) return this.result(false, availability.reason, { test });
    const question = test.questions.find((entry) => entry.id === questionId);
    if (!question) return this.result(false, 'Вопрос не найден.');
    const correct = question.type === 'amount'
      ? integer(answer) === question.correctAmount
      : question.options.some((option) => option.id === answer && option.correct);

    const next = cloneState(this.state);
    next.taskHistory.push({
      taskId: testId,
      testId,
      questionId,
      period: next.period,
      cycle: next.taskCycle,
      correct,
      attemptedAt: new Date(this.now()).toISOString()
    });
    if (!correct) {
      next.mood = clamp(next.mood + 1, 0, 100);
      next.feedback = question.retryExplanation;
    } else {
      next.feedback = question.successExplanation;
    }
    this.commit(next);
    return this.result(true, next.feedback, { correct, test, question });
  }

  completeTestAttempt(testId, answers) {
    this.refreshTasksIfDue();
    const test = this.content.tasks.find((entry) => entry.id === testId);
    const availability = getTestAvailability(this.state, this.content, test);
    if (!availability.unlocked) return this.result(false, availability.reason, { test });
    if (!Array.isArray(answers)) return this.result(false, 'Нужно ответить на все пять вопросов.');

    const answerMap = new Map(answers.map((entry) => [String(entry.questionId), entry.answer]));
    if (answerMap.size !== test.questions.length || test.questions.some((question) => !answerMap.has(question.id))) {
      return this.result(false, 'Нужно ответить на все пять вопросов.');
    }

    const details = test.questions.map((question) => {
      const answer = answerMap.get(question.id);
      const correct = question.type === 'amount'
        ? integer(answer) === question.correctAmount
        : question.options.some((option) => option.id === answer && option.correct);
      return { questionId: question.id, answer, correct };
    });
    const score = details.filter((entry) => entry.correct).length;
    const total = test.questions.length;
    const passed = score >= integer(test.passScore || 4);
    const next = cloneState(this.state);
    next.testHistory.push({
      testId,
      blockId: test.blockId,
      period: next.period,
      cycle: next.taskCycle,
      score,
      total,
      passed,
      completedAt: new Date(this.now()).toISOString()
    });

    if (!passed) {
      next.feedback = `Результат: ${score} из ${total}. Для зачёта нужно ${test.passScore || 4}. Повтори теорию и попробуй ещё раз — штрафа нет.`;
      this.commit(next);
      return this.result(true, next.feedback, { passed, score, total, reward: 0, xpReward: 0, test, details });
    }

    const alreadyRewarded = next.completedTaskIds.includes(test.id);
    if (!next.completedTestIds.includes(test.id)) next.completedTestIds.push(test.id);
    if (!next.masteredTaskIds.includes(test.id)) next.masteredTaskIds.push(test.id);
    if (!alreadyRewarded) {
      next.completedTaskIds.push(test.id);
      next.balance += test.reward;
      next.xp += test.xp;
      next.confidence = clamp(next.confidence + 5, 0, 100);
    }
    next.feedback = alreadyRewarded
      ? `Тест сдан: ${score} из ${total}. Награда текущего цикла уже получена.`
      : `Тест сдан: ${score} из ${total}. Награда: +${test.reward} бамбунчинок и +${test.xp} опыта.`;
    this.commit(next);
    return this.result(true, next.feedback, {
      passed,
      score,
      total,
      reward: alreadyRewarded ? 0 : test.reward,
      xpReward: alreadyRewarded ? 0 : test.xp,
      test,
      details
    });
  }

  finishPeriod() {
    if (this.state.courseComplete) return this.result(false, 'Все пять учебных периодов уже пройдены. Результаты доступны в разделе прогресса.');
    const requirements = getPeriodRequirements(this.state, this.content);
    const remainingRequirements = requirements.filter((entry) => !entry.done);
    if (!this.state.demoMode && remainingRequirements.length) {
      return this.result(false, `Переход пока закрыт: выполни ещё ${remainingRequirements.length} ${remainingRequirements.length === 1 ? 'цель' : 'цели'} периода.`, {
        requirements,
        remainingRequirements
      });
    }
    const next = cloneState(this.state);
    const actual = getPeriodActuals(next);
    const score = calculatePeriodScore(next);
    const message = score >= 80
      ? 'План отлично соблюдён. Финни становится увереннее!'
      : score >= 55
        ? 'Хороший шаг. В следующем периоде попробуй точнее следовать плану.'
        : 'Ошибки помогают учиться. Начни следующий период с важных расходов и небольшого взноса.';
    next.periodHistory.push({
      period: next.period,
      score,
      plan: { ...next.plan },
      actual,
      balanceAfter: next.balance,
      savingsAfter: next.savings,
      requirements: requirements.map(({ id, label }) => ({ id, label, done: true })),
      message
    });
    next.growthPoints = Math.min(5, next.period);
    next.xp += Math.round(score / 4);
    next.mood = clamp(next.mood + (score >= 75 ? 8 : score >= 50 ? 2 : -4), 0, 100);
    next.confidence = clamp(next.confidence + (score >= 75 ? 8 : score >= 50 ? 2 : -3), 0, 100);
    next.satiety = clamp(next.satiety - 8, 0, 100);

    if (next.period >= this.content.periods.length) {
      next.courseComplete = true;
      next.feedback = `${message} Все пять учебных периодов пройдены.`;
      this.commit(next);
      return this.result(true, next.feedback, { summary: next.periodHistory.at(-1), complete: true });
    }

    next.period += 1;
    next.plan = createEmptyPlan();
    next.periodSavingsDeposited = 0;
    const period = this.content.periods[next.period - 1];
    const newGoal = getUnlockedGoals(this.content, next.period).find((entry) => !next.ownedGoalIds.includes(entry.id));
    if (newGoal) next.selectedGoalId = newGoal.id;
    next.balance += period.income;
    next.incomes.push({ source: period.incomeSource, amount: period.income, period: next.period });
    next.feedback = `${message} Начался период ${next.period} «${period.title}»: +${period.income} бамбунчинок (${period.incomeSource}). Новый уровень — ${period.stage.toLowerCase()}.`;
    this.commit(next);
    return this.result(true, next.feedback, { summary: next.periodHistory.at(-1), complete: false, nextPeriod: period });
  }

  updateSettings(patch) {
    const next = cloneState(this.state);
    next.settings = { ...next.settings, ...patch };
    this.commit(next);
  }

  resetProfile() {
    this.storage.clear();
    this.state = createDefaultState();
    this.storage.save(this.state);
    return this.result(true, 'Локальный профиль и прогресс удалены.');
  }
}
