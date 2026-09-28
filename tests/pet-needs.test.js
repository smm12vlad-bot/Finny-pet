import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GameEngine, SATIETY_DECAY_MS, MOOD_DECAY_MS} from '../src/core/engine.js';
import {GameStorage, MemoryStorage} from '../src/core/storage.js';
import {petNeedsEmotion, petImageUrl, testPetEmotion} from '../src/ui/pet-assets.js';
const content = Object.fromEntries(['lessons','tasks','items','goals','periods'].map(k => [k, JSON.parse(readFileSync(new URL(`../content/${k}.json`, import.meta.url)))]));
function setup() {
  let now = 1800000000000;
  const storage = new GameStorage(new MemoryStorage());
  const clock = {now: () => now};
  const engine = new GameEngine(content, storage, clock);
  engine.createProfile({nickname:'Игрок',petName:'Финни'});
  return {engine,storage,clock,advance: ms => {now += ms;}};
}
test('whole ticks preserve remainder and repeated polling does not lose time', () => {
  const {engine:e,advance} = setup();
  advance(SATIETY_DECAY_MS-1);
  assert.equal(e.refreshPetNeeds(),false);
  advance(1); assert.equal(e.refreshPetNeeds(),true);
  assert.equal(e.state.satiety,67); assert.equal(e.state.mood,72);
  advance(MOOD_DECAY_MS-SATIETY_DECAY_MS); e.refreshPetNeeds();
  assert.equal(e.state.mood,71);
  assert.equal(e.refreshPetNeeds(),false);
  advance(2*60000); e.refreshPetNeeds(); assert.equal(e.state.satiety,66);
});
test('offline decay survives reload and cannot be charged twice', () => {
  const {engine:e,storage,clock,advance} = setup();
  advance(3600000);
  const restored = new GameEngine(content,storage,clock);
  assert.equal(restored.state.satiety,58); assert.equal(restored.state.mood,66);
  const again = new GameEngine(content,storage,clock);
  assert.equal(again.state.satiety,58);
  assert.equal(again.state.balance,e.state.balance);
  assert.deepEqual(again.state.completedTestIds,e.state.completedTestIds);
});
test('legacy save starts now; long absence clamps to zero; clock rollback gives no points', () => {
  const {engine:e,storage,clock,advance} = setup();
  const legacy = {...e.state}; delete legacy.satietyUpdatedAt; delete legacy.moodUpdatedAt;
  storage.save(legacy); advance(86400000);
  const restored = new GameEngine(content,storage,clock);
  assert.equal(restored.state.satiety,68);
  advance(30*86400000); restored.refreshPetNeeds();
  assert.equal(restored.state.satiety,0); assert.equal(restored.state.mood,0);
  advance(-86400000); restored.refreshPetNeeds(); assert.equal(restored.state.satiety,0);
});
test('feeding applies elapsed loss before adding food benefit', () => {
  const {engine:e,advance} = setup(); advance(3600000);
  assert.equal(e.feedPet().ok,true);
  assert.equal(e.state.satiety,76); assert.equal(e.state.mood,69);
  assert.equal(e.state.food,0);
});
test('all stages select needs emotions and test feedback keeps priority', () => {
  for (const period of [1,3,5]) {
    for (const [satiety,mood,emotion] of [[100,100,'happy'],[70,70,'happy'],[69,80,'neutral'],[51,80,'neutral'],[50,80,'thinking'],[80,31,'thinking'],[80,30,'sad'],[0,100,'sad']]) {
      const state={period,satiety,mood};
      assert.equal(petNeedsEmotion(state),emotion);
      assert.ok(petImageUrl(state).endsWith(`-${emotion}.png`));
      assert.ok(petImageUrl(state,testPetEmotion({correct:true})).endsWith('-happy.png'));
      assert.ok(petImageUrl(state,testPetEmotion(null)).endsWith('-thinking.png'));
    }
  }
});
