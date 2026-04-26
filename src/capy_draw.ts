import { CAPY_TYPES, type CapyType } from './capy_types.ts';

export interface DrawResult {
  capy: CapyType;
  isDuplicate: boolean;
  compensation: number;
}

const RARITY_WEIGHTS = {
  common: 70,
  rare: 20,
  epic: 8,
  legendary: 2
};

function getRarity(capy: CapyType): keyof typeof RARITY_WEIGHTS {
  if (capy.cost >= 7000) return 'legendary';
  if (capy.cost >= 2500) return 'epic';
  if (capy.cost >= 1200) return 'rare';
  return 'common';
}

export function drawCapybara(unlockedIds: string[]): DrawResult {
  const rand = Math.random() * 100;
  let targetRarity: keyof typeof RARITY_WEIGHTS = 'common';
  
  let cumulative = 0;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    cumulative += weight;
    if (rand <= cumulative) {
      targetRarity = rarity as keyof typeof RARITY_WEIGHTS;
      break;
    }
  }

  const pool = CAPY_TYPES.filter(c => getRarity(c) === targetRarity);
  const selected = pool[Math.floor(Math.random() * pool.length)];
  
  const isDuplicate = unlockedIds.includes(selected.id);
  // Compensation: 20% of cost if duplicate, min 100
  const compensation = isDuplicate ? Math.max(100, Math.floor(selected.cost * 0.2)) : 0;

  return {
    capy: selected,
    isDuplicate,
    compensation
  };
}
