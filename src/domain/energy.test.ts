import { describe, it, expect } from 'vitest';
import { calcCurrentEnergy, daysToFull, spendEnergy, buildLicenseSnapshot, REFILL_WINDOW_DAYS } from './energy';
import type { SpendingLicense } from '../types/user';

const iso = (d: Date) => d.toISOString();
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

describe('calcCurrentEnergy', () => {
  it('returns 0 when max is 0 (disabled)', () => {
    const lic: SpendingLicense = { max: 0, current: 0, lastRefillAt: iso(new Date()) };
    expect(calcCurrentEnergy(lic)).toBe(0);
  });

  it('returns current when no time has passed', () => {
    const now = new Date();
    const lic: SpendingLicense = { max: 300, current: 100, lastRefillAt: iso(now) };
    expect(calcCurrentEnergy(lic, now)).toBe(100);
  });

  it('refills linearly over 30 days', () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const lic: SpendingLicense = { max: 300, current: 0, lastRefillAt: iso(now) };
    // +1 day → +10
    expect(calcCurrentEnergy(lic, addDays(now, 1))).toBeCloseTo(10, 5);
    // +15 days → +150
    expect(calcCurrentEnergy(lic, addDays(now, 15))).toBeCloseTo(150, 5);
  });

  it('clamps at max', () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const lic: SpendingLicense = { max: 300, current: 0, lastRefillAt: iso(now) };
    expect(calcCurrentEnergy(lic, addDays(now, 100))).toBe(300);
  });

  it('never goes below 0', () => {
    const lic: SpendingLicense = { max: 300, current: -50, lastRefillAt: iso(new Date()) };
    expect(calcCurrentEnergy(lic)).toBe(0);
  });
});

describe('daysToFull', () => {
  it('returns 0 when already full', () => {
    const now = new Date();
    const lic: SpendingLicense = { max: 300, current: 300, lastRefillAt: iso(now) };
    expect(daysToFull(lic, now)).toBe(0);
  });

  it('computes remaining days correctly', () => {
    const now = new Date();
    const lic: SpendingLicense = { max: 300, current: 0, lastRefillAt: iso(now) };
    expect(daysToFull(lic, now)).toBe(REFILL_WINDOW_DAYS);
  });

  it('rounds up partial days', () => {
    const now = new Date();
    // 290 out of 300 → need 1 more day (10 energy/day)
    const lic: SpendingLicense = { max: 300, current: 290, lastRefillAt: iso(now) };
    expect(daysToFull(lic, now)).toBe(1);
  });
});

describe('spendEnergy', () => {
  it('approves in-budget spend and deducts', () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const lic: SpendingLicense = { max: 300, current: 200, lastRefillAt: iso(now) };
    const r = spendEnergy(lic, 50, now);
    expect(r.ok).toBe(true);
    expect(r.energyBefore).toBe(200);
    expect(r.energyAfter).toBe(150);
    expect(r.nextLicense.current).toBe(150);
    expect(r.nextLicense.lastRefillAt).toBe(iso(now));
    expect(r.shortfall).toBe(0);
  });

  it('rejects over-budget spend and returns shortfall', () => {
    const now = new Date();
    const lic: SpendingLicense = { max: 300, current: 50, lastRefillAt: iso(now) };
    const r = spendEnergy(lic, 100, now);
    expect(r.ok).toBe(false);
    expect(r.shortfall).toBe(50);
    expect(r.nextLicense).toBe(lic); // unchanged
  });

  it('uses refilled energy when computing fit', () => {
    const past = new Date('2025-01-01T00:00:00Z');
    const now = addDays(past, 10); // +100 energy
    const lic: SpendingLicense = { max: 300, current: 0, lastRefillAt: iso(past) };
    // energy at `now` is 100; spend 80 → fits
    const r = spendEnergy(lic, 80, now);
    expect(r.ok).toBe(true);
    expect(r.energyBefore).toBeCloseTo(100, 5);
    expect(r.nextLicense.current).toBeCloseTo(20, 5);
    expect(r.nextLicense.lastRefillAt).toBe(iso(now));
  });

  it('handles negative amounts as 0 (safety)', () => {
    const now = new Date();
    const lic: SpendingLicense = { max: 300, current: 100, lastRefillAt: iso(now) };
    const r = spendEnergy(lic, -50, now);
    expect(r.ok).toBe(true);
    expect(r.nextLicense.current).toBe(100);
  });
});

describe('buildLicenseSnapshot', () => {
  it('starts at full when onboarding (no prev)', () => {
    const now = new Date();
    const snap = buildLicenseSnapshot(300, undefined, now);
    expect(snap.max).toBe(300);
    expect(snap.current).toBe(300);
    expect(snap.lastRefillAt).toBe(iso(now));
  });

  it('disables when newMax is 0', () => {
    const prev: SpendingLicense = { max: 300, current: 200, lastRefillAt: iso(new Date()) };
    const snap = buildLicenseSnapshot(0, prev);
    expect(snap.max).toBe(0);
    expect(snap.current).toBe(0);
  });

  it('preserves energy ratio when cap changes', () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const prev: SpendingLicense = { max: 300, current: 150, lastRefillAt: iso(now) }; // 50%
    const snap = buildLicenseSnapshot(600, prev, now);
    expect(snap.max).toBe(600);
    expect(snap.current).toBeCloseTo(300, 5); // 50% of new cap
  });

  it('clamps when prev exceeded ratio 1 somehow', () => {
    const now = new Date();
    const prev: SpendingLicense = { max: 100, current: 999, lastRefillAt: iso(now) };
    const snap = buildLicenseSnapshot(200, prev, now);
    expect(snap.current).toBeLessThanOrEqual(200);
  });
});
