import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dist = path.join(root, 'dist');

const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'vendor/phaser-3.90.0.min.js',
  'vendor/PHASER_LICENSE.txt',
  'src/main.js',
  'src/styles.css',
  'content/lessons.json',
  'content/tasks.json',
  'content/items.json',
  'content/goals.json',
  'content/periods.json',
  'assets/icons/finny-icon.svg'
];

for (const relativePath of requiredFiles) await access(path.join(dist, relativePath));

const readJson = async (name) => JSON.parse(await readFile(path.join(dist, 'content', name), 'utf8'));
const [lessons, tasks, items, goals, periods] = await Promise.all([
  readJson('lessons.json'),
  readJson('tasks.json'),
  readJson('items.json'),
  readJson('goals.json'),
  readJson('periods.json')
]);

function uniqueIds(entries, label) {
  const ids = entries.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error(`Повторяющиеся id: ${label}`);
}

uniqueIds(lessons, 'учебные блоки');
uniqueIds(tasks, 'тесты');
uniqueIds(items, 'товары');
uniqueIds(goals, 'цели');
uniqueIds(periods, 'периоды');

if (lessons.length !== 5 || tasks.length !== 15 || items.length < 12 || goals.length < 5 || periods.length !== 5) {
  throw new Error('Минимальный объём контента ТЗ не выполнен.');
}
if (!lessons.every((lesson) => lesson.sections?.length >= 3 && lesson.keyPoints?.length >= 3 && lesson.formula && lesson.example)) {
  throw new Error('В каждом блоке должна быть полная теория.');
}
if (!tasks.every((task) => task.questions?.length === 5 && task.passScore === 4)) {
  throw new Error('В каждом тесте должно быть пять вопросов и проходной балл 4.');
}
if (tasks.reduce((sum, task) => sum + task.questions.length, 0) !== 75) {
  throw new Error('В тестах должно быть ровно 75 вопросов.');
}
const questions = tasks.flatMap((task) => task.questions);
if (new Set(questions.map((question) => question.id)).size !== questions.length) {
  throw new Error('Идентификаторы вопросов не должны повторяться.');
}
if (!questions.every((question) => {
  const answerIsValid = question.type === 'amount'
    ? Number.isFinite(question.correctAmount)
    : question.type === 'choice' && question.options?.filter((option) => option.correct).length === 1;
  return question.prompt && question.successExplanation && question.retryExplanation && answerIsValid;
})) {
  throw new Error('У каждого вопроса должны быть объяснения верного и неверного ответа.');
}
const difficultyOrder = ['easy', 'medium', 'hard'];
if (!difficultyOrder.every((level) => tasks.some((task) => task.difficulty === level))) {
  throw new Error('В тестах отсутствует один из уровней сложности.');
}
for (const theme of lessons.map((lesson) => lesson.id)) {
  const themeTasks = tasks.filter((task) => task.theme === theme).sort((a, b) => a.unlockPeriod - b.unlockPeriod);
  if (themeTasks.length !== 3) throw new Error(`В блоке ${theme} должно быть три теста.`);
  if (!difficultyOrder.every((level) => themeTasks.some((task) => task.difficulty === level))) throw new Error(`В блоке ${theme} нет одного из уровней.`);
  if (!themeTasks.some((task) => task.testType === 'theory') || !themeTasks.some((task) => task.testType === 'practice')) throw new Error(`В блоке ${theme} нужны теория и практика.`);
  if (!themeTasks.every((task, index) => index === 0 || task.reward > themeTasks[index - 1].reward)) throw new Error(`Награды темы ${theme} не растут со сложностью.`);
  if (!themeTasks.every((task, index) => index === 0 || task.xp > themeTasks[index - 1].xp)) throw new Error(`XP темы ${theme} не растёт со сложностью.`);
}
if (!items.some((item) => item.category === 'essential') || !items.some((item) => item.category === 'optional')) {
  throw new Error('В магазине должны быть обе категории покупок.');
}
if (!tasks.every((task) => Number.isInteger(task.unlockPeriod) && task.unlockPeriod >= 1 && task.unlockPeriod <= periods.length)) {
  throw new Error('У тестов неверно указан период открытия.');
}
if (!periods.every((period) => period.stage && period.learningGoal && Array.isArray(period.objectives) && period.objectives.length >= 4)) {
  throw new Error('У каждого периода должны быть учебная цель и обязательный чек-лист.');
}
if (!periods.every((period) => tasks.some((task) => task.unlockPeriod === period.id))) {
  throw new Error('В каждом периоде должен открываться новый тест.');
}
if (!goals.every((goal) => goal.actionLabel && goal.effectDescription && goal.effect && Number.isFinite(goal.cost) && Number.isInteger(goal.unlockPeriod))) {
  throw new Error('У каждой цели должны быть стоимость, действие и игровой эффект.');
}
if (!periods.every((period) => goals.some((goal) => goal.unlockPeriod === period.id))) {
  throw new Error('В каждом периоде должна открываться новая цель накопления.');
}

const phaser = await stat(path.join(dist, 'vendor/phaser-3.90.0.min.js'));
if (phaser.size < 1_000_000) throw new Error('Локальный файл Phaser повреждён или неполон.');

const index = await readFile(path.join(dist, 'index.html'), 'utf8');
for (const link of ['./src/styles.css', './vendor/phaser-3.90.0.min.js', './src/main.js']) {
  if (!index.includes(link)) throw new Error(`В index.html отсутствует ${link}`);
}

console.log('Проверка production-сборки пройдена.');
console.log(`Контент: ${lessons.length} блоков, ${tasks.length} тестов и ${questions.length} вопросов, ${items.length} товаров, ${goals.length} целей, ${periods.length} периодов.`);
console.log('Внешние npm-пакеты для запуска не требуются.');
