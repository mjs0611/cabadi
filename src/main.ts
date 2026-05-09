import { createInitialState } from './state.ts';
import { Game } from './game.ts';
import { processChromakeyURL } from './renderer.ts';
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
import { getStage } from './stages.ts';
import { drawCapybara } from './capy_draw.ts';

// ── AIT ──────────────────────────────────────────────────────────────────────
const AIT_AD_GROUP_ID = 'ait.v2.live.CABADI_AD_GROUP_ID';
let ait: any = null;
let aitAdLoaded = false;

import('@apps-in-toss/web-framework').then((m) => {
  ait = m;
  preloadAd();
  
  // iOS 뒤로가기 제스처 비활성화 (가이드 필수)
  m.setIosSwipeGestureEnabled({ isEnabled: false });

  m.getUserKeyForGame().then((result: any) => {
    if (result && result.type === 'HASH') {
      userHash = result.hash;
      localStorage.setItem('userHash', result.hash);
      resetIfNewDay(userHash);
      updateLobbyStats();
    }
  }).catch(() => {});
}).catch(() => {});

// 배경 전환 시 사운드 제어 (가이드 필수)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    sound.pauseAll();
    game?.pause();
  } else {
    sound.resumeAll();
  }
});

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
  sound.pauseAll(); // 광고 재생 시 게임 사운드 중단
  if (ait && aitAdLoaded) {
    aitAdLoaded = false;
    ait.showFullScreenAd({
      options: { adGroupId: AIT_AD_GROUP_ID },
      onEvent: (event: any) => {
        if (event.type === 'dismissed' || event.type === 'userEarnedReward') {
          sound.resumeAll();
          onDone();
          preloadAd();
        } else if (event.type === 'failedToShow') {
          showAdFallback(() => {
            sound.resumeAll();
            onDone();
          });
        }
      },
      onError: () => { 
        showAdFallback(() => {
          sound.resumeAll();
          onDone();
        });
      },
    });
    return;
  }
  showAdFallback(() => {
    sound.resumeAll();
    onDone();
  });
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
  acorn_cannon: '🌰', poison_thorn: '🌵', coconut_bomb: '🥥', mango_laser: '🥭',
  homing_seed: '🌱', mud_artillery: '💩', tropical_lightning: '⚡', palm_fall: '🌴',
  hp_regen: '💚',
  shield: '🛡️',
  speed_boost: '💨',
};

function getRarityName(cost: number) {
  if (cost >= 7000) return '전설';
  if (cost >= 2500) return '영웅';
  if (cost >= 1200) return '희귀';
  return '일반';
}
function getRarityClass(cost: number) {
  if (cost >= 7000) return 'legendary';
  if (cost >= 2500) return 'epic';
  if (cost >= 1200) return 'rare';
  return 'common';
}

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
const waveProgressFill = document.getElementById('waveProgressFill') as HTMLElement;
const bossBar          = document.getElementById('bossBar') as HTMLElement;
const bossHpFill       = document.getElementById('bossHpFill') as HTMLElement;
const levelUpSplash    = document.getElementById('levelUpSplash') as HTMLElement;
const lvlUpSkillName   = document.getElementById('lvlUpSkillName') as HTMLElement;
const hudMissionsBtn    = document.getElementById('hudMissionsBtn')!;
const soundBtn          = document.getElementById('soundBtn')!;
const ultimateBtn       = document.getElementById('ultimateBtn')!;
const ultGauge          = document.getElementById('ultGauge')!;

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

// Gacha UI
const drawResultModal    = document.getElementById('drawResultModal')!;
const drawCapsuleBtn     = document.getElementById('drawCapsuleBtn') as HTMLButtonElement;
const drawCapsule        = document.getElementById('drawCapsule')!;
const drawContent        = document.getElementById('drawContent')!;
const drawRarity         = document.getElementById('drawRarity')!;
const drawIcon           = document.getElementById('drawIcon')!;
const drawName           = document.getElementById('drawName')!;
const drawDesc           = document.getElementById('drawDesc')!;
const drawCompensation   = document.getElementById('drawCompensation')!;
const closeDrawBtn       = document.getElementById('closeDrawBtn')!;
const cheatBananaBtn    = document.getElementById('cheatBananaBtn')!;

// ── Gacha Logic ──
drawCapsuleBtn.addEventListener('click', () => {
  const drawCost = 1500;
  if (!spendBananas(userHash, drawCost)) return;

  const upgrades = getCapyUpgrades(userHash);
  const result = drawCapybara(upgrades.unlockedCapyTypes);

  // Animation Sequence
  drawResultModal.classList.remove('hidden');
  drawCapsule.classList.remove('open', 'hidden');
  drawContent.classList.add('hidden');
  drawCompensation.classList.add('hidden');
  sound.upgrade(); // Use upgrade sound for shake

  setTimeout(() => {
    drawCapsule.classList.add('open');
    sound.enemyDie(); // Burst sound
    
    setTimeout(() => {
      drawCapsule.classList.add('hidden');
      drawContent.classList.remove('hidden');
      
      // Setup Result UI
      drawRarity.textContent = getRarityName(result.capy.cost);
      drawRarity.className = `draw-rarity ${getRarityClass(result.capy.cost)}`;
      if (result.capy.icon.startsWith('/')) {
        drawIcon.innerHTML = `<img src="" style="width:100%;height:100%;object-fit:contain;">`;
        processChromakeyURL(result.capy.icon).then(url => {
          const img = drawIcon.querySelector('img');
          if (img) img.src = url;
        });
      } else {
        drawIcon.textContent = result.capy.icon;
      }
      drawName.textContent = result.capy.name;
      drawDesc.textContent = result.capy.description;
      
      if (result.isDuplicate) {
        drawCompensation.textContent = `+${result.compensation} 🍌 (중복 보상)`;
        drawCompensation.classList.remove('hidden');
        addBananas(userHash, result.compensation);
      } else {
        upgrades.unlockedCapyTypes.push(result.capy.id);
        saveCapyUpgrades(userHash, upgrades);
      }
      
      renderShop();
      updateLobbyStats();
    }, 500);
  }, 1500);
});

closeDrawBtn.addEventListener('click', () => {
  drawResultModal.classList.add('hidden');
});

cheatBananaBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  addBananas(userHash, 5000);
  updateLobbyStats();
  sound.upgrade();
  
  const shopTab = document.getElementById('tab-shop');
  if (shopTab && shopTab.classList.contains('active')) {
    renderShop();
  }
});

const waveAnnounce      = document.getElementById('waveAnnounce')!;
const baseFlash         = document.getElementById('baseFlash')!;

// ── State ───────────────────────────────────────────────────────────────────
let userHash: string = localStorage.getItem('userHash') ?? 'guest';
let state = createInitialState(getCapyUpgrades(userHash));
let game: Game | null = null;
let buffActiveInLobby = false;

resetIfNewDay(userHash);
updateLobbyStats();

// ── Logic ────────────────────────────────────────────────────────────────────
function updateLobbyStats() {
  const upgrades = getCapyUpgrades(userHash);
  const capyType = CAPY_TYPES.find(t => t.id === upgrades.selectedCapyType) || CAPY_TYPES[0];
  
  lobbyBananaCountTop.textContent = String(getBananas(userHash));
  lobbyBestWaveTop.textContent = String(getBestWave(userHash));
  
  const nameEl = document.querySelector('.top-name');
  if (nameEl) nameEl.textContent = capyType.name;
  
  const lobbyHeroImg = document.querySelector('#lobbyCapybaraHero img') as HTMLImageElement;
  const introHeroImg = document.querySelector('.intro-hero img') as HTMLImageElement;
  
  processChromakeyURL(capyType.icon).then(url => {
    if (lobbyHeroImg) {
      lobbyHeroImg.src = url;
      lobbyHeroImg.style.filter = 'drop-shadow(0 10px 20px rgba(0,0,0,0.4))';
      lobbyHeroImg.style.opacity = '1';
    }
    if (introHeroImg) {
      introHeroImg.src = url;
      introHeroImg.style.opacity = '1';
    }
  });
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

  waveNum.textContent = `Wave ${state.wave}`;
  updateHpBar(state.hp, state.maxHp);
  hudBananas.innerHTML = `<span class="icon icon-gold"></span> ${state.sessionBananas}`;
  updateSkillSlots();
  ultimateBtn.classList.remove('hidden');
  ultGauge.style.height = `${state.ultimateGauge}%`;
  if (state.ultimateGauge >= 100) ultimateBtn.style.boxShadow = '0 0 20px 10px rgba(255, 255, 255, 0.8)';
  else ultimateBtn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';

  game = makeGame();
  showWaveAnnounce(state.wave);
  game.startWave();
}

function makeGame() {
  return new Game(canvas, state, onWaveClear, onStageClear, onGameOver, onHpChange, onBananaEarned, onKill, onBaseFlash, onBossSpawn, onBossHit);
}

// ── Rendering ────────────────────────────────────────────────────────────────
function renderShop() {
  const upgrades = getCapyUpgrades(userHash);
  const bananas = getBananas(userHash);
  shopItems.innerHTML = '';
  shopItems.className = 'ui-grid';

  for (const capy of CAPY_TYPES) {
    const isUnlocked = upgrades.unlockedCapyTypes.includes(capy.id);
    const isSelected = upgrades.selectedCapyType === capy.id;
    const canAfford = bananas >= capy.cost;
    
    // Gacha-only characters (Epic and Legendary)
    const isGachaOnly = capy.cost >= 2500;
    
    let tier = 'common';
    if (capy.cost >= 7000) tier = 'legendary';
    else if (capy.cost >= 2500) tier = 'epic';
    else if (capy.cost >= 1200) tier = 'rare';

    const el = document.createElement('div');
    el.className = `ui-card ${tier}`;
    el.innerHTML = `
      <div class="ui-card-lvl">${tier === 'legendary' ? '전설' : tier === 'epic' ? '영웅' : tier === 'rare' ? '희귀' : '일반'}</div>
      <div class="ui-card-top">
        <div class="ui-card-icon">${capy.icon.startsWith('/') ? `<img src="" data-src="${capy.icon}" style="width:100%;height:100%;object-fit:contain;">` : capy.icon}</div>
        <div class="ui-card-info">
          <div class="ui-card-name">${capy.name}</div>
        </div>
      </div>
      <div class="ui-card-desc">${capy.passiveDesc}</div>
      <button class="ui-card-btn ${isSelected ? 'active' : (isUnlocked || (canAfford && !isGachaOnly)) ? '' : 'locked'}">
        ${isSelected ? '장착 됨' : isUnlocked ? '장착하기' : isGachaOnly ? '캡슐 전용' : `<span class="btn-cost">${capy.cost}</span> <span class="icon icon-gold"></span>`}
      </button>
    `;

    const img = el.querySelector('img[data-src]') as HTMLImageElement;
    if (img) {
      processChromakeyURL(img.getAttribute('data-src')!).then(url => {
        img.src = url;
        img.style.opacity = '1';
      });
    }

    const btn = el.querySelector('button')!;
    btn.addEventListener('click', () => {
      if (isSelected) return;
      if (isUnlocked || (!isGachaOnly && spendBananas(userHash, capy.cost))) {
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
  upgradesItems.className = 'ui-grid';

  for (const item of CAPY_SHOP) {
    const currentLevel = (upgrades as any)[item.id] as number;
    const isMax = currentLevel >= item.maxLevel;
    const cost = isMax ? 0 : item.cost(currentLevel);
    const canAfford = bananas >= cost;
    const progress = (currentLevel / item.maxLevel) * 100;

    const el = document.createElement('div');
    el.className = 'ui-card';
    el.innerHTML = `
      <div class="ui-card-lvl">레벨 ${currentLevel}</div>
      <div class="ui-card-top">
        <div class="ui-card-icon">${item.icon}</div>
        <div class="ui-card-info">
          <div class="ui-card-name">${item.name}</div>
        </div>
      </div>
      <div class="ui-progress-container"><div class="ui-progress-fill" style="width:${progress}%"></div></div>
      <button class="ui-card-btn ${isMax ? 'active' : canAfford ? '' : 'locked'}">
        ${isMax ? 'MAX' : `<span class="btn-cost">${cost}</span> <span class="icon icon-gold"></span>`}
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
  missionsItems.className = 'ui-grid';

  for (const m of missions) {
    const progress = Math.min(100, (m.progress / m.goal) * 100);
    const el = document.createElement('div');
    el.className = `ui-card ${m.completed ? 'epic' : ''}`;
    el.innerHTML = `
      <div class="ui-card-lvl">${m.completed ? '완료됨' : '진행 중'}</div>
        <div class="ui-card-info">
          <div class="ui-card-name">${m.desc}</div>
        </div>
      </div>
      <div class="ui-card-desc">${m.progress} / ${m.goal}</div>
      <div class="ui-progress-container"><div class="ui-progress-fill" style="width:${progress}%"></div></div>
      <button class="ui-card-btn ${m.claimed ? 'locked' : m.completed ? '' : 'locked'}">
        ${m.claimed ? '수령 완료' : m.completed ? `보상 받기 (+${m.reward})` : `잠김`}
      </button>
    `;
    if (m.completed && !m.claimed) {
      el.querySelector('button')!.addEventListener('click', () => {
        const reward = claimMissionReward(userHash, m.id);
        if (reward > 0) {
          addBananas(userHash, reward);
          sound.upgrade();
          renderMissions();
          updateLobbyStats();
        }
      });
    }
    missionsItems.appendChild(el);
  }
}

function renderSkillSetting() {
  skillSettingList.innerHTML = '';
  skillSettingList.className = 'ui-grid';

  for (const id in SKILLS) {
    const s = (SKILLS as any)[id];
    const isUnlocked = state.unlockedSkills.includes(id);
    const isActive = state.startingSkillId === id;
    const tier = s.tier || 'common';
    
    const el = document.createElement('div');
    el.className = `ui-card ${tier}`;
    el.innerHTML = `
      <div class="ui-card-lvl">${tier === 'legendary' ? '전설' : tier === 'hero' ? '영웅' : tier === 'unique' ? '희귀' : '일반'} 스킬</div>
      <div class="ui-card-top">
        <div class="ui-card-icon">${SKILL_ICONS[id] || '❓'}</div>
        <div class="ui-card-info">
          <div class="ui-card-name">${s.name}</div>
        </div>
      </div>
      <div class="ui-card-desc">${s.desc}</div>
      <button class="ui-card-btn ${isActive ? 'active' : isUnlocked ? '' : 'locked'}">
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
function onBananaEarned() { 
  hudBananas.innerHTML = `<span class="icon icon-gold"></span> ${state.sessionBananas}`; 
  hudBananas.classList.remove('collect-pulse');
  void hudBananas.offsetWidth;
  hudBananas.classList.add('collect-pulse');
}
function onKill(isBoss: boolean) {
  updateMissionProgress(userHash, 'kills', 1);
  updateMissionProgress(userHash, 'session_bananas', state.sessionBananas);
  if (isBoss) {
    updateMissionProgress(userHash, 'bosses', 1);
    bossBar.classList.add('hidden');
  }
  updateWaveProgress();

  if (state.ultimateGauge < 100) {
    state.ultimateGauge = Math.min(100, state.ultimateGauge + (isBoss ? 20 : 2));
    ultGauge.style.height = `${state.ultimateGauge}%`;
    if (state.ultimateGauge >= 100) {
      ultimateBtn.style.boxShadow = '0 0 20px 10px rgba(255, 255, 255, 0.8)';
      sound.upgrade(); // Ready sound
    }
  }
}
function onBaseFlash() { baseFlash.classList.remove('flash'); void baseFlash.offsetWidth; baseFlash.classList.add('flash'); }
function onBossSpawn(e: any) {
  bossBar.classList.remove('hidden');
  updateBossHpLoop(e);
}
function onBossHit() {
  bossBar.classList.remove('hit');
  void bossBar.offsetWidth;
  bossBar.classList.add('hit');
}
function onWaveClear() {
  updateMissionProgress(userHash, 'waves', 1);
  sound.waveClear();

  waveNum.textContent = `Wave ${state.wave}`;
  showWaveAnnounce(state.wave);

  // 5웨이브마다 업그레이드 선택, 나머지는 자동 진행
  const prevWave = state.wave - 1;
  if (prevWave % 5 === 0) {
    state.phase = 'upgrade';
    showUpgradeScreen();
  } else {
    setTimeout(() => {
      if (state.phase === 'playing' && game) {
        game.startWave();
      }
    }, 2000);
  }
}

function onStageClear() {
  state.phase = 'stageclear';
  updateMissionProgress(userHash, 'waves', 1);
  sound.waveClear();
  
  const stageClearEl = document.getElementById('stageClear')!;
  const stageClearNum = document.getElementById('stageClearNum')!;
  const stageNextName = document.getElementById('stageNextName')!;
  
  stageClearNum.textContent = String(state.stage);
  
  if (state.stage < 20) {
    const nextStage = getStage(state.stage + 1);
    stageNextName.textContent = nextStage.name;
  } else {
    stageNextName.textContent = '게임 클리어!';
  }
  
  stageClearEl.classList.add('show');
}
function onGameOver() {
  state.phase = 'gameover';
  hud.classList.remove('show');
  ultimateBtn.classList.add('hidden');
  addBananas(userHash, state.sessionBananas);
  saveBestWave(userHash, state.wave - 1);
  const best = getBestWave(userHash);
  goScore.textContent = `S${state.stage} W${state.wave - 1}`;
  goBest.textContent = `최고 기록 ${best} 웨이브`;
  goBananaEarned.textContent = `+${state.sessionBananas}개`;
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
function getWaveTypeLabel(w: number): string {
  if (w % 10 === 0) return '💀 BOSS';
  if (w % 7 === 0) return '⚡ RUSH';
  if (w % 9 === 0) return '🐛 SWARM';
  if (w % 11 === 0) return '🛡 ARMORED';
  return '';
}

function showWaveAnnounce(w: number) {
  waveAnnounce.classList.remove('show');
  void waveAnnounce.offsetWidth;

  const typeLabel = getWaveTypeLabel(w);
  waveAnnounce.style.whiteSpace = 'pre-wrap';
  waveAnnounce.innerHTML = typeLabel
    ? `<span style="font-size:0.7em;opacity:0.85">${typeLabel}</span>\nWave ${w}`
    : `Wave ${w}`;
  waveAnnounce.classList.add('show');

  updateWaveProgress(0);
}

function updateWaveProgress(forced?: number) {
  if (!waveProgressFill) return;
  if (forced !== undefined) {
    waveProgressFill.style.width = `${forced}%`;
    return;
  }
  const total = 5 + state.wave * 3;
  const killed = total - (game as any).enemiesLeft - (game as any).enemies.length;
  waveProgressFill.style.width = `${Math.min(100, (killed / total) * 100)}%`;
}

function updateBossHpLoop(boss: any) {
  if (!boss || boss.dead || state.phase !== 'playing') {
    bossBar.classList.add('hidden');
    return;
  }
  const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
  bossHpFill.style.width = `${pct}%`;
  requestAnimationFrame(() => updateBossHpLoop(boss));
}

function showLevelUpSplash(skillType: string) {
  levelUpSplash.classList.remove('hidden');
  const typeMap: Record<string, string> = {
    'acorn_cannon': '도토리 캐논',
    'poison_thorn': '독가시',
    'coconut_bomb': '코코넛 폭탄',
    'mango_laser': '망고 레이저',
    'homing_seed': '추적 씨앗',
    'mud_artillery': '진흙 대포',
    'tropical_lightning': '열대 번개',
    'palm_fall': '야자수 폭격'
  };
  lvlUpSkillName.textContent = typeMap[skillType] || skillType.toUpperCase();
  setTimeout(() => levelUpSplash.classList.add('hidden'), 1500);
}

function showUpgradeScreen() {
  const upgrades = pickUpgrades(state, 3);
  upgradeCards.innerHTML = '';
  for (const u of upgrades) {
    const card = document.createElement('div');
    card.className = 'upgradeCard';
    
    // Translate Upgrade Names/Descriptions in UI if not already in JSON
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
      if (u.type === 'skill_up' && u.skillType) {
        showLevelUpSplash(u.skillType);
      }
      state.phase = 'playing';
      waveNum.textContent = `Wave ${state.wave}`;
      updateHpBar(state.hp, state.maxHp);
      updateSkillSlots();
      hud.classList.add('show');
      sound.upgrade();
      showWaveAnnounce(state.wave);
      game!.startWave();
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

ultimateBtn.addEventListener('click', () => {
  if (state.ultimateGauge >= 100 && game) {
    state.ultimateGauge = 0;
    ultGauge.style.height = '0%';
    ultimateBtn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
    (game as any).triggerUltimate();
  }
});

// 종료 컨펌 연동
const closeConfirm = document.getElementById('closeConfirm')!;
const closeYes = document.getElementById('closeYes')!;
const closeNo = document.getElementById('closeNo')!;

// (참고) 게임 내에서 종료 팝업을 띄우고 싶을 때 호출하는 예시 함수
(window as any).requestClose = () => { closeConfirm.classList.add('show'); };

closeNo.addEventListener('click', () => { closeConfirm.classList.remove('show'); });
closeYes.addEventListener('click', () => {
  if (ait && ait.close) {
    ait.close();
  } else {
    // 대체 동작 (웹 브라우저 등)
    window.history.back();
  }
});

// 스테이지 클리어 버튼 이벤트
const stageClearEl = document.getElementById('stageClear')!;
const stageNextBtn = document.getElementById('stageNextBtn')!;
const stageLobbyBtn = document.getElementById('stageLobbyBtn')!;

stageNextBtn.addEventListener('click', () => {
  stageClearEl.classList.remove('show');
  if (state.stage < 20) {
    state.stage++;
    state.wave = 1;
    state.phase = 'playing';
    // HP 일부 회복
    state.hp = Math.min(state.maxHp, state.hp + Math.floor(state.maxHp * 0.3));
    game = makeGame();
    showWaveAnnounce(state.wave);
    game.startWave();
  } else {
    // 게임 완전 클리어 - 로비로
    state = createInitialState(getCapyUpgrades(userHash));
    openLobby();
  }
});

stageLobbyBtn.addEventListener('click', () => {
  stageClearEl.classList.remove('show');
  state = createInitialState(getCapyUpgrades(userHash));
  openLobby();
});
