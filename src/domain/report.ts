/**
 * Report generation — pure aggregations over transactions/quests/envelopes.
 * No Firebase / React / DOM dependencies.
 */

import type { Envelope, Transaction, ExpenseCategory } from '../types/envelope';
import type { Quest } from '../types/quest';
import type { User } from '../types/user';
import { calcGoalProgress } from './goal';
import { calcCurrentEnergy } from './energy';

export type ReportPeriod = 'week' | 'month';

export interface ReportRange {
  start: string; // ISO
  end: string;   // ISO (exclusive)
  periodLabel: string; // e.g. "2025/01/06 – 01/12"
}

export interface CategoryBreakdown {
  categoryId: string | null;
  name: string;
  icon: string;
  amount: number;   // positive number
  count: number;
  percent: number;  // 0–100 of spending total
}

export interface TopExpense {
  amount: number;
  note: string;
  timestamp: string;
  categoryName: string | null;
  envelopeName: string | null;
}

export interface GoalSnapshot {
  envelopeId: string;
  envelopeName: string;
  goalAmount: number;
  currentPercent: number;
  achieved: boolean;
}

export interface ReportData {
  period: ReportPeriod;
  range: ReportRange;
  kid: { id: string; name: string };

  income: { total: number; count: number };
  spending: {
    total: number;
    count: number;
    byCategory: CategoryBreakdown[];
  };
  netFlow: number; // income - spending

  savings: {
    startBalance: number;
    endBalance: number;
    delta: number;
  };

  quests: {
    completed: number;
    totalClosed: number; // completed + rejected + failed + delayed
    completionRate: number; // 0–1
  };

  energy: {
    hasLicense: boolean;
    max: number;
    currentEnergy: number;
    utilizationRate: number; // spending / max, 0–1+
  };

  goals: GoalSnapshot[];

  topExpenses: TopExpense[]; // top 3 by amount
}

export interface GenerateReportInput {
  period: ReportPeriod;
  now?: Date;
  kid: User;
  transactions: Transaction[];
  envelopes: Envelope[];
  quests: Quest[];
  expenseCategories: ExpenseCategory[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Compute the [start, end) range for the report period, ending at `now`. */
export function getReportRange(period: ReportPeriod, now: Date = new Date()): ReportRange {
  const end = now;
  const days = period === 'week' ? 7 : 30;
  const start = new Date(end.getTime() - days * MS_PER_DAY);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    periodLabel: `${start.getFullYear()}/${fmt(start)} – ${fmt(end)}`,
  };
}

export function generateReport(input: GenerateReportInput): ReportData {
  const { period, kid, transactions, envelopes, quests, expenseCategories } = input;
  const now = input.now ?? new Date();
  const range = getReportRange(period, now);
  const startMs = new Date(range.start).getTime();
  const endMs = new Date(range.end).getTime();

  const kidEnvIds = new Set(envelopes.filter(e => e.ownerId === kid.id).map(e => e.id));

  // Filter in-window, non-rejected txns on this kid's envelopes
  const inWindow = transactions.filter(t => {
    if (!kidEnvIds.has(t.envelopeId)) return false;
    if (t.status === 'rejected') return false;
    const ts = new Date(t.timestamp).getTime();
    return ts >= startMs && ts < endMs;
  });

  const incomeTxs = inWindow.filter(t => t.amount > 0);
  const spendTxs = inWindow.filter(t => t.amount < 0);

  const incomeTotal = incomeTxs.reduce((s, t) => s + t.amount, 0);
  const spendTotal = Math.abs(spendTxs.reduce((s, t) => s + t.amount, 0));

  // Category breakdown (uses categoryId; missing → "其他")
  const catMap = new Map<string, { categoryId: string | null; name: string; icon: string; amount: number; count: number }>();
  const catLookup = new Map(expenseCategories.map(c => [c.id, c]));
  for (const t of spendTxs) {
    const cat = t.categoryId ? catLookup.get(t.categoryId) : undefined;
    const key = cat?.id ?? '__other__';
    const existing = catMap.get(key);
    if (existing) {
      existing.amount += Math.abs(t.amount);
      existing.count += 1;
    } else {
      catMap.set(key, {
        categoryId: cat?.id ?? null,
        name: cat?.name ?? '其他',
        icon: cat?.icon ?? '💸',
        amount: Math.abs(t.amount),
        count: 1,
      });
    }
  }
  const byCategory: CategoryBreakdown[] = [...catMap.values()]
    .map(c => ({ ...c, percent: spendTotal > 0 ? (c.amount / spendTotal) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // Savings (investing envelopes): reconstruct balance at start by subtracting
  // in-window net flow from current balance.
  const investEnvs = envelopes.filter(e => e.ownerId === kid.id && e.type === 'investing');
  const investIds = new Set(investEnvs.map(e => e.id));
  const investWindowNet = inWindow
    .filter(t => investIds.has(t.envelopeId))
    .reduce((s, t) => s + t.amount, 0);
  const investEnd = investEnvs.reduce((s, e) => s + e.balance, 0);
  const investStart = investEnd - investWindowNet;

  // Quests closed in window (has a feedback timestamp or status is terminal)
  const kidQuests = quests.filter(q => q.ownerId === kid.id);
  const closedInWindow = kidQuests.filter(q => {
    if (!q.feedback?.timestamp) return false;
    const ts = new Date(q.feedback.timestamp).getTime();
    return ts >= startMs && ts < endMs;
  });
  const completed = closedInWindow.filter(q => q.status === 'completed').length;
  const totalClosed = closedInWindow.length;

  // Energy stats
  const license = kid.spendingLicense;
  const hasLicense = !!license && license.max > 0;
  const currentEnergy = hasLicense ? calcCurrentEnergy(license, now) : 0;
  const utilizationRate = hasLicense && license.max > 0 ? spendTotal / license.max : 0;

  // Goal snapshots (current values; historical "start" is non-trivial without
  // snapshots, so we report where the kid is NOW for each goaled envelope)
  const goals: GoalSnapshot[] = envelopes
    .filter(e => e.ownerId === kid.id && e.goalAmount && e.goalAmount > 0)
    .map(e => {
      const gp = calcGoalProgress(e, transactions, now);
      return {
        envelopeId: e.id,
        envelopeName: e.name,
        goalAmount: gp.goalAmount,
        currentPercent: gp.percent,
        achieved: gp.achieved,
      };
    });

  // Top 3 expenses
  const topExpenses: TopExpense[] = [...spendTxs]
    .sort((a, b) => a.amount - b.amount) // ascending (most negative first)
    .slice(0, 3)
    .map(t => {
      const cat = t.categoryId ? catLookup.get(t.categoryId) : undefined;
      const env = envelopes.find(e => e.id === t.envelopeId);
      return {
        amount: Math.abs(t.amount),
        note: t.note || '（無備註）',
        timestamp: t.timestamp,
        categoryName: cat?.name ?? null,
        envelopeName: env?.name ?? null,
      };
    });

  return {
    period,
    range,
    kid: { id: kid.id, name: kid.name },
    income: { total: incomeTotal, count: incomeTxs.length },
    spending: { total: spendTotal, count: spendTxs.length, byCategory },
    netFlow: incomeTotal - spendTotal,
    savings: {
      startBalance: investStart,
      endBalance: investEnd,
      delta: investEnd - investStart,
    },
    quests: {
      completed,
      totalClosed,
      completionRate: totalClosed > 0 ? completed / totalClosed : 0,
    },
    energy: {
      hasLicense,
      max: license?.max ?? 0,
      currentEnergy,
      utilizationRate,
    },
    goals,
    topExpenses,
  };
}
