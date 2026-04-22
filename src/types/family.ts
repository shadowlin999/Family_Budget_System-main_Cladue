import type { Timestamp } from 'firebase/firestore';
import type { User, AllowanceSettings } from './user';
import type { Envelope, ExpenseCategory } from './envelope';
import type { RoutineQuest } from './quest';
import type { Badge, TreasureBox, TreasureClaim } from './gamification';

export type AllowancePeriod = 'weekly' | 'monthly';

export interface FamilyDoc {
  name: string;
  adminInviteCode: string;
  kidInviteCode: string;
  users: User[];
  envelopes: Envelope[];
  routineQuests: RoutineQuest[];
  nextAllowanceDate: string | null;
  allowanceSettings?: AllowanceSettings;
  lastRoutineGenerateDate: string | null;
  expenseCategories?: ExpenseCategory[];
  badges?: Badge[];
  treasureBoxes?: TreasureBox[];
  treasureClaims?: TreasureClaim[];
  gamificationSettings?: {
    levelFormula?: string;
  };
  interestSettings?: {
    rate: number; // e.g. 0.05
    period: 'monthly' | 'yearly';
    lastInterestCheck: string | null;
  };
  themeSettings?: {
    backgroundUrl: string;
    primaryColor?: string;
  };
  timezoneOffset?: number; // UTC offset in minutes, e.g. 480 = UTC+8
  currencySymbol?: string; // e.g. 'NT$', '$', '¥', '€', 'HK$', 'CN¥'
  kidTheme?: string;       // 'pilot' | 'dark' | future themes
  createdAt?: Timestamp;
}
