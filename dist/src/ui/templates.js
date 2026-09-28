import {
  getLevel,
  getLevelProgress,
  getPeriodActuals,
  getPeriodRequirements,
  getPetExplanation,
  getPetStage,
  getTestAvailability,
  getTestsForBlock,
  getTasksForPeriod,
  getUnlockedGoals
} from '../core/engine.js';
import { categoryLabel, escapeHtml, percent, statusIcon, themeLabel } from './helpers.js';
import { petImageUrl, testPetEmotion } from './pet-assets.js';

const navItems = [
  { route: 'home', icon: 'home', label: 'Домой' },
  { route: 'budget', icon: 'budget', label: 'Бюджет' },
  { route: 'tasks', icon: 'tasks', label: 'Обучение' },
  { route: 'savings', icon: 'goal', label: 'Цель' },
  { route: 'more', icon: 'more', label: 'Ещё' }
];


function appIcon(name, className = '', variant = 'default') {
  const suffix = variant === 'white' ? '-white' : '';
  return `<img class="app-icon ${className}" src="./assets/icons/ui/${name}${suffix}.png" alt="" aria-hidden="true">`;
}

const difficultyMap = {
  easy: { label: 'Легко', icon: 'growth' },
  medium: { label: 'Средне', icon: 'confidence' },
  hard: { label: 'Сложно', icon: 'trophy' },
  expert: { label: 'Эксперт', icon: 'brain' },
  master: { label: 'Итог', icon: 'medal' }
};

function difficultyBadge(difficulty) {
  const info = difficultyMap[difficulty] || difficultyMap.easy;
  return `<span class="difficulty-badge difficulty-badge--${difficulty || 'easy'}">${appIcon(info.icon, 'difficulty-badge__icon')} ${info.label}</span>`;
}

export function formatTaskTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function progressBar(value, label, tone = 'green') {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  return `
    <div class="meter" aria-label="${escapeHtml(label)}: ${safe}%">
      <div class="meter__head"><span>${escapeHtml(label)}</span><strong>${safe}%</strong></div>
      <div class="meter__track"><span class="meter__fill meter__fill--${tone}" style="width:${safe}%"></span></div>
    </div>`;
}

function topBar(title, state, { back = false } = {}) {
  const level = getLevel(state.xp);
  return `
    <header class="topbar">
      <div class="topbar__title-wrap">
        ${back ? '<button class="icon-button" type="button" data-action="back" aria-label="Назад">‹</button>' : ''}
        <div>
          <p class="eyebrow">Период ${state.period} из 5</p>
          <h1>${escapeHtml(title)}</h1>
        </div>
      </div>
      <div class="topbar__chips" aria-label="Уровень и запас еды">
        <span class="mini-chip">${appIcon('level', 'mini-chip__icon')} Ур. ${level}</span>
        <span class="mini-chip mini-chip--food">${appIcon('feed', 'mini-chip__icon')} ${state.food}</span>
      </div>
    </header>`;
}

function bottomNav(active) {
  return `
    <nav class="bottom-nav" aria-label="Основная навигация">
      ${navItems.map((item) => `
        <button type="button" class="bottom-nav__item ${active === item.route ? 'is-active' : ''}" data-route="${item.route}" ${active === item.route ? 'aria-current="page"' : ''}>
          <span class="bottom-nav__icon-wrap" aria-hidden="true">${appIcon(item.icon, 'bottom-nav__icon')}</span>
          <small>${item.label}</small>
        </button>`).join('')}
    </nav>`;
}

function shell(title, state, body, { active = '', back = false, nav = true } = {}) {
  return `
    <div class="app-shell ${state.settings.largeText ? 'is-large-text' : ''} ${state.settings.highContrast ? 'is-high-contrast' : ''}">
      <div class="phone-frame">
        ${topBar(title, state, { back })}
        <main class="screen" id="main-content">${body}</main>
        ${nav ? bottomNav(active) : ''}
      </div>
    </div>`;
}

export function onboardingTemplate(page) {
  const slides = [
    {
      icon: 'guide',
      title: 'Помоги Финни вырасти',
      text: 'Ты будешь принимать финансовые решения и сразу видеть их результат.'
    },
    {
      icon: 'plan',
      title: 'Три важных решения',
      text: 'Сначала важное, затем желания и регулярный шаг к своей цели.'
    },
    {
      icon: 'safe',
      title: 'Без настоящих денег',
      text: 'Игра работает локально. Настоящие имя, телефон, e-mail и банковские данные не нужны.'
    }
  ];
  const slide = slides[page] || slides[0];
  return `
    <div class="welcome-screen">
      <div class="welcome-card">
        <div class="brand-mark" aria-hidden="true">${appIcon(slide.icon, 'brand-mark__icon')}</div>
        <p class="eyebrow">Финансовая игра 7–11 лет</p>
        <h1>${slide.title}</h1>
        <p class="welcome-card__text">${slide.text}</p>
        <div class="dots" aria-label="Шаг ${page + 1} из 3">
          ${slides.map((_, index) => `<span class="dot ${index === page ? 'is-active' : ''}"></span>`).join('')}
        </div>
        <button class="button button--primary button--wide" type="button" data-action="next-onboarding">
          ${page === slides.length - 1 ? 'Создать питомца' : 'Дальше'}
        </button>
        ${page > 0 ? '<button class="text-button" type="button" data-action="previous-onboarding">Назад</button>' : ''}
      </div>
    </div>`;
}

export function profileTemplate(state) {
  return shell('Создание питомца', state, `
    <section class="intro-card">
      <span class="intro-card__icon" aria-hidden="true">🦊</span>
      <div><strong>Только игровой профиль</strong><p>Не вводи настоящее имя, телефон или e-mail.</p></div>
    </section>

    <div id="pet-preview" class="pet-preview" role="img" aria-label="Предпросмотр питомца"></div>

    <form id="profile-form" class="stack" autocomplete="off">
      <label class="field">
        <span>Твой игровой ник</span>
        <input name="nickname" maxlength="16" minlength="2" placeholder="Например, Следопыт" required>
      </label>
      <fieldset class="choice-fieldset">
        <legend>Аксессуар</legend>
        <div class="appearance-grid">
          <label class="appearance-option"><input type="radio" name="accessory" value="leaf" checked><span class="accessory-icon">🌿</span><small>Листик</small></label>
          <label class="appearance-option"><input type="radio" name="accessory" value="bow"><span class="accessory-icon">🎀</span><small>Бантик</small></label>
          <label class="appearance-option"><input type="radio" name="accessory" value="star"><span class="accessory-icon">⭐</span><small>Звезда</small></label>
        </div>
      </fieldset>

      <fieldset class="choice-fieldset">
        <legend>Цвет аксессуара</legend>
        <div class="appearance-grid">
          <label class="appearance-option"><input type="radio" name="accessoryColor" value="green" checked><span class="accessory-icon">🟢</span><small>Зелёный</small></label>
          <label class="appearance-option"><input type="radio" name="accessoryColor" value="pink"><span class="accessory-icon">🩷</span><small>Розовый</small></label>
          <label class="appearance-option"><input type="radio" name="accessoryColor" value="blue"><span class="accessory-icon">🔵</span><small>Голубой</small></label>
        </div>
      </fieldset>

      <p class="hint">Выбери аксессуар и его цвет — доступно 9 визуальных комбинаций.</p>
      <button class="button button--primary button--wide" type="submit">Начать игру</button>
    </form>`, { nav: false, back: false });
}

export function homeTemplate(state, content) {
  const petName = escapeHtml(state.profile?.petName || 'Финни');
  const nickname = state.profile?.nickname || 'Игрок';
  const stage = getPetStage(state);
  const period = content.periods.find((entry) => entry.id === state.period) || content.periods[state.period - 1];
  const periodRequirements = getPeriodRequirements(state, content);
  const completedRequirements = periodRequirements.filter((entry) => entry.done).length;
  const remainingRequirements = periodRequirements.length - completedRequirements;
  const currentTasks = getTasksForPeriod(content, state.period);
  const ownedGoalIds = new Set(state.ownedGoalIds || []);
  const selectedGoal = content.goals.find((entry) => entry.id === state.selectedGoalId) || content.goals[0];
  const unlockedGoals = getUnlockedGoals(content, state.period);
  const availableGoal = unlockedGoals.find((entry) => entry.id === selectedGoal.id && !ownedGoalIds.has(entry.id))
    || unlockedGoals.find((entry) => !ownedGoalIds.has(entry.id));
  const nextFutureGoal = content.goals.find((entry) => entry.unlockPeriod > state.period && !ownedGoalIds.has(entry.id));
  const allGoalsOwned = content.goals.every((entry) => ownedGoalIds.has(entry.id));
  const goal = availableGoal || selectedGoal;
  const allUnlockedGoalsOwned = !availableGoal;
  const goalProgress = allUnlockedGoalsOwned ? 100 : percent(state.savings, goal.cost);
  const activeTask = currentTasks.find((test) => !state.completedTestIds.includes(test.id));
  const xp = getLevelProgress(state.xp);
  const planText = state.plan.confirmed
    ? `${state.plan.essential} важное · ${state.plan.optional} желания · ${state.plan.savings} цель`
    : 'План ещё не составлен';

  return shell(`Привет, ${nickname}!`, state, `
    ${state.demoMode ? `<section class="lesson-banner" aria-label="Демонстрационный режим"><span>${appIcon('demo', 'card-icon')}</span><p><strong>Тестовый режим для экспертов.</strong> Все тесты открыты, бамбунчинки безлимитные, ожидание календарных сроков отключено. Сброс выполняется в разделе «Для взрослого».</p></section>` : ''}
    <section class="summary-grid" aria-label="Финансовое состояние">
      <article class="summary-card summary-card--balance"><span>${appIcon('budget', 'summary-card__icon')} Доступно</span><strong>🎋 ${state.demoMode ? '∞' : state.balance}</strong></article>
      <article class="summary-card summary-card--savings"><span>${appIcon('goal', 'summary-card__icon')} Накоплено</span><strong>🎯 ${state.savings}</strong></article>
    </section>

    <section class="pet-card">
      <div class="speech-bubble"><strong>${petName}</strong><span>${escapeHtml(getPetExplanation(state))}</span></div>
      <div id="pet-stage" class="pet-stage" role="img" aria-label="${petName}, ${stage.title}"></div>
      <p class="stage-label">Стадия ${stage.id}: ${stage.title}</p>
      <div class="status-grid">
        ${progressBar(state.satiety, '🍎 Сытость', 'orange')}
        ${progressBar(state.mood, '💚 Настроение', 'green')}
        ${progressBar(state.confidence, '🧭 Уверенность', 'blue')}
      </div>
      <div class="level-progress">
        <div><strong>Уровень ${getLevel(state.xp)}</strong><span>${xp.current}/${xp.target} XP</span></div>
        <div class="meter__track"><span class="meter__fill meter__fill--violet" style="width:${percent(xp.current, xp.target)}%"></span></div>
      </div>
    </section>

    <section class="quick-actions" aria-label="Быстрые действия">
      <button type="button" class="quick-action quick-action--blue" data-route="tasks"><span class="quick-action__visual" aria-hidden="true">${appIcon('tasks', 'quick-action__icon', 'white')}</span><strong>Учиться</strong></button>
      <button type="button" class="quick-action quick-action--orange" data-route="shop"><span class="quick-action__visual" aria-hidden="true">${appIcon('shop', 'quick-action__icon', 'white')}</span><strong>Магазин</strong></button>
      <button type="button" class="quick-action quick-action--green" data-action="feed"><span class="quick-action__visual" aria-hidden="true">${appIcon('feed', 'quick-action__icon', 'white')}</span><strong>Покормить</strong></button>
    </section>

    <section class="card goal-card">
      ${allUnlockedGoalsOwned
        ? `<div class="section-heading"><div><p class="eyebrow">${allGoalsOwned ? 'Коллекция целей' : `Цели периода ${state.period}`}</p><h2>${appIcon('trophy', 'heading-icon')} ${allGoalsOwned ? 'Все цели получены' : 'Открытые цели получены'}</h2></div><strong>${ownedGoalIds.size}/${content.goals.length}</strong></div>
          <div class="meter__track"><span class="meter__fill meter__fill--green" style="width:100%"></span></div>
          <p>${allGoalsOwned ? 'Полученные цели можно использовать для заботы о питомце.' : `Следующая цель откроется в периоде ${nextFutureGoal?.unlockPeriod || state.period + 1}. Пока можно копить заранее.`}</p>`
        : `<div class="section-heading"><div><p class="eyebrow">Текущая цель</p><h2>${goal.emoji} ${escapeHtml(goal.title)}</h2></div><strong>${state.savings}/${goal.cost}</strong></div>
          <div class="meter__track"><span class="meter__fill meter__fill--green" style="width:${goalProgress}%"></span></div>
          <p>${escapeHtml(goal.description)}</p>`}
      <button class="link-button" type="button" data-route="savings">${allUnlockedGoalsOwned ? 'Открыть коллекцию и копилку' : 'Открыть накопления'} →</button>
    </section>

    <section class="card compact-card">
      <div class="section-heading"><div><p class="eyebrow">Бюджет периода</p><h2>${state.plan.confirmed ? 'План подтверждён' : 'Нужно составить план'}</h2></div><span>${appIcon(state.plan.confirmed ? 'check' : 'plan', 'section-heading__icon')}</span></div>
      <p>${planText}</p>
      <button class="link-button" type="button" data-route="budget">${state.plan.confirmed ? 'Сравнить план и факт' : 'Распределить деньги'} →</button>
    </section>

    <section class="card compact-card">
      <div class="section-heading"><div><p class="eyebrow">Активное обучение</p><h2>${activeTask ? escapeHtml(activeTask.title) : 'План обучения выполнен'}</h2></div><span>${appIcon(activeTask ? 'tasks' : 'trophy', 'section-heading__icon')}</span></div>
      <p>${activeTask
        ? `${escapeHtml(themeLabel(activeTask.theme))} · 5 вопросов · ${difficultyMap[activeTask.difficulty]?.label || 'Легко'} · 🎋 +${activeTask.reward} · ⭐ +${activeTask.xp} XP`
        : 'Все обязательные тесты текущего периода сданы. Их можно повторять после обновления наград.'}</p>
      <button class="link-button" type="button" data-route="tasks">Открыть обучение →</button>
    </section>

    <section class="card period-mission-card">
      <div class="section-heading"><div><p class="eyebrow">${escapeHtml(period.stage)}</p><h2>Цели периода ${state.period}: ${escapeHtml(period.title)}</h2></div><strong>${completedRequirements}/${periodRequirements.length}</strong></div>
      <p>${escapeHtml(period.learningGoal)}</p>
      <div class="meter__track"><span class="meter__fill meter__fill--blue" style="width:${percent(completedRequirements, periodRequirements.length)}%"></span></div>
      <ul class="period-requirements">
        ${periodRequirements.map((entry) => `<li class="${entry.done ? 'is-done' : ''}"><span>${entry.done ? '✅' : '○'}</span><p>${escapeHtml(entry.label)}<small>${entry.current}/${entry.target}</small></p></li>`).join('')}
      </ul>
    </section>

    <section class="feedback-card" aria-label="Последнее объяснение">
      <span aria-hidden="true">${appIcon('idea', 'card-icon')}</span><p>${escapeHtml(state.feedback)}</p>
    </section>

    ${state.courseComplete
      ? '<button class="button button--secondary button--wide" type="button" data-route="progress">🏆 Посмотреть итог игры</button>'
      : state.demoMode
        ? `<button class="button button--primary button--wide" type="button" data-action="finish-period">Перейти к следующему периоду</button>`
        : `<button class="button ${remainingRequirements === 0 ? 'button--primary' : 'button--secondary'} button--wide" type="button" data-action="finish-period">${remainingRequirements === 0 ? `Завершить период ${state.period}` : `Проверить цели периода · осталось ${remainingRequirements}`}</button>`}
    `, { active: 'home' });
}

export function budgetTemplate(state) {
  const actual = getPeriodActuals(state);
  const recommended = {
    essential: Math.max(1, Math.floor(state.balance * 0.45)),
    optional: Math.max(1, Math.floor(state.balance * 0.25)),
    savings: Math.max(1, Math.floor(state.balance * 0.2))
  };

  const planner = state.plan.confirmed ? `
    <section class="card">
      <div class="success-heading"><span>${appIcon('check', 'card-icon')}</span><div><h2>План подтверждён</h2><p>Изменить его можно в следующем периоде.</p></div></div>
      ${planFactRow('Обязательные расходы', state.plan.essential, actual.essential, 'orange')}
      ${planFactRow('Желаемые покупки', state.plan.optional, actual.optional, 'blue')}
      ${planFactRow('Накопления', state.plan.savings, actual.savings, 'green')}
    </section>` : `
    <form id="budget-form" class="stack">
      <section class="card budget-inputs">
        <p class="card-note">Доступно для распределения: <strong>${state.demoMode ? '∞ бамбунчинок' : `${state.balance} бамбунчинок`}</strong></p>
        ${budgetInput('essential', '🧺 Обязательные расходы', recommended.essential, 'Еда и забота о питомце')}
        ${budgetInput('optional', `${appIcon('gift', 'list-icon')} Желаемые покупки`, recommended.optional, 'Игрушки и украшения')}
        ${budgetInput('savings', `${appIcon('goal', 'list-icon')} Накопления`, recommended.savings, 'Регулярный шаг к цели')}
        <div class="budget-total" aria-live="polite">
          <span>Всего запланировано</span><strong id="budget-total">${recommended.essential + recommended.optional + recommended.savings}</strong>
          <span>Свободный остаток</span><strong id="budget-remainder">${state.demoMode ? '∞' : state.balance - recommended.essential - recommended.optional - recommended.savings}</strong>
        </div>
      </section>
      <button class="button button--primary button--wide" type="submit">Подтвердить план</button>
      <p class="hint">После подтверждения план нельзя изменить до следующего периода.</p>
    </form>`;

  return shell('Мой бюджет', state, `
    <section class="lesson-banner"><span>📊</span><p><strong>Бюджет</strong> — это план: сколько денег есть и на что их направить.</p></section>
    ${planner}
    <section class="card compact-card">
      <h2>Почему три части?</h2>
      <ul class="simple-list">
        <li><span>${appIcon('feed', 'list-icon')}</span><p><strong>Важное</strong> — то, без чего трудно обойтись.</p></li>
        <li><span>${appIcon('gift', 'list-icon')}</span><p><strong>Желания</strong> — приятные покупки, которые можно отложить.</p></li>
        <li><span>${appIcon('goal', 'list-icon')}</span><p><strong>Накопления</strong> — часть денег для будущей цели.</p></li>
      </ul>
    </section>`, { active: 'budget' });
}

function budgetInput(name, label, value, hint) {
  return `<label class="budget-field"><span><strong>${label}</strong><small>${hint}</small></span><input type="number" inputmode="numeric" min="1" max="999" name="${name}" value="${value}" required></label>`;
}

function planFactRow(label, plan, actual, tone) {
  const max = Math.max(plan, actual, 1);
  return `
    <div class="plan-fact">
      <div><strong>${label}</strong><span>План ${plan} · факт ${actual}</span></div>
      <div class="meter__track"><span class="meter__fill meter__fill--${tone}" style="width:${percent(actual, max)}%"></span></div>
    </div>`;
}

export function tasksTemplate(state, content, notice) {
  const period = content.periods.find((entry) => entry.id === state.period) || content.periods[state.period - 1];
  const remaining = Math.max(0, state.taskResetAt - Date.now());
  const completedTests = state.completedTestIds.length;
  return shell('Учебные блоки', state, `
    <section class="lesson-banner"><span>${appIcon('tasks', 'card-icon')}</span><p><strong>Период ${state.period}: ${escapeHtml(period.stage)}.</strong> Сначала изучи теорию, затем пройди тест из 5 вопросов.</p></section>
    <section class="task-stage-progress">
      <div><span>Пройдено тестов</span><strong>${completedTests}/${content.tasks.length}</strong></div>
      <p>Для зачёта нужно 4 правильных ответа из 5. После каждого ответа появится подробное объяснение.</p>
    </section>
    ${state.demoMode ? `<section class="task-reset-banner"><span aria-hidden="true">🧪</span><div><strong>Тестовый режим</strong><span>Все тесты открыты сразу · награды без ожидания времени</span></div></section>` : `<section class="task-reset-banner">
      <span aria-hidden="true">${appIcon('refresh', 'card-icon')}</span>
      <div><strong>Награды каждые 12 часов — осталось</strong><span id="task-reset-countdown" data-reset-at="${state.taskResetAt}">${formatTaskTime(remaining)}</span></div>
    </section>`}
    ${notice ? `<section class="result-box result-box--success task-result-notice"><strong>Готово!</strong><p>${escapeHtml(notice.message)}</p></section>` : ''}
    <div class="learning-blocks">
      ${[...content.lessons].sort((a, b) => (a.unlockPeriod === state.period ? -1 : b.unlockPeriod === state.period ? 1 : a.unlockPeriod - b.unlockPeriod)).map((lesson) => {
        const tests = getTestsForBlock(content, lesson.id);
        const blockLocked = !state.demoMode && lesson.unlockPeriod > state.period;
        const theoryRead = state.readTheoryBlockIds.includes(lesson.id);
        const passedCount = tests.filter((test) => state.completedTestIds.includes(test.id)).length;
        return `<section class="learning-block ${blockLocked ? 'is-locked' : ''}">
          <div class="learning-block__head">
            <span class="learning-block__number">${appIcon(blockLocked ? 'lock' : 'book', 'learning-block__icon')}</span>
            <div><p class="eyebrow">Период ${lesson.unlockPeriod} из ${content.periods.length} · ${state.demoMode && lesson.unlockPeriod > state.period ? 'Демо-доступ' : lesson.unlockPeriod === state.period ? 'Сейчас' : lesson.unlockPeriod < state.period ? 'Повторение' : 'Впереди'}</p><h2>${escapeHtml(lesson.title)}</h2><p>${escapeHtml(lesson.intro)}</p></div>
            <strong>${passedCount}/${tests.length}</strong>
          </div>
          ${blockLocked
            ? `<div class="block-lock-note">Откроется в периоде ${lesson.unlockPeriod}</div>`
            : `<button class="theory-row ${theoryRead ? 'is-complete' : ''}" type="button" data-action="open-theory" data-block-id="${lesson.id}">
                <span>${appIcon(theoryRead ? 'check' : 'book', 'row-icon')}</span>
                <span><strong>${theoryRead ? 'Теория изучена' : 'Сначала изучить теорию'}</strong><small>Правила, формула, пример и памятка</small></span>
                <b>›</b>
              </button>`}
          <div class="stack stack--small">
            ${tests.map((test) => {
              const availability = getTestAvailability(state, content, test);
              const passed = state.completedTestIds.includes(test.id);
              const rewarded = state.completedTaskIds.includes(test.id);
              return `<button class="task-row ${passed ? 'is-complete' : ''} ${availability.unlocked ? '' : 'is-locked'}" type="button" data-action="open-test" data-test-id="${test.id}" ${availability.unlocked ? '' : 'disabled'}>
                <span class="task-row__icon">${appIcon(passed ? 'check' : availability.unlocked ? (test.testType === 'theory' ? 'brain' : 'beaker') : 'lock', 'task-row__icon-img')}</span>
                <span>
                  <strong>${escapeHtml(test.title)}</strong>
                  <small class="test-kind">${test.testType === 'theory' ? 'Теория' : 'Практика'} · 5 вопросов · зачёт 4/5</small>
                  <span class="task-row__details">${difficultyBadge(test.difficulty)}<small>🎋 ${rewarded ? 'получено' : `+${test.reward}`}</small><small>⭐ ${rewarded ? 'получено' : `+${test.xp} XP`}</small></span>
                  ${availability.unlocked ? '' : `<small class="lock-reason">${escapeHtml(availability.reason)}</small>`}
                </span>
                <span aria-hidden="true">${availability.unlocked ? '›' : ''}</span>
              </button>`;
            }).join('')}
          </div>
        </section>`;
      }).join('')}
    </div>
    ${state.period < content.periods.length ? `<section class="locked-preview"><span>${appIcon('lock', 'card-icon')}</span><p><strong>Следующий период</strong><small>Откроется после выполнения всех целей периода ${state.period}.</small></p></section>` : ''}`, { active: 'tasks' });
}

export function theoryTemplate(state, lesson) {
  const alreadyRead = state.readTheoryBlockIds.includes(lesson.id);
  return shell(lesson.title, state, `
    <section class="theory-hero">
      <span aria-hidden="true">${lesson.icon}</span>
      <p class="eyebrow">Теория перед тестом</p>
      <h2>${escapeHtml(lesson.title)}</h2>
      <p>${escapeHtml(lesson.intro)}</p>
    </section>
    <div class="theory-sections">
      ${lesson.sections.map((section) => `<article class="theory-card"><span>${section.icon}</span><div><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.text)}</p></div></article>`).join('')}
    </div>
    <section class="formula-card"><p class="eyebrow">Формула</p><strong>${escapeHtml(lesson.formula)}</strong></section>
    <section class="example-card"><span>${appIcon('idea', 'card-icon')}</span><div><h3>Разберём пример</h3><p>${escapeHtml(lesson.example)}</p></div></section>
    <section class="card">
      <h2>Запомни главное</h2>
      <ul class="theory-checklist">${lesson.keyPoints.map((point) => `<li><span>✓</span><p>${escapeHtml(point)}</p></li>`).join('')}</ul>
    </section>
    <button class="button button--primary button--wide" type="button" data-action="complete-theory" data-block-id="${lesson.id}">${alreadyRead ? 'Повторено — вернуться к тестам' : 'Теорию прочитал — открыть тесты'}</button>
    <button class="text-button" type="button" data-route="tasks">Вернуться к блокам</button>`, { back: true, nav: false });
}

export function testTemplate(state, test, session) {
  const safeSession = session || { questionIndex: 0, answers: [], feedback: null, summary: null };
  const questionIndex = Math.min(test.questions.length - 1, Math.max(0, safeSession.questionIndex || 0));
  const question = test.questions[questionIndex];
  const feedback = safeSession.feedback;
  const answered = Boolean(feedback);
  const rewardReceived = state.completedTaskIds.includes(test.id);

  if (safeSession.summary) {
    const summary = safeSession.summary;
    return shell(test.title, state, `
      <section class="test-summary-card">
        <span class="test-summary-card__icon">${appIcon(summary.passed ? 'trophy' : 'growth', 'test-summary-card__icon-img')}</span>
        <p class="eyebrow">Результат теста</p>
        <h2>${summary.score} из ${summary.total}</h2>
        <p>${escapeHtml(summary.message)}</p>
        <div class="test-score-dots">${test.questions.map((entry) => {
          const result = summary.details.find((detail) => detail.questionId === entry.id);
          return `<span class="${result?.correct ? 'is-correct' : 'is-wrong'}">${result?.correct ? '✓' : '×'}</span>`;
        }).join('')}</div>
        <button class="button button--primary button--wide" type="button" data-action="retry-test" data-test-id="${test.id}">Повторить тест</button>
        <button class="text-button" type="button" data-route="tasks">Вернуться к блокам</button>
      </section>`, { back: true, nav: false });
  }

  const answerArea = question.type === 'amount' ? `
    <form id="test-amount-form" class="stack">
      <input type="hidden" name="testId" value="${test.id}">
      <input type="hidden" name="questionId" value="${question.id}">
      <label class="field"><span>Твой ответ</span><input type="number" name="amount" min="0" max="999" inputmode="numeric" required ${answered ? 'disabled' : 'autofocus'}></label>
      <button class="button button--primary button--wide" type="submit" ${answered ? 'disabled' : ''}>Проверить ответ</button>
    </form>` : `
    <div class="answer-list">
      ${question.options.map((option) => `<button class="answer-button" type="button" data-action="answer-test-choice" data-test-id="${test.id}" data-question-id="${question.id}" data-option-id="${option.id}" ${answered ? 'disabled' : ''}>${escapeHtml(option.text)}</button>`).join('')}
    </div>`;

  return shell(test.title, state, `
    <section class="test-progress-card">
      <div><span>Вопрос ${questionIndex + 1} из ${test.questions.length}</span><strong>${Math.round(((questionIndex + 1) / test.questions.length) * 100)}%</strong></div>
      <div class="meter__track"><span class="meter__fill meter__fill--blue" style="width:${((questionIndex + 1) / test.questions.length) * 100}%"></span></div>
    </section>
    <section class="task-card">
      <div class="task-meta"><span>${test.testType === 'theory' ? 'Теоретический тест' : 'Практический тест'}</span>${difficultyBadge(test.difficulty)}</div>
      <div class="task-rewards"><span>🎋 <strong>${rewardReceived ? 'получено' : `+${test.reward}`}</strong></span><span>⭐ <strong>${rewardReceived ? 'получено' : `+${test.xp} XP`}</strong></span></div>
      <img class="task-hero task-hero--pet" src="${escapeHtml(petImageUrl(state, testPetEmotion(feedback)))}" alt="${feedback ? (feedback.correct ? 'Финни радуется правильному ответу' : 'Финни расстроен — разберём ошибку вместе') : 'Финни размышляет над вопросом'}" width="220" height="168">
      <h2>${escapeHtml(question.prompt)}</h2>
      ${answerArea}
      ${feedback ? `<div class="result-box ${feedback.correct ? 'result-box--success' : 'result-box--retry'}"><strong>${feedback.correct ? 'Верно!' : 'Разберём ошибку'}</strong><p>${escapeHtml(feedback.message)}</p>${feedback.correct ? '' : '<small>Ответ сохранён, но штрафа нет. Продолжай: итог можно улучшить повторной попыткой.</small>'}</div>
        <button class="button button--primary button--wide" type="button" data-action="next-test-question">${questionIndex === test.questions.length - 1 ? 'Завершить тест' : 'Следующий вопрос'}</button>` : ''}
    </section>
    <button class="text-button" type="button" data-route="tasks">Выйти из теста</button>`, { back: true, nav: false });
}

export function shopTemplate(state, content) {
  const sections = [
    { category: 'essential', title: 'Сначала важное', note: 'Еда и забота', icon: '🧺' },
    { category: 'optional', title: 'Потом желания', note: 'Если позволяет план', icon: '🎁' }
  ];
  return shell('Магазин', state, `
    <section class="balance-banner"><span>Доступно сейчас</span><strong>🎋 ${state.demoMode ? '∞' : state.balance}</strong><small>${state.demoMode ? 'Демо: валюта не заканчивается' : state.plan.confirmed ? 'Сверяй покупку с планом' : 'Сначала подтверди бюджет'}</small></section>
    ${sections.map((section) => `
      <section class="shop-section">
        <div class="section-heading"><div><p class="eyebrow">${section.note}</p><h2>${section.icon} ${section.title}</h2></div></div>
        <div class="product-grid">
          ${content.items.filter((item) => item.category === section.category && (item.unlockPeriod || 1) <= state.period).map((item) => `
            <article class="product-card">
              <span class="product-card__emoji" aria-hidden="true">${item.emoji}</span>
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(item.impactText)}</p>
              <div><strong>${item.price} 🎋</strong><button type="button" class="small-button" data-action="open-purchase" data-item-id="${item.id}" ${item.oncePerPeriod && state.purchases.some((entry) => entry.itemId === item.id && entry.period === state.period) ? 'disabled' : ''}>${item.oncePerPeriod && state.purchases.some((entry) => entry.itemId === item.id && entry.period === state.period) ? 'Оплачено' : 'Посмотреть'}</button></div>
            </article>`).join('')}
        </div>
      </section>`).join('')}
    <section class="feedback-card"><span>${appIcon('idea', 'card-icon')}</span><p>Цена, категория и влияние показываются до подтверждения покупки.</p></section>`, { back: true, active: '' });
}

export function savingsTemplate(state, content) {
  const ownedGoalIds = new Set(state.ownedGoalIds || []);
  const selectedGoal = content.goals.find((entry) => entry.id === state.selectedGoalId) || content.goals[0];
  const unlockedGoals = getUnlockedGoals(content, state.period);
  const availableGoal = unlockedGoals.find((entry) => entry.id === selectedGoal.id && !ownedGoalIds.has(entry.id))
    || unlockedGoals.find((entry) => !ownedGoalIds.has(entry.id));
  const nextFutureGoal = content.goals.find((entry) => entry.unlockPeriod > state.period && !ownedGoalIds.has(entry.id));
  const allGoalsOwned = content.goals.every((entry) => ownedGoalIds.has(entry.id));
  const allUnlockedGoalsOwned = !availableGoal;
  const goal = availableGoal || selectedGoal;
  const acquiredGoals = content.goals.filter((entry) => ownedGoalIds.has(entry.id));
  const remaining = availableGoal ? Math.max(0, goal.cost - state.savings) : 0;
  const regular = Math.max(1, state.plan.savings || 10);
  const estimate = remaining === 0 ? 0 : Math.ceil(remaining / regular);
  return shell('Моя цель', state, `
    <section class="goal-hero">
      ${allUnlockedGoalsOwned
        ? `<span class="goal-hero__emoji">🏆</span>
          <p class="eyebrow">${allGoalsOwned ? 'Коллекция собрана' : `Период ${state.period} завершён по целям`}</p>
          <h2>${allGoalsOwned ? 'Все цели получены' : 'Все открытые цели получены'}</h2>
          <p>${allGoalsOwned ? 'Накопленные деньги превратились в полезные возможности для питомца.' : `Следующая цель «${escapeHtml(nextFutureGoal?.title || 'Новая цель')}» откроется в периоде ${nextFutureGoal?.unlockPeriod || state.period + 1}.`}</p>
          <div class="goal-amounts"><span>Получено <strong>${ownedGoalIds.size}</strong></span><span>В копилке <strong>${state.savings}</strong></span></div>
          <div class="meter__track meter__track--large"><span class="meter__fill meter__fill--green" style="width:100%"></span></div>
          <small>${allGoalsOwned ? 'Каждую цель можно применять один раз за игровой период.' : 'Можно продолжать копить заранее.'}</small>`
        : `<span class="goal-hero__emoji">${goal.emoji}</span>
          <p class="eyebrow">Выбранная цель</p>
          <h2>${escapeHtml(goal.title)}</h2>
          <p>${escapeHtml(goal.description)}</p>
          <div class="goal-amounts"><span>Накоплено <strong>${state.savings}</strong></span><span>Осталось <strong>${remaining}</strong></span></div>
          <div class="meter__track meter__track--large"><span class="meter__fill meter__fill--green" style="width:${percent(state.savings, goal.cost)}%"></span></div>
          <small>${estimate ? `При взносе ${regular} бамбунчинок: примерно ${estimate} периодов` : 'Нужная сумма собрана — теперь цель можно получить!'}</small>
          ${remaining === 0 ? `<div class="goal-claim-panel"><strong>Бамбунчинки не пропадут впустую</strong><p>После покупки цель появится в коллекции и даст действие: ${escapeHtml(goal.effectDescription)}.</p><button class="button button--primary button--wide" type="button" data-action="open-goal-claim" data-goal-id="${goal.id}">Получить за ${goal.cost} бамбунчинок</button></div>` : ''}`}
    </section>

    <section class="card">
      <h2>Выбрать цель</h2>
      <div class="goal-options">
        ${content.goals.map((entry) => {
          if (ownedGoalIds.has(entry.id)) return `<div class="goal-option is-owned"><span>${entry.emoji}</span><span><strong>${escapeHtml(entry.title)}</strong><small>Получено · ${escapeHtml(entry.effectDescription)}</small></span><b>✓</b></div>`;
          if (entry.unlockPeriod > state.period) return `<div class="goal-option is-locked"><span>${appIcon('lock', 'list-icon')}</span><span><strong>${escapeHtml(entry.title)}</strong><small>Откроется в периоде ${entry.unlockPeriod}</small></span><b>${entry.unlockPeriod}</b></div>`;
          return `<button type="button" class="goal-option ${entry.id === goal.id ? 'is-active' : ''}" data-action="select-goal" data-goal-id="${entry.id}">
            <span>${entry.emoji}</span><span><strong>${escapeHtml(entry.title)}</strong><small>${entry.cost} бамбунчинок</small></span>${entry.id === goal.id ? '<b>✓</b>' : ''}
          </button>`;
        }).join('')}
      </div>
    </section>

    ${acquiredGoals.length ? `<section class="card goal-collection">
      <div class="section-heading"><div><p class="eyebrow">Практическая польза</p><h2>Мои полученные цели</h2></div><strong>${acquiredGoals.length}</strong></div>
      <p>Используй каждую один раз за период. В новом периоде действия снова станут доступны.</p>
      <div class="goal-collection__list">
        ${acquiredGoals.map((entry) => {
          const used = state.goalUsagePeriods?.[entry.id] === state.period;
          return `<article class="goal-owned-card ${used ? 'is-used' : ''}">
            <span class="goal-owned-card__emoji">${entry.emoji}</span>
            <div><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.effectDescription)}</small></div>
            <button class="small-button" type="button" data-action="use-goal" data-goal-id="${entry.id}" ${used ? 'disabled' : ''}>${used ? 'Использовано' : escapeHtml(entry.actionLabel)}</button>
          </article>`;
        }).join('')}
      </div>
    </section>` : ''}

    ${allGoalsOwned
      ? `<section class="card"><h2>Копилка</h2><p>Все доступные цели собраны. Оставшиеся ${state.savings} бамбунчинок можно вернуть на баланс.</p><button class="link-button link-button--danger" type="button" data-action="open-withdraw" ${state.savings <= 0 ? 'disabled' : ''}>Снять из копилки</button></section>`
      : `<section class="card">
          <h2>Пополнить копилку</h2>
          <form id="deposit-form" class="inline-form">
            <label class="field"><span>Сумма</span><input type="number" name="amount" min="1" max="999" inputmode="numeric" value="${Math.min(regular, state.balance)}" required></label>
            <button class="button button--primary" type="submit">Отложить</button>
          </form>
          <p class="hint">${allUnlockedGoalsOwned ? 'Бамбунчинки сохранятся заранее до открытия новой цели.' : 'Бамбунчинки переместятся с доступного баланса в накопления.'}</p>
          <button class="link-button link-button--danger" type="button" data-action="open-withdraw" ${state.savings <= 0 ? 'disabled' : ''}>Снять из копилки</button>
        </section>`}

    <section class="feedback-card"><span>${appIcon('idea', 'card-icon')}</span><p>${escapeHtml(state.feedback)}</p></section>`, { active: 'savings' });
}

export function progressTemplate(state, content) {
  const stage = getPetStage(state);
  const completedByTheme = (theme) => content.tasks.filter((test) => test.theme === theme && state.completedTestIds.includes(test.id)).length;
  return shell('Мой прогресс', state, `
    <section class="stage-card">
      <span>${appIcon('growth', 'card-icon')}</span><div><p class="eyebrow">Развитие питомца</p><h2>Стадия ${stage.id}: ${stage.title}</h2><p>${Math.min(4, state.period - 1)}/4 завершённых периодов к высшей стадии. Финни взрослеет после каждых двух периодов.</p></div>
    </section>

    <section class="card">
      <h2>Освоенные темы</h2>
      ${planFactRow('Планирование бюджета', 2, completedByTheme('budget'), 'orange')}
      ${planFactRow('Накопления', 2, completedByTheme('savings'), 'green')}
      ${planFactRow('Покупки и платежи', 2, completedByTheme('purchases'), 'blue')}
    </section>

    <section class="card">
      <div class="section-heading"><h2>Итоги периодов</h2><span>${state.periodHistory.length}/5</span></div>
      ${state.periodHistory.length ? `<div class="history-list">${[...state.periodHistory].reverse().map((entry) => `
        <article class="history-row">
          <span class="score-circle">${entry.score}</span>
          <div><strong>Период ${entry.period}</strong><p>${escapeHtml(entry.message)}</p><small>План/факт: важное ${entry.plan.essential}/${entry.actual.essential}, желания ${entry.plan.optional}/${entry.actual.optional}, цель ${entry.plan.savings}/${entry.actual.savings}</small></div>
        </article>`).join('')}</div>` : '<p class="empty-state">Первый итог появится после завершения периода.</p>'}
    </section>

    <section class="card">
      <h2>Последние операции</h2>
      ${state.purchases.length || state.incomes.length ? `<div class="transaction-list">
        ${[...state.incomes].slice(-3).reverse().map((entry) => `<div><span>➕ ${escapeHtml(entry.source)}</span><strong>+${entry.amount}</strong></div>`).join('')}
        ${[...state.purchases].slice(-5).reverse().map((entry) => `<div><span>${entry.category === 'essential' ? '🧺' : '🎁'} ${escapeHtml(entry.name)}</span><strong>−${entry.price}</strong></div>`).join('')}
      </div>` : '<p class="empty-state">Операций пока нет.</p>'}
    </section>`, { back: true, nav: false });
}

export function moreTemplate(state) {
  return shell('Ещё', state, `
    <div class="menu-list">
      <button type="button" data-route="shop"><span>🛒</span><span><strong>Магазин</strong><small>Обязательные и желаемые покупки</small></span><b>›</b></button>
      <button type="button" data-route="progress"><span>📈</span><span><strong>Прогресс и история</strong><small>Периоды, тесты и операции</small></span><b>›</b></button>
      <button type="button" data-route="help"><span>❓</span><span><strong>Помощь и словарь</strong><small>Как играть и что означают слова</small></span><b>›</b></button>
      <button type="button" data-route="adult"><span>${appIcon('lock', 'row-icon')}</span><span><strong>Для взрослого</strong><small>Результаты, настройки и сброс</small></span><b>›</b></button>
    </div>
    <section class="privacy-card"><span>${appIcon('shield', 'card-icon')}</span><p>Игра не просит настоящее имя, телефон, e-mail, банковские данные и не показывает рекламу.</p></section>`, { active: 'more' });
}

export function helpTemplate(state) {
  return shell('Помощь и словарь', state, `
    <section class="card">
      <h2>Как играть</h2>
      <ol class="steps-list">
        <li><span>1</span><p>Получи игровой доход и распредели его на три части.</p></li>
        <li><span>2</span><p>Изучи теорию, затем сдай базовый и практический тесты.</p></li>
        <li><span>3</span><p>Сделай важную и желаемую покупку, пополни цель.</p></li>
        <li><span>4</span><p>Заверши период и сравни план с результатом.</p></li>
      </ol>
    </section>
    <section class="card glossary">
      <h2>Короткий словарь</h2>
      <details open><summary>Бюджет</summary><p>План денег: сколько приходит и на что их можно направить.</p></details>
      <details><summary>Доход</summary><p>Деньги, которые появились в игровом периоде. Источник всегда указан.</p></details>
      <details><summary>Обязательный расход</summary><p>Важная трата, например еда или уход.</p></details>
      <details><summary>Желаемая покупка</summary><p>Приятная вещь, которую можно отложить, если денег мало.</p></details>
      <details><summary>Накопления</summary><p>Деньги, которые сохраняют для будущей цели.</p></details>
      <details><summary>План и факт</summary><p>План — как собирались потратить. Факт — что получилось на самом деле.</p></details>
    </section>
    <section class="privacy-card"><span>💚</span><p>Финни не сердится за ошибки. Любое неверное решение можно исправить.</p></section>`, { back: true, nav: false });
}

export function adultGateTemplate(state, challenge) {
  return shell('Раздел для взрослого', state, `
    <section class="gate-card">
      <span class="gate-card__icon">${appIcon('lock', 'gate-card__icon-img')}</span>
      <h2>Проверка для взрослого</h2>
      <p>Решите пример, чтобы посмотреть просветительские цели и общий прогресс ребёнка. Регистрация не нужна.</p>
      <p class="hint">Это защита от случайного входа. После выхода раздел снова закрывается.</p>
      <form id="adult-gate-form" class="stack">
        <label class="field"><span>${challenge.a} + ${challenge.b} = ?</span><input type="number" name="answer" inputmode="numeric" required autofocus></label>
        <button class="button button--primary button--wide" type="submit">Открыть</button>
      </form>
    </section>`, { back: true, nav: false });
}

export function adultDashboardTemplate(state, content) {
  const totalAttempts = state.taskHistory.length;
  const correctAttempts = state.taskHistory.filter((entry) => entry.correct).length;
  const finishedPeriods = content.periods.filter((period) => state.periodHistory.some((entry) => entry.period === period.id)).length;
  const requirements = getPeriodRequirements(state, content);
  const nextStep = requirements.find((entry) => !entry.done);
  const stage = getPetStage(state);
  return shell('Раздел для взрослого', state, `
    <section class="privacy-card"><span>${appIcon('lock', 'card-icon')}</span><p>Просветительские цели и прогресс на этом устройстве. Регистрация, почта и телефон не требуются.</p></section>
    <button class="button button--secondary button--wide" type="button" data-action="lock-adult">Закрыть раздел и вернуться в игру</button>
    <section class="adult-summary">
      <article><span>Периоды</span><strong>${finishedPeriods}/${content.periods.length}</strong></article>
      <article><span>Теория</span><strong>${state.readTheoryBlockIds.length}/${content.lessons.length}</strong></article>
      <article><span>Сдано тестов</span><strong>${state.completedTestIds.length}/${content.tasks.length}</strong></article>
      <article><span>Верные ответы</span><strong>${totalAttempts ? Math.round((correctAttempts / totalAttempts) * 100) + '%' : 'Нет ответов'}</strong></article>
    </section>

    <section class="card">
      <h2>Общий прогресс</h2>
      ${progressBar(percent(finishedPeriods, content.periods.length), 'Завершённые периоды', 'violet')}
      <p>Завершено ${finishedPeriods} из ${content.periods.length} периодов. Стадия Финни: ${stage.id} из 3 — ${escapeHtml(stage.title)}.</p>
      <p>${totalAttempts ? `Верных ответов: ${correctAttempts} из ${totalAttempts}. Учитываются повторные попытки; это не школьная оценка.` : 'Ответов пока нет. Прогресс появится после первых заданий.'}</p>
      <p>Получено целей накопления: ${content.goals.filter((goal) => state.ownedGoalIds.includes(goal.id)).length} из ${content.goals.length}.</p>
    </section>

    <section class="card">
      <h2>Просветительские цели по блокам</h2>
      ${content.lessons.map((lesson) => {
        const tests = getTestsForBlock(content, lesson.id);
        const passed = tests.filter((entry) => state.completedTestIds.includes(entry.id)).length;
        const read = state.readTheoryBlockIds.includes(lesson.id);
        const status = lesson.unlockPeriod > state.period ? `Откроется в периоде ${lesson.unlockPeriod}` : passed === tests.length && read ? 'Блок пройден' : read ? 'Теория изучена — идёт практика' : 'Теория ещё не изучена';
        return `<details class="card" open><summary><strong>${escapeHtml(lesson.title)}</strong></summary>
          <p>${escapeHtml(lesson.intro)}</p>
          <ul>${lesson.keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
          <p><strong>${status}</strong>. Тесты: ${passed}/${tests.length}.</p>
          <ul class="simple-list">${tests.map((entry) => `<li><span>${state.completedTestIds.includes(entry.id) ? '✅' : '○'}</span><p>${escapeHtml(entry.title)} — ${state.completedTestIds.includes(entry.id) ? 'сдан' : 'ещё не сдан'}</p></li>`).join('')}</ul>
        </details>`;
      }).join('')}
    </section>

    <section class="card">
      <h2>Следующий шаг</h2>
      <p>${state.courseComplete ? 'Все периоды завершены. Можно повторять тесты и обсуждать похожие ситуации из жизни.' : nextStep ? escapeHtml(nextStep.label) : 'Все требования текущего периода выполнены — можно подвести итог.'}</p>
      <ul class="simple-list">${requirements.map((entry) => `<li><span>${statusIcon(entry.done)}</span><p>${escapeHtml(entry.label)} <small>${entry.current}/${entry.target}</small></p></li>`).join('')}</ul>
    </section>

    <section class="card">
      <h2>Что обсудить вместе</h2>
      <ul class="simple-list">
        <li><span>💬</span><p>Какие покупки нужны сейчас, а какие могут подождать?</p></li>
        <li><span>💬</span><p>Сколько можно отложить на цель, чтобы хватило на важное?</p></li>
        <li><span>💬</span><p>Почему реальные расходы отличаются от плана?</p></li>
      </ul>
      <p>Просите ребёнка объяснить решение. При ошибке разберите пояснение и предложите попробовать снова.</p>
    </section>

    <section class="card">
      <h2>Образовательные темы</h2>
      <ul class="simple-list">
        <li><span>📊</span><p><strong>Бюджет:</strong> распределение дохода и сравнение плана с фактом.</p></li>
        <li><span>🛒</span><p><strong>Покупки:</strong> различие потребностей и желаний, проверка остатка.</p></li>
        <li><span>🎯</span><p><strong>Накопления:</strong> цель, регулярный взнос и последствия снятия.</p></li>
      </ul>
    </section>

    <section class="card settings-card">
      <h2>Доступность</h2>
      <label class="switch-row"><span><strong>Анимации</strong><small>Можно отключить движение питомца</small></span><input type="checkbox" data-setting="animations" ${state.settings.animations ? 'checked' : ''}></label>
      <label class="switch-row"><span><strong>Крупный текст</strong><small>Увеличить основной шрифт</small></span><input type="checkbox" data-setting="largeText" ${state.settings.largeText ? 'checked' : ''}></label>
      <label class="switch-row"><span><strong>Высокий контраст</strong><small>Усилить границы и цвет текста</small></span><input type="checkbox" data-setting="highContrast" ${state.settings.highContrast ? 'checked' : ''}></label>
    </section>

    <section class="card adult-actions">
      <h2>Тестовый режим для экспертов</h2>
      <p>${state.demoMode ? '<strong>Режим активен.</strong> Все тесты доступны сразу, бамбунчинки безлимитные, ожидание времени отключено. Обычный прогресс сохранён и будет восстановлен после выхода.' : 'Создаёт отдельный тестовый профиль: все тесты будут открыты сразу, валюта станет безлимитной, а обычный прогресс сохранится отдельно.'}</p>
      <ul class="simple-list">
        <li><span>1</span><p>Стартовый бюджет, цель и задания.</p></li>
        <li><span>2</span><p>Бюджет → задание → обязательная и необязательная покупка → накопления.</p></li>
        <li><span>3</span><p>Обратная связь → завершение периода → следующая стадия Финни.</p></li>
        <li><span>4</span><p>Повторяйте цикл до пятого периода; прогресс сохраняется между запусками.</p></li>
      </ul>
      <button class="button button--secondary button--wide" type="button" data-action="confirm-demo">${state.demoMode ? 'Сбросить тестовый режим к началу' : 'Запустить тестовый режим'}</button>
      ${state.demoMode ? '<button class="button button--primary button--wide" type="button" data-action="confirm-exit-demo">Выйти из тестового режима</button>' : ''}
      <button class="button button--danger button--wide" type="button" data-action="confirm-reset">Удалить локальный профиль</button>
    </section>
    <p class="legal-note">Хранение: только на устройстве. Передача данных и внешние ссылки отсутствуют.</p>`, { back: true, nav: false });
}

export function errorTemplate(message) {
  return `<div class="welcome-screen"><div class="welcome-card"><div class="brand-mark">${appIcon('warning', 'brand-mark__icon')}</div><h1>Не удалось запустить игру</h1><p class="welcome-card__text">${escapeHtml(message)}</p><p>Перезапустите локальный сервер и обновите страницу.</p></div></div>`;
}

export function renderRoute(route, state, content, ui) {
  switch (route) {
    case 'onboarding': return onboardingTemplate(ui.onboardingPage);
    case 'profile': return profileTemplate(state);
    case 'home': return homeTemplate(state, content);
    case 'budget': return budgetTemplate(state);
    case 'tasks': return tasksTemplate(state, content, ui.tasksNotice);
    case 'theory': {
      const lesson = content.lessons.find((entry) => entry.id === ui.selectedBlockId) || content.lessons[0];
      return theoryTemplate(state, lesson);
    }
    case 'test': {
      const test = content.tasks.find((entry) => entry.id === ui.selectedTestId) || content.tasks[0];
      return testTemplate(state, test, ui.testSession);
    }
    case 'shop': return shopTemplate(state, content);
    case 'savings': return savingsTemplate(state, content);
    case 'progress': return progressTemplate(state, content);
    case 'more': return moreTemplate(state);
    case 'help': return helpTemplate(state);
    case 'adult': return ui.adultUnlocked ? adultDashboardTemplate(state, content) : adultGateTemplate(state, ui.challenge);
    default: return homeTemplate(state, content);
  }
}

export { statusIcon };
