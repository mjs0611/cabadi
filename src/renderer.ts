import type { Enemy, Bullet, Particle, FloatingText, PalmDrop } from './entities.ts';
import type { GameState } from './state.ts';

const SPRITE_DIR = './assets/images/sprites/';

const SKILL_SHEETS: Record<string, { s1: string; s2: string }> = {
  acorn_cannon: { s1: SPRITE_DIR + 'acorn_cannon_lv1_5_sheet_1775317224250.png', s2: SPRITE_DIR + 'acorn_cannon_lv6_10_sheet_1775317241980.png' },
  poison_thorn: { s1: SPRITE_DIR + 'poison_thorn_lv1_5_sheet_1775317261744.png', s2: SPRITE_DIR + 'poison_thorn_lv6_10_sheet_1775317284229.png' },
  coconut_bomb: { s1: SPRITE_DIR + 'coconut_bomb_lv1_5_sheet_1775317309885.png', s2: SPRITE_DIR + 'coconut_bomb_lv6_10_sheet_1775317327984.png' },
  mango_laser: { s1: SPRITE_DIR + 'mango_laser_lv1_5_sheet_1775317346447.png', s2: SPRITE_DIR + 'mango_laser_lv6_10_sheet_1775317366004.png' },
  homing_seed: { s1: SPRITE_DIR + 'homing_seed_lv1_5_sheet_1775317390351.png', s2: SPRITE_DIR + 'homing_seed_lv6_10_sheet_1775317410814.png' },
  mud_artillery: { s1: SPRITE_DIR + 'mud_artillery_lv1_5_sheet_1775317432087.png', s2: SPRITE_DIR + 'mud_artillery_lv6_10_sheet_1775317449589.png' },
  tropical_lightning: { s1: SPRITE_DIR + 'tropical_lightning_lv1_5_sheet_1775317471272.png', s2: SPRITE_DIR + 'tropical_lightning_lv6_10_sheet_1775317485980.png' },
  palm_fall: { s1: SPRITE_DIR + 'palm_fall_lv1_5_sheet_1775317501145.png', s2: SPRITE_DIR + 'palm_fall_lv6_10_sheet_1775317517346.png' }
};

const MONSTER_SHEET = SPRITE_DIR + 'monster_tier1_sheet1_normal_1775317541532.png';
const CAPYBARA_SPRITE = SPRITE_DIR + 'capybara_main_sprite_1775313079058.png';

const images: Record<string, HTMLImageElement> = {};
function getImg(src: string) {
  if (images[src]) return images[src];
  const img = new Image(); img.src = src; images[src] = img;
  return img;
}

export function render(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  enemies: Enemy[],
  bullets: Bullet[],
  particles: Particle[],
  floatingTexts: FloatingText[],
  palmDrops: PalmDrop[],
  state: GameState,
  turretAngle: number,
  boss: Enemy | null,
) {
  const cx = w / 2, cy = h / 2;

  // 1. Background
  ctx.fillStyle = '#0a1a0f';
  ctx.fillRect(0, 0, w, h);
  drawBackgroundDecor(ctx, w, h, state.wave);

  // 2. Base & Capybara
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  drawCapybara(ctx, cx, cy);

  // Turret
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(turretAngle);
  ctx.fillStyle = 'rgba(255,165,0,0.3)';
  ctx.beginPath(); ctx.roundRect(15, -4, 25, 8, 4); ctx.fill();
  ctx.restore();

  // 3. Palm Drops (Shadows/Warning)
  for (const pd of palmDrops) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.arc(pd.x, pd.y, pd.radius, 0, Math.PI * 2); ctx.fill();
  }

  // 4. Enemies
  for (const e of enemies) {
    drawEnemy(ctx, e);
  }

  // 5. Bullets
  for (const b of bullets) {
    drawBullet(ctx, b, state);
  }

  // 6. Particles
  for (const p of particles) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 7. Floating Texts
  for (const ft of floatingTexts) {
    drawFloatingText(ctx, ft);
  }
}

function drawCapybara(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const img = getImg(CAPYBARA_SPRITE);
  const size = 100;
  if (img.complete) {
    ctx.drawImage(img, cx - size/2, cy - size/2, size, size);
  } else {
    ctx.fillStyle = '#c8a97e';
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  const img = getImg(MONSTER_SHEET);
  if (img.complete) {
    const idx = (e.type.includes('snake') ? 0 : e.type.includes('frog') ? 1 : e.type.includes('bat') ? 2 : 3) % 4;
    const sw = 160, sh = 160;
    ctx.drawImage(img, idx * sw, 0, sw, sh, e.x - e.radius * 1.5, e.y - e.radius * 1.5, e.radius * 3, e.radius * 3);
  } else {
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
  }

  if (e.hp < e.maxHp) {
    const bw = e.radius * 2, bx = e.x - e.radius, by = e.y - e.radius - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = '#aaff00'; ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 4);
  }
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet, state: GameState) {
  const skill = state.activeSkills.find(s => s.type === b.originType);
  const lv = skill ? skill.level : 1;
  const sheets = SKILL_SHEETS[b.originType];

  if (sheets) {
    const isS1 = lv <= 5;
    const img = getImg(isS1 ? sheets.s1 : sheets.s2);
    if (img.complete) {
      const idx = (lv - 1) % 5;
      const sw = 128, sh = 128;
      ctx.save();
      ctx.translate(b.x, b.y);
      const angle = Math.atan2(b.vy, b.vx);
      ctx.rotate(angle + Math.PI/2);
      ctx.drawImage(img, idx * sw, 0, sw, sh, -b.radius*2, -b.radius*2, b.radius*4, b.radius*4);
      ctx.restore();
      return;
    }
  }
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
}

function drawFloatingText(ctx: CanvasRenderingContext2D, ft: FloatingText) {
  const alpha = 1 - ft.life / ft.maxLife;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ft.color;
  ctx.font = 'bold 24px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(ft.text, ft.x, ft.y);
  ctx.globalAlpha = 1;
}

function drawBackgroundDecor(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.015)';
  for (let i = 0; i < 30; i++) {
    const x = (Math.sin(i * 123.45 + seed) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 678.90 + seed) * 0.5 + 0.5) * h;
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  }
}
