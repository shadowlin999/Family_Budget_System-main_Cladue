export type QuestStatus = 'open' | 'pending_approval' | 'completed' | 'rejected' | 'delayed';

export interface QuestFeedback {
  grade: 'great' | 'good' | 'tryAgain' | 'rejected' | 'delayed';
  emoji: string;
  comment: string;
  actualExp: number;
  actualMoney: number;
  actualGems: number;
  timestamp: string;
}

export interface Quest {
  id: string;
  ownerId: string;
  title: string;
  expReward: number;
  moneyReward: number;
  gemReward: number;
  status: QuestStatus;
  familyId?: string;
  icon?: string;
  dueDate?: string;       // YYYY-MM-DD
  feedback?: QuestFeedback;
  createdAt?: string;     // ISO timestamp
  boxRewardId?: string;   // grant a box instance on completion
}

export interface RoutineQuest {
  id: string;
  ownerId: string;
  title: string;
  expReward: number;
  moneyReward: number;
  gemReward: number;
  daysOfWeek: number[];
  icon?: string;
  dueDays?: number; // days after creation until due (0 = same day)
  boxRewardId?: string; // grant a box instance on completion
}
