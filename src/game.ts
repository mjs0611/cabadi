import type { GameState } from './state.ts';
import {
  type Enemy, type Bullet, type Particle, type FloatingText, type PalmDrop,
  createEnemy, createBullet, createParticle, createFloatingText,
} from './entities.ts';
import { render } from './renderer.ts';
import { getSkillStats } from './data.ts';
import { sound } from './sound.ts';

function enemiesForWave(wave: number) { return 5 + wave * 3; }

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState;
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private palmDrops: PalmDrop[] = [];

  private rafId = 0;
  private lastTime = 0;
  private turretAngle = 0;
  private manualAngle: number | null = null;
  private isPointerDown = false;

  // 웨이브 스폰
  private enemiesLeft = 0;
  private spawnInterval = 0;
  private lastSpawn = 0;

  private onWaveClear: () => void;
  private onGameOver: () => void;
  private onHpChange: (hp: number, maxHp: number) => void;
  private onBananaEarned: (amount: number) => void;
  private onKill: (isBoss: boolean) => void;
  private onBaseFlash: () => void;
  private onBossSpawn: (enemy: Enemy) => void;

  private paused = false;
  private reviveUsed = false;

  constructor(
    canvas: HTMLCanvasElement,
    state: GameState,
    onWaveClear: () => void,
    onGameOver: () => void,
    onHpChange: (hp: number, maxHp: number) => void,
    onBananaEarned: (amount: number) => void,
    onKill: (isBoss: boolean) => void,
    onBaseFlash: () => void,
    onBossSpawn: (enemy: Enemy) => void,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.state = state;
    this.onWaveClear = onWaveClear;
    this.onGameOver = onGameOver;
    this.onHpChange = onHpChange;
    this.onBananaEarned = onBananaEarned;
    this.onKill = onKill;
    this.onBaseFlash = onBaseFlash;
    this.onBossSpawn = onBossSpawn;

    this.initInput();
  }

  private initInput() {
    const handleInput = (x: number, y: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const lx = x - rect.left;
      const ly = y - rect.top;
      const dx = lx - (this.canvas.width / 2);
      const dy = ly - (this.canvas.height / 2);
      this.manualAngle = Math.atan2(dy, dx);
    };

    this.canvas.addEventListener('mousedown', (e) => { 
      this.isPointerDown = true; 
      handleInput(e.clientX, e.clientY); 
    });
    window.addEventListener('mousemove', (e) => { 
      if (this.isPointerDown) handleInput(e.clientX, e.clientY); 
    });
    window.addEventListener('mouseup', () => { 
      this.isPointerDown = false; 
      this.manualAngle = null; 
    });

    this.canvas.addEventListener('touchstart', (e) => {
      this.isPointerDown = true;
      handleInput(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (this.isPointerDown) handleInput(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    window.addEventListener('touchend', () => { 
      this.isPointerDown = false; 
      this.manualAngle = null; 
    });
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    cancelAnimationFrame(this.rafId);
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  revive() {
    if (this.reviveUsed) return;
    this.reviveUsed = true;
    this.state.hp = Math.floor(this.state.maxHp * 0.5);
    this.state.phase = 'playing';
    this.startWave();
  }

  getBoss(): Enemy | null {
    return this.enemies.find(e => !e.dead && e.isBoss) ?? null;
  }

  startWave() {
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.floatingTexts = [];
    this.palmDrops = [];
    this.enemiesLeft = enemiesForWave(this.state.wave);
    this.spawnInterval = Math.max(300, 1200 - this.state.wave * 50);
    this.lastSpawn = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }

  private loop = (now: number) => {
    if (this.state.phase !== 'playing') return;
    const dt = Math.min(now - this.lastTime, 50);
    this.lastTime = now;
    this.update(now, dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(now: number, dt: number) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2, cy = h / 2;

    // 스폰
    if (this.enemiesLeft > 0 && now - this.lastSpawn > this.spawnInterval) {
      const enemy = createEnemy(w, h, this.state.wave);
      this.enemies.push(enemy);
      if (enemy.isBoss) this.onBossSpawn(enemy);
      this.enemiesLeft--;
      this.lastSpawn = now;
    }

    // 적 이동
    for (const e of this.enemies) {
      if (e.dead) continue;

      // DoT 처리
      if (e.status.poisoned) {
        const p = e.status.poisoned;
        e.hp -= p.dps * (dt / 1000);
        p.msLeft -= dt;
        if (p.msLeft <= 0) delete e.status.poisoned;
        if (e.hp <= 0) { this.killEnemy(e); continue; }
      }
      if (e.status.slowed) {
        e.status.slowed.msLeft -= dt;
        if (e.status.slowed.msLeft <= 0) delete e.status.slowed;
      }

      const dx = cx - e.x, dy = cy - e.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const slowFactor = e.status.slowed ? e.status.slowed.factor : 1;
      e.x += (dx / len) * e.speed * slowFactor;
      e.y += (dy / len) * e.speed * slowFactor;

      // 기지 충돌
      if (len < 40 + e.radius) {
        const dmg = e.isBoss ? 30 : e.maxHp > 1000 ? 20 : 10;
        this.state.hp -= dmg;
        this.onHpChange(this.state.hp, this.state.maxHp);
        this.onBaseFlash();

        // Reflect Damage
        if (this.state.reflectPercent > 0) {
          const reflectDmg = dmg * this.state.reflectPercent;
          e.hp -= reflectDmg;
          this.particles.push(...createParticle(e.x, e.y, '#aaffff', 8, 0));
          this.floatingTexts.push(createFloatingText(e.x, e.y - 20, `↩${Math.round(reflectDmg)}`, '#aaffff'));
          if (e.hp <= 0) this.killEnemy(e);
        } else {
          this.particles.push(...createParticle(e.x, e.y, '#ff4d6d', 8));
        }

        e.dead = true;

        if (this.state.hp <= 0) {
          this.state.hp = 0;
          this.stop();
          this.onGameOver();
          return;
        }
      }
    }

    // 조준 및 발사
    const nearest = this.getNearestEnemy(cx, cy);
    if (this.manualAngle !== null) {
      this.turretAngle = this.manualAngle;
    } else if (nearest) {
      this.turretAngle = Math.atan2(nearest.y - cy, nearest.x - cx);
    }

    if (nearest || this.manualAngle !== null) {
      for (const skill of this.state.activeSkills) {
        const stats = getSkillStats(skill.type, skill.level);
        if (!stats) continue;

        const cooldown = (stats.cooldown || 0.6) * 1000 * this.state.fireRateMultiplier;
        if (now - skill.lastShot >= cooldown) {
          const tx = this.manualAngle !== null ? cx + Math.cos(this.manualAngle) * 200 : nearest!.x;
          const ty = this.manualAngle !== null ? cy + Math.sin(this.manualAngle) * 200 : nearest!.y;
          this.shoot(cx, cy, tx, ty, skill.type, stats);
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

    // 투사체 이동
    for (const b of this.bullets) {
      if (b.dead) continue;
      if (b.isHoming) {
        if (!b.homingTarget || b.homingTarget.dead) b.homingTarget = this.getNearestEnemy(b.x, b.y);
        if (b.homingTarget) {
          const hdx = b.homingTarget.x - b.x, hdy = b.homingTarget.y - b.y;
          const hlen = Math.sqrt(hdx*hdx + hdy*hdy) || 1;
          const spd = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
          b.vx += (hdx/hlen*spd - b.vx)*0.12; b.vy += (hdy/hlen*spd - b.vy)*0.12;
          const nl = Math.sqrt(b.vx*b.vx + b.vy*b.vy) || 1;
          b.vx = b.vx/nl*spd; b.vy = b.vy/nl*spd;
        }
      }
      b.x += b.vx; b.y += b.vy;
      if (b.x < -100 || b.x > w+100 || b.y < -100 || b.y > h+100) { b.dead = true; continue; }

      for (const e of this.enemies) {
        if (e.dead || b.hitEnemies.has(e)) continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx*dx + dy*dy < (b.radius + e.radius)**2) {
          b.hitEnemies.add(e); 
          let finalDmg = b.damage;
          const isCrit = Math.random() < this.state.critChance;
          if (isCrit) {
            finalDmg *= 2;
            this.floatingTexts.push(createFloatingText(e.x, e.y - 20, 'CRIT!', '#ff0055'));
          }
          e.hp -= finalDmg;
          // VFX: Impact Spark (0)
          this.particles.push(...createParticle(b.x, b.y, b.color, 4, 0));
          this.floatingTexts.push(createFloatingText(e.x, e.y, `-${Math.round(finalDmg)}`, isCrit ? '#ff0055' : '#ff9a3c'));
          sound.monsterHit();
          if (b.hasExplosion) this.explode(b.x, b.y, finalDmg * 0.5, 80);
          this.applySkillEffect(b.originType, e);
          if (e.hp <= 0) { e.dead = true; this.killEnemy(e); }
          if (b.pierce <= 0) { b.dead = true; break; } else { b.pierce--; }
        }
      }
    }

    // Effect cleanup
    this.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life++; p.alpha = 1 - p.life/p.maxLife; p.radius *= 0.97; });
    this.floatingTexts.forEach(ft => { ft.y -= 0.5; ft.life++; });
    this.enemies = this.enemies.filter(e => !e.dead);
    this.bullets = this.bullets.filter(b => !b.dead);
    this.particles = this.particles.filter(p => p.life < p.maxLife);
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life < ft.maxLife);

    if (this.enemiesLeft === 0 && this.enemies.length === 0) {
      this.stop();
      const bonus = Math.round((this.state.wave * 5) * this.state.bananaMultiplier);
      this.state.sessionBananas += bonus;
      this.onBananaEarned(bonus);
      this.state.wave++;
      this.onWaveClear();
    }
  }

  private killEnemy(e: Enemy) {
    this.state.score++;
    // VFX: Water/Soul Splash (5)
    this.particles.push(...createParticle(e.x, e.y, '#ffffff', 12, 5));
    sound.enemyDie();
    const earned = Math.max(1, Math.round(e.gold * this.state.bananaMultiplier));
    this.state.sessionBananas += earned;
    this.floatingTexts.push(createFloatingText(e.x, e.y - 20, `+${earned}🍌`, '#ffcc33'));
    
    // Life Steal
    if (Math.random() < this.state.lifeStealChance) {
      this.state.hp = Math.min(this.state.maxHp, this.state.hp + 1);
      this.particles.push(...createParticle(this.canvas.width/2, this.canvas.height/2, '#ff4d6d', 4)); 
    }

    this.onBananaEarned(earned);
    this.onKill(e.isBoss ?? false);
  }

  private applySkillEffect(skillType: string, target: Enemy) {
    const skill = this.state.activeSkills.find(s => s.type === skillType);
    const lv = skill?.level ?? 1;
    if (skillType === 'poison_thorn') {
      const dps = (getSkillStats(skillType, lv)?.poison_dot ?? 5) * this.state.damageMultiplier;
      target.status.poisoned = { dps, msLeft: 3000 };
      // VFX: Poison Cloud (2)
      this.particles.push(...createParticle(target.x, target.y, '#aaff00', 4, 2));
    }
    if (skillType === 'mud_artillery') {
      const factor = Math.max(0.2, 0.7 - lv * 0.04);
      target.status.slowed = { factor, msLeft: 2000 + lv * 200 };
      // VFX: Mud Splash (3)
      this.particles.push(...createParticle(target.x, target.y, '#886644', 4, 3));
    }
    if (skillType === 'tropical_lightning') {
      const chains = getSkillStats(skillType, lv)?.chains ?? 0;
      if (chains > 0) this.chainLightning(target, chains, lv);
    }
  }

  private chainLightning(origin: Enemy, chains: number, lv: number) {
    const dmg = (getSkillStats('tropical_lightning', lv)?.damage ?? 10) * this.state.damageMultiplier * 0.6;
    this.enemies.filter(e => !e.dead && e !== origin)
      .sort((a,b) => ((a.x-origin.x)**2+(a.y-origin.y)**2) - ((b.x-origin.x)**2+(b.y-origin.y)**2))
      .slice(0, chains).forEach(t => {
        if (Math.sqrt((t.x-origin.x)**2+(t.y-origin.y)**2) > 200) return;
        t.hp -= dmg; 
        this.floatingTexts.push(createFloatingText(t.x, t.y, `⚡${Math.round(dmg)}`, '#88eeff'));
        // VFX: Lightning (4)
        this.particles.push(...createParticle(t.x, t.y, '#88eeff', 4, 4));
        if (t.hp <= 0) { t.dead = true; this.killEnemy(t); }
      });
  }

  private shoot(cx: number, cy: number, tx: number, ty: number, type: string, stats: any) {
    const count = stats.count || 1;
    const speed = stats.speed ? stats.speed / 50 : 5;
    const damage = (stats.damage || 10) * this.state.damageMultiplier;
    sound.playSkillSound(type);
    if (type === 'palm_fall') {
      const cands = this.enemies.filter(e => !e.dead);
      for(let i=0; i<count; i++) {
        const t = cands[Math.floor(Math.random()*Math.min(cands.length, 5))] ?? {x: tx, y: ty};
        this.palmDrops.push({ x: t.x+(Math.random()-0.5)*60, y: t.y+(Math.random()-0.5)*60, damage, radius: stats.radius || 80, msLeft: 700, exploded: false });
      }
      return;
    }
    const angle = Math.atan2(ty - cy, tx - cx);
    const pierce = stats.pierce || 0;
    const hasExplo = !!stats.radius || !!stats.explosive;
    const color = type === 'acorn_cannon' ? '#ffcc33' : type === 'poison_thorn' ? '#aaff00' : type === 'coconut_bomb' ? '#885522' : type === 'mango_laser' ? '#ffaa00' : type === 'homing_seed' ? '#88ff44' : '#ffffff';
    const spread = 0.2;
    for(let i=0; i<count; i++) {
      const a = angle + (i - (count-1)/2)*spread;
      const btx = cx + Math.cos(a)*100, bty = cy + Math.sin(a)*100;
      const bullet = createBullet(cx, cy, btx, bty, speed, damage, pierce, hasExplo, type, color);
      if (type === 'homing_seed') bullet.isHoming = true;
      this.bullets.push(bullet);
    }
  }

  private explode(x: number, y: number, damage: number, radius: number) {
    this.enemies.filter(e => !e.dead && (e.x-x)**2+(e.y-y)**2 < radius*radius).forEach(e => {
      e.hp -= damage; this.floatingTexts.push(createFloatingText(e.x, e.y, `-${Math.round(damage)}`, '#ff4d6d'));
      if (e.hp <= 0) { e.dead = true; this.killEnemy(e); }
    });
    // VFX: Explosion (1)
    this.particles.push(...createParticle(x, y, '#ffcc33', 16, 1));
  }

  private getNearestEnemy(cx: number, cy: number): Enemy | null {
    let nearest: Enemy | null = null, minDist = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = (e.x - cx) ** 2 + (e.y - cy) ** 2;
      if (d < minDist) { minDist = d; nearest = e; }
    }
    return nearest;
  }

  private draw() {
    render(this.ctx, this.canvas.width, this.canvas.height, this.enemies, this.bullets, this.particles, this.floatingTexts, this.palmDrops, this.state, this.turretAngle, this.getBoss());
  }
}
