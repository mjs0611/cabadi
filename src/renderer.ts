import type { Enemy, Bullet, Particle, FloatingText, PalmDrop } from './entities.ts';
import type { GameState } from './state.ts';

// ── Asset Mapping ────────────────────────────────────────────────────────────
const SPRITE_DIR = '/assets/images/sprites/';

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

const MONSTER_SHEETS = {
  normal:       SPRITE_DIR + 'monster_tier1_sheet1_normal_1775317541532.png',
  intermediate: SPRITE_DIR + 'monster_tier2_intermediate_sheet.png',
  elite:        SPRITE_DIR + 'monster_tier3_elite_sheet.png',
  boss:         SPRITE_DIR + 'monster_tier4_boss_sheet.png'
};

const UI_SHEET   = SPRITE_DIR + 'ui_decor_sheet.png';
const VFX_SHEET  = SPRITE_DIR + 'vfx_combat_sheet.png';
const CAPYBARA   = SPRITE_DIR + 'capybara_main_sprite_1775313079058.png';

const images: Record<string, HTMLImageElement> = {};
function getImg(src: string) {
  if (images[src]) return images[src];
  const img = new Image(); img.src = src; images[src] = img;
  return img;
}

// ── Render ───────────────────────────────────────────────────────────────────
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
  ctx.fillStyle = '#102015'; // Dark jungle
  ctx.fillRect(0, 0, w, h);
  drawBackgroundDecor(ctx, w, h, state.wave);

  // 2. Base Platform
  drawUI(ctx, cx, cy, 0, 140); // Base platform is index 2 (idx 0-indexed: 2)

  // 3. Capybara
  drawCapybara(ctx, cx, cy);

  // 4. Turret Orientation
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(turretAngle);
  ctx.fillStyle = 'rgba(255,200,50,0.4)';
  ctx.beginPath(); ctx.roundRect(18, -4, 28, 8, 4); ctx.fill();
  ctx.restore();

  // 5. Palm Drops
  for (const pd of palmDrops) {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(pd.x, pd.y, pd.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // 6. Enemies
  for (const e of enemies) drawEnemy(ctx, e);

  // 7. Bullets
  for (const b of bullets) drawBullet(ctx, b, state);

  // 8. Particles (VFX)
  for (const p of particles) drawParticle(ctx, p);

  // 9. Floating Texts
  for (const ft of floatingTexts) drawFloatingText(ctx, ft);
}

function drawUI(ctx: CanvasRenderingContext2D, x: number, y: number, idx: number, size: number) {
  const img = getImg(UI_SHEET);
  if (!img.complete) return;
  const sw = 1024 / 3, sh = 1024 / 2; // Assuming 3x2 grid
  const sx = (idx % 3) * sw, sy = Math.floor(idx / 3) * sh;
  ctx.drawImage(img, sx, sy, sw, sh, x - size/2, y - size/2, size, size);
}

function drawCapybara(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const img = getImg(CAPYBARA);
  const breath = Math.sin(Date.now() / 400) * 0.03;
  const size = 100;
  if (img.complete) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + breath, 1 - breath * 0.5);
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = '#c8a97e';
    ctx.beginPath(); ctx.arc(cx, cy, 22 * (1 + breath), 0, Math.PI * 2); ctx.fill();
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  // Mapping based on tier and type
  let sheet = MONSTER_SHEETS.normal;
  let idx = 0;
  
  if (e.isBoss) {
    sheet = MONSTER_SHEETS.boss;
    idx = e.type.includes('caiman') ? 0 : e.type.includes('jaguar') ? 1 : e.type.includes('anaconda') ? 2 : 3;
  } else if (e.radius > 20) { // Elite or intermediate
    sheet = e.hp > 1000 ? MONSTER_SHEETS.elite : MONSTER_SHEETS.intermediate;
    // Simple modulo mapping for variation
    idx = (e.type.length) % 6;
  } else {
    idx = (e.type.length) % 4;
  }

  const img = getImg(sheet);
  if (img.complete) {
    const cols = e.isBoss ? 2 : (sheet === MONSTER_SHEETS.normal ? 4 : 3);
    const sw = img.width / cols;
    const sh = img.height / Math.ceil(6 / cols); // Assuming total 6 or 4
    const sx = (idx % cols) * sw, sy = Math.floor(idx / cols) * sh;
    ctx.drawImage(img, sx, sy, sw, sh, e.x - e.radius * 1.5, e.y - e.radius * 1.5, e.radius * 3, e.radius * 3);
  } else {
    ctx.fillStyle = e.isBoss ? '#ffcc33' : '#ff4d6d';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
  }

  // HP Bar
  if (e.hp < e.maxHp) {
    const bw = e.radius * 2, bx = e.x - e.radius, by = e.y - e.radius - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, 5);
    ctx.fillStyle = e.status.slowed ? '#44ccff' : (e.status.poisoned ? '#aaff00' : '#ff4d6d');
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 5);
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
      const sw = img.width / 5, sh = img.height;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI/2);
      ctx.drawImage(img, idx * sw, 0, sw, sh, -b.radius*2, -b.radius*2, b.radius*4, b.radius*4);
      ctx.restore();
      return;
    }
  }
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  if (p.vfxIdx !== undefined) {
    const img = getImg(VFX_SHEET);
    if (img.complete) {
      const sw = img.width / 3, sh = img.height / 2;
      const sx = (p.vfxIdx % 3) * sw, sy = Math.floor(p.vfxIdx / 3) * sh;
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(img, sx, sy, sw, sh, p.x - p.radius * 2, p.y - p.radius * 2, p.radius * 4, p.radius * 4);
      ctx.globalAlpha = 1;
      return;
    }
  }
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawFloatingText(ctx: CanvasRenderingContext2D, ft: FloatingText) {
  const alpha = 1 - ft.life / ft.maxLife;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ft.color;
  ctx.font = 'bold 24px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(ft.text, ft.x, ft.y);
  ctx.globalAlpha = 1;
}

function drawBackgroundDecor(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.01)';
  for (let i = 0; i < 40; i++) {
    const x = (Math.sin(i * 123.45 + seed) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 678.90 + seed) * 0.5 + 0.5) * h;
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  }
}
