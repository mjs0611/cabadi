import type { CapyUpgrades } from './store.ts';
import { CAPY_TYPES } from './capy_types.ts';

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
  critChance: number;
  lifeStealChance: number;
  reflectPercent: number;
  adBuffActive: boolean;

  // 이번 세션 획득 바나나
  sessionBananas: number;

  // 메타 정보
  unlockedSkills: string[];
  startingSkillId: string;
  selectedCapyType: string;
}

const EXTRA_START_SKILLS = ['poison_thorn', 'coconut_bomb', 'mango_laser', 'tropical_lightning'];

export function createInitialState(upgrades: CapyUpgrades): GameState {
  const capyType = CAPY_TYPES.find(t => t.id === upgrades.selectedCapyType) || CAPY_TYPES[0];
  const maxHp = 100 + upgrades.maxHp * 20 + capyType.hpBonus;

  // Initial skills based on starting skill
  const startingSkillId = upgrades.startingSkillId || 'acorn_cannon';
  const unlockedSkills = upgrades.unlockedSkills || ['acorn_cannon'];
  
  const activeSkills: ActiveSkill[] = [
    { type: startingSkillId, level: 1, lastShot: 0 },
  ];
  // If user has extra start slots (legacy compatibility)
  for (let i = 0; i < Math.min(upgrades.startSkills, EXTRA_START_SKILLS.length); i++) {
    const type = EXTRA_START_SKILLS[i];
    if (type !== startingSkillId) {
      activeSkills.push({ type, level: 1, lastShot: 0 });
    }
  }

  return {
    hp: maxHp,
    maxHp,
    wave: 1,
    score: 0,
    phase: 'intro',
    activeSkills,
    damageMultiplier: (1 + upgrades.damage * 0.1) * capyType.damageMultiplier,
    fireRateMultiplier: Math.max(0.2, (1 - upgrades.fireRate * 0.05) * (1 - capyType.cooldownReduction)),
    bananaMultiplier: 1 + upgrades.coinBoost * 0.15 + (capyType.id === 'rich' ? 0.2 : 0),
    critChance: upgrades.critChance * 0.03,
    lifeStealChance: upgrades.lifeSteal * 0.05,
    reflectPercent: upgrades.reflect * 0.1,
    adBuffActive: false,
    sessionBananas: 0,
    unlockedSkills,
    startingSkillId,
    selectedCapyType: upgrades.selectedCapyType,
  };
}
