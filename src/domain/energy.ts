import type { SpendingLicense } from '../types/user';

export const REFILL_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Compute current energy given the persisted snapshot.
 * Linear refill: max / REFILL_WINDOW_DAYS per day, clamped to [0, max].
 * Pure — no side effects.
 */
export function calcCurrentEnergy(lic: SpendingLicense, now: Date = new Date()): number {
  if (!Number.isFinite(lic.max) || lic.max <= 0) return 0;
  const lastMs = new Date(lic.lastRefillAt).getTime();
  if (!Number.isFinite(lastMs)) return Math.max(0, Math.min(lic.max, lic.current));
  const elapsedDays = Math.max(0, (now.getTime() - lastMs) / MS_PER_DAY);
  const refilled = lic.current + elapsedDays * (lic.max / REFILL_WINDOW_DAYS);
  return Math.max(0, Math.min(lic.max, refilled));
}

/**
 * Days until energy reaches max, given current snapshot.
 * Returns 0 if already full; rounded up.
 */
export function daysToFull(lic: SpendingLicense, now: Date = new Date()): number {
  if (!Number.isFinite(lic.max) || lic.max <= 0) return 0;
  const e = calcCurrentEnergy(lic, now);
  if (e >= lic.max) return 0;
  return Math.ceil((lic.max - e) / (lic.max / REFILL_WINDOW_DAYS));
}

export interface SpendResult {
  ok: boolean;              // true if spend fit within current energy
  nextLicense: SpendingLicense; // updated snapshot (same ref semantics if ok=false)
  energyBefore: number;
  energyAfter: number;
  shortfall: number;        // amount missing if over-limit; 0 otherwise
}

/**
 * Attempt to spend `amount` energy. Always returns a non-mutating snapshot.
 * If successful: flushes accrued refill into `current`, subtracts spend,
 * and advances `lastRefillAt` to `now`.
 * If not successful (over limit): leaves snapshot untouched; caller should
 * fall back to pending-approval flow.
 */
export function spendEnergy(
  lic: SpendingLicense,
  amount: number,
  now: Date = new Date(),
): SpendResult {
  const energyBefore = calcCurrentEnergy(lic, now);
  const spend = Math.max(0, amount);
  if (spend <= energyBefore + 1e-9) {
    const next: SpendingLicense = {
      max: lic.max,
      current: Math.max(0, energyBefore - spend),
      lastRefillAt: now.toISOString(),
    };
    return { ok: true, nextLicense: next, energyBefore, energyAfter: next.current, shortfall: 0 };
  }
  return {
    ok: false,
    nextLicense: lic,
    energyBefore,
    energyAfter: energyBefore,
    shortfall: spend - energyBefore,
  };
}

/**
 * Create a fresh license snapshot when the parent (re)configures max.
 * - newMax = 0 → disables the system (returns null-equivalent sentinel; caller deletes field)
 * - If a previous license exists, preserves the current energy ratio so
 *   changing the cap doesn't "reset" the kid's earned energy.
 */
export function buildLicenseSnapshot(
  newMax: number,
  prev: SpendingLicense | undefined,
  now: Date = new Date(),
): SpendingLicense {
  const max = Math.max(0, newMax);
  if (max === 0) {
    return { max: 0, current: 0, lastRefillAt: now.toISOString() };
  }
  if (!prev || prev.max <= 0) {
    // Start full — trust-based onboarding
    return { max, current: max, lastRefillAt: now.toISOString() };
  }
  const currentEnergy = calcCurrentEnergy(prev, now);
  const ratio = prev.max > 0 ? currentEnergy / prev.max : 1;
  return {
    max,
    current: Math.max(0, Math.min(max, max * ratio)),
    lastRefillAt: now.toISOString(),
  };
}
