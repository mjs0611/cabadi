import { createInitialState } from './state.ts';
import { Game } from './game.ts';
import type { Enemy } from './entities.ts';
import { pickUpgrades } from './upgrades.ts';
import { sound } from './sound.ts';
import { CAPY_SHOP } from './capy_shop.ts';
import { CAPY_TYPES } from './capy_types.ts';
import {
  getBananas, addBananas, spendBananas,
  getCapyUpgrades, saveCapyUpgrades,
  getBestWave, saveBestWave,
} from './store.ts';
import {
  resetIfNewDay, getTodayMissions, updateMissionProgress, claimMissionReward,
} from './missions.ts';
import { SKILLS } from './data.ts';

// ── AIT ──────────────────────────────────────────────────────────────────────
const AIT_AD_GROUP_ID = 'ait.v2.live.CABADI_AD_GROUP_ID';
let ait: any = null;
let aitAdLoaded = false;

import('@apps-in-toss/web-framework').then((m) => {
  ait = m;
  preloadAd();
  m.getUserKeyForGame().then((result: any) => {
    if (result && result.type === 'HASH') {
      userHash = result.hash;
      localStorage.setItem('userHash', result.hash);
      resetIfNewDay(userHash);
    }
  }).catch(() => {});
}).catch(() => {});

function preloadAd() {
  if (!ait) return;
  aitAdLoaded = false;
  ait.loadFullScreenAd({
    options: { adGroupId: AIT_AD_GROUP_ID },
    onEvent: () => { aitAdLoaded = true; },
    onError: () => { aitAdLoaded = false; },
  });
}

async function showAd(onDone: () => void) {
  if (ait && aitAdLoaded) {
    aitAdLoaded = false;
    ait.showFullScreenAd({
      options: { adGroupId: AIT_AD_GROUP_ID },
      onEvent: (event: any) => {
        if (event.type === 'dismissed' || event.type === 'userEarnedReward') {
          onDone();
          preloadAd();
        } else if (event.type === 'failedToShow') {
          showAdFallback(onDone);
        }
      },
      onError: () => { showAdFallback(onDone); },
    });
    return;
  }
  showAdFallback(onDone);
}

function showAdFallback(onDone: () => void) {
  const el = document.getElementById('adScreen')!;
  el.classList.add('show');
  let cnt = 3;
  const box = document.getElementById('adCount')!;
  box.textContent = String(cnt);
  const interval = setInterval(() => {
    cnt--; box.textContent = String(cnt);
    if (cnt <= 0) { clearInterval(interval); el.classList.remove('show'); onDone(); }
  }, 1000);
}

// ── Skill Icons ──────────────────────────────────────────────────────────────
const SKILL_ICONS: Record<string, string> = {
  acorn_cannon: '🌰',
  poison_thorn: '🌵',
  coconut_bomb: '🥥',
  mango_laser: '🥭',
  homing_seed: '🌱',
  mud_artillery: '⚱️',
  tropical_lightning: '⚡',
  palm_fall: '🌴',
  hp_regen: '💚',
  shield: '🛡️',
  speed_boost: '💨',
};

// ── Elements ─────────────────────────────────────────────────────────────────
const intro             = document.getElementById('intro')!;
const startBtn          = document.getElementById('startBtn')!;
const topBar            = document.getElementById('topBar')!;
const bottomNav         = document.getElementById('bottomNav')!;
const lobbyTabs         = document.getElementById('lobbyTabs')!;

const lobbyBananaCountTop = document.getElementById('lobbyBananaCountTop')!;
const lobbyBestWaveTop    = document.getElementById('lobbyBestWaveTop')!;

// Home Tab Elements
const lobbyAdBuffBtn    = document.getElementById('lobbyAdBuffBtn') as HTMLButtonElement;
const lobbyBattleBtn    = document.getElementById('lobbyBattleBtn')!;

// HUD
const hud               = document.getElementById('hud')!;
const waveNum           = document.getElementById('waveNum')!;
const hpFill            = document.getElementById('hpFill')!;
const hudBananas        = document.getElementById('hudBananas')!;
const hudMissionsBtn    = document.getElementById('hudMissionsBtn')!;
const soundBtn          = document.getElementById('soundBtn')!;

// Overlays
const upgradeScreen     = document.getElementById('upgradeScreen')!;
const upgradeCards      = document.getElementById('upgradeCards')!;
const gameOverEl        = document.getElementById('gameOver')!;
const goScore           = document.getElementById('goScore')!;
const goBest            = document.getElementById('goBest')!;
const goBananaEarned    = document.getElementById('goBananaEarned')!;
const reviveBtn         = document.getElementById('reviveBtn')!;
const retryBtn          = document.getElementById('retryBtn')!;
const goLobbyBtn        = document.getElementById('goLobbyBtn')!;
const doubleBananaBtn   = document.getElementById('doubleBananaBtn') as HTMLButtonElement;

// Tab Containers
const shopItems         = document.getElementById('shopItems')!;
const missionsItems     = document.getElementById('missionsItems')!;
const upgradesItems     = document.getElementById('upgradesItems')!;
const skillSettingList   = document.getElementById('skillSettingList')!;

const waveAnnounce      = document.getElementById('waveAnnounce')!;
const baseFlash         = document.getElementById('baseFlash')!;

// ── State ───────────────────────────────────────────────────────────────────
let userHash: string = localStorage.getItem('userHash') ?? 'guest';
let state = createInitialState(getCapyUpgrades(userHash));
let game: Game | null = null;
let buffActiveInLobby = false;

resetIfNewDay(userHash);

// ── Logic ────────────────────────────────────────────────────────────────────
function updateLobbyStats() {
  const upgrades = getCapyUpgrades(userHash);
  const capyType = CAPY_TYPES.find(t => t.id === upgrades.selectedCapyType) || CAPY_TYPES[0];
  
  lobbyBananaCountTop.textContent = String(getBananas(userHash));
  lobbyBestWaveTop.textContent = String(getBestWave(userHash));
  
  const nameEl = document.querySelector('.top-name');
  if (nameEl) nameEl.textContent = capyType.name;
  
  const lobbyHeroImg = document.querySelector('#lobbyCapybaraHero img') as HTMLImageElement;
  if (lobbyHeroImg) {
    lobbyHeroImg.src = '/assets/images/intro_hero.png';
    lobbyHeroImg.style.filter = 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))';
  }
}

function showTab(tabId: string) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  if (tabId === 'shop') renderShop();
  if (tabId === 'upgrades') renderUpgrades();
  if (tabId === 'missions') renderMissions();
  if (tabId === 'skills') renderSkillSetting();
  
  updateLobbyStats();
}

function openLobby() {
  intro.classList.add('hidden');
  topBar.classList.remove('hidden');
  bottomNav.classList.remove('hidden');
  lobbyTabs.classList.remove('hidden');
  showTab('home');
}

function startGame() {
  state.phase = 'playing';
  topBar.classList.add('hidden');
  bottomNav.classList.add('hidden');
  lobbyTabs.classList.add('hidden');
  hud.classList.add('show');
  gameOverEl.classList.remove('show');
  upgradeScreen.classList.remove('show');
  reviveBtn.style.display = '';

  waveNum.textContent = String(state.wave);
  updateHpBar(state.hp, state.maxHp);
  hudBananas.innerHTML = `<span class="icon icon-gold"></span> ${state.sessionBananas}`;
  updateSkillSlots();

  game = makeGame();
  showWaveAnnounce(state.wave);
  game.startWave();
}

function makeGame() {
  return new Game(canvas, state, onWaveClear, onGameOver, onHpChange, onBananaEarned, onKill, onBaseFlash, onBossSpawn);
}

// ── Rendering ────────────────────────────────────────────────────────────────
function renderShop() {
  const upgrades = getCapyUpgrades(userHash);
  const bananas = getBananas(userHash);
  shopItems.innerHTML = '';
  shopItems.className = 'slot-grid';

  for (const capy of CAPY_TYPES) {
    const isUnlocked = upgrades.unlockedCapyTypes.includes(capy.id);
    const isSelected = upgrades.selectedCapyType === capy.id;
    const canAfford = bananas >= capy.cost;

    const el = document.createElement('div');
    el.className = 'slot-card';
    el.innerHTML = `
      <div class="slot-card-icon">${capy.icon}</div>
      <div class="slot-card-name">${capy.name}</div>
      <button class="slot-card-btn ${isSelected ? 'active' : (isUnlocked || canAfford) ? '' : 'locked'}">
        ${isSelected ? '장착 중' : isUnlocked ? '선택' : `${capy.cost} <span class="icon icon-gold"></span>`}
      </button>
    `;

    const btn = el.querySelector('button')!;
    btn.addEventListener('click', () => {
      if (isSelected) return;
      if (isUnlocked || spendBananas(userHash, capy.cost)) {
        if (!isUnlocked) upgrades.unlockedCapyTypes.push(capy.id);
        upgrades.selectedCapyType = capy.id;
        saveCapyUpgrades(userHash, upgrades);
        sound.upgrade();
        renderShop();
        updateLobbyStats();
        state = createInitialState(upgrades);
      }
    });

    shopItems.appendChild(el);
  }
}

function renderUpgrades() {
  const upgrades = getCapyUpgrades(userHash);
  const bananas = getBananas(userHash);
  upgradesItems.innerHTML = '';
  upgradesItems.className = 'slot-grid';

  for (const item of CAPY_SHOP) {
    const currentLevel = (upgrades as any)[item.id] as number;
    const isMax = currentLevel >= item.maxLevel;
    const cost = isMax ? 0 : item.cost(currentLevel);
    const canAfford = bananas >= cost;

    const el = document.createElement('div');
    el.className = 'slot-card';
    el.innerHTML = `
      <div class="slot-card-icon">${item.icon}</div>
      <div class="slot-card-name" style="height:auto; font-size:10px;">${item.name}<br>Lv.${currentLevel}</div>
      <button class="slot-card-btn ${isMax ? 'active' : canAfford ? '' : 'locked'}">
        ${isMax ? 'MAX' : `${cost} <span class="icon icon-gold"></span>`}
      </button>
    `;

    if (!isMax) {
      el.querySelector('button')!.addEventListener('click', () => {
        if (spendBananas(userHash, cost)) {
          (upgrades as any)[item.id]++;
          saveCapyUpgrades(userHash, upgrades);
          sound.upgrade();
          renderUpgrades();
        }
      });
    }
    upgradesItems.appendChild(el);
  }
}

function renderMissions() {
  const missions = getTodayMissions(userHash);
  missionsItems.innerHTML = '';
  missionsItems.className = 'list-layout';

  for (const m of missions) {
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `
      <div class="list-item-content">
        <div class="list-item-name">${m.desc}</div>
        <div class="list-item-desc">${m.progress}/${m.goal} 완료됨</div>
      </div>
      <button class="list-item-btn ${m.claimed ? 'claimed' : m.completed ? '' : 'locked'}">
        ${m.claimed ? '완료' : m.completed ? `받기` : `🔒 ${m.reward}`}
      </button>
    `;
    if (m.completed && !m.claimed) {
      el.querySelector('button')!.addEventListener('click', () => {
        const reward = claimMissionReward(userHash, m.id);
        if (reward > 0) {
          addBananas(userHash, reward);
          sound.upgrade();
          renderMissions();
        }
      });
    }
    missionsItems.appendChild(el);
  }
}

function renderSkillSetting() {
  skillSettingList.innerHTML = '';
  skillSettingList.className = 'slot-grid';

  for (const id in SKILLS) {
    const s = (SKILLS as any)[id];
    const isUnlocked = state.unlockedSkills.includes(id);
    const isActive = state.startingSkillId === id;
    
    const el = document.createElement('div');
    el.className = `slot-card tier-${s.tier || 'normal'}`;
    el.innerHTML = `
      <span class="tier-label">${s.tier || 'normal'}</span>
      <div class="slot-card-icon">${SKILL_ICONS[id] || '❓'}</div>
      <div class="slot-card-name">${s.name}</div>
      <button class="slot-card-btn ${isActive ? 'active' : isUnlocked ? '' : 'locked'}">
        ${isActive ? '장착 중' : isUnlocked ? '장착' : '잠김'}
      </button>
    `;
    if (isUnlocked && !isActive) {
      el.querySelector('button')!.addEventListener('click', () => {
        state.startingSkillId = id;
        const upgrades = getCapyUpgrades(userHash);
        upgrades.startingSkillId = id;
        saveCapyUpgrades(userHash, upgrades);
        renderSkillSetting();
        sound.upgrade();
      });
    }
    skillSettingList.appendChild(el);
  }
}

// ── Callbacks ────────────────────────────────────────────────────────────────
function onHpChange(hp: number, maxHp: number) { updateHpBar(hp, maxHp); sound.baseHit(); }
function onBananaEarned() { hudBananas.innerHTML = `<span class="icon icon-gold"></span> ${state.sessionBananas}`; }
function onKill(isBoss: boolean) {
  updateMissionProgress(userHash, 'kills', 1);
  updateMissionProgress(userHash, 'session_bananas', state.sessionBananas);
  if (isBoss) updateMissionProgress(userHash, 'bosses', 1);
}
function onBaseFlash() { baseFlash.classList.remove('flash'); void baseFlash.offsetWidth; baseFlash.classList.add('flash'); }
function onBossSpawn(_e: any) {}
function onWaveClear() {
  state.phase = 'upgrade';
  updateMissionProgress(userHash, 'waves', 1);
  sound.waveClear();
  showUpgradeScreen();
}
function onGameOver() {
  state.phase = 'gameover';
  hud.classList.remove('show');
  addBananas(userHash, state.sessionBananas);
  saveBestWave(userHash, state.wave - 1);
  const best = getBestWave(userHash);
  goScore.textContent = String(state.wave - 1);
  goBest.textContent = `최고 기록 ${best} WAVES`;
  goBananaEarned.textContent = `+${state.sessionBananas}`;
  gameOverEl.classList.add('show');
  doubleBananaBtn.style.display = state.sessionBananas > 0 ? 'block' : 'none';
  sound.gameOver();
}

function updateHpBar(hp: number, maxHp: number) { hpFill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`; }
function updateSkillSlots() {
  const container = document.getElementById('skillSlots')!;
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    slot.className = `skill-slot ${state.activeSkills[i] ? '' : 'empty'}`;
    const s = state.activeSkills[i];
    if (s) slot.innerHTML = `${(SKILL_ICONS as any)[s.type] || '❓'}<div class="level-badge">Lv.${s.level}</div>`;
    container.appendChild(slot);
  }
}
function showWaveAnnounce(w: number) { waveAnnounce.classList.remove('show'); void waveAnnounce.offsetWidth; waveAnnounce.textContent = `WAVE ${w}`; waveAnnounce.classList.add('show'); }

function showUpgradeScreen() {
  const upgrades = pickUpgrades(state, 3);
  upgradeCards.innerHTML = '';
  for (const u of upgrades) {
    const card = document.createElement('div');
    card.className = 'upgradeCard';
    
    let icon = '✨';
    if (u.id.startsWith('level_up_')) {
      const skillId = u.id.replace('level_up_', '');
      icon = SKILL_ICONS[skillId] || '✨';
    } else if (u.id.startsWith('new_skill_')) {
      const skillId = u.id.replace('new_skill_', '');
      icon = SKILL_ICONS[skillId] || '✨';
    } else if (u.id === 'hp_recover') {
      icon = '💚';
    } else if (u.id === 'max_hp_up') {
      icon = '💪';
    }

    card.innerHTML = `<div class="upgradeCard-icon">${icon}</div><div class="upgradeCard-name">${u.name}</div><div class="upgradeCard-desc">${u.desc}</div>`;
    card.addEventListener('click', () => {
      u.apply(state);
      upgradeScreen.classList.remove('show');
      state.phase = 'playing';
      waveNum.textContent = String(state.wave);
      updateHpBar(state.hp, state.maxHp);
      updateSkillSlots();
      hud.classList.add('show');
      sound.upgrade();
      game = makeGame();
      showWaveAnnounce(state.wave);
      game.startWave();
    });
    upgradeCards.appendChild(card);
  }
  upgradeScreen.classList.add('show');
}

function doRevive() {
  if (!game) return;
  gameOverEl.classList.remove('show');
  hud.classList.add('show');
  updateHpBar(Math.floor(state.maxHp * 0.5), state.maxHp);
  game.revive();
}

// ── Events ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

startBtn.addEventListener('click', openLobby);
lobbyBattleBtn.addEventListener('click', startGame);
lobbyAdBuffBtn.addEventListener('click', () => {
  if (buffActiveInLobby) return;
  showAd(() => {
    buffActiveInLobby = true;
    state.adBuffActive = true;
    state.damageMultiplier *= 1.3;
    lobbyAdBuffBtn.textContent = '✅ 공격 버프 활성화';
    lobbyAdBuffBtn.classList.add('activated');
  });
});

document.querySelectorAll('.nav-btn').forEach(b => {
  b.addEventListener('click', () => {
    const tab = b.getAttribute('data-tab');
    if (tab) showTab(tab);
  });
});

reviveBtn.addEventListener('click', () => { reviveBtn.style.display = 'none'; showAd(doRevive); });
doubleBananaBtn.addEventListener('click', () => {
  showAd(() => {
    doubleBananaBtn.style.display = 'none';
    addBananas(userHash, state.sessionBananas);
    goBananaEarned.textContent = `+${state.sessionBananas * 2} (2배!)`;
  });
});
retryBtn.addEventListener('click', () => { state = createInitialState(getCapyUpgrades(userHash)); openLobby(); });
goLobbyBtn.addEventListener('click', () => { gameOverEl.classList.remove('show'); openLobby(); });
hudMissionsBtn.addEventListener('click', () => { game?.pause(); topBar.classList.remove('hidden'); bottomNav.classList.remove('hidden'); lobbyTabs.classList.remove('hidden'); showTab('missions'); });
soundBtn.addEventListener('click', () => { const on = sound.toggle(); soundBtn.textContent = on ? '🔊' : '🔇'; });
