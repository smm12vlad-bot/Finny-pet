export const SCHEMA_VERSION = 4;

export function createEmptyPlan() {
  return {
    essential: 0,
    optional: 0,
    savings: 0,
    confirmed: false
  };
}

export function createDefaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: null,
    onboardingComplete: false,
    balance: 0,
    savings: 0,
    selectedGoalId: 'picnic',
    ownedGoalIds: [],
    goalHistory: [],
    goalUsagePeriods: {},
    food: 0,
    satiety: 68,
    mood: 72,
    confidence: 65,
    xp: 0,
    period: 1,
    growthPoints: 0,
    plan: createEmptyPlan(),
    periodSavingsDeposited: 0,
    purchases: [],
    incomes: [],
    completedTaskIds: [],
    masteredTaskIds: [],
    taskHistory: [],
    readTheoryBlockIds: [],
    completedTestIds: [],
    testHistory: [],
    taskCycle: 1,
    taskResetAt: 0,
    taskResetIntervalMs: 0,
    periodHistory: [],
    feedback: 'Сначала познакомимся и создадим игрового питомца.',
    demoMode: false,
    courseComplete: false,
    settings: {
      animations: true,
      highContrast: false,
      largeText: false
    }
  };
}

function numberOr(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizeState(raw) {
  const base = createDefaultState();
  if (!raw || typeof raw !== 'object') return base;

  return {
    ...base,
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    balance: numberOr(raw.balance, base.balance, 0),
    savings: numberOr(raw.savings, base.savings, 0),
    food: numberOr(raw.food, base.food, 0, 99),
    satiety: numberOr(raw.satiety, base.satiety, 0, 100),
    mood: numberOr(raw.mood, base.mood, 0, 100),
    confidence: numberOr(raw.confidence, base.confidence, 0, 100),
    xp: numberOr(raw.xp, base.xp, 0),
    period: numberOr(raw.period, base.period, 1, 5),
    growthPoints: numberOr(raw.growthPoints, base.growthPoints, 0, 5),
    profile: raw.profile && typeof raw.profile === 'object' ? {
      nickname: String(raw.profile.nickname || '').slice(0, 16),
      petName: 'Финни',
      fur: ['sunset', 'honey', 'berry'].includes(raw.profile.fur) ? raw.profile.fur : 'sunset',
      accessory: raw.profile.accessory === 'scarf' ? 'bow' : (['leaf', 'bow', 'star'].includes(raw.profile.accessory) ? raw.profile.accessory : 'leaf'),
      accessoryColor: ['green', 'pink', 'blue'].includes(raw.profile.accessoryColor) ? raw.profile.accessoryColor : 'green'
    } : null,
    plan: {
      ...createEmptyPlan(),
      ...(raw.plan || {}),
      essential: numberOr(raw.plan?.essential, 0, 0),
      optional: numberOr(raw.plan?.optional, 0, 0),
      savings: numberOr(raw.plan?.savings, 0, 0),
      confirmed: Boolean(raw.plan?.confirmed)
    },
    periodSavingsDeposited: numberOr(raw.periodSavingsDeposited, 0, 0),
    purchases: Array.isArray(raw.purchases) ? raw.purchases : [],
    incomes: Array.isArray(raw.incomes) ? raw.incomes : [],
    ownedGoalIds: Array.isArray(raw.ownedGoalIds) ? [...new Set(raw.ownedGoalIds.map(String))] : [],
    goalHistory: Array.isArray(raw.goalHistory) ? raw.goalHistory : [],
    goalUsagePeriods: raw.goalUsagePeriods && typeof raw.goalUsagePeriods === 'object' && !Array.isArray(raw.goalUsagePeriods)
      ? Object.fromEntries(Object.entries(raw.goalUsagePeriods).map(([goalId, period]) => [String(goalId), numberOr(period, 0, 0, 5)]))
      : {},
    completedTaskIds: Array.isArray(raw.completedTaskIds) ? [...new Set(raw.completedTaskIds.map(String))] : [],
    masteredTaskIds: Array.isArray(raw.masteredTaskIds)
      ? [...new Set(raw.masteredTaskIds.map(String))]
      : Array.isArray(raw.completedTestIds)
        ? [...new Set(raw.completedTestIds.map(String))]
        : Array.isArray(raw.completedTaskIds)
          ? [...new Set(raw.completedTaskIds.map(String))]
          : [],
    taskHistory: Array.isArray(raw.taskHistory) ? raw.taskHistory : [],
    readTheoryBlockIds: Array.isArray(raw.readTheoryBlockIds)
      ? [...new Set(raw.readTheoryBlockIds.map(String))]
      : [],
    completedTestIds: Array.isArray(raw.completedTestIds)
      ? [...new Set(raw.completedTestIds.map(String))]
      : [],
    testHistory: Array.isArray(raw.testHistory) ? raw.testHistory : [],
    taskCycle: numberOr(raw.taskCycle, 1, 1),
    taskResetAt: numberOr(raw.taskResetAt, 0, 0),
    periodHistory: Array.isArray(raw.periodHistory) ? raw.periodHistory : [],
    demoMode: Boolean(raw.demoMode),
    settings: {
      ...base.settings,
      ...(raw.settings || {}),
      animations: raw.settings?.animations !== false,
      highContrast: Boolean(raw.settings?.highContrast),
      largeText: Boolean(raw.settings?.largeText)
    }
  };
}

export function cloneState(state) {
  return normalizeState(JSON.parse(JSON.stringify(state)));
}
