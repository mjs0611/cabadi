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
  projectileColor?: string;
  projectileScale?: number;
  passiveDesc: string;
}

export const CAPY_TYPES: CapyType[] = [
  {
    id: 'standard',
    name: '기본 카피바라',
    description: '평범하지만 잠재력이 무궁무진한 정글의 평화론자입니다.',
    icon: '/assets/images/icons/capy_standard.png',
    cost: 0,
    unlockedByDefault: true,
    hpBonus: 0,
    damageMultiplier: 1.0,
    cooldownReduction: 0,
    speedBonus: 0,
    passiveDesc: '기본에 충실합니다.',
  },
  {
    id: 'knight',
    name: '기사 카피바라',
    description: '단단한 갑옷과 용기로 무장하여 체력이 매우 높습니다.',
    icon: '/assets/images/icons/capy_knight.png',
    cost: 500,
    unlockedByDefault: false,
    hpBonus: 50,
    damageMultiplier: 1.1,
    cooldownReduction: -0.1,
    speedBonus: -0.2,
    projectileColor: '#e0e0e0',
    projectileScale: 1.5,
    specialAbility: 'knockback',
    passiveDesc: '공격 시 적을 넉백시킵니다.',
  },
  {
    id: 'wizard',
    name: '마법사 카피바라',
    description: '정글의 기운을 다루어 공격력이 높고 쿨타임이 짧습니다.',
    icon: '/assets/images/icons/capy_wizard.png',
    cost: 1200,
    unlockedByDefault: false,
    hpBonus: -20,
    damageMultiplier: 1.4,
    cooldownReduction: 0.15,
    speedBonus: 0.1,
    projectileColor: '#d666ff',
    specialAbility: 'magic_blast',
    passiveDesc: '타격 시 마법 폭발이 발생합니다.',
  },
  {
    id: 'rich',
    name: '부자 카피바라',
    description: '황금빛 털을 가진 행운의 상징입니다. 바나나를 더 잘 모읍니다.',
    icon: '/assets/images/icons/capy_rich.png',
    cost: 2500,
    unlockedByDefault: false,
    hpBonus: 0,
    damageMultiplier: 1.0,
    cooldownReduction: 0,
    speedBonus: 0.2,
    projectileColor: '#ffd700',
    specialAbility: 'banana_master',
    passiveDesc: '코인 탄환을 발사하며 바나나 획득량이 증가합니다.',
  },
  {
    id: 'cyber',
    name: '사이버 카피바라',
    description: '미래 기술로 개조된 카피바라입니다. 정밀한 사격이 특징입니다.',
    icon: '/assets/images/icons/capy_cyber.png',
    cost: 3500,
    unlockedByDefault: false,
    hpBonus: 20,
    damageMultiplier: 1.2,
    cooldownReduction: 0.2,
    speedBonus: 0.1,
    projectileColor: '#00f2ff',
    specialAbility: 'laser_aim',
    passiveDesc: '모든 탄환이 유도 레이저로 변경됩니다.',
  },
  {
    id: 'ninja',
    name: '닌자 카피바라',
    description: '그림자 속에서 적을 유린하는 신속한 암살자입니다.',
    icon: '/assets/images/icons/capy_ninja.png',
    cost: 4000,
    unlockedByDefault: false,
    hpBonus: -10,
    damageMultiplier: 1.3,
    cooldownReduction: 0.3,
    speedBonus: 0.4,
    projectileColor: '#555555',
    specialAbility: 'dodge_master',
    passiveDesc: '매우 빠른 연사력과 높은 회피율을 가집니다.',
  },
  {
    id: 'nature',
    name: '대자연의 수호자',
    description: '고대 정글의 분노를 대변하는 전설적인 존재입니다.',
    icon: '/assets/images/icons/capy_nature.png',
    cost: 7000,
    unlockedByDefault: false,
    hpBonus: 80,
    damageMultiplier: 1.5,
    cooldownReduction: 0.2,
    speedBonus: 0.2,
    projectileColor: '#2ecc71',
    specialAbility: 'nature_grasp',
    passiveDesc: '공격 시 주변에 가시 덩굴을 소환합니다.',
  },
  {
    id: 'shiny',
    name: '빛나는 카피바라',
    description: '전설적인 빛을 품은 카피바라입니다. 모든 능력치가 뛰어납니다.',
    icon: '/assets/images/icons/capy_shiny.png',
    cost: 10000,
    unlockedByDefault: false,
    hpBonus: 100,
    damageMultiplier: 1.8,
    cooldownReduction: 0.3,
    speedBonus: 0.3,
    projectileColor: '#ffffff',
    specialAbility: 'holy_stun',
    passiveDesc: '모든 공격에 강력한 스턴 효과가 동반됩니다.',
  },
];
