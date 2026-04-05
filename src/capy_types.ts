export interface CapyType {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  unlockedByDefault: boolean;
  
  // Stat Bonuses
  hpBonus: number;
  damageMultiplier: number;
  cooldownReduction: number; // 0.1 = 10% faster
  speedBonus: number;
  specialAbility?: string;
}

export const CAPY_TYPES: CapyType[] = [
  {
    id: 'standard',
    name: '기본 카피바라',
    description: '평범하지만 잠재력이 무궁무진한 정글의 평화론자입니다.',
    icon: '🐾',
    cost: 0,
    unlockedByDefault: true,
    hpBonus: 0,
    damageMultiplier: 1.0,
    cooldownReduction: 0,
    speedBonus: 0,
  },
  {
    id: 'knight',
    name: '기사 카피바라',
    description: '단단한 갑옷과 용기로 무장하여 체력이 매우 높습니다.',
    icon: '🛡️',
    cost: 500,
    unlockedByDefault: false,
    hpBonus: 50,
    damageMultiplier: 1.1,
    cooldownReduction: -0.1, // Slower but stronger
    speedBonus: -0.2,
  },
  {
    id: 'wizard',
    name: '마법사 카피바라',
    description: '정글의 기운을 다루어 공격력이 높고 쿨타임이 짧습니다.',
    icon: '🧙',
    cost: 1200,
    unlockedByDefault: false,
    hpBonus: -20,
    damageMultiplier: 1.4,
    cooldownReduction: 0.15,
    speedBonus: 0.1,
  },
  {
    id: 'rich',
    name: '부자 카피바라',
    description: '황금빛 털을 가진 행운의 상징입니다. 바나나를 더 잘 모읍니다.',
    icon: '💰',
    cost: 2500,
    unlockedByDefault: false,
    hpBonus: 0,
    damageMultiplier: 1.0,
    cooldownReduction: 0,
    speedBonus: 0.2,
    specialAbility: 'banana_master', // Might use later
  },
  {
    id: 'shiny',
    name: '빛나는 카피바라',
    description: '전설적인 빛을 품은 카피바라입니다. 모든 능력치가 뛰어납니다.',
    icon: '✨',
    cost: 5000,
    unlockedByDefault: false,
    hpBonus: 100,
    damageMultiplier: 1.6,
    cooldownReduction: 0.25,
    speedBonus: 0.3,
  },
];
