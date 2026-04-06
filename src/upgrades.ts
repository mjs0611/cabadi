import type { GameState } from './state.ts';
import { SKILLS } from './data.ts';

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  type?: 'skill_up' | 'new_skill' | 'utility';
  skillType?: string;
  apply: (state: GameState) => void;
}

export function pickUpgrades(state: GameState, count = 3): Upgrade[] {
  const pool: Upgrade[] = [];

  // 1. 기존 스킬 레벨업
  for (const skill of state.activeSkills) {
    if (skill.level < 10) {
      const data = (SKILLS as any)[skill.type];
      pool.push({
        id: `level_up_${skill.type}`,
        name: `${data.name} 강화`,
        desc: `Lv${skill.level} -> Lv${skill.level + 1}로 진화합니다.`,
        type: 'skill_up',
        skillType: skill.type,
        apply: (s) => {
          const target = s.activeSkills.find(as => as.type === skill.type);
          if (target) target.level++;
        }
      });
    }
  }

  // 2. 새로운 스킬 획득 (최대 5개)
  if (state.activeSkills.length < 5) {
    for (const type in SKILLS) {
      if (!state.activeSkills.find(as => as.type === type)) {
        const data = (SKILLS as any)[type];
        pool.push({
          id: `new_skill_${type}`,
          name: `새 기술: ${data.name}`,
          desc: `${data.type} 타입의 새로운 공격을 시작합니다.`,
          type: 'new_skill',
          skillType: type,
          apply: (s) => {
            s.activeSkills.push({ type, level: 1, lastShot: 0 });
          }
        });
      }
    }
  }

  // 3. 기본 유틸리티 (항상 포함 가능성 있음)
  pool.push({
    id: 'hp_recover',
    name: '카피바라의 휴식',
    desc: 'HP를 30 회복합니다.',
    type: 'utility',
    apply: (s) => { s.hp = Math.min(s.maxHp, s.hp + 30); }
  });

  pool.push({
    id: 'max_hp_up',
    name: '튼튼한 털뭉치',
    desc: '최대 HP가 50 증가합니다.',
    type: 'utility',
    apply: (s) => { s.maxHp += 50; s.hp += 50; }
  });

  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
