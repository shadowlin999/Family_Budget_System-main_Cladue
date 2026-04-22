import { describe, it, expect } from 'vitest';
import {
  buildBackupPayload,
  parseBackupPayload,
  buildBackupFilename,
  BackupParseError,
  BACKUP_SCHEMA_VERSION,
} from './backup';
import type { User } from '../types/user';
import type { Envelope } from '../types/envelope';

const baseInput = {
  familyId: 'fam1',
  familyName: '我家',
  users: [{ id: 'u1', name: 'Kid', role: 'kid', level: 1, exp: 0 } as User],
  envelopes: [{ id: 'e1', ownerId: 'u1', name: 'Wallet', type: 'spendable', balance: 100, isHidden: false } as Envelope],
  expenseCategories: [],
  badges: [],
  treasureBoxes: [],
  routineQuests: [],
  nextAllowanceDate: null,
  lastRoutineGenerateDate: null,
  interestSettings: null,
  themeSettings: null,
  timezoneOffset: 480,
  currencySymbol: 'NT$',
  quests: [],
  transactions: [],
};

describe('buildBackupPayload', () => {
  it('emits current schema version and timestamp', () => {
    const now = new Date('2025-03-15T10:00:00Z');
    const p = buildBackupPayload({ ...baseInput, now });
    expect(p.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(p.exportedAt).toBe(now.toISOString());
  });

  it('preserves #2 SpendingLicense and #3 goal fields', () => {
    const userWithLic: User = {
      ...baseInput.users[0],
      spendingLicense: { max: 300, current: 150, lastRefillAt: '2025-01-01T00:00:00Z' },
    };
    const envWithGoal: Envelope = {
      ...baseInput.envelopes[0],
      goalAmount: 500,
      goalNote: 'Lego',
      goalCreatedAt: '2025-01-01T00:00:00Z',
    };
    const p = buildBackupPayload({
      ...baseInput,
      users: [userWithLic],
      envelopes: [envWithGoal],
    });
    expect(p.users[0].spendingLicense?.max).toBe(300);
    expect(p.envelopes[0].goalAmount).toBe(500);
  });
});

describe('parseBackupPayload', () => {
  it('round-trips a freshly-built payload', () => {
    const p = buildBackupPayload(baseInput);
    const parsed = parseBackupPayload(JSON.stringify(p));
    expect(parsed.familyName).toBe('我家');
    expect(parsed.users[0].id).toBe('u1');
    expect(parsed.envelopes[0].balance).toBe(100);
  });

  it('reads legacy v1.0 files (with `version` field) and normalizes schema', () => {
    const legacy = {
      version: '1.0',
      timestamp: '2024-06-01T00:00:00Z',
      familyId: 'fam1',
      familyName: 'Old',
      users: [{ id: 'u1', name: 'K', role: 'kid', level: 1, exp: 0 }],
      envelopes: [{ id: 'e1', ownerId: 'u1', name: 'W', type: 'spendable', balance: 0, isHidden: false }],
    };
    const parsed = parseBackupPayload(JSON.stringify(legacy));
    expect(parsed.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(parsed.exportedAt).toBe('2024-06-01T00:00:00Z');
    expect(parsed.expenseCategories).toEqual([]); // defaulted
    expect(parsed.timezoneOffset).toBe(480);
    expect(parsed.currencySymbol).toBe('NT$');
  });

  it('rejects invalid JSON', () => {
    expect(() => parseBackupPayload('not json')).toThrowError(BackupParseError);
    try { parseBackupPayload('not json'); } catch (e) {
      expect((e as BackupParseError).code).toBe('INVALID_JSON');
    }
  });

  it('rejects missing required fields', () => {
    const bad = JSON.stringify({ schemaVersion: '2.0' });
    expect(() => parseBackupPayload(bad)).toThrowError(BackupParseError);
    try { parseBackupPayload(bad); } catch (e) {
      expect((e as BackupParseError).code).toBe('MISSING_REQUIRED_FIELDS');
    }
  });

  it('rejects schema versions newer than what we support', () => {
    const future = JSON.stringify({
      schemaVersion: '9.9',
      users: baseInput.users,
      envelopes: baseInput.envelopes,
    });
    try {
      parseBackupPayload(future);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as BackupParseError).code).toBe('UNSUPPORTED_SCHEMA');
    }
  });

  it('accepts equal schema version', () => {
    const p = JSON.stringify({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      users: baseInput.users,
      envelopes: baseInput.envelopes,
    });
    expect(() => parseBackupPayload(p)).not.toThrow();
  });
});

describe('buildBackupFilename', () => {
  it('sanitizes family name and uses ISO date', () => {
    const fn = buildBackupFilename('王 / 家', new Date('2025-05-20T00:00:00Z'));
    expect(fn).toMatch(/^family_budget_backup_王_家_2025-05-20\.json$/); // spaces and slashes → _
  });

  it('falls back to "family" when name is null', () => {
    const fn = buildBackupFilename(null, new Date('2025-05-20T00:00:00Z'));
    expect(fn).toBe('family_budget_backup_family_2025-05-20.json');
  });
});
