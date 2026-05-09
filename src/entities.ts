export interface Enemy {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  gold: number;
  dead: boolean;
  isBoss?: boolean;
  tier: string;
  idx: number;
  sheetIdx: number;
  traits: string[];
  attackType: 'melee' | 'charge' | 'ranged' | 'poison';
  attackDamage: number;
  shieldActive: boolean;    // 'shielded' 특성: 첫 타격 흡수
  level: number;
  status: {
    poisoned?: { dps: number; msLeft: number };
    slowed?: { factor: number; msLeft: number };
  };
  flashTicks: number;
  attackCooldown: number;   // ms - ranged 공격 쿨다운
  lastAttack: number;       // timestamp
}

export interface EnemyProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  radius: number;
  dead: boolean;
}

export interface Bullet {
  type: string;
  originType: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  pierce: number;
  hitEnemies: Set<Enemy>;
  dead: boolean;
  hasExplosion: boolean;
  color: string;
  isHoming?: boolean;
  homingTarget?: Enemy | null;
  pulse?: number;
  scale?: number;
  rotation?: number;
  stretch?: number;
  spiralAngle?: number;
  spiralRadius?: number;
  fuseTicks?: number;
  chainExplosionsLeft?: number;
  vfxLevel?: number;
  createdAt: number;
}

export interface PalmDrop {
  x: number;
  y: number;
  damage: number;
  radius: number;
  msLeft: number;
  exploded: boolean;
  isUltimate?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
  vfxIdx?: number;
  rotation?: number;
  stretch?: number;
  isGold?: boolean;
  targetX?: number;
  targetY?: number;
  isPoisonCloud?: boolean;
  isMushroomCloud?: boolean;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface Trap {
  id: string;
  type: 'log' | 'thorns';
  x: number;
  y: number;
  hp: number;
  radius: number;
  vx?: number;
  vy?: number;
}

export interface LuckyDrop {
  id: string;
  x: number;
  y: number;
  type: 'pelican';
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  dropped: boolean;
}

import { getEnemyForStageWave, getBossForStageWave } from './data.ts';
import { isBossWave } from './stages.ts';

export function createEnemy(
  canvasW: number,
  canvasH: number,
  wave: number,
  stage: number,
  forceBoss = false
): Enemy {
  const margin = -40;
  const x = Math.random() * canvasW;
  const y = margin;

  const isBoss = forceBoss || (isBossWave(wave) && Math.random() < 0.05); // 보스 웨이브는 별도 스폰
  const data = isBoss
    ? getBossForStageWave(stage, wave)
    : getEnemyForStageWave(stage, wave);

  const hp = data.hp;
  const hasSplit = data.traits.includes('splitting');
  const hasSwift = data.traits.includes('swift');

  // 보스는 크게, 엘리트는 중간, 일반은 작게
  let radius: number;
  if (isBoss) radius = 36;
  else if (data.tier === 'elite') radius = 16;
  else if (data.tier === 'intermediate') radius = 12;
  else radius = 9;

  // 분열형 미니 버전은 작게 생성하면 되므로 별도 처리 불필요

  let speed = data.speed / 100;
  if (hasSwift) speed *= 1.5;

  return {
    id: data.id,
    type: data.id,
    name: data.name,
    x, y,
    radius,
    hp, maxHp: hp,
    speed,
    gold: data.gold,
    dead: false,
    isBoss,
    tier: data.tier,
    idx: data.idx ?? 0,
    sheetIdx: data.sheetIdx ?? 0,
    traits: data.traits,
    attackType: data.attackType as any,
    attackDamage: data.attackDamage,
    shieldActive: data.traits.includes('shielded'),
    level: data.level,
    status: {},
    flashTicks: 0,
    attackCooldown: data.attackType === 'ranged' ? 2000 : 0,
    lastAttack: 0
  };
}

// 분열 시 생성되는 미니 적
export function createSplitEnemy(parent: Enemy): Enemy[] {
  return [0, 1].map(i => ({
    ...parent,
    id: parent.id + '_split_' + i,
    type: parent.type,
    x: parent.x + (i === 0 ? -20 : 20),
    y: parent.y,
    radius: Math.max(6, parent.radius * 0.6),
    hp: parent.maxHp * 0.4,
    maxHp: parent.maxHp * 0.4,
    speed: parent.speed * 1.2,
    gold: Math.floor(parent.gold * 0.3),
    dead: false,
    isBoss: false,
    traits: parent.traits.filter(t => t !== 'splitting'), // 분열 없음
    shieldActive: false,
    flashTicks: 0,
    status: {},
    attackCooldown: 0,
    lastAttack: 0
  }));
}

export function createBullet(fromX: number, fromY: number, toX: number, toY: number, speed: number, damage: number, pierce: number, hasExplosion: boolean, type: string, color = '#fff', scale = 1): Bullet {
  const dx = toX - fromX, dy = toY - fromY;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  return {
    type, originType: type,
    x: fromX, y: fromY,
    vx: (dx/len)*speed, vy: (dy/len)*speed,
    radius: 8 * scale,
    damage, pierce,
    hitEnemies: new Set(),
    dead: false,
    hasExplosion, color, scale,
    createdAt: Date.now()
  };
}

export function createEnemyProjectile(fromX: number, fromY: number, toX: number, toY: number, damage: number, color: string): EnemyProjectile {
  const dx = toX - fromX, dy = toY - fromY;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const speed = 4;
  return { x: fromX, y: fromY, vx: (dx/len)*speed, vy: (dy/len)*speed, damage, color, radius: 6, dead: false };
}

export function createFloatingText(x: number, y: number, text: string, color = '#fff'): FloatingText {
  return { x, y, text, color, life: 0, maxLife: 40 };
}

export function createParticle(x: number, y: number, color: string, count = 6, vfxIdx?: number): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    return {
      x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
      radius: 2 + Math.random()*3, alpha: 1, color,
      life: 0, maxLife: 20 + Math.random()*20,
      vfxIdx
    };
  });
}

export function createGoldParticle(x: number, y: number, targetX: number, targetY: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const burstSpeed = 8 + Math.random() * 8;
  return {
    x, y, vx: Math.cos(angle) * burstSpeed, vy: Math.sin(angle) * burstSpeed - 5,
    radius: 8 + Math.random() * 3, alpha: 1, color: '#ffcc33', life: 0, maxLife: 150,
    isGold: true, targetX, targetY
  };
}
