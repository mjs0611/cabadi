import type { Enemy, Bullet, Particle, FloatingText, PalmDrop, Trap, EnemyProjectile } from './entities.ts';
import type { GameState } from './state.ts';
import { getStage } from './stages.ts';
import { CAPY_TYPES } from './capy_types.ts';

// ── Asset Mapping ────────────────────────────────────────────────────────────
const SPRITE_DIR = '/assets/images/sprites/';

export async function processChromakeyURL(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve(src); return; }
      
      ctx.drawImage(img, 0, 0);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          const w = canvas.width, h = canvas.height;
          
          // Sample all 4 corners to detect background
          const corners2 = [0, w-1, (h-1)*w, (h-1)*w+(w-1)];
          let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
          for (const ci of corners2) {
            const a = data[ci*4+3];
            if (a > 0) { bgR = data[ci*4]; bgG = data[ci*4+1]; bgB = data[ci*4+2]; bgA = a; break; }
          }

          const isMagentaBg = bgA > 0 && bgR > 200 && bgB > 200 && bgG < 150;
          const isWhiteBg = bgA > 0 && bgR > 240 && bgG > 240 && bgB > 240;
          const isGrayBg = bgA > 0 && bgR > 100 && bgR < 250 && Math.abs(bgR - bgG) < 20 && Math.abs(bgG - bgB) < 20;

          if (isMagentaBg || isWhiteBg || isGrayBg) {
            const visited2 = new Uint8Array(w * h);
            const queue2: number[] = [];

            function enqueue2(idx: number) {
              if (idx < 0 || idx >= w * h || visited2[idx]) return;
              visited2[idx] = 1;
              queue2.push(idx);
            }

            for (let x = 0; x < w; x++) { enqueue2(x); enqueue2((h-1)*w+x); }
            for (let y = 1; y < h-1; y++) { enqueue2(y*w); enqueue2(y*w+w-1); }
            const step2 = Math.max(4, Math.floor(Math.min(w, h) / 16));
            for (let gy = step2; gy < h; gy += step2)
              for (let gx = step2; gx < w; gx += step2) enqueue2(gy*w+gx);

            let qi2 = 0;
            while (qi2 < queue2.length) {
              const idx = queue2[qi2++];
              const p = idx * 4;
              const r = data[p], g = data[p+1], b = data[p+2], a = data[p+3];
              if (a === 0) continue;

              const isWhite = r > 235 && g > 235 && b > 235;
              const isGray = r > 150 && r < 245 && g > 150 && g < 245 && b > 150 && b < 245 && Math.abs(r-g) < 25 && Math.abs(g-b) < 25;
              const isMagenta = r > 180 && b > 180 && g < 150;

              if (isWhite || isGray || isMagenta) {
                data[p+3] = 0;
                const x = idx % w, y = Math.floor(idx / w);
                if (x > 0) enqueue2(idx-1);
                if (x < w-1) enqueue2(idx+1);
                if (y > 0) enqueue2(idx-w);
                if (y < h-1) enqueue2(idx+w);
              }
            }
            
            // Fringe Cleaning
            const cleanedData = new Uint8ClampedArray(data);
            for (let y = 1; y < h - 1; y++) {
              for (let x = 1; x < w - 1; x++) {
                const idx = y * w + x;
                const p = idx * 4;
                if (data[p + 3] === 0) continue; 
                
                if (data[(idx - 1)*4 + 3] === 0 || data[(idx + 1)*4 + 3] === 0 || 
                    data[(idx - w)*4 + 3] === 0 || data[(idx + w)*4 + 3] === 0) {
                   
                   const r = data[p], g = data[p+1], b = data[p+2];
                   const isFringeWhite = r > 230 && g > 230 && b > 230;
                   const isFringeGray = r > 160 && r < 240 && g > 160 && g < 240 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20;
                   const isFringeMagenta = r > 180 && b > 180 && g < 150;
                   
                   if (isFringeWhite || isFringeGray || isFringeMagenta) {
                      cleanedData[p + 3] = 0;
                   }
                }
              }
            }
            ctx.putImageData(new ImageData(cleanedData, w, h), 0, 0);
          } else {
             // Not a known background, keep original
             ctx.putImageData(imgData, 0, 0);
          }
        resolve(canvas.toDataURL());
      } catch(e) {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
  });
}

const SKILL_SHEETS_MAP: Record<string, { lv1_5: string, lv6_10: string }> = {
  acorn_cannon: { lv1_5: SPRITE_DIR + 'acorn_cannon_lv1_5_sheet_1775317224250.png', lv6_10: SPRITE_DIR + 'acorn_cannon_lv6_10_sheet_1775317241980.png' },
  coconut_bomb: { lv1_5: SPRITE_DIR + 'coconut_bomb_lv1_5_sheet_1775317309885.png', lv6_10: SPRITE_DIR + 'coconut_bomb_lv6_10_sheet_1775317327984.png' },
  homing_seed: { lv1_5: SPRITE_DIR + 'homing_seed_lv1_5_sheet_1775317390351.png', lv6_10: SPRITE_DIR + 'homing_seed_lv6_10_sheet_1775317410814.png' },
  mango_laser: { lv1_5: SPRITE_DIR + 'mango_laser_lv1_5_sheet_1775317346447.png', lv6_10: SPRITE_DIR + 'mango_laser_lv6_10_sheet_1775317366004.png' },
  mud_artillery: { lv1_5: SPRITE_DIR + 'mud_artillery_lv1_5_sheet_1775317432087.png', lv6_10: SPRITE_DIR + 'mud_artillery_lv6_10_sheet_1775317449589.png' },
  palm_fall: { lv1_5: SPRITE_DIR + 'palm_fall_lv1_5_sheet_1775317501145.png', lv6_10: SPRITE_DIR + 'palm_fall_lv6_10_sheet_1775317517346.png' },
  poison_thorn: { lv1_5: SPRITE_DIR + 'poison_thorn_lv1_5_sheet_1775317261744.png', lv6_10: SPRITE_DIR + 'poison_thorn_lv6_10_sheet_1775317284229.png' },
  tropical_lightning: { lv1_5: SPRITE_DIR + 'tropical_lightning_lv1_5_sheet_1775317471272.png', lv6_10: SPRITE_DIR + 'tropical_lightning_lv6_10_sheet_1775317485980.png' }
};

const MONSTER_SHEETS = {
  normal:       SPRITE_DIR + 'monsters_v6.png',
  intermediate: SPRITE_DIR + 'monster_tier2_intermediate_sheet.png',
  elite:        SPRITE_DIR + 'monster_tier3_elite_sheet.png',
  boss:         SPRITE_DIR + 'monster_tier4_boss_sheet.png'
};

const UI_SHEET   = SPRITE_DIR + 'ui_decor_sheet.png';
const VFX_SHEET  = SPRITE_DIR + 'vfx_combat_sheet.png';
const CAPYBARA   = SPRITE_DIR + 'hero_v6.png';
const MONSTER_PREM_1 = SPRITE_DIR + 'monster_premium_tier1.png';
const WATERMELON = SPRITE_DIR + 'watermelon.png';
const HOT_SPRING = SPRITE_DIR + 'hot_spring.png';

const TRAP_LOG = SPRITE_DIR + 'trap_log.png';
const TRAP_THORNS = SPRITE_DIR + 'trap_thorns.png';

const THEMES: Record<string, { bg: string; overlay: string; decor: string }> = {
  jungle: { bg: '/assets/images/stage_bg_cute_v2.png', overlay: 'rgba(255,255,255,0.05)', decor: 'jungle' },
  oasis:  { bg: '/assets/images/stage_bg_oasis.png', overlay: 'rgba(255,240,200,0.1)', decor: 'oasis' },
  ruins:  { bg: '/assets/images/stage_bg_ruins.png', overlay: 'rgba(200,200,250,0.1)', decor: 'ruins' }
};

function getTheme(state: GameState) {
  const stageDef = getStage(state.stage);
  
  const assetMap: Record<number, string> = {
    1: 'stage_bg_1.png', 2: 'stage_bg_2.png', 3: 'stage_bg_3.png', 4: 'stage_bg_4.png', 5: 'stage_bg_5.png',
    6: 'stage_bg_6.png', 7: 'stage_bg_7.png', 8: 'stage_bg_8.png', 9: 'stage_bg_9.png', 10: 'stage_bg_10.png',
    11: 'stage_bg_11.png', 12: 'stage_bg_12.png', 13: 'stage_bg_13.png', 14: 'stage_bg_14.png',
    15: 'stage_bg_12.png', // Dark Temple reused for Chaos Labyrinth
    16: 'stage_bg_oasis.png', // Base Oasis reused for Twilight Plains
    17: 'stage_bg_ruins.png', // Base Ruins reused for Fire Temple
    18: 'stage_bg_11.png', // Ancient Ruins reused for Underground Labyrinth
    19: 'stage_bg_cute_v2.png', // Base Jungle reused for Chaos Land
    20: 'stage_bg_13.png', // Lava Volcano reused for Final Battle
  };

  const bgAsset = assetMap[state.stage] || 'stage_bg_cute_v2.png';
  const base = THEMES[stageDef.theme] || THEMES.jungle;
  return { ...base, bg: `/assets/images/${bgAsset}`, colorOverlay: stageDef.colorOverlay };
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
    // Process sprites, sheets and icons to remove solid backgrounds
    if (src.includes('sprites') || src.includes('sheet') || src.includes('icons')) {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          const w = canvas.width, h = canvas.height;
          
          let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
          // Sample corners to find a solid background color
          const corners = [0, (w-1), (h-1)*w, (h-1)*w+(w-1)];
          for (const ci of corners) {
            const a = data[ci*4+3];
            if (a === 255) { bgR = data[ci*4]; bgG = data[ci*4+1]; bgB = data[ci*4+2]; bgA = a; break; }
          }

          if (bgA === 255) {
            const isMagentaBg = bgR > 200 && bgB > 200 && bgG < 150;
            const isWhiteBg = bgR > 240 && bgG > 240 && bgB > 240;
            const isGrayBg = bgR > 100 && bgR < 250 && Math.abs(bgR - bgG) < 20 && Math.abs(bgG - bgB) < 20;

            if (isMagentaBg || isWhiteBg || isGrayBg) {
              const visited = new Uint8Array(w * h);
              const queue: number[] = [];

              function enqueue(idx: number) {
                if (idx < 0 || idx >= w * h || visited[idx]) return;
                visited[idx] = 1;
                queue.push(idx);
              }

              // Seed edge pixels ONLY - no internal grid seeding to prevent eating eyes/armor
              for (let x = 0; x < w; x++) { enqueue(x); enqueue((h-1)*w+x); }
              for (let y = 1; y < h-1; y++) { enqueue(y*w); enqueue(y*w+w-1); }

              // BFS Flood Fill
              let qi = 0;
              while (qi < queue.length) {
                const idx = queue[qi++];
                const p = idx * 4;
                const r = data[p], g = data[p+1], b = data[p+2], a = data[p+3];
                if (a === 0) continue;
                
                // Color distance to the DETECTED background
                const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);

                // If it matches background color (with tolerance), clear it and enqueue neighbors
                if (dist < 45) {
                  data[p+3] = 0;
                  const x = idx % w, y = Math.floor(idx / w);
                  if (x > 0) enqueue(idx-1);
                  if (x < w-1) enqueue(idx+1);
                  if (y > 0) enqueue(idx-w);
                  if (y < h-1) enqueue(idx+w);
                }
              }
              
              // Fringe Cleaning (targets pixels matching bg color to avoid halos)
              const cleanedData = new Uint8ClampedArray(data);
              for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                  const idx = y * w + x;
                  const p = idx * 4;
                  if (data[p + 3] === 0) continue; 
                  
                  if (data[(idx - 1)*4 + 3] === 0 || data[(idx + 1)*4 + 3] === 0 || 
                      data[(idx - w)*4 + 3] === 0 || data[(idx + w)*4 + 3] === 0) {
                     
                     const r = data[p], g = data[p+1], b = data[p+2];
                     const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
                     
                     if (dist < 120) {
                        cleanedData[p + 3] = 0;
                     }
                  }
                }
              }
              ctx.putImageData(new ImageData(cleanedData, w, h), 0, 0);
            } else {
               ctx.putImageData(imgData, 0, 0);
            }
          } else {
             ctx.putImageData(imgData, 0, 0);
          }
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
  boss: Enemy | null,
  traps: Trap[] = [],
  enemyProjectiles: EnemyProjectile[] = []
) {
  const cx = w / 2, cy = h - 40;
  const canvasW = w;

  // 1. Background (Theme-Based)
  const theme = getTheme(state);
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
  // Stage-specific color overlay for visual differentiation
  if ((theme as any).colorOverlay) {
    ctx.fillStyle = (theme as any).colorOverlay;
    ctx.fillRect(0, 0, w, h);
  }
  drawBackgroundDecor(ctx, w, h, state.wave, theme.decor);

  // 1.5 서식지 하단 영역 (Habitat / Muddy Pool Zone)
  const habitatH = 100;
  const habitatY = h - habitatH;
  
  // Muddy Ground
  const groundGrd = ctx.createLinearGradient(0, habitatY, 0, h);
  groundGrd.addColorStop(0, '#5D4037'); // Dark mud
  groundGrd.addColorStop(1, '#3E2723');
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, habitatY, w, habitatH);

  // Water/Pool area (Capybaras love water)
  ctx.fillStyle = 'rgba(79, 195, 247, 0.4)'; // Clear bluish water overlay
  ctx.beginPath();
  ctx.ellipse(w/2, h - 20, w * 0.6, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Reeds and Grass patches
  ctx.fillStyle = '#2E7D32';
  for (let i = 0; i < 12; i++) {
    const gx = (i * 123.456) % w;
    const gy = habitatY + (i * 67.89) % habitatH;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx - 5, gy - 15);
    ctx.lineTo(gx + 5, gy - 15);
    ctx.fill();
    
    // Tiny flowers
    if (i % 3 === 0) {
       ctx.fillStyle = '#FFEB3B';
       ctx.beginPath(); ctx.arc(gx, gy - 18, 3, 0, Math.PI * 2); ctx.fill();
       ctx.fillStyle = '#2E7D32';
    }
  }

  // Muddy puddles/details
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  for (let i = 0; i < 5; i++) {
    const px = (i * 200) % w;
    const py = habitatY + 20 + (i * 10) % 40;
    ctx.beginPath();
    ctx.ellipse(px, py, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Base Platform & Hot Spring (Natural Look)
  if (state.hotSpringActiveMs > 0) {
    const img = getImg(HOT_SPRING);
    const isLoaded = img instanceof HTMLCanvasElement || (img instanceof HTMLImageElement && img.complete);
    if (isLoaded) {
       ctx.drawImage(img, cx - 120, cy - 80, 240, 160);
    } else {
       ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
       ctx.beginPath(); ctx.arc(cx, cy, 100, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Muddy mound for the capybara
  ctx.fillStyle = 'rgba(62, 39, 35, 0.6)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 60, 25, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. Capybara
  drawCapybara(ctx, cx, cy, state);

  // 4. Turret Orientation
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(turretAngle);
  ctx.fillStyle = 'rgba(255,200,50,0.4)';
  ctx.beginPath(); ctx.roundRect(18, -4, 28, 8, 4); ctx.fill();
  ctx.restore();

  // 5. Palm Drops / Ultimates
  for (const pd of palmDrops) {
    if (pd.isUltimate) {
       const img = getImg(WATERMELON);
       const isLoaded = img instanceof HTMLCanvasElement || (img instanceof HTMLImageElement && img.complete);
       const fallY = pd.y - (pd.msLeft); // starts high and falls down
       if (isLoaded) {
          ctx.drawImage(img, pd.x - 100, fallY - 100, 200, 200);
       }
    } else {
       ctx.strokeStyle = 'rgba(255,255,255,0.2)';
       ctx.setLineDash([5, 5]);
       ctx.beginPath(); ctx.arc(pd.x, pd.y, pd.radius, 0, Math.PI * 2); ctx.stroke();
       ctx.setLineDash([]);
    }
  }

  // 5.5 Traps
  for (const t of traps) drawTrap(ctx, t);

  // 6. Enemies
  for (const e of enemies) drawEnemy(ctx, e, canvasW);

  // 7. Bullets
  for (const b of bullets) drawBullet(ctx, b, state);

  // 8. Particles (VFX)
  for (const p of particles) drawParticle(ctx, p);

  // 8.5 Enemy Projectiles
  for (const proj of enemyProjectiles) {
    ctx.save();
    ctx.translate(proj.x, proj.y);
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = proj.color;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 10;
    
    // Toxic projectile (teardrop) vs normal (stretched flame)
    if (proj.color === '#aaff00') { // toxic
      ctx.beginPath();
      ctx.moveTo(proj.radius, 0); // tip
      ctx.quadraticCurveTo(-proj.radius, proj.radius, -proj.radius*1.5, 0); // bottom
      ctx.quadraticCurveTo(-proj.radius, -proj.radius, proj.radius, 0); // top
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, proj.radius * 2, proj.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // 9. Floating Texts
  for (const ft of floatingTexts) drawFloatingText(ctx, ft);

  // 10. Weather Overlay
  if (state.currentWeather === 'rain') {
    ctx.fillStyle = 'rgba(0, 50, 150, 0.2)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    const time = Date.now();
    for(let i=0; i<20; i++) {
       const lx = ((i * 30 + time) % w);
       const ly = ((i * 50 + time * 2) % h);
       ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 10, ly + 20); ctx.stroke();
    }
  } else if (state.currentWeather === 'sandstorm') {
    ctx.fillStyle = 'rgba(200, 150, 50, 0.2)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255, 200, 100, 0.3)';
    const time = Date.now();
    for(let i=0; i<30; i++) {
       const lx = ((i * 40 + time * 1.5) % w);
       const ly = ((i * 20 + Math.sin(time/100)*10) % h);
       ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
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
  const capyType = CAPY_TYPES.find(t => t.id === state.selectedCapyType) || CAPY_TYPES[0];
  const img = getImg(capyType.icon);
  
  // Add recoil animation if recently fired a skill
  let recoilX = 0;
  let recoilY = 0;
  let maxRecentScale = 1;
  const now = Date.now();
  for (const sk of state.activeSkills) {
    const timeSinceShot = now - sk.lastShot;
    if (timeSinceShot < 150) {
      maxRecentScale = Math.max(maxRecentScale, 1.3 - (timeSinceShot/150)*0.3);
      recoilY += 8 - (timeSinceShot/150)*8; // Strong push down
    }
  }

  if (maxRecentScale > 1.05) {
    ctx.save();
    ctx.translate(cx, cy - 15);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 220, 100, 0.5)';
    ctx.beginPath();
    ctx.arc(0, Math.sin(now/300)*5, 70 * maxRecentScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Subtler breath and recoil to avoid distortion
  const breath = Math.sin(now / 250) * 0.04;
  const size = 110 * maxRecentScale; 
  const isLoaded = img instanceof HTMLCanvasElement || (img instanceof HTMLImageElement && img.complete);
  if (isLoaded) {
    const imgW = (img as any).width || 100;
    const imgH = (img as any).height || 100;
    const aspect = imgW / imgH;
    const drawW = size * aspect;
    const drawH = size;

    ctx.save();
    ctx.translate(cx + recoilX, cy + Math.sin(now/300)*5 + recoilY - 15); 
    // Stronger squash on fire
    const squash = (maxRecentScale - 1) * 0.8;
    ctx.scale(1 + breath + squash, 1 - breath * 0.5 - squash);
    
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  } else {
    ctx.fillStyle = '#c8a97e';
    ctx.beginPath(); ctx.arc(cx, cy, 32 * (1 + breath), 0, Math.PI * 2); ctx.fill();
  }

  // Draw Player HP Bar right below the capybara
  const hpW = 60;
  const hpX = cx - hpW/2;
  const hpY = cy + 30; // below character
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(hpX - 2, hpY - 2, hpW + 4, 10);
  ctx.fillStyle = '#ff4d6d';
  ctx.fillRect(hpX, hpY, hpW * (Math.max(0, state.hp) / state.maxHp), 6);
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
  } else if (e.tier === 'elite') {
    sheet = MONSTER_SHEETS.elite;
    idx = e.sheetIdx % 8;
  } else if (e.tier === 'intermediate') {
    sheet = MONSTER_SHEETS.intermediate;
    idx = e.sheetIdx % 8;
  } else {
    idx = e.sheetIdx % 8;
  }

  const img = getImg(sheet);
  const isLoaded = img instanceof HTMLCanvasElement || (img instanceof HTMLImageElement && img.complete);
  
  // Traits-specific calculations
  const isFlying = e.traits.includes('flying');
  const isToxic = e.traits.includes('toxic');
  const timeOffset = e.id.charCodeAt(0) * 10;
  const now = Date.now();
  const walkSpeed = e.speed * 100;

  // Flying bobbing vs walking bounce
  let verticalOffset = 0;
  let horizontalSway = 0;
  let waddleRotation = 0;
  const isWalking = !e.status.slowed || e.status.slowed.factor > 0.1;
  const walkPhase = now / (120 - walkSpeed / 2) + timeOffset;

  if (isFlying) {
    verticalOffset = Math.sin(now / 300 + timeOffset) * (e.radius * 0.8) - 15;
    horizontalSway = Math.cos(now / 400 + timeOffset) * (e.radius * 0.5);
  } else {
    verticalOffset = isWalking ? Math.abs(Math.sin(walkPhase)) * (e.radius * 0.5) : 0;
    horizontalSway = isWalking ? Math.sin(walkPhase / 2) * (e.radius * 0.4) : 0;
    waddleRotation = isWalking ? Math.sin(walkPhase / 2) * 0.15 : 0;
  }

  // Draw Drop Shadow for ALL monsters
  ctx.save();
  ctx.translate(e.x + horizontalSway, e.y);
  const shadowScale = isFlying ? 1 - (verticalOffset / -30) * 0.3 : 1 - (verticalOffset / 20) * 0.2;
  ctx.scale(shadowScale, 0.4 * shadowScale);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(0, 0, e.radius * 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (isLoaded) {
    let sx = 0, sy = 0, sw = img.width, sh = img.height;

    if (sheet === MONSTER_SHEETS.normal || sheet === MONSTER_SHEETS.intermediate || sheet === MONSTER_SHEETS.elite || sheet === MONSTER_SHEETS.boss) {
      sw = img.width / 4; sh = img.height / 4;
      sx = (idx % 4) * sw; sy = Math.floor((idx % 16) / 4) * sh;
    } else if (sheet === MONSTER_PREM_1) {
      sw = img.width / 3; sh = img.height; 
      sx = idx * sw; sy = 0;
    }
    
    const insetW = sw * 0.05, insetH = sh * 0.05;
    const finalSX = sx + insetW, finalSY = sy + insetH;
    const finalSW = sw - insetW * 2, finalSH = sh - insetH * 2;
    
    const drawRadius = e.isBoss ? 110 : e.tier === 'elite' ? 72 : e.tier === 'intermediate' ? 56 : 42;

    ctx.save();
    ctx.translate(e.x + horizontalSway, e.y + verticalOffset);
    if (waddleRotation !== 0) ctx.rotate(waddleRotation);
    
    // Aura Effects
    if (isToxic) {
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#aaff00';
      ctx.fillStyle = 'rgba(170, 255, 0, 0.15)';
      ctx.beginPath(); ctx.arc(0, 0, drawRadius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (e.shieldActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius * 1.1, now / 200, now / 200 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const hitScale = e.flashTicks > 0 ? 1.15 : 1;
    ctx.scale((e.x > canvasW / 2 ? 1 : -1) * hitScale, hitScale);
    
    ctx.drawImage(img, finalSX, finalSY, finalSW, finalSH, -drawRadius, -drawRadius, drawRadius * 2, drawRadius * 2);

    if (e.flashTicks > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(-drawRadius, -drawRadius, drawRadius * 2, drawRadius * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  } else {
    ctx.fillStyle = e.isBoss ? '#ffcc33' : '#ff4d6d';
    ctx.beginPath(); ctx.arc(e.x, e.y + verticalOffset, e.radius, 0, Math.PI * 2); ctx.fill();
  }

  // HP Bar (Only for non-bosses)
  if (!e.isBoss && e.hp < e.maxHp) {
    const drawRadius = e.tier === 'elite' ? 72 : e.tier === 'intermediate' ? 56 : 42;
    const barW = drawRadius * 1.8;
    const barX = e.x - barW / 2;
    const barY = e.y - drawRadius - 8;
    const barH = 6;
    
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    
    // Fill
    const hpColor = e.shieldActive ? '#00ffff' : e.status.poisoned ? '#aaff00' : e.status.slowed ? '#44ccff' : e.traits.includes('regenerating') ? '#00ff88' : '#ff4d6d';
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barW * Math.max(0, e.hp / e.maxHp), barH);
    
    // Segments for tanky enemies
    if (e.maxHp > 100) {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      const segmentSize = 100;
      const segmentCount = Math.floor(e.maxHp / segmentSize);
      if (segmentCount > 1 && segmentCount < 30) {
        for (let i = 1; i < segmentCount; i++) {
          const segX = barX + barW * ((i * segmentSize) / e.maxHp);
          ctx.fillRect(segX, barY, 1.5, barH);
        }
      }
    }
  }
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet, state: GameState) {
  const skill = state.activeSkills.find(s => s.type === b.originType);
  const lv = skill ? skill.level : 1;
  
  let imgSrc = '';
  const skillPaths = SKILL_SHEETS_MAP[b.originType];
  if (skillPaths) {
    imgSrc = lv <= 5 ? skillPaths.lv1_5 : skillPaths.lv6_10;
  } else {
    // fallback
    imgSrc = SKILL_SHEETS_MAP['acorn_cannon'].lv1_5;
  }

  const img = getImg(imgSrc);
  const isLoaded = img instanceof HTMLCanvasElement || (img instanceof HTMLImageElement && img.complete);
  
  if (isLoaded) {
    const frameCount = 5; // most of the skill sheets are 5-frame horizontal strips
    const frameDuration = 80; // ms per frame
    const elapsed = Date.now() - (b.createdAt || Date.now());
    const frameIdx = Math.floor(elapsed / frameDuration) % frameCount;
    
    const sh = img.height;
    const sw = img.width / frameCount; // should equal sh
    const sx = frameIdx * sw;
    const sy = 0;
    
    ctx.save();
    ctx.translate(b.x, b.y);
    
    // Rotation & Scaling
    if (b.rotation !== undefined) {
      ctx.rotate(b.rotation);
    } else {
      ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
    }

    let scaleX = 1 + (lv - 1) * 0.05, scaleY = 1 + (lv - 1) * 0.05;
    if (b.stretch !== undefined) {
      scaleY *= b.stretch;
      scaleX *= 1 / Math.sqrt(b.stretch);
    }
    if (b.pulse !== undefined) {
      scaleX *= b.pulse;
      scaleY *= b.pulse;
    }
    ctx.scale(scaleX, scaleY);

    // Apply character-specific tint
    ctx.drawImage(img, sx, sy, sw, sh, -b.radius * 2, -b.radius * 2, b.radius * 4, b.radius * 4);
    
    // Level-based Glow/FX
    if (lv >= 5) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3;
      const color = b.color || '#fff';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // Dynamic Fading Trails for all levels
    const trailCount = lv >= 7 ? 5 : (lv >= 4 ? 3 : 1);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= trailCount; i++) {
      ctx.globalAlpha = 0.5 * (1 - i / (trailCount + 1));
      ctx.fillStyle = b.color || '#fff';
      const tx = b.x - (b.vx * i * 1.5);
      const ty = b.y - (b.vy * i * 1.5);
      ctx.beginPath();
      ctx.arc(tx, ty, b.radius * Math.max(0.2, (1 - i * 0.15)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
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
  
  if (p.isPoisonCloud) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.arc(-p.radius*0.6, p.radius*0.3, p.radius*0.8, 0, Math.PI * 2);
    ctx.arc(p.radius*0.6, p.radius*0.3, p.radius*0.8, 0, Math.PI * 2);
    ctx.arc(0, -p.radius*0.5, p.radius*0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.isMushroomCloud) {
    const progress = p.life / p.maxLife;
    const scale = 0.5 + progress * 1.5;
    ctx.scale(scale, scale);
    ctx.globalAlpha = p.alpha;
    
    // Stalk
    ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
    ctx.beginPath();
    ctx.roundRect(-p.radius*0.3, 0, p.radius*0.6, p.radius*1.5, 5);
    ctx.fill();
    
    // Cap
    ctx.fillStyle = 'rgba(255, 100, 50, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, Math.PI, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    return;
  }
  
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
  ctx.globalCompositeOperation = 'lighter'; // Additive blending for glow
  ctx.fillStyle = p.color;
  
  // Shrink particle over its lifetime
  const progress = p.life / p.maxLife;
  const currentRadius = Math.max(0.1, p.radius * (1 - Math.pow(progress, 2))); // Non-linear shrink
  
  // If particle has velocity, stretch it to look like a moving spark
  const speed = Math.sqrt((p.vx || 0) * (p.vx || 0) + (p.vy || 0) * (p.vy || 0));
  if (speed > 1) {
    const angle = Math.atan2(p.vy || 0, p.vx || 0);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, currentRadius * (1 + speed * 0.2), currentRadius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(-angle);
  } else {
    ctx.beginPath(); ctx.arc(0, 0, currentRadius, 0, Math.PI * 2); ctx.fill();
  }
  
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function drawFloatingText(ctx: CanvasRenderingContext2D, ft: FloatingText) {
  const alpha = Math.max(0, 1 - Math.pow(ft.life / ft.maxLife, 2.5)); // Fade out later, sharper drop
  const isCrit = ft.color === '#ffcc33' || ft.color === '#ff0000'; // Yellow or Red means big hit
  
  // Pop-out and arc animation
  const progress = ft.life / ft.maxLife;
  
  // Crits pop much larger
  const baseScale = isCrit ? 2.2 : 1.3;
  
  // Springy pop animation
  let popScale;
  if (ft.life < 8) {
    popScale = 1 + (ft.life / 8) * (baseScale - 1) + Math.sin(ft.life * 0.8) * 0.3;
  } else {
    popScale = baseScale - ((ft.life - 8) / ft.maxLife) * 0.4;
  }
  
  // Crits shake slightly initially
  const shakeX = isCrit && ft.life < 10 ? (Math.random() - 0.5) * 8 : 0;
  const shakeY = isCrit && ft.life < 10 ? (Math.random() - 0.5) * 8 : 0;
  
  // Determine arc direction based on an arbitrary but consistent property, like x position or just use a fallback
  const arcDirection = (ft.x % 2 === 0) ? 1 : -1;
  const arcX = Math.sin(progress * Math.PI) * (isCrit ? 40 : 20) * arcDirection;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(ft.x + arcX + shakeX, ft.y + shakeY);
  ctx.scale(popScale, popScale);
  
  // Text styling
  ctx.font = isCrit ? '900 26px "Jua", sans-serif' : 'bold 22px "Jua", sans-serif';
  ctx.textAlign = 'center';
  
  // Glow effect for crits
  if (isCrit) {
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 10;
  }
  
  // Thick outline for cute commercial look
  ctx.strokeStyle = '#221100';
  ctx.lineWidth = isCrit ? 6 : 4;
  ctx.lineJoin = 'round';
  ctx.strokeText(ft.text, 0, 0);
  
  ctx.shadowBlur = 0; // Turn off shadow for inner fill
  
  // Gradient fill for text
  const grad = ctx.createLinearGradient(0, -15, 0, 5);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, ft.color);
  
  ctx.fillStyle = grad;
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

function drawTrap(ctx: CanvasRenderingContext2D, t: Trap) {
  const imgSrc = t.type === 'log' ? TRAP_LOG : TRAP_THORNS;
  const img = getImg(imgSrc);
  const isLoaded = img instanceof HTMLCanvasElement || (img instanceof HTMLImageElement && img.complete);
  if (isLoaded) {
    ctx.save();
    ctx.translate(t.x, t.y);
    if (t.type === 'log') {
       ctx.rotate(Date.now() / 200);
       ctx.drawImage(img, -t.radius, -t.radius, t.radius*2, t.radius*2);
    } else {
       ctx.drawImage(img, -t.radius, -t.radius, t.radius*2, t.radius*2);
    }
    ctx.restore();
  }
}

