import type { User } from '../types/user';
import type { Badge, TreasureBox, OwnedBoxInstance } from '../types';

/**
 * Evaluate a level formula string using the current EXP value.
 * The formula string is a JavaScript expression with `exp` as the variable.
 * Example: "Math.floor(exp / 100) + 1"
 * Pure function — no Firebase or React dependencies.
 */
export const evaluateLevelFormula = (exp: number, formulaStr: string): number => {
  try {
    return Math.max(1, new Function('exp', 'return ' + formulaStr)(exp));
  } catch {
    return Math.floor(exp / 100) + 1;
  }
};

/**
 * Calculate how many EXP points are needed to reach the next level.
 * Pure function — no Firebase or React dependencies.
 */
export const calculateExpToNextLevel = (currentExp: number, formulaStr: string): number => {
  const currentLevel = evaluateLevelFormula(currentExp, formulaStr);
  let testExp = currentExp;
  while (evaluateLevelFormula(testExp, formulaStr) === currentLevel && testExp < currentExp + 100000) {
    testExp++;
  }
  return testExp - currentExp;
};

/**
 * Returns progress bar data: { progressPercent, currentLevelStartExp, nextLevelStartExp }
 * Pure function — no Firebase or React dependencies.
 */
export const calculateLevelProgress = (
  currentExp: number,
  formulaStr: string,
): { progressPercent: number; currentLevelStartExp: number; nextLevelStartExp: number } => {
  const currentLevel = evaluateLevelFormula(currentExp, formulaStr);
  // Find currentLevelStartExp: walk backwards from currentExp
  let startExp = 0;
  for (let e = currentExp; e >= 0; e--) {
    if (evaluateLevelFormula(e, formulaStr) < currentLevel) {
      startExp = e + 1;
      break;
    }
    if (e === 0) { startExp = 0; }
  }
  // Find nextLevelStartExp: walk forward
  let nextExp = currentExp + 1;
  while (evaluateLevelFormula(nextExp, formulaStr) === currentLevel && nextExp < currentExp + 100000) {
    nextExp++;
  }
  const range = nextExp - startExp;
  const progress = range > 0 ? Math.min(100, Math.max(0, ((currentExp - startExp) / range) * 100)) : 100;
  return { progressPercent: Math.round(progress), currentLevelStartExp: startExp, nextLevelStartExp: nextExp };
};

/**
 * Apply EXP and gem rewards to a user, then check if any new badges are unlocked.
 * If a badge has a box reward, add a box instance to ownedBoxes.
 * Returns a new User object (immutable — original is not mutated).
 * Pure function — no Firebase or React dependencies.
 */
export const applyUserRewards = (
  user: User,
  expAction: number,
  gemsAction: number,
  settings?: { levelFormula?: string },
  allBadges: Badge[] = [],
  allBoxes: TreasureBox[] = [],
): User => {
  const newUser = { ...user };
  if (expAction > 0) Object.assign(newUser, { exp: newUser.exp + expAction });
  if (gemsAction > 0) Object.assign(newUser, { gems: (newUser.gems || 0) + gemsAction });
  const levelStr = settings?.levelFormula || 'Math.floor(exp / 100) + 1';
  newUser.level = evaluateLevelFormula(newUser.exp, levelStr);

  const unlocked = new Set(newUser.unlockedBadges || []);
  let badgesToProcess = allBadges.filter(b => !unlocked.has(b.id));
  let newlyUnlocked = true;
  while (newlyUnlocked && badgesToProcess.length > 0) {
    newlyUnlocked = false;
    for (const badge of badgesToProcess) {
      let met = false;
      for (const cond of badge.conditions) {
        if (cond.type === 'total_gems' && (newUser.gems || 0) >= cond.value) { met = true; break; }
        if (cond.type === 'level' && newUser.level >= cond.value) { met = true; break; }
        if (cond.type === 'quests_count' && (newUser.stats?.questsCount || 0) >= cond.value) { met = true; break; }
      }
      if (met) {
        unlocked.add(badge.id);
        newUser.unlockedBadges = Array.from(unlocked);
        if (badge.expReward) newUser.exp += badge.expReward;
        if (badge.gemReward) newUser.gems = (newUser.gems || 0) + badge.gemReward;
        newUser.level = evaluateLevelFormula(newUser.exp, levelStr);
        // Grant box reward if badge has one and the box still exists
        if (badge.boxRewardId) {
          const rewardBox = allBoxes.find(b => b.id === badge.boxRewardId);
          if (rewardBox) {
            const newInstance: OwnedBoxInstance = {
              instanceId: `badge-${badge.id}-${Date.now()}`,
              boxId: rewardBox.id,
              boxName: rewardBox.name,
              obtainedAt: new Date().toISOString(),
            };
            newUser.ownedBoxes = [...(newUser.ownedBoxes || []), newInstance];
          }
        }
        newlyUnlocked = true;
      }
    }
    badgesToProcess = allBadges.filter(b => !unlocked.has(b.id));
  }
  return newUser;
};
