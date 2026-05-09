import skillsData from '../assets/data/skills_balance.json';
import monstersData from '../assets/data/monster_stats.json';
import { getStage, getHpMult, getGoldMult, getBossHpMult, getBossIndex, getMonsterLevel } from './stages.ts';

export const SKILLS = skillsData.skills;
export const MONSTERS = monstersData.monsters;

export function getSkillStats(type: string, level: number) {
  const skill = (SKILLS as any)[type];
  if (!skill) return null;
  return skill.levels[level - 1] || skill.levels[skill.levels.length - 1];
}

// 스테이지+웨이브에서 일반/중간/엘리트 몬스터 선택
export function getEnemyForStageWave(stage: number, wave: number) {
  const stageDef = getStage(stage);
  const level = getMonsterLevel(stage, wave);
  const hpMult = getHpMult(stage, wave, stageDef.difficultyMult);
  const goldMult = getGoldMult(stage, wave);

  // 웨이브 진행도에 따라 티어 결정
  let tier: 'normal' | 'intermediate' | 'elite';
  const waveProgress = wave / 50;
  const r = Math.random();

  if (waveProgress < 0.2) {
    tier = r < 0.8 ? 'normal' : 'intermediate';
  } else if (waveProgress < 0.4) {
    tier = r < 0.4 ? 'normal' : r < 0.9 ? 'intermediate' : 'elite';
  } else if (waveProgress < 0.6) {
    tier = r < 0.2 ? 'normal' : r < 0.7 ? 'intermediate' : 'elite';
  } else if (waveProgress < 0.8) {
    tier = r < 0.1 ? 'normal' : r < 0.5 ? 'intermediate' : 'elite';
  } else {
    tier = r < 0.1 ? 'intermediate' : 'elite';
  }

  let pool: string[];
  if (tier === 'normal') pool = stageDef.normalPool;
  else if (tier === 'intermediate') pool = stageDef.intermediatePool;
  else pool = stageDef.elitePool;

  const allOfTier = (MONSTERS as any)[tier] as any[];
  const available = allOfTier.filter((m: any) => pool.includes(m.id));
  const source = available.length > 0 ? available : allOfTier;
  const base = source[Math.floor(Math.random() * source.length)];

  const hp = Math.round(base.baseHp * hpMult);
  const gold = Math.round(base.baseGold * goldMult);

  return {
    id: base.id,
    name: base.name,
    hp,
    speed: base.baseSpeed,
    gold,
    tier,
    traits: base.traits as string[],
    attackType: base.attackType as string,
    attackDamage: Math.round(base.attackDamage * stageDef.difficultyMult),
    sheetIdx: base.sheetIdx ?? 0,
    idx: base.sheetIdx ?? 0,
    level,
    isBoss: false
  };
}

// 스테이지+웨이브에서 보스 선택 (10웨이브마다)
export function getBossForStageWave(stage: number, wave: number) {
  const stageDef = getStage(stage);
  const bossIdx = Math.min(getBossIndex(wave), stageDef.bossPool.length - 1);
  const bossId = stageDef.bossPool[bossIdx];
  const bossList = MONSTERS.boss as any[];
  const base = bossList.find((b: any) => b.id === bossId) ?? bossList[0];

  const level = getMonsterLevel(stage, wave);
  const hpMultiplier = getBossHpMult(bossIdx, stage);
  const hp = Math.round(base.baseHp * hpMultiplier);
  const goldMult = getGoldMult(stage, wave);

  return {
    id: base.id,
    name: base.name,
    hp,
    speed: base.baseSpeed,
    gold: Math.round(base.baseGold * goldMult),
    tier: 'boss',
    traits: base.traits as string[],
    attackType: base.attackType as string,
    attackDamage: Math.round(base.attackDamage * stageDef.difficultyMult * (1 + bossIdx * 0.5)),
    sheetIdx: base.sheetIdx ?? 0,
    idx: base.sheetIdx ?? 0,
    level,
    isBoss: true
  };
}
