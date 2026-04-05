import { createInitialState } from './state.ts';
import { Game } from './game.ts';
import type { Enemy } from './entities.ts';
import { pickUpgrades } from './upgrades.ts';
import { sound } from './sound.ts';
import { CAPY_SHOP } from './capy_shop.ts';
import {
  getBananas, addBananas, spendBananas,
  getCapyUpgrades, saveCapyUpgrades,
  getBestWave, saveBestWave,
} from './store.ts';
import {
  resetIfNewDay, getTodayMissions, updateMissionProgress, claimMissionReward,
} from './missions.ts';

// ── AIT ──────────────────────────────────────────────────────────────────────
const AIT_AD_GROUP_ID = 'ait.v2.live.CABADI_AD_GROUP_ID'; // TODO: 등록 후 교체

// ── AdMob ────────────────────────────────────────────────────────────────────
const ADMOB_INTERSTITIAL_ID = 'ca-app-pub-4557219410513767/2917356306';
type AdMobType = typeof import('@capacitor-community/admob').AdMob;
type InterstitialEventsType = typeof import('@capacitor-community/admob').InterstitialAdPluginEvents;
let AdMobPlugin: AdMobType | null = null;
let InterstitialEvents: InterstitialEventsType | null = null;
let adLoaded = false;
import('@capacitor-community/admob').then((m) => {
  AdMobPlugin = m.AdMob;
  InterstitialEvents = m.InterstitialAdPluginEvents;
  AdMobPlugin.initialize({ requestTrackingAuthorization: false }).then(() => preloadAdMob()).catch(() => {});
}).catch(() => {});

async function preloadAdMob() {
  if (!AdMobPlugin) return;
  try {
    await AdMobPlugin.prepareInterstitial({ adId: ADMOB_INTERSTITIAL_ID });
    adLoaded = true;
  } catch { adLoaded = false; }
}

let adFallbackInterval: ReturnType<typeof setInterval> | null = null;
function showAdFallback(onDone: () => void) {
  const el = document.getElementById('adScreen')!;
  el.classList.add('show');
  let cnt = 5;
  document.getElementById('adCount')!.textContent = String(cnt);
  adFallbackInterval = setInterval(() => {
    cnt--;
    document.getElementById('adCount')!.textContent = String(cnt);
    if (cnt <= 0) {
      clearInterval(adFallbackInterval!);
      el.classList.remove('show');
      onDone();
    }
  }, 1000);
}

async function showAd(onDone: () => void) {
  // 1. AIT 광고
  if (ait && aitAdLoaded) {
    aitAdLoaded = false;
    ait.showFullScreenAd({
      options: { adGroupId: AIT_AD_GROUP_ID },
      onEvent: (event) => {
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
  // 2. AdMob (Capacitor Android)
  if (AdMobPlugin && InterstitialEvents && adLoaded) {
    adLoaded = false;
    try {
      const dismissed = await AdMobPlugin.addListener(InterstitialEvents.Dismissed, () => {
        onDone();
        preloadAdMob();
        dismissed.remove();
      });
      const failed = await AdMobPlugin.addListener(InterstitialEvents.FailedToShow, () => {
        showAdFallback(onDone);
        failed.remove();
        dismissed.remove();
      });
      await AdMobPlugin.showInterstitial();
      return;
    } catch { showAdFallback(onDone); return; }
  }
  // 3. Fallback (둘 다 없을 때)
  showAdFallback(onDone);
}

type AitModule = {
  submitGameCenterLeaderBoardScore: typeof import('@apps-in-toss/web-framework').submitGameCenterLeaderBoardScore;
  openGameCenterLeaderboard: typeof import('@apps-in-toss/web-framework').openGameCenterLeaderboard;
  generateHapticFeedback: typeof import('@apps-in-toss/web-framework').generateHapticFeedback;
  getUserKeyForGame: typeof import('@apps-in-toss/web-framework').getUserKeyForGame;
  loadFullScreenAd: typeof import('@apps-in-toss/web-framework').loadFullScreenAd;
  showFullScreenAd: typeof import('@apps-in-toss/web-framework').showFullScreenAd;
};
let ait: AitModule | null = null;
let aitAdLoaded = false;

// ── 유저 식별자 ───────────────────────────────────────────────────────────────
let userHash: string = localStorage.getItem('userHash') ?? 'guest';
resetIfNewDay(userHash);

import('@apps-in-toss/web-framework').then((m) => {
  ait = {
    submitGameCenterLeaderBoardScore: m.submitGameCenterLeaderBoardScore,
    openGameCenterLeaderboard: m.openGameCenterLeaderboard,
    generateHapticFeedback: m.generateHapticFeedback,
    getUserKeyForGame: m.getUserKeyForGame,
    loadFullScreenAd: m.loadFullScreenAd,
    showFullScreenAd: m.showFullScreenAd,
  };
  leaderboardBtn.style.display = 'block';
  preloadAd();
  m.getUserKeyForGame().then((result) => {
    if (result && typeof result === 'object' && 'type' in result && result.type === 'HASH') {
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

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── Elements ─────────────────────────────────────────────────────────────────
const intro             = document.getElementById('intro')!;
const startBtn          = document.getElementById('startBtn')!;
const introShopBtn      = document.getElementById('introShopBtn')!;
const hud               = document.getElementById('hud')!;
const waveNum           = document.getElementById('waveNum')!;
const hpFill            = document.getElementById('hpFill')!;
const hudBananas        = document.getElementById('hudBananas')!;
const hudMissionsBtn    = document.getElementById('hudMissionsBtn')!;
const soundBtn          = document.getElementById('soundBtn')!;
const upgradeScreen     = document.getElementById('upgradeScreen')!;
const upgradeCards      = document.getElementById('upgradeCards')!;
const gameOverEl        = document.getElementById('gameOver')!;
const goScore           = document.getElementById('goScore')!;
const goBest            = document.getElementById('goBest')!;
const goBananaEarned    = document.getElementById('goBananaEarned')!;
const reviveBtn         = document.getElementById('reviveBtn')!;
const retryBtn          = document.getElementById('retryBtn')!;
const goShopBtn         = document.getElementById('goShopBtn')!;
const goMissionsBtn     = document.getElementById('goMissionsBtn')!;
const leaderboardBtn    = document.getElementById('leaderboardBtn')!;
const shopScreen        = document.getElementById('shopScreen')!;
const shopBananaCount   = document.getElementById('shopBananaCount')!;
const shopItems         = document.getElementById('shopItems')!;
const shopCloseBtn      = document.getElementById('shopCloseBtn')!;
const missionsScreen    = document.getElementById('missionsScreen')!;
const missionsItems     = document.getElementById('missionsItems')!;
const missionsCloseBtn  = document.getElementById('missionsCloseBtn')!;
const missionsBananaCount = document.getElementById('missionsBananaCount')!;
const closeConfirm      = document.getElementById('closeConfirm')!;
const closeNo           = document.getElementById('closeNo')!;
const closeYes          = document.getElementById('closeYes')!;
const waveAnnounce      = document.getElementById('waveAnnounce')!;
const baseFlash         = document.getElementById('baseFlash')!;
const doubleBananaBtn   = document.getElementById('doubleBananaBtn') as HTMLButtonElement;
const introAdBuffBtn    = document.getElementById('introAdBuffBtn') as HTMLButtonElement;

// ── 사운드 / 백그라운드 처리 ──────────────────────────────────────────────────
soundBtn.addEventListener('click', () => {
  const on = sound.toggle();
  soundBtn.textContent = on ? '🔊' : '🔇';
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game?.pause();
    sound.suspend();
  } else {
    game?.resume();
    sound.resume();
  }
});

// ── Game State ────────────────────────────────────────────────────────────────
let state = createInitialState(getCapyUpgrades(userHash));
let game: Game | null = null;

function updateHpBar(hp: number, maxHp: number) {
  hpFill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
}

function updateHudBananas() {
  hudBananas.textContent = `🍌 ${state.sessionBananas}`;
}

// ── 웨이브 알림 ────────────────────────────────────────────────────────────────
function showWaveAnnounce(wave: number) {
  waveAnnounce.classList.remove('show');
  // reflow trigger for re-animation
  void waveAnnounce.offsetWidth;
  waveAnnounce.textContent = `WAVE ${wave}`;
  waveAnnounce.classList.add('show');
}

// ── 베이스 플래시 ──────────────────────────────────────────────────────────────
function triggerBaseFlash() {
  baseFlash.classList.remove('flash');
  void baseFlash.offsetWidth;
  baseFlash.classList.add('flash');
}

// ── 게임 인스턴스 생성 헬퍼 ───────────────────────────────────────────────────
function makeGame() {
  return new Game(
    canvas, state,
    onWaveClear, onGameOver, onHpChange, onBananaEarned,
    onKill, onBaseFlash, onBossSpawn,
  );
}

// ── 게임 시작 ─────────────────────────────────────────────────────────────────
function startGame() {
  state = createInitialState(getCapyUpgrades(userHash));
  state.phase = 'playing';

  intro.classList.add('hidden');
  shopScreen.classList.remove('show');
  missionsScreen.classList.remove('show');
  hud.classList.add('show');
  gameOverEl.classList.remove('show');
  upgradeScreen.classList.remove('show');
  reviveBtn.style.display = '';

  waveNum.textContent = String(state.wave);
  updateHpBar(state.hp, state.maxHp);
  updateHudBananas();

  game = makeGame();
  showWaveAnnounce(state.wave);
  game.startWave();
}

// ── 콜백 ──────────────────────────────────────────────────────────────────────
function onHpChange(hp: number, maxHp: number) {
  updateHpBar(hp, maxHp);
  sound.baseHit();
  ait?.generateHapticFeedback({ type: 'basicWeak' }).catch(() => {});
}

function onBananaEarned(_amount: number) {
  updateHudBananas();
}

function onKill(isBoss: boolean) {
  updateMissionProgress(userHash, 'kills', 1);
  updateMissionProgress(userHash, 'session_bananas', state.sessionBananas);
  if (isBoss) {
    updateMissionProgress(userHash, 'bosses', 1);
    ait?.generateHapticFeedback({ type: 'success' }).catch(() => {});
  }
}

function onBaseFlash() {
  triggerBaseFlash();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function onBossSpawn(_enemy: Enemy) {
  // boss HP bar는 renderer에서 자동 표시
}

function onWaveClear() {
  state.phase = 'upgrade';
  // 바나나는 onGameOver에서 sessionBananas 일괄 저장 — 여기서 중복 저장 안 함
  updateMissionProgress(userHash, 'waves', 1);
  updateMissionProgress(userHash, 'session_bananas', state.sessionBananas);
  sound.waveClear();
  ait?.generateHapticFeedback({ type: 'confetti' }).catch(() => {});
  showUpgradeScreen();
}

function onGameOver() {
  state.phase = 'gameover';
  hud.classList.remove('show');
  upgradeScreen.classList.remove('show');

  const survivedWaves = state.wave - 1;

  const totalEarned = state.sessionBananas;
  addBananas(userHash, totalEarned);

  saveBestWave(userHash, survivedWaves);
  const best = getBestWave(userHash);

  goScore.textContent = String(survivedWaves);
  goBest.textContent = `최고 기록 ${best} WAVES`;
  goBananaEarned.textContent = `+${totalEarned} 🍌 획득`;
  gameOverEl.classList.add('show');
  if (totalEarned > 0) doubleBananaBtn.style.display = 'block';

  sound.gameOver();
  ait?.generateHapticFeedback({ type: 'error' }).catch(() => {});
  ait?.submitGameCenterLeaderBoardScore({ score: String(survivedWaves) }).catch(() => {});
}

// ── 부활 (광고 시청) ──────────────────────────────────────────────────────────
reviveBtn.addEventListener('click', () => {
  reviveBtn.style.display = 'none';
  showAd(() => doRevive());
});

// ── 보상 2배 (광고 시청) ──────────────────────────────────────────────────────
doubleBananaBtn.addEventListener('click', () => {
  showAd(() => {
    doubleBananaBtn.style.display = 'none';
    addBananas(userHash, state.sessionBananas); // 한 번 더 추가 (2배 효과)
    goBananaEarned.textContent = `+${state.sessionBananas * 2} 🍌 획득 (2배!)`;
  });
});

// ── 시작 버프 (광고 시청) ──────────────────────────────────────────────────────
introAdBuffBtn.addEventListener('click', () => {
  showAd(() => {
    state.adBuffActive = true;
    state.damageMultiplier *= 1.3;
    state.fireRateMultiplier *= 0.8;
    introAdBuffBtn.textContent = '✅ 공격 버프 활성화됨 (+30%)';
    introAdBuffBtn.style.background = 'rgba(100,255,100,0.1)';
    introAdBuffBtn.style.borderColor = '#66ff66';
    introAdBuffBtn.style.color = '#66ff66';
    introAdBuffBtn.disabled = true;
  });
});

function doRevive() {
  if (!game) return;
  gameOverEl.classList.remove('show');
  hud.classList.add('show');
  updateHpBar(Math.floor(state.maxHp * 0.5), state.maxHp);
  game.revive();
}

// ── 웨이브 강화 선택 ──────────────────────────────────────────────────────────
function showUpgradeScreen() {
  const upgrades = pickUpgrades(state, 3);
  upgradeCards.innerHTML = '';
  for (const u of upgrades) {
    const card = document.createElement('div');
    card.className = 'upgradeCard';
    card.innerHTML = `
      <div class="upgradeCard-name">${u.name}</div>
      <div class="upgradeCard-desc">${u.desc}</div>
    `;
    card.addEventListener('click', () => {
      u.apply(state);
      upgradeScreen.classList.remove('show');
      state.phase = 'playing';
      waveNum.textContent = String(state.wave);
      updateHpBar(state.hp, state.maxHp);
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

// ── 카피바라 업그레이드 상점 ──────────────────────────────────────────────────
function openShop() {
  renderShop();
  shopScreen.classList.add('show');
}

function closeShop() {
  shopScreen.classList.remove('show');
}

function renderShop() {
  const upgrades = getCapyUpgrades(userHash);
  const bananas = getBananas(userHash);
  shopBananaCount.textContent = String(bananas);
  shopItems.innerHTML = '';

  for (const item of CAPY_SHOP) {
    const currentLevel = upgrades[item.id];
    const isMax = currentLevel >= item.maxLevel;
    const cost = isMax ? 0 : item.cost(currentLevel);
    const canAfford = bananas >= cost;

    const el = document.createElement('div');
    el.className = 'shopItem';
    el.innerHTML = `
      <div class="shopItem-left">
        <span class="shopItem-icon">${item.icon}</span>
        <div>
          <div class="shopItem-name">${item.name}</div>
          <div class="shopItem-effect">${item.effectPerLevel} · Lv ${currentLevel}/${item.maxLevel}</div>
        </div>
      </div>
      <button class="shopItem-btn ${isMax ? 'max' : canAfford ? '' : 'disabled'}" data-id="${item.id}">
        ${isMax ? 'MAX' : `${cost} 🍌`}
      </button>
    `;

    if (!isMax) {
      el.querySelector('.shopItem-btn')!.addEventListener('click', () => {
        if (!spendBananas(userHash, cost)) return;
        upgrades[item.id]++;
        saveCapyUpgrades(userHash, upgrades);
        sound.upgrade();
        renderShop();
      });
    }

    shopItems.appendChild(el);
  }
}

// ── 일일 미션 ─────────────────────────────────────────────────────────────────
function openMissions() {
  renderMissions();
  missionsScreen.classList.add('show');
}

function closeMissions() {
  missionsScreen.classList.remove('show');
}

function renderMissions() {
  const missions = getTodayMissions(userHash);
  const bananas = getBananas(userHash);
  missionsBananaCount.textContent = String(bananas);
  missionsItems.innerHTML = '';

  for (const m of missions) {
    const pct = Math.min(100, Math.round((m.progress / m.goal) * 100));
    const el = document.createElement('div');
    el.className = 'missionItem';
    el.innerHTML = `
      <div class="missionItem-desc">${m.desc}</div>
      <div class="missionItem-progress">
        <div class="missionItem-bar"><div class="missionItem-fill" style="width:${pct}%"></div></div>
        <span class="missionItem-count">${m.progress}/${m.goal}</span>
      </div>
      <button class="missionItem-btn ${m.claimed ? 'claimed' : m.completed ? '' : 'locked'}">
        ${m.claimed ? '완료 ✓' : m.completed ? `+${m.reward} 🍌 받기` : `🔒 ${m.reward} 🍌`}
      </button>
    `;
    if (m.completed && !m.claimed) {
      el.querySelector('.missionItem-btn')!.addEventListener('click', () => {
        const reward = claimMissionReward(userHash, m.id);
        if (reward > 0) {
          addBananas(userHash, reward);
          sound.upgrade();
          ait?.generateHapticFeedback({ type: 'confetti' }).catch(() => {});
          renderMissions();
        }
      });
    }
    missionsItems.appendChild(el);
  }
}

// ── 뒤로가기 / 닫기 ───────────────────────────────────────────────────────────
window.addEventListener('popstate', () => {
  if (missionsScreen.classList.contains('show')) { closeMissions(); if (state.phase === 'playing') game?.resume(); return; }
  if (shopScreen.classList.contains('show')) { closeShop(); return; }
  if (state.phase === 'playing') game?.stop();
  closeConfirm.classList.add('show');
});

closeNo.addEventListener('click', () => {
  closeConfirm.classList.remove('show');
  if (state.phase === 'playing') {
    game = makeGame();
    game.startWave();
  }
});

closeYes.addEventListener('click', () => { window.history.back(); });

// ── Buttons ───────────────────────────────────────────────────────────────────
startBtn.addEventListener('click', startGame);
introShopBtn.addEventListener('click', openShop);
shopCloseBtn.addEventListener('click', closeShop);
retryBtn.addEventListener('click', startGame);
goShopBtn.addEventListener('click', openShop);
hudMissionsBtn.addEventListener('click', () => { game?.pause(); openMissions(); });
goMissionsBtn.addEventListener('click', openMissions);
missionsCloseBtn.addEventListener('click', () => { closeMissions(); if (state.phase === 'playing') game?.resume(); });
leaderboardBtn.addEventListener('click', () => {
  ait?.openGameCenterLeaderboard().catch(() => {});
});
