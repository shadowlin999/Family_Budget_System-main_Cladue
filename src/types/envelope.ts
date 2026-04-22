export type EnvelopeType = 'spendable' | 'investing';

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
}

export interface Envelope {
  id: string;
  ownerId: string;
  name: string;
  type: EnvelopeType;
  balance: number;
  isHidden: boolean;
  icon?: string; // custom emoji
  // Wish-goal fields (optional, additive migration)
  goalAmount?: number;         // target amount in currency units
  goalDeadline?: string;       // ISO date; optional soft deadline
  goalCreatedAt?: string;      // ISO timestamp when goal was set
  goalNote?: string;           // what the kid is saving for
}

export interface Transaction {
  id: string;
  envelopeId: string;
  amount: number;
  timestamp: string;
  note: string;
  categoryId?: string;
  familyId?: string;
  status: 'pending' | 'approved' | 'rejected';
}
