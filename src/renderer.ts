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
  normal:       SPRITE_DIR + 'monsters_v5.png',
  intermediate: SPRITE_DIR + 'monsters_v5.png',
  elite:        SPRITE_DIR + 'monsters_v5.png',
  boss:         SPRITE_DIR + 'monsters_v5.png'
};

const UI_SHEET   = SPRITE_DIR + 'ui_decor_sheet.png';
const VFX_SHEET  = SPRITE_DIR + 'vfx_combat_sheet.png';
const CAPYBARA   = SPRITE_DIR + 'hero_v5.png';
const MONSTER_PREM_1 = SPRITE_DIR + 'monster_premium_tier1.png';

const THEMES: Record<string, { bg: string; overlay: string; decor: string }> = {
  jungle: { bg: '/assets/images/stage_bg_cute_v2.png', overlay: 'rgba(255,255,255,0.05)', decor: 'jungle' },
  oasis:  { bg: '/assets/images/stage_bg_oasis.png', overlay: 'rgba(255,240,200,0.1)', decor: 'oasis' },
  ruins:  { bg: '/assets/images/stage_bg_ruins.png', overlay: 'rgba(200,200,250,0.1)', decor: 'ruins' }
};

function getTheme(wave: number) {
  if (wave <= 10) return THEMES.jungle;
  if (wave <= 20) return THEMES.oasis;
  return THEMES.ruins;
}

const imageCache: Record<string, HTMLImageElement | HTMLCanvasElement> = {};
const patternCache: Record<string, CanvasPattern> = {};
const processing: Record<string, boolean> = {};

function getImg(src: string): HTMLImageElement | HTMLCanvasElement {
  if (imageCache[src]) return imageCache[src];
  if (processing[src]) {
    const img = new Image(); img.src = src; return img;
  }
  
  processing[src] = true;
  const img = new Image(); 
  img.src = src; 
  
  img.onload = () => {
    // Process sprites and sheets to remove solid backgrounds
    if (src.includes('sprites') || src.includes('sheet')) {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          
          // Commercial Grade Chromakey: Remove Magenta (#FF00FF)
          // Also handle subtle variations (fringing)
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2];
            
            // Magenta detection: High R, High B, Low G
            // We also detect "nearly white" as a fallback for older assets
            const isMagenta = r > 180 && b > 180 && g < 150;
            const isWhite = r > 240 && g > 240 && b > 240;

            if (isMagenta || isWhite) {
              data[i+3] = 0;
            }
          }

          // Edge Smoothing (Smoothing any leftover magenta fringe)
          const w = canvas.width, h = canvas.height;
          const alphaCopy = new Uint8ClampedArray(data.length / 4);
          for (let i = 0; i < data.length; i += 4) alphaCopy[i/4] = data[i+3];

          for (let y = 1; y < h-1; y++) {
            for (let x = 1; x < w-1; x++) {
              const idx = (y * w + x);
              if (alphaCopy[idx] > 0) {
                // If any neighbor is transparent, this is an edge
                const neighbors = [
                  alphaCopy[idx-1], alphaCopy[idx+1], 
                  alphaCopy[idx-w], alphaCopy[idx+w]
                ];
                if (neighbors.some(a => a === 0)) {
                  // Clean fringe: If the current pixel has a magenta tint, kill it
                  const p4 = idx * 4;
                  if (data[p4] > data[p4+1] + 20 && data[p4+2] > data[p4+1] + 20) {
                    data[p4+3] = 0;
                  }
                }
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
          imageCache[src] = canvas;
        } catch(e) {
          imageCache[src] = img;
        }
      }
    } else {
      imageCache[src] = img;
    }
    delete processing[src];
  };
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
  boss: Enemy | null
) {
  const cx = w / 2, cy = h / 2;
  const canvasW = w;

  // 1. Background (Theme-Based)
  const theme = getTheme(state.wave);
  const bgImg = getImg(theme.bg);
  const isBGLoaded = bgImg instanceof HTMLCanvasElement || (bgImg instanceof HTMLImageElement && bgImg.complete);
  
  if (isBGLoaded) {
    if (!patternCache[theme.bg]) {
      const pat = ctx.createPattern(bgImg as CanvasImageSource, 'repeat');
      if (pat) patternCache[theme.bg] = pat;
    }
    
    if (patternCache[theme.bg]) {
      ctx.fillStyle = patternCache[theme.bg];
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#f0f8ff'; ctx.fillRect(0, 0, w, h);
    }
  } else {
    ctx.fillStyle = '#f0f8ff'; ctx.fillRect(0, 0, w, h);
  }
  // Darken overlay specialized per theme
  ctx.fillStyle = theme.overlay;
  ctx.fillRect(0, 0, w, h);
  drawBackgroundDecor(ctx, w, h, state.wave, theme.decor);

  // 2. Base Platform (Index 2 in 3x3 UI sheet is the Platform)
  drawUI(ctx, cx, cy, 2, 80);

  // 3. Capybara
  drawCapybara(ctx, cx, cy, state);

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
  for (const e of enemies) drawEnemy(ctx, e, canvasW);

  // 7. Bullets
  for (const b of bullets) drawBullet(ctx, b, state);

  // 8. Particles (VFX)
  for (const p of particles) drawParticle(ctx, p);

  // 9. Floating Texts
  for (const ft of floatingTexts) drawFloatingText(ctx, ft);
}

function drawUI(ctx: CanvasRenderingContext2D, x: number, y: number, idx: number, size: number) {
  const img = getImg(UI_SHEET);
  const isLoaded = img instanceof HTMLCanvasElement || (img instanceof HTMLImageElement && img.complete);
  if (!isLoaded) return;
  
  // Visual inspection: 3x3 grid on a 640x640 sheet
  const sw = img.width / 3, sh = img.height / 3;
  const sx = (idx % 3) * sw, sy = Math.floor(idx / 3) * sh;
  
  // Tighten crop to avoid text/borders
  const insetW = sw * 0.1, insetH = sh * 0.1;
  const finalSX = sx + insetW, finalSY = sy + insetH;
  const finalSW = sw - insetW * 2, finalSH = sh - insetH * 2;
  
  ctx.drawImage(img, finalSX, finalSY, finalSW, finalSH, x - size/2, y - size/2, size, size);
}

function drawCapybara(ctx: CanvasRenderingContext2D, cx: number, cy: number, state: GameState) {
  const img = getImg(CAPYBARA);
  
  // Add recoil animation if recently fired a skill
  let recoilX = 0;
  let recoilY = 0;
  let maxRecentScale = 1;
  const now = Date.now();
  for (const sk of state.activeSkills) {
    const timeSinceShot = now - sk.lastShot;
    if (timeSinceShot < 100) {
      maxRecentScale = Math.max(maxRecentScale, 1.15 - (timeSinceShot/100)*0.15);
      recoilY += 2; // slight push down
    }
  }

  // Exaggerated breath and recoil (Squash and Stretch)
  const breath = Math.sin(Date.now() / 200) * 0.08;
  const size = 60 * maxRecentScale; 
  const isLoaded = img instanceof HTMLCanvasElement || (img instanceof HTMLImageElement && img.complete);
  if (isLoaded) {
    ctx.save();
    ctx.translate(cx + recoilX, cy + Math.sin(Date.now()/300)*5 + recoilY);
    // Extra squash and stretch
    ctx.scale(1 + breath, 1 - breath * 0.8);
    
    // Simple derpy capy is usually full-frame or centered
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = '#c8a97e';
    ctx.beginPath(); ctx.arc(cx, cy, 22 * (1 + breath), 0, Math.PI * 2); ctx.fill();
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, canvasW: number) {
  // Mapping based on tier and type
  let sheet = MONSTER_SHEETS.normal;
  let idx = 0;
  
  if (e.isBoss) {
    sheet = MONSTER_SHEETS.boss;
    idx = e.type.includes('caiman') ? 0 : e.type.includes('jaguar') ? 1 : e.type.includes('anaconda') ? 2 : 3;
  } else if (e.type === 'poison_frog' || e.type === 'toucan' || e.type === 'turtle') {
    sheet = MONSTER_PREM_1;
    idx = e.type === 'poison_frog' ? 0 : e.type === 'toucan' ? 1 : 2;
  } else if (e.radius > 20) {
    sheet = e.hp > 1000 ? MONSTER_SHEETS.elite : MONSTER_SHEETS.intermediate;
    idx = (e.type.length) % 4;
  } else {
    idx = (e.type.length) % 16;
  }

  const img = getImg(sheet);
  const isLoaded = img instanceof HTMLCanvasElement || (img instanceof HTMLImageElement && img.complete);
  if (isLoaded) {
    let sx = 0, sy = 0, sw = img.width, sh = img.height;

    if (sheet === MONSTER_SHEETS.normal || sheet === MONSTER_SHEETS.intermediate || sheet === MONSTER_SHEETS.elite || sheet === MONSTER_SHEETS.boss) {
      sw = img.width / 4; sh = img.height / 4;
      sx = (idx % 4) * sw; sy = Math.floor(idx / 4) * sh;
    } else if (sheet === MONSTER_PREM_1) {
      sw = img.width / 3; sh = img.height; 
      sx = idx * sw; sy = 0;
    }
    
    const insetW = sw * 0.05, insetH = sh * 0.05; // Tighten inset for clean assets
    const finalSX = sx + insetW, finalSY = sy + insetH;
    const finalSW = sw - insetW * 2, finalSH = sh - insetH * 2;
    
    const drawRadius = e.radius * 2.5; // Slightly larger for better detail
    
    const walkSpeed = e.speed * 100;
    const isWalking = !e.status.slowed || e.status.slowed.factor > 0.1;
    const timeOffset = e.id.charCodeAt(0) * 10;
    
    // Enhanced Squash and Stretch based on walk cycle
    const walkPhase = Date.now() / (120 - walkSpeed/2) + timeOffset;
    const walkBounce = isWalking ? Math.abs(Math.sin(walkPhase)) * (e.radius * 0.5) : 0;
    const squash = isWalking ? Math.sin(walkPhase * 2) * 0.15 : 0; // Stretch vertically when moving up, squash when landing

    ctx.save();
    ctx.translate(e.x, e.y - walkBounce);
    
    const hitScale = e.flashTicks > 0 ? 1.2 : 1;
    ctx.scale((e.x > canvasW / 2 ? 1 : -1) * (1 + squash) * hitScale, (1 - squash * 0.5) * hitScale);
    
    ctx.drawImage(img, finalSX, finalSY, finalSW, finalSH, -drawRadius, -drawRadius, drawRadius * 2, drawRadius * 2);

    if (e.flashTicks > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(-drawRadius, -drawRadius, drawRadius * 2, drawRadius * 2);
      ctx.restore();
    }
    ctx.restore();
  } else {
    ctx.fillStyle = e.isBoss ? '#ffcc33' : '#ff4d6d';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
  }

  // HP Bar
  // Draw HP Bar
  if (e.hp < e.maxHp) {
    const w = e.radius * 2;
    const barX = e.x - e.radius;
    const barY = e.y - e.radius - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, w, 5);
    ctx.fillStyle = e.status.slowed ? '#44ccff' : e.status.poisoned ? '#aaff00' : '#ff4d6d';
    ctx.fillRect(barX, barY, w * (e.hp / e.maxHp), 5);
  }
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet, state: GameState) {
  const skill = state.activeSkills.find(s => s.type === b.originType);
  const lv = skill ? skill.level : 1;
  const sheets = SKILL_SHEETS[b.originType];

  if (sheets) {
    const isS1 = lv <= 5;
    const img = getImg(isS1 ? sheets.s1 : sheets.s2);
    const isLoaded = img instanceof HTMLCanvasElement || (img instanceof HTMLImageElement && img.complete);
    if (!isLoaded) return;
    const idx = (lv - 1) % 5;
    const sw = img.width / 5, sh = img.height;
    
    ctx.save();
    ctx.translate(b.x, b.y);
    
    // Rotation & Scaling
    if (b.rotation !== undefined) {
      ctx.rotate(b.rotation);
    } else {
      ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
    }

    let scaleX = 1, scaleY = 1;
    if (b.stretch !== undefined) {
      scaleY = b.stretch;
      scaleX = 1 / Math.sqrt(b.stretch); // Preserve area roughly
    }
    if (b.pulse !== undefined) {
      scaleX *= b.pulse;
      scaleY *= b.pulse;
    }
    ctx.scale(scaleX, scaleY);

    ctx.scale(scaleX, scaleY);

    // Apply character-specific tint
    ctx.drawImage(img, idx * sw, 0, sw, sh, -b.radius * 2, -b.radius * 2, b.radius * 4, b.radius * 4);
    
    // Tint overlay
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const color = b.color || '#fff';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4; // 40% tint
    ctx.fillRect(-b.radius * 2, -b.radius * 2, b.radius * 4, b.radius * 4);
    ctx.restore();

    ctx.restore();

    // Trails for high level
    if (lv >= 7) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x - b.vx * 2, b.y - b.vy * 2, b.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
    return;
  }
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.rotation !== undefined) ctx.rotate(p.rotation);
  if (p.stretch !== undefined) ctx.scale(1, p.stretch);
  
  if (p.isGold && p.targetX !== undefined && p.targetY !== undefined) {
    if (p.life < 25) {
      // Burst phase: apply gravity and friction
      p.vx *= 0.9;
      p.vy += 0.5;
    } else {
      // Collect animation: home toward target
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const speed = 25; // faster homing
      p.vx += (dx/dist * speed - p.vx) * 0.2;
      p.vy += (dy/dist * speed - p.vy) * 0.2;
    }
    
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * (1 + Math.sin(p.life*0.5)*0.3), 0, Math.PI * 2);
    ctx.fill();
    // Add a small glint
    ctx.fillStyle = '#fff9d8';
    ctx.beginPath(); ctx.arc(-p.radius/3, -p.radius/3, p.radius/3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  
  if (p.vfxIdx !== undefined) {
    const img = getImg(VFX_SHEET);
    const isLoaded = img instanceof HTMLCanvasElement || (img instanceof HTMLImageElement && img.complete);
    if (isLoaded) {
      const sw = img.width / 3, sh = img.height / 2;
      const sx = (p.vfxIdx % 3) * sw, sy = Math.floor(p.vfxIdx / 3) * sh;
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(img, sx, sy, sw, sh, -p.radius * 2, -p.radius * 2, p.radius * 4, p.radius * 4);
      ctx.restore();
      return;
    }
  }
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFloatingText(ctx: CanvasRenderingContext2D, ft: FloatingText) {
  const alpha = 1 - Math.pow(ft.life / ft.maxLife, 2); // Fade out later
  
  // Pop-out and arc animation
  const progress = ft.life / ft.maxLife;
  const popScale = ft.life < 5 ? 1 + (ft.life / 5) * 0.5 : 1.5 - ((ft.life - 5) / ft.maxLife) * 0.5;
  const arcX = Math.sin(progress * Math.PI) * 20; // Slight arc

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(ft.x + arcX, ft.y);
  ctx.scale(popScale, popScale);
  ctx.fillStyle = ft.color;
  ctx.font = 'bold 24px "Jua", sans-serif';
  ctx.textAlign = 'center';
  
  // Add thick outline for cute commercial look
  ctx.strokeStyle = '#332211';
  ctx.lineWidth = 4;
  ctx.strokeText(ft.text, 0, 0);
  ctx.fillText(ft.text, 0, 0);
  ctx.restore();
}

function drawBackgroundDecor(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, style: string) {
  const now = Date.now();
  
  // Floating motes/stars
  ctx.fillStyle = style === 'oasis' ? 'rgba(255,200,50,0.15)' : 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 30; i++) {
    const timeOffset = (now / 3000) * (i % 2 === 0 ? 1 : -1);
    const x = ((Math.sin(i * 123.45 + seed) * 0.5 + 0.5 + timeOffset) * w) % w;
    const y = ((Math.cos(i * 678.90 + seed) * 0.5 + 0.5 + timeOffset * 0.5) * h) % h;
    const s = Math.abs(Math.sin(now / 1000 + i)) * (style === 'ruins' ? 4 : 2) + 1;
    ctx.beginPath(); ctx.arc(x >= 0 ? x : x + w, y >= 0 ? y : y + h, s, 0, Math.PI * 2); ctx.fill();
  }

  // Theme-specific silhouettes
  if (style === 'jungle') {
    ctx.fillStyle = 'rgba(0, 20, 10, 0.3)';
    for (let i = 0; i < 6; i++) {
      const x = (i / 6) * w;
      const h2 = 100 + Math.sin(now / 2000 + i) * 20;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + 20, h2 / 2, x, h2); ctx.lineTo(x - 5, h2); ctx.lineTo(x - 5, 0); ctx.fill();
    }
  } else if (style === 'oasis') {
    ctx.fillStyle = 'rgba(255, 180, 0, 0.1)';
    for (let i = 0; i < 4; i++) {
       const x = ((i * 300 + now/50) % (w + 200)) - 100;
       ctx.beginPath(); ctx.arc(x, h * 0.8, 150, 0, Math.PI * 2); ctx.fill();
    }
  } else if (style === 'ruins') {
    ctx.fillStyle = 'rgba(100, 100, 130, 0.2)';
    ctx.fillRect(0, 0, w, 40); ctx.fillRect(0, h - 40, w, 40);
  }
}
