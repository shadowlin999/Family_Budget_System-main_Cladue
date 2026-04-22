import type { Envelope, Transaction } from '../types/envelope';

export interface GoalProgress {
  hasGoal: boolean;
  goalAmount: number;
  balance: number;
  remaining: number;
  percent: number;          // 0–100, clamped
  achieved: boolean;
  avgDailySaving: number;   // mean positive-inflow per day over window (currency/day)
  etaDays: number | null;   // null if no meaningful pace yet or already achieved
  deadlineDays: number | null; // days until goalDeadline (can be negative if past)
  onTrack: boolean | null;  // whether eta ≤ deadline (null if either missing)
}

const WINDOW_DAYS = 30;

/**
 * Compute wish-goal progress + ETA for an envelope.
 * Pure function — no Firebase or React deps.
 *
 * Average daily saving uses positive-amount transactions
 * (allowance / deposits / refunds) within the last WINDOW_DAYS,
 * excluding spending and rejected items.
 */
export function calcGoalProgress(
  envelope: Envelope,
  transactions: Transaction[],
  now: Date = new Date(),
): GoalProgress {
  const goalAmount = envelope.goalAmount ?? 0;
  const balance = envelope.balance;

  if (!goalAmount || goalAmount <= 0) {
    return {
      hasGoal: false,
      goalAmount: 0,
      balance,
      remaining: 0,
      percent: 0,
      achieved: false,
      avgDailySaving: 0,
      etaDays: null,
      deadlineDays: null,
      onTrack: null,
    };
  }

  const remaining = Math.max(0, goalAmount - balance);
  const percent = Math.max(0, Math.min(100, (balance / goalAmount) * 100));
  const achieved = balance >= goalAmount;

  const windowStart = now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const inflowSum = transactions
    .filter(t => t.envelopeId === envelope.id)
    .filter(t => t.status !== 'rejected')
    .filter(t => t.amount > 0)
    .filter(t => {
      const ts = new Date(t.timestamp).getTime();
      return Number.isFinite(ts) && ts >= windowStart;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const avgDailySaving = inflowSum / WINDOW_DAYS;

  let etaDays: number | null = null;
  if (achieved) {
    etaDays = 0;
  } else if (avgDailySaving > 0) {
    etaDays = Math.ceil(remaining / avgDailySaving);
  }

  let deadlineDays: number | null = null;
  if (envelope.goalDeadline) {
    const deadlineMs = new Date(envelope.goalDeadline).getTime();
    if (Number.isFinite(deadlineMs)) {
      deadlineDays = Math.ceil((deadlineMs - now.getTime()) / (24 * 60 * 60 * 1000));
    }
  }

  const onTrack =
    etaDays !== null && deadlineDays !== null ? etaDays <= deadlineDays : null;

  return {
    hasGoal: true,
    goalAmount,
    balance,
    remaining,
    percent,
    achieved,
    avgDailySaving,
    etaDays,
    deadlineDays,
    onTrack,
  };
}
