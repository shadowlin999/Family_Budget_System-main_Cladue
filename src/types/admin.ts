export type SystemAdminRole = 'super' | 'senior';

export interface SystemAdmin {
  uid: string;
  email: string;
  displayName?: string;
  role: SystemAdminRole;
  /** undefined = unlimited (super admin); number = max codes senior admin can generate */
  inviteQuota?: number;
  inviteUsed: number;
  createdAt: string;
  createdBy: string; // uid or 'system'
}

export interface InviteCode {
  code: string; // also the Firestore doc ID
  createdBy: string; // uid
  createdByEmail: string;
  createdAt: string;
  isUsed: boolean;
  usedBy?: string;       // uid
  usedByEmail?: string;
  usedAt?: string;
  creatorRole: SystemAdminRole;
}

/** Lightweight family summary shown in super admin panel */
export interface FamilySummary {
  familyId: string;
  familyName: string;
  members: { name: string; role: string; googleEmail?: string }[];
  createdAt?: string;
}
