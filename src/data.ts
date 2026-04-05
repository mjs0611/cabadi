import skillsData from '../assets/data/skills_balance.json';
import monstersData from '../assets/data/monster_stats.json';

export const SKILLS = skillsData.skills;
export const MONSTERS = monstersData.monsters;

export function getSkillStats(type: string, level: number) {
  const skill = (SKILLS as any)[type];
  if (!skill) return null;
  return skill.levels[level - 1] || skill.levels[skill.levels.length - 1];
}

export function getRandomMonster(wave: number) {
  let tier: 'normal' | 'intermediate' | 'elite' | 'boss' = 'normal';
  if (wave >= 15) tier = Math.random() < 0.2 ? 'boss' : 'elite';
  else if (wave >= 10) tier = Math.random() < 0.3 ? 'elite' : 'intermediate';
  else if (wave >= 5) tier = Math.random() < 0.3 ? 'intermediate' : 'normal';

  const list = MONSTERS[tier];
  const idxInTier = Math.floor(Math.random() * list.length);
  const monster = list[idxInTier];
  return { ...monster, isBoss: tier === 'boss', tier, idx: idxInTier };
}
