export interface CapyUpgrades {
  maxHp: number;      // 0~10  (+20 HP per level)
  damage: number;     // 0~10  (+10% damage per level)
  fireRate: number;   // 0~8   (-5% cooldown per level)
  startSkills: number; // 0~4  (extra starting skill slots)
  coinBoost: number;  // 0~5   (+15% banana earn per level)
}

const DEFAULT_UPGRADES: CapyUpgrades = {
  maxHp: 0, damage: 0, fireRate: 0, startSkills: 0, coinBoost: 0,
};

function bKey(hash: string) { return `bananas_${hash}`; }
function uKey(hash: string) { return `capy_upgrades_${hash}`; }
function bwKey(hash: string) { return `bestWave_${hash}`; }

export function getBananas(hash: string): number {
  return parseInt(localStorage.getItem(bKey(hash)) ?? '0', 10);
}

export function addBananas(hash: string, amount: number): number {
  const next = getBananas(hash) + amount;
  localStorage.setItem(bKey(hash), String(next));
  return next;
}

export function spendBananas(hash: string, amount: number): boolean {
  const current = getBananas(hash);
  if (current < amount) return false;
  localStorage.setItem(bKey(hash), String(current - amount));
  return true;
}

export function getCapyUpgrades(hash: string): CapyUpgrades {
  const raw = localStorage.getItem(uKey(hash));
  if (!raw) return { ...DEFAULT_UPGRADES };
  return { ...DEFAULT_UPGRADES, ...JSON.parse(raw) };
}

export function saveCapyUpgrades(hash: string, upgrades: CapyUpgrades) {
  localStorage.setItem(uKey(hash), JSON.stringify(upgrades));
}

export function getBestWave(hash: string): number {
  return parseInt(localStorage.getItem(bwKey(hash)) ?? '0', 10);
}

export function saveBestWave(hash: string, wave: number) {
  if (wave > getBestWave(hash)) localStorage.setItem(bwKey(hash), String(wave));
}
