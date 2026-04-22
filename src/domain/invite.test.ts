import { describe, it, expect } from 'vitest';
import { generateInviteCode } from './invite';

describe('generateInviteCode', () => {
  it('returns a string of exactly 6 characters', () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it('contains only uppercase alphanumeric characters', () => {
    const code = generateInviteCode();
    expect(/^[A-Z0-9]{6}$/.test(code)).toBe(true);
  });

  it('produces uppercase output (no lowercase)', () => {
    const code = generateInviteCode();
    expect(code).toBe(code.toUpperCase());
  });

  it('generates different codes on successive calls (randomness check)', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()));
    // With 36^6 possible codes, 100 calls should produce >90 unique values
    expect(codes.size).toBeGreaterThan(90);
  });

  it('never returns empty string', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode().length).toBeGreaterThan(0);
    }
  });
});
