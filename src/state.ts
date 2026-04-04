import type { CapyUpgrades } from './store.ts';

export interface ActiveSkill {
  type: string;
  level: number;
  lastShot: number;
}

export interface GameState {
  hp: number;
  maxHp: number;
  wave: number;
  score: number;
  phase: 'intro' | 'playing' | 'upgrade' | 'gameover';

  activeSkills: ActiveSkill[];

  // 영구 업그레이드에서 파생된 멀티플라이어
  damageMultiplier: number;
  fireRateMultiplier: number;
  bananaMultiplier: number;

  // 이번 세션 획득 바나나
  sessionBananas: number;
}

const EXTRA_START_SKILLS = ['poison_thorn', 'coconut_bomb', 'mango_laser', 'tropical_lightning'];

export function createInitialState(upgrades: CapyUpgrades): GameState {
  const maxHp = 100 + upgrades.maxHp * 20;

  const activeSkills: ActiveSkill[] = [
    { type: 'acorn_cannon', level: 1, lastShot: 0 },
  ];
  for (let i = 0; i < Math.min(upgrades.startSkills, EXTRA_START_SKILLS.length); i++) {
    activeSkills.push({ type: EXTRA_START_SKILLS[i], level: 1, lastShot: 0 });
  }

  return {
    hp: maxHp,
    maxHp,
    wave: 1,
    score: 0,
    phase: 'intro',
    activeSkills,
    damageMultiplier: 1 + upgrades.damage * 0.1,
    fireRateMultiplier: Math.max(0.2, 1 - upgrades.fireRate * 0.05),
    bananaMultiplier: 1 + upgrades.coinBoost * 0.15,
    sessionBananas: 0,
  };
}
