export type BadgeConditionType =
  | 'quests_count'
  | 'level'
  | 'consecutive_record_days'
  | 'total_gems'
  | 'savings_amount'
  | 'consecutive_all_quests_weeks'
  | 'consecutive_all_quests_days';

export interface BadgeCondition {
  type: BadgeConditionType;
  value: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  conditions: BadgeCondition[];
  expReward?: number;
  gemReward?: number;
  boxRewardId?: string; // grant a box instance when unlocked
}

export interface TreasureBoxItem {
  id: string;
  name: string;
  probability: number; // 1-100
  isPhysical?: boolean;
  expReward?: number;
  gemReward?: number;
}

export interface TreasureBox {
  id: string;
  name: string;
  costGems: number;
  purchasable?: boolean; // if true, kids can buy with gems (default true for legacy data)
  items: TreasureBoxItem[];
}

export interface TreasureClaim {
  id: string;
  userId: string;
  boxId: string;
  boxName: string;
  itemId: string;
  itemName: string;
  status: 'pending' | 'approved';
  timestamp: string;
}
