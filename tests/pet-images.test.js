import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { petImageUrl } from '../src/ui/pet-assets.js';
import { testTemplate } from '../src/ui/templates.js';
import { createDefaultState } from '../src/core/state.js';

const tasks = JSON.parse(readFileSync(new URL('../content/tasks.json', import.meta.url)));

test('PNG stages follow periods and all assets exist', () => {
  for (const [period, stage] of [[1, 1], [2, 1], [3, 2], [4, 2], [5, 3]]) {
    for (const emotion of ['neutral', 'thinking', 'happy', 'sad']) {
      const url = petImageUrl({ period }, emotion);
      assert.ok(url.endsWith(`stage-${stage}-${emotion}.png`));
      assert.ok(existsSync(new URL(url)));
    }
  }
});

test('each stage shows thinking, happy and sad PNGs from the answer feedback', () => {
  for (const [period, stage] of [[1, 1], [3, 2], [5, 3]]) {
    const state = { ...createDefaultState(), period };
    for (const [feedback, emotion] of [[null, 'thinking'], [{ correct: true, message: 'Верно' }, 'happy'], [{ correct: false, message: 'Разберём' }, 'sad']]) {
      const html = testTemplate(state, tasks[0], { questionIndex: 0, answers: [], feedback });
      assert.ok(html.includes(`stage-${stage}-${emotion}.png`));
      assert.ok(!html.includes('🤔'));
    }
    const nextQuestion = testTemplate(state, tasks[0], { questionIndex: 1, answers: [], feedback: null });
    assert.ok(nextQuestion.includes(`stage-${stage}-thinking.png`));
  }
});
