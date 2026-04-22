import { describe, it, expect } from 'vitest';
import { generateReport, getReportRange } from './report';
import type { Envelope, Transaction, ExpenseCategory } from '../types/envelope';
import type { Quest } from '../types/quest';
import type { User } from '../types/user';

const kid: User = { id: 'k1', name: 'Kid', role: 'kid', level: 1, exp: 0 };

const mkEnv = (o: Partial<Envelope>): Envelope => ({
  id: 'e1', ownerId: 'k1', name: 'Wallet', type: 'spendable', balance: 0, isHidden: false, ...o,
});

const mkTx = (o: Partial<Transaction> & { amount: number; daysAgo: number; envelopeId: string }): Transaction => ({
  id: `tx-${Math.random()}`,
  envelopeId: o.envelopeId,
  amount: o.amount,
  timestamp: new Date(Date.now() - o.daysAgo * 86400000).toISOString(),
  note: o.note ?? '',
  status: o.status ?? 'approved',
  categoryId: o.categoryId,
});

const cats: ExpenseCategory[] = [
  { id: 'c1', name: '零食', icon: '🍭' },
  { id: 'c2', name: '玩具', icon: '🧸' },
];

describe('getReportRange', () => {
  it('weekly covers last 7 days', () => {
    const now = new Date('2025-01-15T00:00:00Z');
    const r = getReportRange('week', now);
    expect(new Date(r.end).getTime() - new Date(r.start).getTime()).toBe(7 * 86400000);
  });
  it('monthly covers last 30 days', () => {
    const now = new Date('2025-01-31T00:00:00Z');
    const r = getReportRange('month', now);
    expect(new Date(r.end).getTime() - new Date(r.start).getTime()).toBe(30 * 86400000);
  });
});

describe('generateReport', () => {
  const envs: Envelope[] = [
    mkEnv({ id: 'spend1', type: 'spendable', balance: 150 }),
    mkEnv({ id: 'invest1', type: 'investing', balance: 500 }),
  ];
  const txs: Transaction[] = [
    mkTx({ envelopeId: 'spend1', amount: 200, daysAgo: 2 }),   // income
    mkTx({ envelopeId: 'spend1', amount: -30, daysAgo: 1, categoryId: 'c1' }), // snack
    mkTx({ envelopeId: 'spend1', amount: -20, daysAgo: 3, categoryId: 'c1' }), // snack
    mkTx({ envelopeId: 'spend1', amount: -100, daysAgo: 4, categoryId: 'c2' }), // toy
    mkTx({ envelopeId: 'spend1', amount: -999, daysAgo: 20 }), // outside week
    mkTx({ envelopeId: 'spend1', amount: -50, daysAgo: 1, status: 'rejected' }), // rejected, skip
    mkTx({ envelopeId: 'invest1', amount: 100, daysAgo: 3 }),  // saved 100
  ];
  const quests: Quest[] = [
    { id: 'q1', ownerId: 'k1', title: 't', expReward: 0, moneyReward: 0, gemReward: 0, status: 'completed',
      feedback: { grade: 'great', emoji: '', comment: '', actualExp: 0, actualMoney: 0, actualGems: 0, timestamp: new Date(Date.now() - 86400000).toISOString() } },
    { id: 'q2', ownerId: 'k1', title: 't', expReward: 0, moneyReward: 0, gemReward: 0, status: 'rejected',
      feedback: { grade: 'rejected', emoji: '', comment: '', actualExp: 0, actualMoney: 0, actualGems: 0, timestamp: new Date(Date.now() - 86400000).toISOString() } },
  ];

  it('aggregates weekly income, spending, and categories', () => {
    const r = generateReport({ period: 'week', kid, transactions: txs, envelopes: envs, quests, expenseCategories: cats });
    expect(r.income.total).toBe(300); // 200 + 100
    expect(r.income.count).toBe(2);
    expect(r.spending.total).toBe(150); // 30+20+100
    expect(r.spending.count).toBe(3);
    expect(r.spending.byCategory[0].name).toBe('玩具'); // largest first
    expect(r.spending.byCategory[0].amount).toBe(100);
    expect(r.spending.byCategory[1].name).toBe('零食');
    expect(r.spending.byCategory[1].amount).toBe(50);
    expect(r.spending.byCategory[1].count).toBe(2);
  });

  it('excludes rejected and out-of-window txns', () => {
    const r = generateReport({ period: 'week', kid, transactions: txs, envelopes: envs, quests, expenseCategories: cats });
    // No category 'null' from rejected → only c1 and c2
    expect(r.spending.byCategory.find(c => c.amount === 50)).toBeTruthy();
    // 999 outside-window spend should NOT appear
    expect(r.spending.byCategory.every(c => c.amount !== 999)).toBe(true);
  });

  it('reconstructs savings start balance from current - in-window delta', () => {
    const r = generateReport({ period: 'week', kid, transactions: txs, envelopes: envs, quests, expenseCategories: cats });
    expect(r.savings.endBalance).toBe(500);
    expect(r.savings.delta).toBe(100);
    expect(r.savings.startBalance).toBe(400);
  });

  it('computes quest completion rate', () => {
    const r = generateReport({ period: 'week', kid, transactions: txs, envelopes: envs, quests, expenseCategories: cats });
    expect(r.quests.completed).toBe(1);
    expect(r.quests.totalClosed).toBe(2);
    expect(r.quests.completionRate).toBe(0.5);
  });

  it('reports license utilization when license exists', () => {
    const kidWithLic: User = {
      ...kid,
      spendingLicense: { max: 300, current: 150, lastRefillAt: new Date().toISOString() },
    };
    const r = generateReport({ period: 'week', kid: kidWithLic, transactions: txs, envelopes: envs, quests, expenseCategories: cats });
    expect(r.energy.hasLicense).toBe(true);
    expect(r.energy.max).toBe(300);
    expect(r.energy.utilizationRate).toBeCloseTo(150 / 300, 5);
  });

  it('surfaces top 3 expenses by absolute amount', () => {
    const r = generateReport({ period: 'week', kid, transactions: txs, envelopes: envs, quests, expenseCategories: cats });
    expect(r.topExpenses.length).toBe(3);
    expect(r.topExpenses[0].amount).toBe(100); // toy
    expect(r.topExpenses[1].amount).toBe(30);
    expect(r.topExpenses[2].amount).toBe(20);
  });

  it('returns goal snapshots for envelopes with goals', () => {
    const envWithGoal = [
      ...envs,
      mkEnv({ id: 'wish1', type: 'spendable', balance: 250, goalAmount: 500, name: 'New Toy' }),
    ];
    const r = generateReport({ period: 'week', kid, transactions: txs, envelopes: envWithGoal, quests, expenseCategories: cats });
    expect(r.goals.length).toBe(1);
    expect(r.goals[0].envelopeName).toBe('New Toy');
    expect(r.goals[0].currentPercent).toBe(50);
  });
});
