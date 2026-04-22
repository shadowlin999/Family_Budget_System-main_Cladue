import { describe, it, expect } from 'vitest';
import { calcGoalProgress } from './goal';
import type { Envelope, Transaction } from '../types/envelope';

const mkEnv = (overrides: Partial<Envelope> = {}): Envelope => ({
  id: 'env1',
  ownerId: 'kid1',
  name: 'Wish',
  type: 'spendable',
  balance: 0,
  isHidden: false,
  ...overrides,
});

const mkTx = (amount: number, daysAgo: number, envelopeId = 'env1', status: Transaction['status'] = 'approved'): Transaction => ({
  id: `tx-${Math.random()}`,
  envelopeId,
  amount,
  timestamp: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  note: '',
  status,
});

describe('calcGoalProgress', () => {
  it('returns hasGoal=false when no goal set', () => {
    const r = calcGoalProgress(mkEnv({ balance: 500 }), []);
    expect(r.hasGoal).toBe(false);
    expect(r.etaDays).toBeNull();
  });

  it('computes percent and remaining', () => {
    const env = mkEnv({ balance: 300, goalAmount: 1000 });
    const r = calcGoalProgress(env, []);
    expect(r.percent).toBe(30);
    expect(r.remaining).toBe(700);
    expect(r.achieved).toBe(false);
  });

  it('clamps percent to 100 once achieved', () => {
    const env = mkEnv({ balance: 1200, goalAmount: 1000 });
    const r = calcGoalProgress(env, []);
    expect(r.percent).toBe(100);
    expect(r.achieved).toBe(true);
    expect(r.remaining).toBe(0);
    expect(r.etaDays).toBe(0);
  });

  it('computes ETA from positive inflows in last 30 days', () => {
    const env = mkEnv({ balance: 100, goalAmount: 400 });
    // 300 inflow over 30 days → 10/day → remaining 300 → 30 days
    const txs = [mkTx(150, 5), mkTx(150, 10)];
    const r = calcGoalProgress(env, txs);
    expect(r.avgDailySaving).toBeCloseTo(10, 5);
    expect(r.etaDays).toBe(30);
  });

  it('ignores rejected and negative (spending) transactions', () => {
    const env = mkEnv({ balance: 100, goalAmount: 400 });
    const txs = [
      mkTx(300, 5, 'env1', 'rejected'),
      mkTx(-200, 5),
      mkTx(90, 1),
    ];
    const r = calcGoalProgress(env, txs);
    // only 90 counts → 3/day → remaining 300 → 100 days
    expect(r.avgDailySaving).toBeCloseTo(3, 5);
    expect(r.etaDays).toBe(100);
  });

  it('ignores transactions outside the 30-day window', () => {
    const env = mkEnv({ balance: 0, goalAmount: 500 });
    const txs = [mkTx(999, 60)];
    const r = calcGoalProgress(env, txs);
    expect(r.avgDailySaving).toBe(0);
    expect(r.etaDays).toBeNull();
  });

  it('ignores transactions belonging to other envelopes', () => {
    const env = mkEnv({ balance: 0, goalAmount: 300 });
    const txs = [mkTx(300, 1, 'env-other')];
    const r = calcGoalProgress(env, txs);
    expect(r.avgDailySaving).toBe(0);
    expect(r.etaDays).toBeNull();
  });

  it('computes deadlineDays and onTrack', () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const deadline = new Date('2025-01-31T00:00:00Z').toISOString();
    const env = mkEnv({ balance: 100, goalAmount: 400, goalDeadline: deadline });
    // 300 inflow over last 30 days → eta 30 days → deadline ~30 days → onTrack true
    const txs = [
      { ...mkTx(300, 5), timestamp: new Date(now.getTime() - 5 * 86400000).toISOString() },
    ];
    const r = calcGoalProgress(env, txs, now);
    expect(r.deadlineDays).toBe(30);
    expect(r.etaDays).toBe(30);
    expect(r.onTrack).toBe(true);
  });
});
