import type { CapyUpgrades } from './store.ts';

export interface ShopItem {
  id: keyof CapyUpgrades;
  icon: string;
  name: string;
  effectPerLevel: string;
  maxLevel: number;
  cost: (currentLevel: number) => number;
}

export const CAPY_SHOP: ShopItem[] = [
  {
    id: 'maxHp',
    icon: '💪',
    name: '두꺼운 털가죽',
    effectPerLevel: '최대 HP +20',
    maxLevel: 10,
    cost: (lv) => (lv + 1) * 50,
  },
  {
    id: 'damage',
    icon: '🌰',
    name: '단단한 도토리',
    effectPerLevel: '데미지 +10%',
    maxLevel: 10,
    cost: (lv) => (lv + 1) * 80,
  },
  {
    id: 'fireRate',
    icon: '⚡',
    name: '빠른 발차기',
    effectPerLevel: '쿨타임 -5%',
    maxLevel: 8,
    cost: (lv) => (lv + 1) * 100,
  },
  {
    id: 'startSkills',
    icon: '🎯',
    name: '정글 훈련',
    effectPerLevel: '시작 스킬 슬롯 +1',
    maxLevel: 4,
    cost: (lv) => [200, 500, 1000, 2000][lv] ?? 9999,
  },
  {
    id: 'coinBoost',
    icon: '🍌',
    name: '바나나 농장',
    effectPerLevel: '바나나 획득 +15%',
    maxLevel: 5,
    cost: (lv) => (lv + 1) * 150,
  },
  {
    id: 'critChance',
    icon: '💥',
    name: '날카로운 발톱',
    effectPerLevel: '치명타 확률 +3%',
    maxLevel: 10,
    cost: (lv) => (lv + 1) * 120,
  },
  {
    id: 'lifeSteal',
    icon: '❤️‍🩹',
    name: '흡혈 식물',
    effectPerLevel: '처치 시 HP 회복 기회 +5%',
    maxLevel: 5,
    cost: (lv) => (lv + 1) * 200,
  },
  {
    id: 'reflect',
    icon: '🛡️',
    name: '가시 넝쿨',
    effectPerLevel: '데미지 반사 +10%',
    maxLevel: 5,
    cost: (lv) => (lv + 1) * 180,
  },
];
