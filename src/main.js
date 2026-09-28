import { loadContent } from './core/content.js';
import { GameEngine, getPeriodRequirements, getUnlockedGoals } from './core/engine.js';
import { GameStorage } from './core/storage.js';
import { mountPetScene, destroyPetScene } from './game/pet-scene.js';
import { escapeHtml, categoryLabel, statusIcon } from './ui/helpers.js';
import { errorTemplate, formatTaskTime, renderRoute } from './ui/templates.js';

const appRoot = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toastElement = document.getElementById('toast');

let content;
let engine;
let currentRoute = 'onboarding';
let toastTimer;
let countdownTimer;
let petNeedsTimer;

const ui = {
  onboardingPage: 0,
  selectedBlockId: 'budget',
  selectedTestId: null,
  testSession: null,
  tasksNotice: null,
  adultUnlocked: false,
  challenge: createChallenge(),
  history: []
};

function createChallenge() {
  const a = 7 + Math.floor(Math.random() * 8);
  const b = 4 + Math.floor(Math.random() * 7);
  return { a, b, answer: a + b };
}

function initialRoute() {
  if (!engine.state.onboardingComplete) return 'onboarding';
  if (!engine.state.profile) return 'profile';
  return 'home';
}

function go(route, { replace = false } = {}) {
  if (currentRoute === 'adult' && route !== 'adult') {
    ui.adultUnlocked = false;
    ui.challenge = createChallenge();
  }
  if (!engine.state.onboardingComplete && route !== 'onboarding') route = 'onboarding';
  if (engine.state.onboardingComplete && !engine.state.profile && !['profile', 'onboarding'].includes(route)) route = 'profile';
  if (!replace && route !== currentRoute) ui.history.push(currentRoute);
  if (route !== 'tasks' || !['test', 'theory'].includes(currentRoute)) ui.tasksNotice = null;
  currentRoute = route;
  if (route !== 'test') ui.testSession = null;
  render();
}

function back() {
  if (currentRoute === 'adult') {
    ui.adultUnlocked = false;
    ui.challenge = createChallenge();
  }
  const route = ui.history.pop();
  if (route && route !== 'onboarding' && route !== 'profile') {
    currentRoute = route;
  } else {
    currentRoute = engine.state.profile ? 'home' : 'profile';
  }
  ui.testSession = null;
  ui.tasksNotice = null;
  render();
}

function render() {
  destroyPetScene();
  appRoot.innerHTML = renderRoute(currentRoute, engine.state, content, ui);
  const screen = appRoot.querySelector('.screen');
  if (screen) screen.scrollTop = 0;

  if (currentRoute === 'home') {
    requestAnimationFrame(() => mountPetScene('pet-stage', engine.state));
  }
  if (currentRoute === 'profile') {
    requestAnimationFrame(updateProfilePreview);
  }
}

function updateProfilePreview() {
  const form = document.getElementById('profile-form');
  if (!form) return;
  const data = new FormData(form);
  const previewState = {
    ...engine.state,
    profile: {
      nickname: 'Игрок',
      petName: 'Финни',
      fur: 'sunset',
      accessory: String(data.get('accessory') || 'leaf'),
      accessoryColor: String(data.get('accessoryColor') || 'green')
    }
  };
  mountPetScene('pet-preview', previewState, { preview: true });
}

function showToast(message) {
  clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.classList.add('is-visible');
  toastTimer = setTimeout(() => toastElement.classList.remove('is-visible'), 2600);
}

function startTest(testId) {
  const result = engine.canStartTest(testId);
  if (!result.ok) {
    showToast(result.message);
    return;
  }
  ui.selectedTestId = testId;
  ui.testSession = {
    testId,
    questionIndex: 0,
    answers: [],
    feedback: null,
    summary: null
  };
  ui.tasksNotice = null;
  go('test');
}

function handleTestAnswer(testId, questionId, answer) {
  if (!ui.testSession || ui.testSession.testId !== testId || ui.testSession.feedback) return;
  const result = engine.answerTestQuestion(testId, questionId, answer);
  if (!result.ok) {
    showToast(result.message);
    return;
  }
  ui.testSession.answers.push({ questionId, answer, correct: result.correct });
  ui.testSession.feedback = result;
  render();
}

function nextTestQuestion() {
  const session = ui.testSession;
  const test = content.tasks.find((entry) => entry.id === session?.testId);
  if (!session || !test || !session.feedback) return;
  if (session.questionIndex < test.questions.length - 1) {
    session.questionIndex += 1;
    session.feedback = null;
    render();
    return;
  }

  const result = engine.completeTestAttempt(test.id, session.answers);
  if (!result.ok) {
    showToast(result.message);
    return;
  }
  if (!result.passed) {
    session.summary = result;
    session.feedback = null;
    render();
    return;
  }

  ui.testSession = null;
  ui.tasksNotice = { message: result.message };
  if (ui.history.at(-1) === 'tasks') ui.history.pop();
  currentRoute = 'tasks';
  render();
  showToast(result.reward > 0 ? `Тест сдан! +${result.reward} бамбунчинок` : 'Тест сдан повторно!');
}

function updatePetNeeds() {
  if (!engine?.state.profile || engine.state.demoMode) return;
  const changed = engine.refreshPetNeeds();
  if (!changed) return;

  // Перерисовываем только текущий экран, чтобы показатели и эмоция Финни
  // обновились сразу после очередного 5-минутного шага.
  render();
}

function updateTaskCountdown() {
  if (!engine?.state.profile) return;
  const refreshed = engine.refreshTasksIfDue();
  if (refreshed) {
    ui.testSession = null;
    ui.tasksNotice = { message: 'Начался новый цикл: за пройденные тесты снова можно получить награды.' };
    if (currentRoute === 'test') currentRoute = 'tasks';
    render();
    showToast('Награды за тесты обновились!');
    return;
  }

  const countdown = document.getElementById('task-reset-countdown');
  if (countdown) countdown.textContent = formatTaskTime(engine.getTaskResetRemaining());
}

function openModal({ title, body, actions = '' }) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="backdrop-close">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal__header">
          <h2 id="modal-title">${escapeHtml(title)}</h2>
          <button class="modal__close" type="button" data-action="close-modal" aria-label="Закрыть">×</button>
        </div>
        <div class="modal__body">${body}</div>
        ${actions ? `<div class="modal__actions">${actions}</div>` : ''}
      </section>
    </div>`;
  requestAnimationFrame(() => modalRoot.querySelector('button, input')?.focus());
}

function closeModal() {
  modalRoot.innerHTML = '';
}

function showPurchase(itemId) {
  const item = content.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const body = `
    <div class="purchase-summary">
      <span aria-hidden="true">${item.emoji}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <p>${escapeHtml(item.description)}</p>
      <div><span>Категория</span><strong>${escapeHtml(categoryLabel(item.category))}</strong></div>
      <div><span>Влияние</span><strong>${escapeHtml(item.impactText)}</strong></div>
      <div><span>Цена</span><strong>${item.price} 🎋</strong></div>
      <div><span>Баланс после покупки</span><strong>${engine.state.demoMode ? '∞ 🎋' : `${Math.max(0, engine.state.balance - item.price)} 🎋`}</strong></div>
    </div>`;
  const actions = `
    <button class="button button--secondary" type="button" data-action="close-modal">Отмена</button>
    <button class="button button--primary" type="button" data-action="confirm-purchase" data-item-id="${item.id}">Купить</button>`;
  openModal({ title: 'Проверка покупки', body, actions });
}

function showGoalClaim(goalId) {
  const goal = content.goals.find((entry) => entry.id === goalId);
  if (!goal) return;
  const savingsAfter = Math.max(0, engine.state.savings - goal.cost);
  const body = `
    <div class="purchase-summary">
      <span aria-hidden="true">${goal.emoji}</span>
      <strong>${escapeHtml(goal.title)}</strong>
      <p>${escapeHtml(goal.description)}</p>
      <div><span>Стоимость</span><strong>${goal.cost} 🎋 из копилки</strong></div>
      <div><span>Останется в копилке</span><strong>${savingsAfter} 🎋</strong></div>
      <div><span>Действие</span><strong>${escapeHtml(goal.actionLabel)}</strong></div>
      <div><span>Польза</span><strong>${escapeHtml(goal.effectDescription)}</strong></div>
    </div>
    <p style="margin-top:12px">После подтверждения цель перейдёт в коллекцию. Её можно использовать один раз в каждом игровом периоде.</p>`;
  const actions = `
    <button class="button button--secondary" type="button" data-action="close-modal">Отмена</button>
    <button class="button button--primary" type="button" data-action="confirm-goal-claim" data-goal-id="${goal.id}">Получить цель</button>`;
  openModal({ title: 'Потратить накопления?', body, actions });
}

function showFinishPeriodConfirmation() {
  const requirements = getPeriodRequirements(engine.state, content);
  const ready = engine.state.demoMode || (requirements.length > 0 && requirements.every((entry) => entry.done));
  const remaining = requirements.filter((entry) => !entry.done).length;
  const body = `
    <p>${engine.state.demoMode
      ? 'Тестовый режим: эксперт может перейти к следующему периоду без выполнения целей текущего периода.'
      : ready
        ? 'Все цели выполнены. Можно перейти к следующему уровню обучения.'
        : `Переход закрыт, пока не выполнены все требования. Осталось: ${remaining}.`}</p>
    <ul class="simple-list" style="margin-top:14px">
      ${requirements.map((entry) => `<li><span>${statusIcon(entry.done)}</span><p>${escapeHtml(entry.label)} <small>${entry.current}/${entry.target}</small></p></li>`).join('')}
    </ul>`;
  const actions = `
    <button class="button button--secondary" type="button" data-action="close-modal">Продолжить период</button>
    <button class="button button--primary" type="button" data-action="confirm-finish-period" ${ready ? '' : 'disabled'}>${ready ? 'Перейти дальше' : 'Сначала выполнить цели'}</button>`;
  openModal({ title: `Цели периода ${engine.state.period}`, body, actions });
}

function showPeriodSummary(result) {
  const summary = result.summary;
  if (!summary) return;
  const body = `
    <div class="purchase-summary">
      <span aria-hidden="true">${summary.score >= 80 ? '🏆' : summary.score >= 55 ? '🌱' : '💡'}</span>
      <strong>Результат: ${summary.score} из 100</strong>
      <p>${escapeHtml(summary.message)}</p>
      <div><span>Важное: план / факт</span><strong>${summary.plan.essential} / ${summary.actual.essential}</strong></div>
      <div><span>Желания: план / факт</span><strong>${summary.plan.optional} / ${summary.actual.optional}</strong></div>
      <div><span>Накопления: план / факт</span><strong>${summary.plan.savings} / ${summary.actual.savings}</strong></div>
      ${result.nextPeriod ? `<div><span>Новый уровень</span><strong>${escapeHtml(result.nextPeriod.stage)}</strong></div><p>${escapeHtml(result.nextPeriod.learningGoal)}</p>` : ''}
    </div>`;
  const actions = `<button class="button button--primary" style="grid-column:1/-1" type="button" data-action="close-modal">${result.complete ? 'Посмотреть прогресс' : 'Начать следующий период'}</button>`;
  openModal({ title: result.complete ? 'Все периоды пройдены' : `Период ${summary.period} завершён`, body, actions });
}

function confirmDemo() {
  openModal({
    title: engine.state.demoMode ? 'Сбросить тестовый режим к началу?' : 'Запустить тестовый режим для экспертов?',
    body: `<p>Обычный локальный прогресс будет сохранён и временно заменён тестовым профилем. В тестовом режиме доступны все тесты, безлимитная валюта и прохождение без ожидания времени.</p>${engine.state.demoMode ? '<p><strong>Тестовый режим уже активен.</strong> Сброс вернёт экспертный профиль к началу, а обычный прогресс останется сохранён.</p>' : ''}`,
    actions: `<button class="button button--secondary" type="button" data-action="close-modal">Отмена</button><button class="button button--primary" type="button" data-action="load-demo">${engine.state.demoMode ? 'Сбросить и начать заново' : 'Запустить'}</button>`
  });
}

function confirmExitDemo() {
  openModal({
    title: 'Выйти из тестового режима?',
    body: '<p>Тестовый профиль эксперта будет закрыт. Обычный игровой прогресс, сохранённый перед запуском режима, восстановится.</p>',
    actions: '<button class="button button--secondary" type="button" data-action="close-modal">Остаться</button><button class="button button--primary" type="button" data-action="exit-demo">Выйти</button>'
  });
}

function confirmReset() {
  openModal({
    title: 'Удалить локальный профиль?',
    body: '<p>Будут удалены бюджет, покупки, накопления, теория, тесты и история. Это действие нельзя отменить.</p>',
    actions: '<button class="button button--secondary" type="button" data-action="close-modal">Отмена</button><button class="button button--danger" type="button" data-action="reset-profile">Удалить</button>'
  });
}

function openWithdrawForm() {
  const body = `
    <p>Сначала укажи сумму. На следующем шаге игра покажет влияние на цель и попросит отдельное подтверждение.</p>
    <form id="withdraw-preview-form" class="stack" style="margin-top:14px">
      <label class="field"><span>Сумма из копилки (доступно ${engine.state.savings})</span><input type="number" name="amount" min="1" max="${engine.state.savings}" inputmode="numeric" required></label>
      <button class="button button--primary button--wide" type="submit">Показать последствия</button>
    </form>`;
  openModal({ title: 'Снять из копилки', body });
}

function previewWithdraw(amount) {
  const value = Math.round(Number(amount));
  if (!Number.isFinite(value) || value <= 0 || value > engine.state.savings) {
    showToast('Укажи сумму, которая есть в копилке.');
    return;
  }
  const savingsAfter = engine.state.savings - value;
  const allGoalsOwned = content.goals.every((entry) => engine.state.ownedGoalIds.includes(entry.id));
  if (allGoalsOwned) {
    const body = `
      <div class="purchase-summary">
        <span aria-hidden="true">🏦</span>
        <strong>Свободные накопления</strong>
        <div><span>Вернётся на баланс</span><strong>${value}</strong></div>
        <div><span>Останется в копилке</span><strong>${savingsAfter}</strong></div>
      </div>
      <p style="margin-top:12px">Все цели уже получены, поэтому эти бамбунчинки можно свободно вернуть на баланс.</p>`;
    const actions = `<button class="button button--secondary" type="button" data-action="close-modal">Отмена</button><button class="button button--primary" type="button" data-action="confirm-withdraw" data-amount="${value}">Подтвердить</button>`;
    openModal({ title: 'Вернуть накопления', body, actions });
    return;
  }
  const unlockedGoals = getUnlockedGoals(content, engine.state.period);
  const goal = unlockedGoals.find((entry) => entry.id === engine.state.selectedGoalId && !engine.state.ownedGoalIds.includes(entry.id))
    || unlockedGoals.find((entry) => !engine.state.ownedGoalIds.includes(entry.id));
  if (!goal) {
    const nextGoal = content.goals.find((entry) => entry.unlockPeriod > engine.state.period && !engine.state.ownedGoalIds.includes(entry.id));
    const body = `
      <div class="purchase-summary">
        <span aria-hidden="true">🏦</span>
        <strong>Накопления на будущую цель</strong>
        <div><span>Вернётся на баланс</span><strong>${value}</strong></div>
        <div><span>Останется в копилке</span><strong>${savingsAfter}</strong></div>
        <div><span>Следующая цель</span><strong>${escapeHtml(nextGoal?.title || 'Коллекция собрана')}</strong></div>
      </div>
      <p style="margin-top:12px">Снять деньги можно, но на новую цель останется меньше накоплений.</p>`;
    const actions = `<button class="button button--secondary" type="button" data-action="close-modal">Отмена</button><button class="button button--primary" type="button" data-action="confirm-withdraw" data-amount="${value}">Подтвердить</button>`;
    openModal({ title: 'Влияние на будущую цель', body, actions });
    return;
  }
  const remaining = Math.max(0, goal.cost - savingsAfter);
  const regular = Math.max(1, engine.state.plan.savings || 10);
  const estimate = Math.ceil(remaining / regular);
  const body = `
    <div class="purchase-summary">
      <span aria-hidden="true">🎯</span>
      <strong>${escapeHtml(goal.title)}</strong>
      <div><span>Будет в копилке</span><strong>${savingsAfter}</strong></div>
      <div><span>Останется до цели</span><strong>${remaining}</strong></div>
      <div><span>Новый примерный срок</span><strong>${estimate} периодов</strong></div>
    </div>
    <p style="margin-top:12px">Снять деньги можно, но цель станет дальше. Подтвердить?</p>`;
  const actions = `<button class="button button--secondary" type="button" data-action="close-modal">Отмена</button><button class="button button--primary" type="button" data-action="confirm-withdraw" data-amount="${value}">Подтвердить</button>`;
  openModal({ title: 'Влияние на цель', body, actions });
}

document.addEventListener('click', (event) => {
  const routeButton = event.target.closest('[data-route]');
  if (routeButton) {
    event.preventDefault();
    go(routeButton.dataset.route);
    return;
  }

  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;

  const adultActions = ['confirm-demo', 'load-demo', 'confirm-exit-demo', 'exit-demo', 'confirm-reset', 'reset-profile'];
  if (adultActions.includes(action) && (currentRoute !== 'adult' || !ui.adultUnlocked)) return;
  if (action === 'lock-adult') {
    closeModal();
    go('more');
    return;
  }

  if (action === 'backdrop-close' && event.target === button) closeModal();
  if (action === 'close-modal') closeModal();
  if (action === 'back') back();

  if (action === 'next-onboarding') {
    if (ui.onboardingPage < 2) {
      ui.onboardingPage += 1;
      render();
    } else {
      engine.completeOnboarding();
      go('profile', { replace: true });
    }
  }
  if (action === 'previous-onboarding') {
    ui.onboardingPage = Math.max(0, ui.onboardingPage - 1);
    render();
  }
  if (action === 'feed') {
    const result = engine.feedPet();
    render();
    showToast(result.message);
  }
  if (action === 'open-theory') {
    ui.selectedBlockId = button.dataset.blockId;
    ui.tasksNotice = null;
    go('theory');
  }
  if (action === 'complete-theory') {
    const result = engine.completeTheory(button.dataset.blockId);
    if (result.ok) {
      ui.tasksNotice = { message: result.message };
      if (ui.history.at(-1) === 'tasks') ui.history.pop();
      currentRoute = 'tasks';
      ui.testSession = null;
      render();
    }
    showToast(result.message);
  }
  if (action === 'open-test') startTest(button.dataset.testId);
  if (action === 'answer-test-choice') {
    handleTestAnswer(button.dataset.testId, button.dataset.questionId, button.dataset.optionId);
  }
  if (action === 'next-test-question') nextTestQuestion();
  if (action === 'retry-test') startTest(button.dataset.testId);
  if (action === 'open-purchase') showPurchase(button.dataset.itemId);
  if (action === 'confirm-purchase') {
    const result = engine.purchase(button.dataset.itemId);
    closeModal();
    render();
    showToast(result.message);
  }
  if (action === 'open-goal-claim') showGoalClaim(button.dataset.goalId);
  if (action === 'confirm-goal-claim') {
    const result = engine.claimGoal(button.dataset.goalId);
    closeModal();
    render();
    showToast(result.message);
  }
  if (action === 'use-goal') {
    const result = engine.useGoal(button.dataset.goalId);
    render();
    showToast(result.message);
  }
  if (action === 'select-goal') {
    const result = engine.selectGoal(button.dataset.goalId);
    render();
    showToast(result.message);
  }
  if (action === 'open-withdraw') openWithdrawForm();
  if (action === 'confirm-withdraw') {
    const result = engine.withdraw(button.dataset.amount);
    closeModal();
    render();
    showToast(result.message);
  }
  if (action === 'finish-period') showFinishPeriodConfirmation();
  if (action === 'confirm-finish-period') {
    const result = engine.finishPeriod();
    closeModal();
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    currentRoute = 'home';
    render();
    showPeriodSummary(result);
  }
  if (action === 'confirm-demo') confirmDemo();
  if (action === 'load-demo') {
    const result = engine.loadDemoProfile();
    closeModal();
    ui.adultUnlocked = false;
    ui.history = [];
    currentRoute = 'home';
    render();
    showToast(result.message);
  }
  if (action === 'confirm-exit-demo') confirmExitDemo();
  if (action === 'exit-demo') {
    const result = engine.exitDemoProfile();
    closeModal();
    ui.adultUnlocked = false;
    ui.history = [];
    currentRoute = engine.state.profile ? 'home' : initialRoute();
    render();
    showToast(result.message);
  }
  if (action === 'confirm-reset') confirmReset();
  if (action === 'reset-profile') {
    const result = engine.resetProfile();
    closeModal();
    ui.onboardingPage = 0;
    ui.adultUnlocked = false;
    ui.history = [];
    currentRoute = 'onboarding';
    render();
    showToast(result.message);
  }
});

document.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);

  if (form.id === 'profile-form') {
    const result = engine.createProfile({
      nickname: data.get('nickname'),
      petName: 'Финни',
      fur: 'sunset',
      accessory: data.get('accessory'),
      accessoryColor: data.get('accessoryColor')
    });
    if (result.ok) {
      ui.history = [];
      currentRoute = 'home';
      render();
    }
    showToast(result.message);
  }

  if (form.id === 'budget-form') {
    const result = engine.confirmBudget({
      essential: data.get('essential'),
      optional: data.get('optional'),
      savings: data.get('savings')
    });
    render();
    showToast(result.message);
  }

  if (form.id === 'test-amount-form') {
    handleTestAnswer(data.get('testId'), data.get('questionId'), data.get('amount'));
  }

  if (form.id === 'deposit-form') {
    const result = engine.deposit(data.get('amount'));
    render();
    showToast(result.message);
  }

  if (form.id === 'adult-gate-form') {
    if (currentRoute !== 'adult') return;
    if (Math.round(Number(data.get('answer'))) === ui.challenge.answer) {
      ui.adultUnlocked = true;
      render();
    } else {
      ui.challenge = createChallenge();
      render();
      showToast('Ответ не совпал. Попробуйте новый пример.');
    }
  }

  if (form.id === 'withdraw-preview-form') previewWithdraw(data.get('amount'));
});

document.addEventListener('input', (event) => {
  if (event.target.closest('#profile-form') && ['accessory', 'accessoryColor'].includes(event.target.name)) {
    updateProfilePreview();
  }

  const budgetForm = event.target.closest('#budget-form');
  if (budgetForm) {
    const data = new FormData(budgetForm);
    const total = ['essential', 'optional', 'savings'].reduce((sum, key) => sum + (Number(data.get(key)) || 0), 0);
    const totalElement = document.getElementById('budget-total');
    const remainderElement = document.getElementById('budget-remainder');
    if (totalElement) totalElement.textContent = String(total);
    if (remainderElement) {
      const remainder = engine.state.balance - total;
      remainderElement.textContent = String(remainder);
      remainderElement.style.color = remainder < 0 ? 'var(--danger)' : '';
    }
  }
});

document.addEventListener('change', (event) => {
  const setting = event.target.dataset?.setting;
  if (!setting) return;
  if (currentRoute !== 'adult' || !ui.adultUnlocked) return;
  engine.updateSettings({ [setting]: event.target.checked });
  render();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modalRoot.firstChild) closeModal();
});

async function boot() {
  try {
    content = await loadContent();
    engine = new GameEngine(content, new GameStorage());
    currentRoute = initialRoute();
    render();
    if (!countdownTimer) countdownTimer = setInterval(updateTaskCountdown, 1000);
    if (!petNeedsTimer) petNeedsTimer = setInterval(updatePetNeeds, 30000);
  } catch (error) {
    console.error(error);
    destroyPetScene();
    appRoot.innerHTML = errorTemplate(error.message);
  }
}

boot();
