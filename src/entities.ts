export interface Enemy {
  id: string;
  type: string;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  gold: number;
  dead: boolean;
  isBoss?: boolean;
  status: {
    poisoned?: { dps: number; msLeft: number };
    slowed?: { factor: number; msLeft: number };
  };
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
}

export interface PalmDrop {
  x: number;
  y: number;
  damage: number;
  radius: number;
  msLeft: number;
  exploded: boolean;
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
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

import { getRandomMonster } from './data.ts';

export function createEnemy(canvasW: number, canvasH: number, wave: number): Enemy {
  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  const margin = -40;
  if (side === 0) { x = Math.random() * canvasW; y = margin; }
  else if (side === 1) { x = canvasW - margin; y = Math.random() * canvasH; }
  else if (side === 2) { x = Math.random() * canvasW; y = canvasH - margin; }
  else { x = margin; y = Math.random() * canvasH; }

  const data = getRandomMonster(wave);
  const hp = (data.hp + wave * 5) * (data.isBoss ? 10 : 1);
  return {
    id: data.id,
    type: data.id,
    x, y,
    radius: data.isBoss ? 50 : (data.hp > 300 ? 24 : 18),
    hp, maxHp: hp,
    speed: data.speed / 100,
    gold: data.gold,
    dead: false,
    isBoss: data.isBoss,
    status: {}
  };
}

export function createBullet(fromX: number, fromY: number, toX: number, toY: number, speed: number, damage: number, pierce: number, hasExplosion: boolean, type: string, color = '#fff'): Bullet {
  const dx = toX - fromX, dy = toY - fromY;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  return {
    type, originType: type,
    x: fromX, y: fromY,
    vx: (dx/len)*speed, vy: (dy/len)*speed,
    radius: 8,
    damage, pierce,
    hitEnemies: new Set(),
    dead: false,
    hasExplosion, color
  };
}

export function createFloatingText(x: number, y: number, text: string, color = '#fff'): FloatingText {
  return { x, y, text, color, life: 0, maxLife: 40 };
}

export function createParticle(x: number, y: number, color: string, count = 6): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    return {
      x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
      radius: 2 + Math.random()*3, alpha: 1, color,
      life: 0, maxLife: 20 + Math.random()*20
    };
  });
}
