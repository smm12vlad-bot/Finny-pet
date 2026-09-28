import { getPetStage } from '../core/engine.js';

// Presentation only: growth thresholds and pet-state calculations remain
// in the existing game engine. This function only chooses which supplied
// illustration to show on the main screen.
export function petStateEmotion(state) {
  const satiety = Number.isFinite(Number(state?.satiety)) ? Number(state.satiety) : 68;
  const mood = Number.isFinite(Number(state?.mood)) ? Number(state.mood) : 72;

  if (satiety < 40 || mood < 40) return 'sad';
  if (satiety >= 75 && mood >= 75) return 'happy';
  return 'neutral';
}

export function petImageUrl(state, emotion = null) {
  const stage = getPetStage(state).id;
  const requestedEmotion = emotion || petStateEmotion(state);
  const displayEmotion = ['neutral', 'thinking', 'happy', 'sad'].includes(requestedEmotion)
    ? requestedEmotion
    : 'neutral';
  return new URL(`../../assets/pets/stages/stage-${stage}-${displayEmotion}.png`, import.meta.url).href;
}

export function testPetEmotion(feedback) {
  return feedback ? (feedback.correct ? 'happy' : 'sad') : 'thinking';
}
