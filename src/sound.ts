// Web Audio API 기반 효과음 (파일 없이 합성음으로 구현)
class SoundManager {
  private ctx: AudioContext | null = null;
  private _enabled = true;

  get enabled() { return this._enabled; }

  private getCtx(): AudioContext | null {
    if (!this._enabled) return null;
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { return null; }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggle(): boolean {
    this._enabled = !this._enabled;
    if (!this._enabled && this.ctx) {
      this.ctx.suspend().catch(() => {});
    } else if (this._enabled && this.ctx) {
      this.ctx.resume().catch(() => {});
    }
    return this._enabled;
  }

  suspend() {
    this.ctx?.suspend().catch(() => {});
  }

  resume() {
    if (this._enabled) this.ctx?.resume().catch(() => {});
  }

  // 스킬별 발사음
  playSkillSound(type: string) {
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);

    switch (type) {
      case 'acorn_cannon':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
        gain.gain.setValueAtTime(0.1, t);
        break;
      case 'coconut_bomb':
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
        gain.gain.setValueAtTime(0.15, t);
        break;
      case 'poison_thorn':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);
        gain.gain.setValueAtTime(0.08, t);
        break;
      case 'mango_laser':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(1200, t + 0.3);
        gain.gain.setValueAtTime(0.05, t);
        break;
      case 'tropical_lightning':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2000, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        gain.gain.setValueAtTime(0.1, t);
        break;
      default:
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        gain.gain.setValueAtTime(0.1, t);
    }

    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.start(t); osc.stop(t + 0.2);
  }

  // 몬스터 피격음 (Splat/Hit)
  monsterHit() {
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.05);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.start(t); osc.stop(t + 0.05);
  }

  // 적 사망
  enemyDie() {
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t); osc.stop(t + 0.15);
  }

  // 기지 피격
  baseHit() {
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lpf = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    
    osc.connect(lpf); lpf.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(400, t);
    
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t); osc.stop(t + 0.3);
  }

  // 웨이브 클리어 — 경쾌한 트로피컬 실로폰 느낌
  waveClear() {
    const ctx = this.getCtx(); if (!ctx) return;
    const notes = [523, 659, 784, 1047, 1318]; // C5-E5-G5-C6-E6
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle'; // 실로폰 느낌
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
    });
  }

  // 게임 오버 — 하강 음
  gameOver() {
    const ctx = this.getCtx(); if (!ctx) return;
    const notes = [523, 415, 330, 220]; // 하강
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
    });
  }

  // 강화 선택
  upgrade() {
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    [784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.1);
      gain.gain.setValueAtTime(0.15, t + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.2);
      osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.2);
    });
  }
}

export const sound = new SoundManager();
