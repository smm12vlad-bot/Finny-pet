async function readJson(relativePath) {
  const response = await fetch(new URL(relativePath, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить ${relativePath}`);
  return response.json();
}

export async function loadContent() {
  const [lessons, tasks, items, goals, periods] = await Promise.all([
    readJson('../../content/lessons.json'),
    readJson('../../content/tasks.json'),
    readJson('../../content/items.json'),
    readJson('../../content/goals.json'),
    readJson('../../content/periods.json')
  ]);

  if (lessons.length !== 5 || tasks.length !== 15 || items.length < 12 || goals.length < 5 || periods.length !== 5) {
    throw new Error('Учебный контент не соответствует минимальному объёму ТЗ.');
  }
  if (!lessons.every((lesson) => lesson.title && lesson.intro && lesson.formula && lesson.example && lesson.sections?.length >= 3 && lesson.keyPoints?.length >= 3)) {
    throw new Error('Каждый учебный блок должен содержать теорию, формулу, пример и памятку.');
  }
  if (!tasks.every((task) => task.questions?.length === 5 && task.passScore === 4)) {
    throw new Error('В каждом тесте должно быть ровно пять вопросов и проходной балл 4 из 5.');
  }
  if (tasks.reduce((total, task) => total + task.questions.length, 0) !== 75) {
    throw new Error('В пятнадцати тестах должно быть ровно 75 вопросов.');
  }
  const questions = tasks.flatMap((task) => task.questions);
  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    throw new Error('Идентификаторы вопросов не должны повторяться.');
  }
  if (!questions.every((question) => {
    const answerIsValid = question.type === 'amount'
      ? Number.isFinite(question.correctAmount)
      : question.type === 'choice'
        && Array.isArray(question.options)
        && question.options.filter((option) => option.correct).length === 1;
    return question.prompt && question.successExplanation && question.retryExplanation && answerIsValid;
  })) {
    throw new Error('У каждого вопроса должны быть ответ и подробные объяснения.');
  }
  const difficulties = new Set(tasks.map((task) => task.difficulty));
  if (!['easy', 'medium', 'hard'].every((level) => difficulties.has(level))) {
    throw new Error('Нужны базовые, практические и сложные тесты.');
  }
  if (!tasks.every((task) => Number.isInteger(task.unlockPeriod) && task.unlockPeriod >= 1 && task.unlockPeriod <= periods.length)) {
    throw new Error('У каждого теста должен быть корректный период открытия.');
  }
  if (!periods.every((period) => Array.isArray(period.objectives) && period.objectives.length >= 4 && period.learningGoal && period.stage)) {
    throw new Error('У каждого периода должны быть учебная цель и обязательный чек-лист.');
  }
  if (!lessons.every((lesson) => {
    const blockTests = tasks.filter((task) => task.blockId === lesson.id);
    return blockTests.length === 3
      && blockTests.every((task) => task.unlockPeriod === lesson.unlockPeriod)
      && ['easy', 'medium', 'hard'].every((level) => blockTests.some((task) => task.difficulty === level))
      && blockTests.some((task) => task.testType === 'theory')
      && blockTests.some((task) => task.testType === 'practice');
  })) {
    throw new Error('В каждом периоде нужны теория, практика и сложный тест.');
  }
  for (const period of periods) {
    if (lessons.filter((lesson) => lesson.unlockPeriod === period.id).length !== 1) throw new Error('Нужен один блок на период.');
    for (const objective of period.objectives) {
      if (objective.testIds?.some((id) => !tasks.some((task) => task.id === id && task.unlockPeriod <= period.id))) throw new Error('Недоступный тест в требованиях периода.');
      if (objective.blockIds?.some((id) => !lessons.some((lesson) => lesson.id === id && lesson.unlockPeriod <= period.id))) throw new Error('Недоступная теория в требованиях периода.');
      if (objective.itemId && !items.some((item) => item.id === objective.itemId && (item.unlockPeriod || 1) <= period.id)) throw new Error('Недоступная покупка в требованиях периода.');
    }
  }
  if (tasks.some((task) => task.requiresTestId && !tasks.some((prerequisite) => prerequisite.id === task.requiresTestId && prerequisite.blockId === task.blockId && prerequisite.reward < task.reward))) throw new Error('Некорректная последовательность тестов.');
  if (!periods.every((period) => tasks.some((task) => task.unlockPeriod === period.id))) {
    throw new Error('В каждом периоде должен открываться новый тест.');
  }
  if (!goals.every((goal) => goal.actionLabel && goal.effectDescription && goal.effect && Number.isFinite(goal.cost) && Number.isInteger(goal.unlockPeriod))) {
    throw new Error('У каждой цели должны быть стоимость, действие и игровой эффект.');
  }
  if (!periods.every((period) => goals.some((goal) => goal.unlockPeriod === period.id))) {
    throw new Error('В каждом периоде должна открываться новая цель накопления.');
  }

  return { lessons, tasks, items, goals, periods };
}
