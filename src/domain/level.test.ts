import { describe, it, expect } from 'vitest';
import {
  evaluateLevelFormula,
  calculateExpToNextLevel,
  calculateLevelProgress,
  applyUserRewards,
} from './level';
import type { User } from '../types/user';
import type { Badge, TreasureBox } from '../types';

// ─── Shared fixtures ──────────────────────────────────────────────────────────
const DEFAULT_FORMULA = 'Math.floor(exp / 100) + 1';
const CUSTOM_FORMULA = 'Math.floor(Math.sqrt(exp / 50)) + 1'; // Lv2 at exp=50, Lv3 at exp=200

const baseUser = (): User => ({
  id: 'u1',
  name: 'Alice',
  role: 'kid',
  level: 1,
  exp: 0,
  gems: 0,
  unlockedBadges: [],
});

// ─── evaluateLevelFormula ─────────────────────────────────────────────────────
describe('evaluateLevelFormula', () => {
  it('returns Lv1 when exp=0 with default formula', () => {
    expect(evaluateLevelFormula(0, DEFAULT_FORMULA)).toBe(1);
  });

  it('returns Lv2 when exp=100 with default formula', () => {
    expect(evaluateLevelFormula(100, DEFAULT_FORMULA)).toBe(2);
  });

  it('returns Lv10 when exp=900 with default formula', () => {
    expect(evaluateLevelFormula(900, DEFAULT_FORMULA)).toBe(10);
  });

  it('level never drops below 1 even with negative exp', () => {
    expect(evaluateLevelFormula(-999, DEFAULT_FORMULA)).toBe(1);
  });

  it('uses default formula on syntax error', () => {
    // Bad formula → fallback: Math.floor(exp / 100) + 1
    expect(evaluateLevelFormula(200, 'THIS IS NOT JS')).toBe(3);
  });

  it('uses custom formula correctly', () => {
    // sqrt(50/50)+1 = 2
    expect(evaluateLevelFormula(50, CUSTOM_FORMULA)).toBe(2);
    // sqrt(200/50)+1 = 3
    expect(evaluateLevelFormula(200, CUSTOM_FORMULA)).toBe(3);
  });
});

// ─── calculateExpToNextLevel ──────────────────────────────────────────────────
describe('calculateExpToNextLevel', () => {
  it('returns 100 for exp=0 with default formula (Lv1→Lv2 needs 100)', () => {
    expect(calculateExpToNextLevel(0, DEFAULT_FORMULA)).toBe(100);
  });

  it('returns 100 for exp=100 with default formula (Lv2→Lv3 needs 100)', () => {
    expect(calculateExpToNextLevel(100, DEFAULT_FORMULA)).toBe(100);
  });

  it('returns 50 for exp=0 with sqrt formula (Lv1→Lv2 needs 50)', () => {
    expect(calculateExpToNextLevel(0, CUSTOM_FORMULA)).toBe(50);
  });

  it('returns correct remainder mid-level', () => {
    // At exp=50 with default formula: still Lv1, needs 50 more
    expect(calculateExpToNextLevel(50, DEFAULT_FORMULA)).toBe(50);
  });

  it('returns 1 when exactly at level boundary', () => {
    // At exp=99, one more brings Lv2
    expect(calculateExpToNextLevel(99, DEFAULT_FORMULA)).toBe(1);
  });
});

// ─── calculateLevelProgress ───────────────────────────────────────────────────
describe('calculateLevelProgress', () => {
  it('returns 0% progress at start of level', () => {
    const { progressPercent } = calculateLevelProgress(0, DEFAULT_FORMULA);
    expect(progressPercent).toBe(0);
  });

  it('returns 50% progress at midpoint of level', () => {
    const { progressPercent } = calculateLevelProgress(50, DEFAULT_FORMULA);
    expect(progressPercent).toBe(50);
  });

  it('returns 99% progress just before level up', () => {
    const { progressPercent } = calculateLevelProgress(99, DEFAULT_FORMULA);
    expect(progressPercent).toBe(99);
  });

  it('returns 0% at start of next level', () => {
    const { progressPercent, currentLevelStartExp } = calculateLevelProgress(100, DEFAULT_FORMULA);
    expect(progressPercent).toBe(0);
    expect(currentLevelStartExp).toBe(100);
  });

  it('progressPercent is always between 0 and 100', () => {
    for (const exp of [0, 1, 50, 99, 100, 500, 999]) {
      const { progressPercent } = calculateLevelProgress(exp, DEFAULT_FORMULA);
      expect(progressPercent).toBeGreaterThanOrEqual(0);
      expect(progressPercent).toBeLessThanOrEqual(100);
    }
  });

  it('currentLevelStartExp < nextLevelStartExp', () => {
    const { currentLevelStartExp, nextLevelStartExp } = calculateLevelProgress(250, DEFAULT_FORMULA);
    expect(currentLevelStartExp).toBeLessThan(nextLevelStartExp);
  });
});

// ─── applyUserRewards ─────────────────────────────────────────────────────────
describe('applyUserRewards', () => {
  it('does not mutate the original user', () => {
    const user = baseUser();
    applyUserRewards(user, 50, 0);
    expect(user.exp).toBe(0);
  });

  it('adds EXP correctly', () => {
    const result = applyUserRewards(baseUser(), 100, 0);
    expect(result.exp).toBe(100);
  });

  it('adds gems correctly', () => {
    const result = applyUserRewards(baseUser(), 0, 5);
    expect(result.gems).toBe(5);
  });

  it('recalculates level after EXP gain', () => {
    const result = applyUserRewards(baseUser(), 100, 0);
    expect(result.level).toBe(2); // 100 exp → Lv2
  });

  it('does not add negative EXP', () => {
    const result = applyUserRewards(baseUser(), -50, 0);
    expect(result.exp).toBe(0);
  });

  it('does not add negative gems', () => {
    const result = applyUserRewards(baseUser(), 0, -10);
    expect(result.gems).toBe(0);
  });

  it('unlocks a badge when level condition is met', () => {
    const badge: Badge = {
      id: 'b1',
      name: '初學者',
      icon: '🎖️',
      description: '達到 Lv2',
      conditions: [{ type: 'level', value: 2 }],
    };
    const result = applyUserRewards(baseUser(), 100, 0, undefined, [badge]);
    expect(result.unlockedBadges).toContain('b1');
  });

  it('does not re-unlock an already-unlocked badge', () => {
    const badge: Badge = {
      id: 'b1',
      name: '初學者',
      icon: '🎖️',
      description: '達到 Lv2',
      conditions: [{ type: 'level', value: 2 }],
    };
    const userWithBadge: User = { ...baseUser(), exp: 100, level: 2, unlockedBadges: ['b1'] };
    const result = applyUserRewards(userWithBadge, 100, 0, undefined, [badge]);
    const count = result.unlockedBadges?.filter(id => id === 'b1').length ?? 0;
    expect(count).toBe(1);
  });

  it('unlocks a badge when quests_count condition is met', () => {
    const badge: Badge = {
      id: 'b2',
      name: '任務達人',
      icon: '⚔️',
      description: '完成10個任務',
      conditions: [{ type: 'quests_count', value: 10 }],
    };
    const userWithQuests: User = { ...baseUser(), stats: { questsCount: 10, totalGemsEarned: 0, consecutiveRecordDays: 0, lastRecordDate: null, consecutiveAllQuestsDays: 0, lastAllQuestsDay: null, consecutiveAllQuestsWeeks: 0, lastAllQuestsWeek: null } };
    const result = applyUserRewards(userWithQuests, 0, 0, undefined, [badge]);
    expect(result.unlockedBadges).toContain('b2');
  });

  it('unlocks a badge when total_gems condition is met', () => {
    const badge: Badge = {
      id: 'b3',
      name: '寶石王',
      icon: '💎',
      description: '累積50顆寶石',
      conditions: [{ type: 'total_gems', value: 50 }],
    };
    const result = applyUserRewards(baseUser(), 0, 50, undefined, [badge]);
    expect(result.unlockedBadges).toContain('b3');
  });

  it('applies badge EXP/gem rewards after unlocking', () => {
    const badge: Badge = {
      id: 'b4',
      name: '初學者',
      icon: '🎖️',
      description: '達到 Lv2',
      conditions: [{ type: 'level', value: 2 }],
      expReward: 50,
      gemReward: 5,
    };
    const result = applyUserRewards(baseUser(), 100, 0, undefined, [badge]);
    expect(result.exp).toBe(150); // 100 from action + 50 from badge
    expect(result.gems).toBe(5);
  });

  it('grants a box reward when badge has boxRewardId and box exists', () => {
    const badge: Badge = {
      id: 'b5',
      name: '冒險家',
      icon: '🗺️',
      description: '達到 Lv2',
      conditions: [{ type: 'level', value: 2 }],
      boxRewardId: 'box1',
    };
    const box: TreasureBox = {
      id: 'box1',
      name: '冒險箱',
      costGems: 0,
      items: [],
    };
    const result = applyUserRewards(baseUser(), 100, 0, undefined, [badge], [box]);
    expect(result.ownedBoxes).toHaveLength(1);
    expect(result.ownedBoxes?.[0].boxId).toBe('box1');
  });

  it('does not grant box reward when box does not exist', () => {
    const badge: Badge = {
      id: 'b6',
      name: '冒險家',
      icon: '🗺️',
      description: '達到 Lv2',
      conditions: [{ type: 'level', value: 2 }],
      boxRewardId: 'missing-box',
    };
    const result = applyUserRewards(baseUser(), 100, 0, undefined, [badge], []);
    expect(result.ownedBoxes ?? []).toHaveLength(0);
  });

  it('handles cascade: badge unlock triggers another badge unlock', () => {
    // Badge A unlocks at Lv2 and awards 200 EXP → pushes user to Lv3 → Badge B unlocks
    const badgeA: Badge = {
      id: 'bA',
      name: 'A',
      icon: '🅰️',
      description: '達到 Lv2',
      conditions: [{ type: 'level', value: 2 }],
      expReward: 200,
    };
    const badgeB: Badge = {
      id: 'bB',
      name: 'B',
      icon: '🅱️',
      description: '達到 Lv4',
      conditions: [{ type: 'level', value: 4 }],
    };
    // Start: exp=100 (Lv2), trigger both cascades
    const user: User = { ...baseUser(), exp: 100, level: 2 };
    const result = applyUserRewards(user, 0, 0, undefined, [badgeA, badgeB]);
    expect(result.unlockedBadges).toContain('bA');
    expect(result.unlockedBadges).toContain('bB');
  });
});
