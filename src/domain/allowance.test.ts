import { describe, it, expect } from 'vitest';
import { getNextAllowanceDate } from './allowance';
import type { AllowanceSettings } from '../types/user';

// ─── Weekly mode ──────────────────────────────────────────────────────────────
describe('getNextAllowanceDate — weekly', () => {
  const weekly = (days: number[], hour = 0, minute = 0): AllowanceSettings => ({
    period: 'weekly',
    days,
    hour,
    minute,
  });

  it('returns a future date', () => {
    const now = new Date('2024-01-15T10:00:00'); // Monday
    const result = getNextAllowanceDate(now, weekly([1])); // Next Monday
    expect(new Date(result) > now).toBe(true);
  });

  it('schedules for the same day later if time has not passed', () => {
    // Monday (day=1) at 09:00, distribution is at 12:00 → same day
    const now = new Date('2024-01-15T09:00:00'); // Monday
    const result = getNextAllowanceDate(now, weekly([1], 12, 0));
    const next = new Date(result);
    expect(next.getDay()).toBe(1); // Monday
    expect(next.getHours()).toBe(12);
  });

  it('rolls to next week when current day time has passed', () => {
    // Monday at 14:00, distribution was at 12:00 today → next Monday
    const now = new Date('2024-01-15T14:00:00'); // Monday
    const result = getNextAllowanceDate(now, weekly([1], 12, 0));
    const next = new Date(result);
    // Should be next Monday (Jan 22)
    expect(next.getDay()).toBe(1);
    expect(next.getDate()).toBe(22);
  });

  it('picks earliest available day this week when multiple days given', () => {
    // Wednesday Jan 17; distribution on Wed(3) and Fri(5) at 20:00
    // Wed at 18:00 → next slot is Wed at 20:00 (same day)
    const now = new Date('2024-01-17T18:00:00');
    const result = getNextAllowanceDate(now, weekly([3, 5], 20, 0));
    const next = new Date(result);
    expect(next.getDay()).toBe(3); // Wednesday
  });

  it('returns correct minute value', () => {
    const now = new Date('2024-01-15T08:00:00'); // Monday
    const result = getNextAllowanceDate(now, weekly([1], 9, 30));
    const next = new Date(result);
    expect(next.getMinutes()).toBe(30);
  });

  it('handles Sunday (day=0) correctly', () => {
    const now = new Date('2024-01-15T10:00:00'); // Monday
    const result = getNextAllowanceDate(now, weekly([0], 10, 0));
    const next = new Date(result);
    expect(next.getDay()).toBe(0); // Sunday
  });

  it('result is always in the future', () => {
    const days = [0, 1, 2, 3, 4, 5, 6];
    for (const day of days) {
      const now = new Date('2024-01-15T12:00:00');
      const result = getNextAllowanceDate(now, weekly([day], 12, 0));
      expect(new Date(result) > now).toBe(true);
    }
  });
});

// ─── Monthly mode ─────────────────────────────────────────────────────────────
describe('getNextAllowanceDate — monthly', () => {
  const monthly = (days: number[], hour = 0, minute = 0): AllowanceSettings => ({
    period: 'monthly',
    days,
    hour,
    minute,
  });

  it('returns a future date', () => {
    const now = new Date('2024-01-15T10:00:00');
    const result = getNextAllowanceDate(now, monthly([20]));
    expect(new Date(result) > now).toBe(true);
  });

  it('schedules for the same day this month if time has not passed', () => {
    // Jan 15 at 09:00, distribution on 15th at 12:00 → same day
    const now = new Date('2024-01-15T09:00:00');
    const result = getNextAllowanceDate(now, monthly([15], 12, 0));
    const next = new Date(result);
    expect(next.getMonth()).toBe(0); // January
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(12);
  });

  it('rolls to next month when day+time has passed', () => {
    // Jan 15 at 14:00, distribution was at 12:00 on 15th → Feb 15
    const now = new Date('2024-01-15T14:00:00');
    const result = getNextAllowanceDate(now, monthly([15], 12, 0));
    const next = new Date(result);
    expect(next.getMonth()).toBe(1); // February
    expect(next.getDate()).toBe(15);
  });

  it('rolls to next month when day has passed this month', () => {
    // Jan 20 at 10:00, distribution on 10th → Feb 10
    const now = new Date('2024-01-20T10:00:00');
    const result = getNextAllowanceDate(now, monthly([10]));
    const next = new Date(result);
    expect(next.getMonth()).toBe(1); // February
    expect(next.getDate()).toBe(10);
  });

  it('picks earliest upcoming day when multiple days given', () => {
    // Jan 5 at 10:00, distribution on 10th and 20th → Jan 10
    const now = new Date('2024-01-05T10:00:00');
    const result = getNextAllowanceDate(now, monthly([10, 20]));
    const next = new Date(result);
    expect(next.getDate()).toBe(10);
    expect(next.getMonth()).toBe(0);
  });

  it('handles end-of-year rollover (Dec → Jan)', () => {
    // Dec 25, distribution on 20th → Jan 20 next year
    const now = new Date('2024-12-25T10:00:00');
    const result = getNextAllowanceDate(now, monthly([20]));
    const next = new Date(result);
    expect(next.getFullYear()).toBe(2025);
    expect(next.getMonth()).toBe(0); // January
    expect(next.getDate()).toBe(20);
  });

  it('result ISO string is parseable', () => {
    const now = new Date('2024-01-15T10:00:00');
    const result = getNextAllowanceDate(now, monthly([20]));
    expect(() => new Date(result)).not.toThrow();
    expect(isNaN(new Date(result).getTime())).toBe(false);
  });
});
