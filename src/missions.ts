export type MissionType = 'kills' | 'waves' | 'session_bananas' | 'bosses';

export interface MissionDef {
  id: string;
  desc: string;
  goal: number;
  type: MissionType;
  reward: number;
}

export interface DailyMission extends MissionDef {
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface CompletedMission extends MissionDef {
  reward: number;
}

// ─── Mission Pool ────────────────────────────────────────────────────────────

const MISSION_POOL: MissionDef[] = [
  {
    id: 'kills_30',
    desc: '적 30마리 처치하기',
    goal: 30,
    type: 'kills',
    reward: 20,
  },
  {
    id: 'kills_80',
    desc: '적 80마리 처치하기',
    goal: 80,
    type: 'kills',
    reward: 40,
  },
  {
    id: 'kills_150',
    desc: '적 150마리 처치하기',
    goal: 150,
    type: 'kills',
    reward: 70,
  },
  {
    id: 'waves_3',
    desc: '웨이브 3개 버티기',
    goal: 3,
    type: 'waves',
    reward: 25,
  },
  {
    id: 'waves_7',
    desc: '웨이브 7개 버티기',
    goal: 7,
    type: 'waves',
    reward: 55,
  },
  {
    id: 'session_bananas_50',
    desc: '한 게임에서 바나나 50개 획득하기',
    goal: 50,
    type: 'session_bananas',
    reward: 30,
  },
  {
    id: 'session_bananas_120',
    desc: '한 게임에서 바나나 120개 획득하기',
    goal: 120,
    type: 'session_bananas',
    reward: 60,
  },
  {
    id: 'bosses_1',
    desc: '보스 1마리 처치하기',
    goal: 1,
    type: 'bosses',
    reward: 35,
  },
  {
    id: 'bosses_3',
    desc: '보스 3마리 처치하기',
    goal: 3,
    type: 'bosses',
    reward: 80,
  },
];

const DAILY_MISSION_COUNT = 3;

// ─── Storage Keys ────────────────────────────────────────────────────────────

const keyDate = (hash: string) => `missions_date_${hash}`;
const keyProgress = (hash: string) => `missions_progress_${hash}`;
const keyClaimed = (hash: string) => `missions_claimed_${hash}`;

// ─── Internal Helpers ────────────────────────────────────────────────────────

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Deterministic pseudo-random selector based on seed string */
function seededSelect(pool: MissionDef[], count: number, seed: string): MissionDef[] {
  // Simple hash: sum of char codes with positional multiplier
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  const indices: number[] = [];
  const available = pool.map((_, i) => i);

  for (let i = 0; i < count && available.length > 0; i++) {
    hash = (hash * 1664525 + 1013904223) >>> 0; // LCG
    const pick = hash % available.length;
    indices.push(available[pick]);
    available.splice(pick, 1);
  }

  return indices.map((i) => pool[i]);
}

function getStoredProgress(hash: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(keyProgress(hash));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getStoredClaimed(hash: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(keyClaimed(hash));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getStoredDate(hash: string): string {
  return localStorage.getItem(keyDate(hash)) ?? '';
}

function getTodayMissionDefs(hash: string): MissionDef[] {
  const seed = `${getTodayDateString()}_${hash}`;
  return seededSelect(MISSION_POOL, DAILY_MISSION_COUNT, seed);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Call on app start. Clears progress/claimed if the stored date differs from today.
 */
export function resetIfNewDay(hash: string): void {
  const today = getTodayDateString();
  const stored = getStoredDate(hash);
  if (stored !== today) {
    localStorage.setItem(keyDate(hash), today);
    localStorage.removeItem(keyProgress(hash));
    localStorage.removeItem(keyClaimed(hash));
  }
}

/**
 * Returns today's 3 missions with current progress/completion/claimed state.
 */
export function getTodayMissions(hash: string): DailyMission[] {
  const defs = getTodayMissionDefs(hash);
  const progress = getStoredProgress(hash);
  const claimed = getStoredClaimed(hash);

  return defs.map((def) => {
    const prog = progress[def.id] ?? 0;
    return {
      ...def,
      progress: prog,
      completed: prog >= def.goal,
      claimed: claimed[def.id] ?? false,
    };
  });
}

/**
 * Increments progress for all today's missions matching the given type.
 * Returns missions that became newly completed as a result of this update.
 */
export function updateMissionProgress(
  hash: string,
  type: MissionType,
  amount: number
): CompletedMission[] {
  const defs = getTodayMissionDefs(hash);
  const progress = getStoredProgress(hash);
  const newly: CompletedMission[] = [];

  // session_bananas tracks per-session max, not cumulative — treat amount as absolute value
  const isSession = type === 'session_bananas';

  for (const def of defs) {
    if (def.type !== type) continue;

    const prev = progress[def.id] ?? 0;
    const wasCompleted = prev >= def.goal;

    let next: number;
    if (isSession) {
      // Take the higher of stored vs current session value
      next = Math.max(prev, amount);
    } else {
      next = prev + amount;
    }

    progress[def.id] = next;

    const nowCompleted = next >= def.goal;
    if (!wasCompleted && nowCompleted) {
      newly.push({ ...def });
    }
  }

  localStorage.setItem(keyProgress(hash), JSON.stringify(progress));
  return newly;
}

/**
 * Marks a mission as claimed and returns its banana reward.
 * Returns 0 if the mission is not completed, not found, or already claimed.
 */
export function claimMissionReward(hash: string, missionId: string): number {
  const defs = getTodayMissionDefs(hash);
  const def = defs.find((d) => d.id === missionId);
  if (!def) return 0;

  const progress = getStoredProgress(hash);
  const claimed = getStoredClaimed(hash);

  const prog = progress[def.id] ?? 0;
  if (prog < def.goal) return 0;
  if (claimed[def.id]) return 0;

  claimed[def.id] = true;
  localStorage.setItem(keyClaimed(hash), JSON.stringify(claimed));
  return def.reward;
}
