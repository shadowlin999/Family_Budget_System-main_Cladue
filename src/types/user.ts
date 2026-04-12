import type { AllowancePeriod } from './family';

export type Role = 'primary_admin' | 'co_admin' | 'kid';

export interface AllowanceSettings {
  period: AllowancePeriod;
  days: number[]; // 0-6 for weekly, 1-31 for monthly
  hour?: number;  // 0-23
  minute?: number; // 0-59
}

export interface OwnedBoxInstance {
  instanceId: string; // unique per obtained box
  boxId: string;
  boxName: string;
  obtainedAt: string; // ISO timestamp
}

export interface User {
  id: string;
  name: string;
  role: Role;
  level: number;
  exp: number;
  isHidden?: boolean;
  allowanceAmount?: number;
  allowanceRatio?: number; // 0-100, percentage for spendable, remaining goes to investing
  googleUid?: string; // linked Google account UID (for admins)
  googleEmail?: string; // linked Google account email
  pin?: string; // 4-digit PIN for profile locks
  allowanceSettings?: AllowanceSettings;
  nextAllowanceDate?: string;

  // Gamification tracking
  gems?: number;
  unlockedBadges?: string[];
  inventory?: { name: string, quantity: number }[];
  ownedBoxes?: OwnedBoxInstance[]; // boxes obtained via quest/badge rewards or purchase
  stats?: {
    questsCount: number;
    totalGemsEarned: number;
    consecutiveRecordDays: number;
    lastRecordDate: string | null;
    consecutiveAllQuestsDays: number;
    lastAllQuestsDay: string | null;
    consecutiveAllQuestsWeeks: number;
    lastAllQuestsWeek: string | null;
  };
}
