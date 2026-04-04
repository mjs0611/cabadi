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
];
