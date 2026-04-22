/**
 * Backup domain — pure build/parse for JSON snapshots of a family.
 * No Firebase / DOM deps; callers handle IO (downloads, Firestore writes).
 *
 * Schema version history:
 *  - 1.0: initial (users, envelopes, categories, badges, treasureBoxes,
 *         routineQuests, schedule fields, interest/theme, quests, transactions)
 *  - 2.0: adds #2 SpendingLicense (User.spendingLicense) and
 *         #3 wish-goal fields (Envelope.goalAmount/Deadline/CreatedAt/Note).
 *         These are additive — v1.0 files stay readable, just lack those fields.
 */

import type { User } from '../types/user';
import type { Envelope, Transaction, ExpenseCategory } from '../types/envelope';
import type { Quest, RoutineQuest } from '../types/quest';
import type { Badge, TreasureBox } from '../types/gamification';
import type { FamilyDoc } from '../types/family';

export const BACKUP_SCHEMA_VERSION = '2.0';
export const BACKUP_SCHEMA_MIN_READABLE = '1.0';

export interface BackupPayload {
  schemaVersion: string;
  exportedAt: string;
  familyId: string | null;
  familyName: string | null;

  // Family-doc fields
  users: User[];
  envelopes: Envelope[];
  expenseCategories: ExpenseCategory[];
  badges: Badge[];
  treasureBoxes: TreasureBox[];
  routineQuests: RoutineQuest[];
  nextAllowanceDate: string | null;
  lastRoutineGenerateDate: string | null;
  interestSettings: FamilyDoc['interestSettings'] | null;
  themeSettings: FamilyDoc['themeSettings'] | null;
  timezoneOffset: number;
  currencySymbol: string;
  gamificationSettings?: FamilyDoc['gamificationSettings'];

  // Sub-collections
  quests: Quest[];
  transactions: Transaction[];
}

export interface BuildBackupInput {
  familyId: string | null;
  familyName: string | null;
  users: User[];
  envelopes: Envelope[];
  expenseCategories: ExpenseCategory[];
  badges: Badge[];
  treasureBoxes: TreasureBox[];
  routineQuests: RoutineQuest[];
  nextAllowanceDate: string | null;
  lastRoutineGenerateDate: string | null;
  interestSettings: FamilyDoc['interestSettings'] | null;
  themeSettings: FamilyDoc['themeSettings'] | null;
  timezoneOffset: number;
  currencySymbol: string;
  gamificationSettings?: FamilyDoc['gamificationSettings'];
  quests: Quest[];
  transactions: Transaction[];
  now?: Date;
}

export function buildBackupPayload(input: BuildBackupInput): BackupPayload {
  const now = input.now ?? new Date();
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    familyId: input.familyId,
    familyName: input.familyName,
    users: input.users,
    envelopes: input.envelopes,
    expenseCategories: input.expenseCategories,
    badges: input.badges,
    treasureBoxes: input.treasureBoxes,
    routineQuests: input.routineQuests,
    nextAllowanceDate: input.nextAllowanceDate,
    lastRoutineGenerateDate: input.lastRoutineGenerateDate,
    interestSettings: input.interestSettings,
    themeSettings: input.themeSettings,
    timezoneOffset: input.timezoneOffset,
    currencySymbol: input.currencySymbol,
    gamificationSettings: input.gamificationSettings,
    quests: input.quests,
    transactions: input.transactions,
  };
}

/** Format a sensible default filename for the downloaded backup. */
export function buildBackupFilename(familyName: string | null, now: Date = new Date()): string {
  const safeName = (familyName ?? 'family')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const date = now.toISOString().split('T')[0];
  return `family_budget_backup_${safeName}_${date}.json`;
}

export type ParseErrorCode =
  | 'INVALID_JSON'
  | 'MISSING_REQUIRED_FIELDS'
  | 'UNSUPPORTED_SCHEMA';

export class BackupParseError extends Error {
  code: ParseErrorCode;
  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'BackupParseError';
  }
}

/** Compare dotted-version strings; returns -1/0/1. */
function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

/**
 * Parse + validate a backup string. Performs lenient forward-migration:
 * v1.0 files simply lack new optional fields (SpendingLicense/goal*), which is fine.
 * Files newer than BACKUP_SCHEMA_VERSION are rejected to avoid silent data loss
 * from unknown fields being stripped.
 */
export function parseBackupPayload(raw: string): BackupPayload {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new BackupParseError('INVALID_JSON', '檔案不是有效的 JSON');
  }

  if (!obj || typeof obj !== 'object') {
    throw new BackupParseError('INVALID_JSON', '檔案內容為空');
  }
  const o = obj as Record<string, unknown>;

  // Accept legacy `version` field and modern `schemaVersion`
  const versionRaw = (o.schemaVersion ?? o.version ?? '1.0') as string;
  const version = typeof versionRaw === 'string' ? versionRaw : '1.0';
  if (cmpVersion(version, BACKUP_SCHEMA_VERSION) > 0) {
    throw new BackupParseError(
      'UNSUPPORTED_SCHEMA',
      `備份檔案版本 ${version} 較新，目前系統支援至 ${BACKUP_SCHEMA_VERSION}，請升級後再匯入`
    );
  }

  if (!Array.isArray(o.users) || !Array.isArray(o.envelopes)) {
    throw new BackupParseError('MISSING_REQUIRED_FIELDS', '備份缺少必要欄位（users / envelopes）');
  }

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION, // normalize on read
    exportedAt: (o.exportedAt as string) ?? (o.timestamp as string) ?? new Date().toISOString(),
    familyId: (o.familyId as string | null) ?? null,
    familyName: (o.familyName as string | null) ?? null,
    users: o.users as User[],
    envelopes: o.envelopes as Envelope[],
    expenseCategories: (o.expenseCategories as ExpenseCategory[] | undefined) ?? [],
    badges: (o.badges as Badge[] | undefined) ?? [],
    treasureBoxes: (o.treasureBoxes as TreasureBox[] | undefined) ?? [],
    routineQuests: (o.routineQuests as RoutineQuest[] | undefined) ?? [],
    nextAllowanceDate: (o.nextAllowanceDate as string | null | undefined) ?? null,
    lastRoutineGenerateDate: (o.lastRoutineGenerateDate as string | null | undefined) ?? null,
    interestSettings: (o.interestSettings as FamilyDoc['interestSettings'] | null | undefined) ?? null,
    themeSettings: (o.themeSettings as FamilyDoc['themeSettings'] | null | undefined) ?? null,
    timezoneOffset: (o.timezoneOffset as number | undefined) ?? 480,
    currencySymbol: (o.currencySymbol as string | undefined) ?? 'NT$',
    gamificationSettings: o.gamificationSettings as FamilyDoc['gamificationSettings'] | undefined,
    quests: (o.quests as Quest[] | undefined) ?? [],
    transactions: (o.transactions as Transaction[] | undefined) ?? [],
  };
}
