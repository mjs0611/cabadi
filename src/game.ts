import type { GameState } from './state.ts';
import {
  type Enemy, type Bullet, type Particle, type FloatingText, type PalmDrop, type Trap,
  type EnemyProjectile,
  createEnemy, createSplitEnemy, createBullet, createEnemyProjectile,
  createParticle, createFloatingText, createGoldParticle
} from './entities.ts';
import { render } from './renderer.ts';
import { getSkillStats } from './data.ts';
import { sound } from './sound.ts';
import { CAPY_TYPES } from './capy_types.ts';
import { getStage, isBossWave } from './stages.ts';

const MAX_WAVES_PER_STAGE = 50;

function enemiesForWave(wave: number, extra: number) { return 10 + wave * 3 + extra; }

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState;
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private palmDrops: PalmDrop[] = [];
  private enemyProjectiles: EnemyProjectile[] = [];

  private rafId = 0;
  private lastTime = 0;
  private turretAngle = 0;
  private manualAngle: number | null = null;
  private isPointerDown = false;
  private pointerX = 0;
  private pointerY = 0;

  private traps: Trap[] = [];

  private enemiesLeft = 0;
  private bossQueued = false;
  private bossSpawned = false;
  private spawnInterval = 0;
  private lastSpawn = 0;

  private onWaveClear: () => void;
  private onStageClear: () => void;
  private onGameOver: () => void;
  private onHpChange: (hp: number, maxHp: number) => void;
  private onBananaEarned: (amount: number) => void;
  private onKill: (isBoss: boolean) => void;
  private onBaseFlash: () => void;
  private onBossSpawn: (enemy: Enemy) => void;
  private onBossHit?: () => void;

  private paused = false;
  private reviveUsed = false;
  private hitStopTicks = 0;

  private comboCount = 0;
  private lastKillTime = 0;
  private tapSlowCooldown = 0; // timestamp ms
  private tapSlowTarget: Enemy | null = null;
  private waveType: 'normal' | 'rush' | 'swarm' | 'armored' = 'normal';
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    state: GameState,
    onWaveClear: () => void,
    onStageClear: () => void,
    onGameOver: () => void,
    onHpChange: (hp: number, maxHp: number) => void,
    onBananaEarned: (amount: number) => void,
    onKill: (isBoss: boolean) => void,
    onBaseFlash: () => void,
    onBossSpawn: (enemy: Enemy) => void,
    onBossHit?: () => void,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.state = state;
    this.onWaveClear = onWaveClear;
    this.onStageClear = onStageClear;
    this.onGameOver = onGameOver;
    this.onHpChange = onHpChange;
    this.onBananaEarned = onBananaEarned;
    this.onKill = onKill;
    this.onBaseFlash = onBaseFlash;
    this.onBossSpawn = onBossSpawn;
    this.onBossHit = onBossHit;
    this.initInput();
  }

  private initInput() {
    const handleInput = (x: number, y: number) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerX = x - rect.left;
      this.pointerY = y - rect.top;
      const dx = this.pointerX - (this.canvas.width / 2);
      const dy = this.pointerY - (this.canvas.height - 40);
      this.manualAngle = Math.atan2(dy, dx);
    };
    this.canvas.addEventListener('mousedown', (e) => { this.isPointerDown = true; handleInput(e.clientX, e.clientY); });
    window.addEventListener('mousemove', (e) => { if (this.isPointerDown) handleInput(e.clientX, e.clientY); });
    window.addEventListener('mouseup', (e) => {
      this.isPointerDown = false;
      this.manualAngle = null;
      // Desktop click → tap slow
      this.handleTap(e.clientX, e.clientY);
    });
    this.canvas.addEventListener('touchstart', (e) => {
      this.isPointerDown = true;
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchStartTime = Date.now();
      handleInput(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => { if (this.isPointerDown) handleInput(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    window.addEventListener('touchend', (e) => {
      this.isPointerDown = false;
      this.manualAngle = null;
      // Short stationary tap → tap slow
      const cx = e.changedTouches[0].clientX, cy = e.changedTouches[0].clientY;
      const dx = cx - this.touchStartX, dy = cy - this.touchStartY;
      if (Math.sqrt(dx*dx+dy*dy) < 25 && Date.now() - this.touchStartTime < 250) {
        this.handleTap(cx, cy);
      }
    });
  }

  private handleTap(clientX: number, clientY: number) {
    const now = Date.now();
    if (now < this.tapSlowCooldown) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const TAP_RADIUS = 60; // generous touch target
    let hit: Enemy | null = null;
    let minDist = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d < TAP_RADIUS * TAP_RADIUS && d < minDist) { minDist = d; hit = e; }
    }
    if (!hit) return;
    hit.status.slowed = { factor: 0.2, msLeft: 2500 };
    this.tapSlowTarget = hit;
    this.tapSlowCooldown = now + 7000;
    this.particles.push(...createParticle(hit.x, hit.y, '#44ccff', 12, 3));
    this.floatingTexts.push(createFloatingText(hit.x, hit.y - 30, '🧊 FREEZE!', '#44ccff'));
    sound.playSkillSound('mud_artillery');
  }

  getWaveType() { return this.waveType; }

  pause() { if (this.paused) return; this.paused = true; cancelAnimationFrame(this.rafId); }
  resume() { if (!this.paused) return; this.paused = false; this.lastTime = performance.now(); this.rafId = requestAnimationFrame(this.loop); }

  revive() {
    if (this.reviveUsed) return;
    this.reviveUsed = true;
    this.state.hp = Math.floor(this.state.maxHp * 0.5);
    this.state.phase = 'playing';
    this.startWave();
  }

  getBoss(): Enemy | null { return this.enemies.find(e => !e.dead && e.isBoss) ?? null; }

  triggerUltimate() {
    const cx = this.canvas.width / 2, cy = this.canvas.height - 40;
    this.palmDrops.push({ x: cx, y: cy - 200, damage: 2000 * this.state.damageMultiplier, radius: 400, msLeft: 1000, exploded: false, isUltimate: true });
    this.state.hotSpringActiveMs = 3000;
    sound.playSkillSound('palm_fall');
  }

  startWave() {
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.floatingTexts = [];
    this.palmDrops = [];
    this.traps = [];
    this.enemyProjectiles = [];

    const stageDef = getStage(this.state.stage);
    const isBoss = isBossWave(this.state.wave);

    // Wave type 결정 (보스 웨이브 제외)
    if (isBoss) {
      this.waveType = 'normal';
    } else {
      const w = this.state.wave;
      if (w % 7 === 0) this.waveType = 'rush';
      else if (w % 9 === 0) this.waveType = 'swarm';
      else if (w % 11 === 0) this.waveType = 'armored';
      else this.waveType = 'normal';
    }

    this.bossQueued = isBoss;
    this.bossSpawned = false;
    let baseCount = enemiesForWave(this.state.wave, stageDef.extraEnemies);
    if (this.waveType === 'rush') baseCount = Math.floor(baseCount * 1.4);
    else if (this.waveType === 'swarm') baseCount = Math.floor(baseCount * 2.0);
    else if (this.waveType === 'armored') baseCount = Math.floor(baseCount * 0.65);
    this.enemiesLeft = isBoss ? Math.max(3, Math.floor(baseCount * 0.6)) : baseCount;

    let baseInterval = Math.max(250, 1000 - this.state.wave * 20);
    if (this.waveType === 'rush') baseInterval = Math.floor(baseInterval * 0.55);
    else if (this.waveType === 'swarm') baseInterval = Math.floor(baseInterval * 0.45);
    else if (this.waveType === 'armored') baseInterval = Math.floor(baseInterval * 1.3);
    this.spawnInterval = baseInterval;

    this.comboCount = 0;
    this.lastSpawn = performance.now();

    const baseWeather = stageDef.envTrait;
    if (this.state.wave % 5 === 0) {
      this.state.currentWeather = Math.random() < 0.5 ? 'rain' : 'sandstorm';
    } else {
      this.state.currentWeather = baseWeather;
    }

    if (!isBoss && Math.random() < 0.35) {
      this.traps.push({ id: 't1', type: 'log', x: Math.random() * this.canvas.width, y: -50, hp: 100, radius: 40, vy: 1.5 });
    } else if (!isBoss && Math.random() < 0.35) {
      this.traps.push({ id: 't2', type: 'thorns', x: Math.random() * this.canvas.width, y: this.canvas.height / 2, hp: 100, radius: 50 });
    }

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() { cancelAnimationFrame(this.rafId); }

  private loop = (now: number) => {
    if (this.state.phase !== 'playing') return;
    const dt = Math.min(now - this.lastTime, 50);
    this.lastTime = now;
    if (this.hitStopTicks > 0) { this.hitStopTicks--; }
    else { this.update(now, dt); }
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(now: number, dt: number) {
    const w = this.canvas.width, h = this.canvas.height;
    const cx = w / 2, cy = h - 40;

    // 보스 스폰
    if (this.bossQueued && !this.bossSpawned) {
      const boss = createEnemy(w, h, this.state.wave, this.state.stage, true);
      this.enemies.push(boss);
      this.onBossSpawn(boss);
      this.bossSpawned = true;
    }

    // 일반 스폰 (그룹 스폰 포함)
    if (this.enemiesLeft > 0 && now - this.lastSpawn > this.spawnInterval) {
      // 웨이브가 높을수록 그룹 크기 증가
      const groupSize = Math.min(this.enemiesLeft, 1 + Math.floor(this.state.wave / 10));
      for (let g = 0; g < groupSize; g++) {
        const enemy = createEnemy(w, h, this.state.wave, this.state.stage, false);
        // 웨이브 타입별 스탯 조정
        if (this.waveType === 'rush') {
          enemy.speed *= 1.6;
          enemy.hp = Math.floor(enemy.hp * 0.7);
          enemy.maxHp = enemy.hp;
        } else if (this.waveType === 'swarm') {
          enemy.hp = Math.floor(enemy.hp * 0.4);
          enemy.maxHp = enemy.hp;
          enemy.speed *= 1.3;
          enemy.gold = Math.max(1, Math.floor(enemy.gold * 0.5));
        } else if (this.waveType === 'armored') {
          if (!enemy.traits.includes('armored')) enemy.traits.push('armored');
          enemy.hp = Math.floor(enemy.hp * 2.0);
          enemy.maxHp = enemy.hp;
          enemy.speed *= 0.75;
        }
        // 같은 그룹은 x축으로 약간 퍼뜨려 스폰
        enemy.x = Math.max(40, Math.min(w - 40, enemy.x + (g - groupSize / 2) * 60));
        this.enemies.push(enemy);
        this.enemiesLeft--;
        if (this.enemiesLeft <= 0) break;
      }
      this.lastSpawn = now;
    }

    if (this.state.hotSpringActiveMs > 0) this.state.hotSpringActiveMs -= dt;
    if (this.state.frenzyModeMs > 0) this.state.frenzyModeMs -= dt;

    // 트랩 (비행 유닛 무시)
    for (const t of this.traps) {
      if (t.type === 'log') t.y += t.vy!;
      for (const e of this.enemies) {
        if (e.dead || e.traits.includes('flying')) continue;
        const dx = t.x - e.x, dy = t.y - e.y;
        if (dx*dx + dy*dy < (t.radius + e.radius)**2) {
          e.hp -= 20 * (dt / 50);
          if (t.type === 'thorns') e.status.poisoned = { dps: 10, msLeft: 2000 };
          else e.y += 2;
          if (e.hp <= 0) { e.dead = true; this.killEnemy(e); }
        }
      }
    }

    // 적 이동 및 특성 처리
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.status.poisoned) {
        e.hp -= e.status.poisoned.dps * (dt / 1000);
        e.status.poisoned.msLeft -= dt;
        if (e.status.poisoned.msLeft <= 0) delete e.status.poisoned;
        if (e.hp <= 0) { e.dead = true; this.killEnemy(e); continue; }
      }
      if (e.status.slowed) {
        e.status.slowed.msLeft -= dt;
        if (e.status.slowed.msLeft <= 0) delete e.status.slowed;
      }
      if (e.flashTicks > 0) e.flashTicks--;

      // 재생 특성
      if (e.traits.includes('regenerating') && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.005 * (dt / 1000));
      }

      const habitatY = h - 80;
      const distToBase = Math.max(0, habitatY - e.y);
      let slowFactor = e.status.slowed ? e.status.slowed.factor : 1;
      if (this.state.hotSpringActiveMs > 0 && distToBase < 200) slowFactor *= 0.1;
      const rainMod = this.state.currentWeather === 'rain' ? 0.8 : 1;
      const sandMod = this.state.currentWeather === 'sandstorm' ? 1.2 : 1;
      const spd = e.speed * slowFactor * rainMod * sandMod;
      
      let actualSpd = spd;
      let dx = 0;
      
      const timeOffset = (e.id.charCodeAt(0) || 0) * 100 + e.idx * 50;
      const phase = now + timeOffset;

      if (e.traits.includes('flying')) {
        // Zigzag (sine wave)
        dx = Math.cos(phase / 400) * spd * 1.5;
      } else if (e.traits.includes('swift')) {
        // Dash periodically
        const dashPhase = phase % 1500;
        if (dashPhase < 200) {
          actualSpd *= 2.5; // Dash!
        } else if (dashPhase < 600) {
          actualSpd *= 0.5; // Rest/Charge
        }
      } else if (e.traits.includes('armored')) {
        actualSpd *= 0.9; // Slightly slower, but steady
      } else {
        // Normal wobble
        dx = Math.sin(phase / 800) * spd * 0.4;
      }

      // Move down
      e.y += actualSpd;
      
      // Converge to center
      const xDiff = cx - e.x;
      if (Math.abs(xDiff) > 20) {
        e.x += Math.sign(xDiff) * actualSpd * 0.06 + dx;
      } else {
        e.x += dx;
      }

      // 재생(Regenerating) 특성
      if (e.traits.includes('regenerating') && !e.dead) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.0005);
        if (Math.random() < 0.02) {
          this.floatingTexts.push(createFloatingText(e.x + (Math.random()-0.5)*20, e.y - 10, '+', '#00ff88'));
        }
      }

      // 원거리 공격
      if (e.attackType === 'ranged' && distToBase > 60 && distToBase < 320) {
        if (now - e.lastAttack > e.attackCooldown) {
          const proj = createEnemyProjectile(e.x, e.y, cx, cy, e.attackDamage, e.traits.includes('toxic') ? '#aaff00' : '#ff6644');
          this.enemyProjectiles.push(proj);
          e.lastAttack = now;
          this.particles.push(...createParticle(e.x, e.y, '#ff6644', 3, 0));
        }
      }

      // 서식지 도달
      if (e.y >= habitatY) {
        if (this.state.hotSpringActiveMs > 0) { e.y -= 5; continue; }
        this.attackBase(e, cx, cy);
        if (this.state.hp <= 0) return;
      }
    }

    // 적 투사체
    for (const proj of this.enemyProjectiles) {
      if (proj.dead) continue;
      proj.x += proj.vx; proj.y += proj.vy;
      if (proj.x < -50 || proj.x > w+50 || proj.y < -50 || proj.y > h+50) { proj.dead = true; continue; }
      const pdx = proj.x - cx, pdy = proj.y - cy;
      if (pdx*pdx + pdy*pdy < 50*50) {
        proj.dead = true;
        this.state.hp -= proj.damage;
        this.onHpChange(this.state.hp, this.state.maxHp);
        this.onBaseFlash();
        this.particles.push(...createParticle(cx, cy, proj.color, 8, 1));
        this.floatingTexts.push(createFloatingText(cx + (Math.random()-0.5)*40, cy-30, `-${proj.damage}`, '#ff4444'));
        if (this.state.hp <= 0) { this.state.hp = 0; this.stop(); this.onGameOver(); return; }
      }
    }

    // 조준 및 발사
    const nearest = this.getNearestEnemy(cx, cy);
    if (this.manualAngle !== null) this.turretAngle = this.manualAngle;
    else if (nearest) this.turretAngle = Math.atan2(nearest.y-cy, nearest.x-cx);

    if (nearest || this.manualAngle !== null) {
      const hasAcorn = this.state.activeSkills.find(s => s.type === 'acorn_cannon')?.level === 10;
      const hasMud = this.state.activeSkills.find(s => s.type === 'mud_artillery')?.level === 10;
      for (const skill of this.state.activeSkills) {
        if (skill.type === 'mud_artillery' && hasAcorn && hasMud) continue;
        const stats = getSkillStats(skill.type, skill.level);
        if (!stats) continue;
        let fireRateMod = this.state.fireRateMultiplier;
        if (this.state.frenzyModeMs > 0) fireRateMod *= 0.3;
        const cooldown = (stats.cooldown || 0.6) * 1000 * fireRateMod;
        if (now - skill.lastShot >= cooldown) {
          const tx = this.manualAngle !== null ? cx+Math.cos(this.manualAngle)*200 : nearest!.x;
          const ty = this.manualAngle !== null ? cy+Math.sin(this.manualAngle)*200 : nearest!.y;
          this.shoot(cx, cy, tx, ty, skill.type, stats, hasAcorn && hasMud);
          skill.lastShot = now;
        }
      }
    }

    // Palm drops
    for (const drop of this.palmDrops) {
      if (drop.exploded) continue;
      drop.msLeft -= dt;
      if (drop.msLeft <= 0) {
        drop.exploded = true;
        this.explode(drop.x, drop.y, drop.damage, drop.radius);
        sound.playSkillSound('palm_fall');
        this.particles.push(...createParticle(drop.x, drop.y, '#88cc44', 20));
      }
    }
    this.palmDrops = this.palmDrops.filter(d => !d.exploded);

    // 총알 이동
    for (const b of this.bullets) {
      if (b.dead) continue;
      if (b.isHoming) {
        if (!b.homingTarget || b.homingTarget.dead) b.homingTarget = this.getNearestEnemy(b.x, b.y);
        if (b.homingTarget) {
          const hdx=b.homingTarget.x-b.x, hdy=b.homingTarget.y-b.y;
          const hlen=Math.sqrt(hdx*hdx+hdy*hdy)||1;
          const spd=Math.sqrt(b.vx*b.vx+b.vy*b.vy);
          b.vx+=(hdx/hlen*spd-b.vx)*0.12; b.vy+=(hdy/hlen*spd-b.vy)*0.12;
          const nl=Math.sqrt(b.vx*b.vx+b.vy*b.vy)||1;
          b.vx=b.vx/nl*spd; b.vy=b.vy/nl*spd;
        }
      }
      if (b.spiralAngle!==undefined&&b.spiralRadius!==undefined) {
        b.spiralAngle+=0.3;
        const spd=Math.sqrt(b.vx*b.vx+b.vy*b.vy)||1;
        b.x+=(-b.vy/spd)*Math.cos(b.spiralAngle)*b.spiralRadius;
        b.y+=(b.vx/spd)*Math.cos(b.spiralAngle)*b.spiralRadius;
      }
      if (b.rotation!==undefined) b.rotation+=0.2;
      const spd=Math.sqrt(b.vx*b.vx+b.vy*b.vy);
      if (b.stretch!==undefined) b.stretch=Math.min(2.5,spd/5);
      if (b.pulse!==undefined) b.pulse=1+Math.sin(now/50)*0.2;
      b.x+=b.vx; b.y+=b.vy;
      if (b.fuseTicks!==undefined){b.fuseTicks--;if(b.fuseTicks<=0){b.dead=true;this.explode(b.x,b.y,b.damage,60,b.chainExplosionsLeft,b.vfxLevel);continue;}}
      if (b.x<-100||b.x>w+100||b.y<-100||b.y>h+100){b.dead=true;continue;}
      for (const e of this.enemies) {
        if (e.dead||b.hitEnemies.has(e)) continue;
        const ddx=b.x-e.x, ddy=b.y-e.y;
        if (ddx*ddx+ddy*ddy<(b.radius+e.radius)**2) {
          b.hitEnemies.add(e);
          // 방어막 특성
          if (e.shieldActive) {
            e.shieldActive=false;
            this.particles.push(...createParticle(e.x,e.y,'#00ffff',15,4));
            this.floatingTexts.push(createFloatingText(e.x,e.y-20,'BLOCKED!','#00ffff'));
            if(b.pierce<=0){b.dead=true;break;}else{b.pierce--;continue;}
          }
          let finalDmg=b.damage;
          if(e.traits.includes('armored')) finalDmg*=0.5;
          const isCrit=Math.random()<this.state.critChance;
          if(isCrit){finalDmg*=2;this.floatingTexts.push(createFloatingText(e.x,e.y-20,'CRIT!','#ff0055'));}
          e.hp-=finalDmg; 
          e.flashTicks=3; 
          if (e.hp <= 0) {
            this.hitStopTicks = (e.isBoss || e.traits.includes('armored')) ? 15 : 5;
            if (e.isBoss || e.traits.includes('armored')) this.applyScreenShake(10, 300);
          } else {
            this.hitStopTicks = isCrit ? 4 : 1;
            if (isCrit) this.applyScreenShake(4, 150);
          }
          if (e.isBoss && this.onBossHit) this.onBossHit();
          this.particles.push(...createParticle(b.x,b.y,b.color,4,0));
          const dmgColor=e.traits.includes('armored')?'#aaaaff':isCrit?'#ff0055':'#ff9a3c';
          this.floatingTexts.push(createFloatingText(e.x,e.y,`-${Math.round(finalDmg)}`,dmgColor));
          sound.monsterHit();
          if(b.hasExplosion) this.explode(b.x,b.y,finalDmg*0.5,80,b.chainExplosionsLeft,b.vfxLevel);
          this.applySkillEffect(b.originType,e);
          this.applyCharacterPassive(e,b);
          if(e.hp<=0){e.dead=true;this.killEnemy(e);}
          if(b.pierce<=0){
            if(b.originType==='acorn_cannon'&&b.vfxLevel&&b.vfxLevel>=10){
              for(let i=0;i<8;i++){const a=(Math.PI/4)*i;this.particles.push({x:b.x,y:b.y,vx:Math.cos(a)*10,vy:Math.sin(a)*10,radius:6,alpha:1,color:'#ffcc33',life:0,maxLife:30,isGold:true});}
            }
            b.dead=true; break;
          } else {b.pierce--;}
        }
      }
    }

    // Cleanup
    this.particles.forEach(p=>{
      if(p.isGold&&p.life>70){p.life=p.maxLife;return;}
      p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.life++;p.alpha=1-p.life/p.maxLife;p.radius*=0.97;
      if(p.rotation!==undefined) p.rotation+=0.1;
    });
    this.floatingTexts.forEach(ft=>{ft.y-=0.5;ft.life++;});
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.bullets=this.bullets.filter(b=>!b.dead);
    this.particles=this.particles.filter(p=>p.life<p.maxLife);
    this.floatingTexts=this.floatingTexts.filter(ft=>ft.life<ft.maxLife);
    this.enemyProjectiles=this.enemyProjectiles.filter(p=>!p.dead);

    // 웨이브 클리어 판정
    if (this.enemiesLeft===0&&this.enemies.length===0) {
      this.stop();
      const bonus=Math.round((this.state.wave*5*this.state.stage)*this.state.bananaMultiplier);
      this.state.sessionBananas+=bonus;
      this.onBananaEarned(bonus);
      if (this.state.wave>=MAX_WAVES_PER_STAGE) {
        this.onStageClear();
      } else {
        this.state.wave++;
        this.onWaveClear();
      }
    }
  }

  private attackBase(e: Enemy, cx: number, cy: number) {
    if (this.state.hotSpringActiveMs > 0) { e.y -= 5; return; }
    const dmg = e.attackDamage;
    this.state.hp -= dmg;
    this.onHpChange(this.state.hp, this.state.maxHp);
    this.onBaseFlash();
    switch (e.attackType) {
      case 'melee':
        this.particles.push(...createParticle(cx,cy,'#ff4d6d',12,0));
        this.floatingTexts.push(createFloatingText(cx+(Math.random()-0.5)*40,cy-30,`-${dmg}`,'#ff4d6d'));
        sound.baseHit();
        break;
      case 'charge':
        this.particles.push(...createParticle(cx,cy,'#ff6600',20,1));
        this.floatingTexts.push(createFloatingText(cx+(Math.random()-0.5)*40,cy-30,`충돌! -${dmg}`,'#ff6600'));
        this.applyScreenShake(6,300);
        sound.baseHit();
        break;
      case 'poison':
        this.particles.push(...createParticle(cx,cy,'#aaff00',15,2));
        this.floatingTexts.push(createFloatingText(cx+(Math.random()-0.5)*40,cy-30,`독! -${dmg}`,'#aaff00'));
        sound.baseHit();
        // 기지 독 도트
        let poisonMs=3000;
        const poisonDps=Math.round(dmg*0.3);
        const poisonTick=setInterval(()=>{
          if(poisonMs<=0||this.state.hp<=0){clearInterval(poisonTick);return;}
          this.state.hp=Math.max(0,this.state.hp-poisonDps*0.1);
          this.onHpChange(this.state.hp,this.state.maxHp);
          poisonMs-=100;
        },100);
        break;
      case 'ranged':
        this.particles.push(...createParticle(cx,cy,'#cc44ff',8,4));
        this.floatingTexts.push(createFloatingText(cx+(Math.random()-0.5)*40,cy-30,`-${dmg}`,'#cc44ff'));
        sound.baseHit();
        break;
    }
    if (this.state.reflectPercent>0) {
      const rd=dmg*this.state.reflectPercent;
      e.hp-=rd;
      this.particles.push(...createParticle(e.x,e.y,'#aaffff',8,0));
      this.floatingTexts.push(createFloatingText(e.x,e.y-20,`↩${Math.round(rd)}`,'#aaffff'));
      if(e.hp<=0) this.killEnemy(e);
    }
    e.dead=true;
    if(this.state.hp<=0){this.state.hp=0;this.stop();this.onGameOver();}
  }

  private killEnemy(e: Enemy) {
    this.state.score++;

    // 콤보 시스템
    const now = Date.now();
    if (now - this.lastKillTime < 1500) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.lastKillTime = now;

    if(e.traits.includes('splitting')&&e.radius>7) {
      const splits=createSplitEnemy(e);
      for(const s of splits) this.enemies.push(s);
      this.floatingTexts.push(createFloatingText(e.x,e.y-30,'분열!','#ffcc33'));
    }
    this.particles.push(...createParticle(e.x,e.y,'#ffffff',12,5));
    let amount=Math.max(1,Math.round(e.gold*this.state.bananaMultiplier));

    // 콤보 보너스 (3콤보 이상)
    if (this.comboCount >= 3) {
      const multiplier = 1 + (this.comboCount - 2) * 0.2;
      const bonus = Math.floor(amount * (multiplier - 1));
      amount += bonus;
      const comboColor = this.comboCount >= 8 ? '#ff4400' : this.comboCount >= 5 ? '#ff9900' : '#ffdd00';
      this.floatingTexts.push(createFloatingText(
        e.x, e.y - 50,
        `${this.comboCount}x COMBO!`,
        comboColor
      ));
      // 5콤보 이상 → 프렌지 모드 발동
      if (this.comboCount >= 5 && this.state.frenzyModeMs <= 0) {
        this.state.frenzyModeMs = 4000;
        this.floatingTexts.push(createFloatingText(
          this.canvas.width / 2, this.canvas.height / 2 - 80,
          '⚡ FRENZY!', '#ff4400'
        ));
        this.particles.push(...createParticle(this.canvas.width/2, this.canvas.height/2, '#ff4400', 20, 1));
      }
    }

    const targetX=this.canvas.width-40, targetY=30;
    for(let i=0;i<Math.min(amount,8);i++){
      this.particles.push({...createGoldParticle(e.x,e.y,targetX,targetY),life:-i*5});
    }
    sound.enemyDie();
    this.state.sessionBananas+=amount;
    this.floatingTexts.push(createFloatingText(e.x,e.y-20,`+${amount}🍌`,'#ffcc33'));
    if(Math.random()<this.state.lifeStealChance){
      this.state.hp=Math.min(this.state.maxHp,this.state.hp+1);
      this.hitStopTicks=6;
      this.particles.push(...createParticle(this.canvas.width/2,this.canvas.height-40,'#ff4d6d',4));
    }
    this.onBananaEarned(amount);
    this.onKill(e.isBoss??false);
  }

  private applySkillEffect(skillType: string, target: Enemy) {
    const skill=this.state.activeSkills.find(s=>s.type===skillType);
    const lv=skill?.level??1;
    if(skillType==='poison_thorn'){
      const dps=(getSkillStats(skillType,lv)?.poison_dot??5)*this.state.damageMultiplier;
      target.status.poisoned={dps,msLeft:3000};
      if(lv>=7){this.particles.push({x:target.x,y:target.y,vx:0,vy:0,radius:30,alpha:0.8,color:'#aa33ff',life:0,maxLife:100,isPoisonCloud:true});}
      else{this.particles.push(...createParticle(target.x,target.y,'#aaff00',4,2));}
    }
    if(skillType==='mud_artillery'){
      const factor=Math.max(0.2,0.7-lv*0.04);
      target.status.slowed={factor,msLeft:2000+lv*200};
      this.particles.push(...createParticle(target.x,target.y,'#886644',4,3));
    }
    if(skillType==='tropical_lightning'){
      const chains=getSkillStats(skillType,lv)?.chains??0;
      if(chains>0) this.chainLightning(target,chains,lv);
    }
  }

  private chainLightning(origin: Enemy, chains: number, lv: number) {
    const dmg=(getSkillStats('tropical_lightning',lv)?.damage??10)*this.state.damageMultiplier*0.6;
    this.enemies.filter(e=>!e.dead&&e!==origin)
      .sort((a,b)=>((a.x-origin.x)**2+(a.y-origin.y)**2)-((b.x-origin.x)**2+(b.y-origin.y)**2))
      .slice(0,chains).forEach(t=>{
        if(Math.sqrt((t.x-origin.x)**2+(t.y-origin.y)**2)>200) return;
        t.hp-=dmg;
        this.floatingTexts.push(createFloatingText(t.x,t.y,`⚡${Math.round(dmg)}`,'#88eeff'));
        this.particles.push(...createParticle(t.x,t.y,'#88eeff',4,4));
        if(t.hp<=0){t.dead=true;this.killEnemy(t);}
      });
  }

  private applyCharacterPassive(target: Enemy, b: Bullet) {
    const capy=CAPY_TYPES.find(c=>c.id===this.state.selectedCapyType);
    if(!capy||!capy.specialAbility) return;
    if(capy.specialAbility==='knockback'){
      const dx=target.x-(this.canvas.width/2),dy=target.y-(this.canvas.height-40);
      const len=Math.sqrt(dx*dx+dy*dy)||1;
      target.x+=(dx/len)*30;target.y+=(dy/len)*30;
      this.particles.push(...createParticle(target.x,target.y,'#ffffff',4,0));
    }
    if(capy.specialAbility==='magic_blast'&&Math.random()<0.2){
      this.explode(target.x,target.y,b.damage*0.4,60);
      this.particles.push(...createParticle(target.x,target.y,'#d666ff',8,1));
      this.floatingTexts.push(createFloatingText(target.x,target.y-30,'MAGIC!','#d666ff'));
    }
    if(capy.specialAbility==='holy_stun'&&Math.random()<0.15){
      target.status.slowed={factor:0,msLeft:1000};
      this.particles.push(...createParticle(target.x,target.y,'#ffffaa',10,4));
      this.floatingTexts.push(createFloatingText(target.x,target.y-30,'STUN!','#ffff00'));
    }
    if(capy.specialAbility==='nature_grasp'&&Math.random()<0.1){
      target.status.slowed={factor:0.1,msLeft:3000};
      this.particles.push(...createParticle(target.x,target.y,'#2ecc71',6,2));
      this.floatingTexts.push(createFloatingText(target.x,target.y-30,'ROOT!','#2ecc71'));
    }
  }

  private shoot(cx: number, cy: number, tx: number, ty: number, type: string, stats: any, synergyMuddyAcorn=false) {
    const capy=CAPY_TYPES.find(c=>c.id===this.state.selectedCapyType);
    let count=stats.count||1;
    const speed=(stats.speed?stats.speed/50:5)*(this.state.currentWeather==='sandstorm'?1.5:1);
    let damage=(stats.damage||10)*this.state.damageMultiplier*(this.state.currentWeather==='rain'&&(type==='mud_artillery'||type==='tropical_lightning')?1.5:1);
    if(type==='acorn_cannon'&&synergyMuddyAcorn){type='synergy_muddy_acorn';count=15;damage*=1.5;}
    sound.playSkillSound(type);
    if(type==='palm_fall'){
      const cands=this.enemies.filter(e=>!e.dead);
      for(let i=0;i<count;i++){
        const t=cands[Math.floor(Math.random()*Math.min(cands.length,5))]??{x:tx,y:ty};
        this.palmDrops.push({x:t.x+(Math.random()-0.5)*60,y:t.y+(Math.random()-0.5)*60,damage,radius:stats.radius||80,msLeft:700,exploded:false});
      }
      return;
    }
    const angle=Math.atan2(ty-cy,tx-cx);
    const pierce=stats.pierce||0;
    const hasExplo=!!stats.radius||!!stats.explosive;
    let color=capy?.projectileColor||(type==='acorn_cannon'?'#ffcc33':type==='poison_thorn'?'#aaff00':type==='coconut_bomb'?'#885522':type==='mango_laser'?'#ffaa00':type==='homing_seed'?'#88ff44':type==='synergy_muddy_acorn'?'#aa8844':'#ffffff');
    if(capy?.specialAbility==='banana_master') color='#ffd700';
    const scale=capy?.projectileScale||1;
    const isCyber=capy?.specialAbility==='laser_aim';
    const spread=0.2;
    for(let i=0;i<count;i++){
      const a=angle+(i-(count-1)/2)*spread;
      const btx=cx+Math.cos(a)*100,bty=cy+Math.sin(a)*100;
      const bullet=createBullet(cx,cy,btx,bty,speed,damage,pierce,hasExplo,type,color,scale);
      const skill=this.state.activeSkills.find(s=>s.type===type);
      const lv=skill?.level??1;
      if(type==='poison_thorn'){if(lv>=4)bullet.rotation=a;if(lv>=10){bullet.spiralAngle=0;bullet.spiralRadius=10;}}
      else if(type==='acorn_cannon'){if(lv>=4)bullet.rotation=0;if(lv>=7)bullet.stretch=1;}
      else if(type==='coconut_bomb'){if(lv>=4)bullet.pulse=1;if(lv>=7)bullet.chainExplosionsLeft=3;}
      bullet.vfxLevel=lv;
      if(type==='homing_seed'||isCyber) bullet.isHoming=true;
      this.bullets.push(bullet);
      if(lv>=10&&(type==='acorn_cannon'||type==='coconut_bomb'||type==='palm_fall')) this.applyScreenShake(10,200);
    }
  }

  private applyScreenShake(intensity: number, duration: number) {
    const startTime = performance.now();
    const shake = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed < duration) {
        // Easing out the factor for punchier start and smooth end
        const factor = Math.pow(1 - elapsed / duration, 1.5);
        const tx = (Math.random() - 0.5) * intensity * factor;
        const ty = (Math.random() - 0.5) * intensity * factor;
        const rot = (Math.random() - 0.5) * intensity * factor * 0.15; // Subtle rotation
        const scale = 1 + factor * 0.02; // Slight zoom on hit
        this.canvas.style.transform = `translate(${tx}px,${ty}px) rotate(${rot}deg) scale(${scale})`;
        requestAnimationFrame(shake);
      } else { 
        this.canvas.style.transform = 'translate(0px,0px) rotate(0deg) scale(1)'; 
      }
    };
    shake();
  }

  private explode(x: number, y: number, damage: number, radius: number, chainLeft=0, lv=1) {
    this.enemies.filter(e=>!e.dead&&(e.x-x)**2+(e.y-y)**2<radius*radius).forEach(e=>{
      e.hp-=damage;this.floatingTexts.push(createFloatingText(e.x,e.y,`-${Math.round(damage)}`,'#ff4d6d'));
      if(e.hp<=0){e.dead=true;this.killEnemy(e);}
    });
    if(lv>=10&&chainLeft!==undefined){
      this.particles.push({x,y,vx:0,vy:0,radius:radius*2,alpha:1,color:'#ffffff',life:0,maxLife:30,isMushroomCloud:true});
      const flash=document.getElementById('baseFlash')!;
      flash.style.background='rgba(255,200,100,0.2)';
      flash.classList.remove('flash');void flash.offsetWidth;flash.classList.add('flash');
      setTimeout(()=>flash.style.background='rgba(255,0,0,0.5)',500);
      
      this.hitStopTicks = 12; // Massive hitstop for huge explosions
      this.applyScreenShake(25, 600); // Massive screen shake
    } else {
      this.particles.push(...createParticle(x,y,'#ffcc33',16,1));
    }
    if(chainLeft>0){
      for(let i=0;i<3;i++){
        const a=Math.random()*Math.PI*2,sp=2+Math.random()*3;
        const nb=createBullet(x,y,x+Math.cos(a)*50,y+Math.sin(a)*50,sp,damage*0.5,0,true,'coconut_bomb','#885522',0.5);
        nb.chainExplosionsLeft=0;nb.vfxLevel=lv;nb.fuseTicks=15;
        this.bullets.push(nb);
      }
    }
  }

  private getNearestEnemy(cx: number, cy: number): Enemy | null {
    // "First" targeting: pick enemy farthest along path (highest Y = most dangerous)
    let best: Enemy | null = null;
    let bestY = -Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.y > bestY) { bestY = e.y; best = e; }
    }
    return best;
  }

  private draw() {
    render(this.ctx,this.canvas.width,this.canvas.height,this.enemies,this.bullets,this.particles,this.floatingTexts,this.palmDrops,this.state,this.turretAngle,this.getBoss(),this.traps,this.enemyProjectiles);
  }
}
