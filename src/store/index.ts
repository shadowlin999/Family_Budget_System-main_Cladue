import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, collection,
  onSnapshot, addDoc, writeBatch, getDocs,
  query, where, serverTimestamp, Timestamp, increment,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../services/firebase';

// ── Type imports ───────────────────────────────────────────────────────────────
import type { Role, AllowanceSettings, User, OwnedBoxInstance } from '../types/user';
import type { QuestFeedback, Quest, RoutineQuest } from '../types/quest';
import type { EnvelopeType, ExpenseCategory, Envelope, Transaction } from '../types/envelope';
import type {
  Badge,
  TreasureBoxItem, TreasureBox, TreasureClaim,
} from '../types/gamification';
import type { AllowancePeriod, FamilyDoc } from '../types/family';
import type { SystemAdmin, SystemAdminRole, InviteCode, FamilySummary } from '../types/admin';

// ── Domain function imports ────────────────────────────────────────────────────
import { getNextAllowanceDate } from '../domain/allowance';
import { applyUserRewards } from '../domain/level';
import { generateInviteCode } from '../domain/invite';

// ── Re-export types for backward compatibility with views ──────────────────────
export type { Role, AllowanceSettings, User, OwnedBoxInstance } from '../types/user';
export type { QuestStatus, QuestFeedback, Quest, RoutineQuest } from '../types/quest';
export type { EnvelopeType, ExpenseCategory, Envelope, Transaction } from '../types/envelope';
export type {
  BadgeConditionType, BadgeCondition, Badge,
  TreasureBoxItem, TreasureBox, TreasureClaim,
} from '../types/gamification';
export type { AllowancePeriod, FamilyDoc } from '../types/family';
export type { SystemAdmin, SystemAdminRole, InviteCode, FamilySummary } from '../types/admin';

// ── Re-export domain functions for backward compatibility with views ───────────
export { getNextAllowanceDate } from '../domain/allowance';
export {
  evaluateLevelFormula,
  calculateExpToNextLevel,
  calculateLevelProgress,
  applyUserRewards,
} from '../domain/level';

// ─────────────────────────────────────────────────────────
// App State
// ─────────────────────────────────────────────────────────
interface AppState {
  // Auth
  firebaseUser: FirebaseUser | null;
  familyId: string | null;
  familyName: string | null;
  adminInviteCode: string | null;
  kidInviteCode: string | null;
  isLoading: boolean;
  isNewFamily: boolean;  // true = show FamilySetup screen
  needsInviteCode: boolean;  // new Google user must enter invite code first
  systemAdminRole: SystemAdminRole | null;

  // App data (live-synced from Firestore)
  users: User[];
  envelopes: Envelope[];
  transactions: Transaction[];
  expenseCategories: ExpenseCategory[];
  badges: Badge[];
  treasureBoxes: TreasureBox[];
  quests: Quest[];
  routineQuests: RoutineQuest[];
  currentUser: User | null;       // selected family member
  nextAllowanceDate: string | null;
  allowanceSettings: AllowanceSettings | null;
  lastRoutineGenerateDate: string | null;
  interestSettings: FamilyDoc['interestSettings'] | null;
  themeSettings: FamilyDoc['themeSettings'] | null;
  gamificationSettings?: FamilyDoc['gamificationSettings'];
  treasureClaims?: TreasureClaim[];
  timezoneOffset: number;
  currencySymbol: string; // default 'NT$'

  // Internal
  _unsubscribers: Unsubscribe[];

  // ── Auth Actions ──────────────────────────────────────
  setFirebaseUser: (user: FirebaseUser | null) => void;
  createFamily: (familyName: string, adminName: string, role: Role) => Promise<void>;
  joinFamilyByCode: (inviteCode: string, memberName: string, role: Role) => Promise<void>;
  joinFamilyAsKid: (kidInviteCode: string) => Promise<void>; // (Deprecated - using 2-step)
  joinFamilyAsKidStep1: (kidInviteCode: string) => Promise<{ familyId: string, familyName: string, kids: User[] }>;
  joinFamilyAsKidStep2: (familyId: string, kidUserId: string) => Promise<void>;
  regenerateInviteCode: (type: 'admin' | 'kid') => Promise<void>;
  logout: () => Promise<void>;
  subscribeToFamily: (familyId: string) => void;
  unsubscribeAll: () => void;

  // ── Member Selection ──────────────────────────────────
  login: (userId: string) => void;   // select which family member to act as

  // ── Budget Actions (write to Firestore) ──────────────
  addExpenseCategory: (name: string, icon: string) => Promise<void>;
  updateExpenseCategory: (id: string, name: string, icon: string) => Promise<void>;
  deleteExpenseCategory: (id: string) => Promise<void>;
  addTransaction: (envelopeId: string, amount: number, note: string, categoryId?: string) => Promise<void>;
  approveTransaction: (transactionId: string) => Promise<void>;
  rejectTransaction: (transactionId: string) => Promise<void>;

  // Game Actions
  createQuest: (ownerId: string, title: string, expReward: number, moneyReward: number, gemReward: number, icon?: string, dueDate?: string, boxRewardId?: string) => Promise<void>;
  submitQuest: (questId: string) => Promise<void>;
  failQuest: (questId: string) => Promise<void>;
  approveQuest: (questId: string) => Promise<void>;
  approveQuestWithFeedback: (questId: string, grade: QuestFeedback['grade'], emoji: string, comment: string, expMult: number, moneyMult: number, gemMult: number) => Promise<void>;
  rejectQuest: (questId: string, comment: string, emoji: string) => Promise<void>;
  delayQuest: (questId: string, comment: string, emoji: string) => Promise<void>;
  addRoutineQuest: (ownerId: string | string[], title: string, expReward: number, moneyReward: number, gemReward: number, daysOfWeek: number[], icon?: string, dueDays?: number, boxRewardId?: string) => Promise<void>;
  updateRoutineQuest: (id: string, title: string, expReward: number, moneyReward: number, gemReward: number, daysOfWeek: number[], icon?: string, dueDays?: number, boxRewardId?: string) => Promise<void>;
  deleteRoutineQuest: (id: string) => Promise<void>;
  generateRoutineQuests: () => Promise<void>;
  forceGenerateRoutineQuests: () => Promise<void>;

  // ── Backup Actions ────────────────────────────────────
  exportFamilyData: () => { data: string, filename: string };
  importFamilyData: (jsonData: string) => Promise<void>;

  // Badge & Treasure Box actions
  addBadge: (badge: Omit<Badge, 'id'>) => Promise<void>;
  updateBadge: (id: string, badge: Omit<Badge, 'id'>) => Promise<void>;
  deleteBadge: (id: string) => Promise<void>;
  addTreasureBox: (box: Omit<TreasureBox, 'id'>) => Promise<void>;
  updateTreasureBox: (id: string, box: Omit<TreasureBox, 'id'>) => Promise<void>;
  deleteTreasureBox: (id: string) => Promise<void>;
  drawTreasureBox: (boxId: string) => Promise<{ wonItemName: string, isPhysical: boolean }>; // legacy - kept for safety
  purchaseTreasureBox: (boxId: string) => Promise<void>; // buy and put in ownedBoxes
  openOwnedBox: (instanceId: string) => Promise<{ wonItemName: string; isPhysical: boolean; expReward?: number; gemReward?: number }>;  // open a held box instance
  updateGamificationSettings: (settings: { levelFormula?: string }) => Promise<void>;
  approveTreasureClaim: (claimId: string) => Promise<void>;

  // Member actions
  addKid: (name: string) => Promise<void>;
  updateKid: (kidId: string, name: string) => Promise<void>;
  deleteKid: (kidId: string) => Promise<void>;
  toggleHideKid: (kidId: string) => Promise<void>;

  // Allowance and Envelope actions
  distributeAllowance: (targetKidId?: string) => Promise<void>;
  manualDistributeAllowance: (targetKidId: string | 'all', amount: number, ratio: number) => Promise<void>;
  updateNextAllowanceDate: (nextDate: string) => Promise<void>;
  updateAllowanceSettings: (period: AllowancePeriod, days: number[], hour?: number, minute?: number) => Promise<void>;
  updateKidAllowance: (kidId: string, amount: number, ratio: number, settings?: AllowanceSettings) => Promise<void>;
  updateFamilyName: (newName: string) => Promise<void>;
  addEnvelope: (ownerId: string, name: string, type: EnvelopeType, icon?: string) => Promise<void>;
  updateEnvelope: (envelopeId: string, name: string, icon?: string) => Promise<void>;
  deleteEnvelope: (envelopeId: string) => Promise<void>;
  toggleHideEnvelope: (envelopeId: string) => Promise<void>;

  // Interest & Theme
  updateInterestSettings: (rate: number, period: 'monthly' | 'yearly') => Promise<void>;
  calculateInterest: () => Promise<void>;
  updateThemeSettings: (backgroundUrl: string) => Promise<void>;
  updateTimezone: (offset: number) => Promise<void>;

  // Currency
  updateCurrencySymbol: (symbol: string) => Promise<void>;

  // Security
  setUserPin: (userId: string, newPin: string) => Promise<void>;

  // Transfer
  transferMoney: (fromEnvId: string, toEnvId: string, amount: number, note?: string) => Promise<void>;

  // ── System Admin Actions ──────────────────────────────
  verifyAndUseSystemInviteCode: (code: string) => Promise<boolean>;
  generateSystemInviteCode: () => Promise<string | null>;
  listAllFamilies: () => Promise<FamilySummary[]>;
  listAllInviteCodes: () => Promise<InviteCode[]>;
  listSystemAdmins: () => Promise<SystemAdmin[]>;
  setSystemAdmin: (uid: string, email: string, role: SystemAdminRole, quota?: number) => Promise<void>;
  removeSystemAdmin: (uid: string) => Promise<void>;
  updateAdminQuota: (uid: string, quota: number | undefined) => Promise<void>;
}

// ─────────────────────────────────────────────────────────
// Firestore helpers
// ─────────────────────────────────────────────────────────
const familyRef = (id: string) => doc(db, 'families', id);
const questsQuery = (fid: string) => query(collection(db, 'quests'), where('familyId', '==', fid));
const txQuery = (fid: string) => query(collection(db, 'transactions'), where('familyId', '==', fid));

function deepClean(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(v => deepClean(v));
  } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Timestamp)) {
    const newObj: Record<string, unknown> = {};
    for (const key in obj as Record<string, unknown>) {
      const val = (obj as Record<string, unknown>)[key];
      if (val !== undefined) {
        newObj[key] = deepClean(val);
      }
    }
    return newObj;
  }
  return obj;
}

async function updateFamilyField(familyId: string | null, data: Partial<FamilyDoc>) {
  if (!familyId) return;
  const cleanData = deepClean(data);
  await updateDoc(familyRef(familyId), cleanData as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────
// Zustand Store
// ─────────────────────────────────────────────────────────
export const useStore = create<AppState>()((set, get) => ({
  firebaseUser: null,
  familyId: null,
  familyName: null,
  adminInviteCode: null,
  kidInviteCode: null,
  isLoading: true,
  isNewFamily: false,
  needsInviteCode: false,
  systemAdminRole: null,
  users: [],
  envelopes: [],
  transactions: [],
  expenseCategories: [],
  badges: [],
  treasureBoxes: [],
  quests: [],
  routineQuests: [],
  currentUser: null,
  nextAllowanceDate: null,
  lastRoutineGenerateDate: null,
  interestSettings: null,
  themeSettings: null,
  gamificationSettings: undefined,
  treasureClaims: [],
  timezoneOffset: 480,
  currencySymbol: 'NT$',
  allowanceSettings: null,
  _unsubscribers: [],

  // ── setFirebaseUser ──────────────────────────────────────────
  setFirebaseUser: async (user) => {
    if (!user) {
      get().unsubscribeAll();
      set({ firebaseUser: null, familyId: null, familyName: null, adminInviteCode: null, kidInviteCode: null, isLoading: false, isNewFamily: false, needsInviteCode: false, systemAdminRole: null, users: [], envelopes: [], transactions: [], quests: [], routineQuests: [], currentUser: null });
      return;
    }
    set({ isLoading: true, firebaseUser: user });

    const SUPER_ADMIN_EMAIL = 'shadowbbs@gmail.com';
    try {
      // ── Resolve system admin role ─────────────────────────────
      let adminRole: SystemAdminRole | null = null;
      if (user.email === SUPER_ADMIN_EMAIL) {
        adminRole = 'super';
        // Auto-provision super admin document
        await setDoc(doc(db, 'systemAdmins', user.uid), {
          uid: user.uid, email: user.email, role: 'super',
          inviteUsed: 0, createdAt: new Date().toISOString(), createdBy: 'system',
        }, { merge: true });
      } else {
        const adminSnap = await getDoc(doc(db, 'systemAdmins', user.uid));
        if (adminSnap.exists()) adminRole = (adminSnap.data() as SystemAdmin).role;
      }

      // ── Find if this Google UID already belongs to a family ───
      const snap = await getDoc(doc(db, 'userFamilyMap', user.uid));
      if (snap.exists()) {
        set({ systemAdminRole: adminRole });
        const { familyId } = snap.data() as { familyId: string };
        get().subscribeToFamily(familyId);
      } else if (adminRole !== null) {
        // Admins may proceed directly to FamilySetup without invite code
        set({ isLoading: false, isNewFamily: true, systemAdminRole: adminRole });
      } else {
        // Regular new user: must enter invite code
        set({ isLoading: false, needsInviteCode: true, systemAdminRole: null });
      }
    } catch (err) {
      console.error('[Firebase] setFirebaseUser 失敗:', err);
      set({ isLoading: false, needsInviteCode: true });
    }
  },

  // ── createFamily ────────────────────────────────────────────
  createFamily: async (familyName, adminName, role) => {
    const { firebaseUser } = get();
    if (!firebaseUser) return;
    set({ isLoading: true });

    try {
      const familyId = uuidv4();
      const adminUser: User = { id: uuidv4(), name: adminName, role, level: 99, exp: 9999, googleUid: firebaseUser.uid, pin: '0000' };
      const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + 7);

      const familyData: FamilyDoc = {
        name: familyName,
        adminInviteCode: generateInviteCode(),
        kidInviteCode: generateInviteCode(),
        users: [adminUser],
        envelopes: [],
        routineQuests: [],
        expenseCategories: [
          { id: uuidv4(), name: '食物', icon: '🍔' },
          { id: uuidv4(), name: '娛樂', icon: '🎮' },
          { id: uuidv4(), name: '生活用品', icon: '🛒' },
          { id: uuidv4(), name: '投資', icon: '📈' },
        ],
        nextAllowanceDate: nextDate.toISOString().split('T')[0],
        lastRoutineGenerateDate: null,
      };

      // Write userFamilyMap FIRST so Security Rules can find membership when family is written
      await setDoc(doc(db, 'userFamilyMap', firebaseUser.uid), { familyId });
      await setDoc(familyRef(familyId), { ...familyData, createdAt: serverTimestamp() });

      set({ isNewFamily: false, familyId }); // Update state immediately to move UI forward
      get().subscribeToFamily(familyId);
    } catch (err) {
      console.error('[Firebase] createFamily 失敗:', err);
      set({ isLoading: false });
      throw err;
    }
  },

  // ── joinFamilyByCode (for co_admin / primary_admin with Google) ────────────
  joinFamilyByCode: async (inviteCode, memberName, role) => {
    const { firebaseUser } = get();
    if (!firebaseUser) return;
    set({ isLoading: true });

    try {
      const { getDocs } = await import('firebase/firestore');
      // Search by adminInviteCode
      const q = query(collection(db, 'families'), where('adminInviteCode', '==', inviteCode.toUpperCase()));
      const results = await getDocs(q);

      if (results.empty) {
        set({ isLoading: false });
        throw new Error('找不到此邀請碼，請確認後再試（共同管理者請使用管理碼）。');
      }

      const familySnap = results.docs[0];
      const familyId = familySnap.id;
      const familyData = familySnap.data() as FamilyDoc;

      const newMember: User = { id: uuidv4(), name: memberName, role, level: 99, exp: 9999, googleUid: firebaseUser.uid, pin: '0000' };
      await setDoc(doc(db, 'userFamilyMap', firebaseUser.uid), { familyId });
      await updateDoc(familyRef(familyId), { users: [...familyData.users, newMember] });

      set({ isNewFamily: false, familyId });
      get().subscribeToFamily(familyId);
    } catch (err) {
      console.error('[Firebase] joinFamilyByCode 失敗:', err);
      set({ isLoading: false });
      throw err;
    }
  },

  // ── joinFamilyAsKid (Step 1: Search) ───────────────────────────────────
  joinFamilyAsKidStep1: async (kidCode) => {
    const { getDocs } = await import('firebase/firestore');
    const q = query(collection(db, 'families'), where('kidInviteCode', '==', kidCode.toUpperCase()));
    const results = await getDocs(q);

    if (results.empty) throw new Error('找不到此小孩邀請碼');

    const familySnap = results.docs[0];
    const data = familySnap.data() as FamilyDoc;
    const kids = (data.users || []).filter(u => u.role === 'kid');
    return { familyId: familySnap.id, familyName: data.name, kids };
  },

  // ── joinFamilyAsKid (Step 2: Bind & Enter) ─────────────────────────────
  joinFamilyAsKidStep2: async (familyId, kidUserId) => {
    const { firebaseUser, subscribeToFamily } = get();
    if (!firebaseUser) throw new Error('請先登入 Google');

    // 1. Write map junction
    await setDoc(doc(db, 'userFamilyMap', firebaseUser.uid), { familyId });

    // 2. Fetch current family data to modify user list
    const snap = await getDoc(familyRef(familyId));
    if (snap.exists()) {
      const data = snap.data() as FamilyDoc;
      const updatedUsers = (data.users || []).map(u =>
        u.id === kidUserId ? { ...u, googleUid: firebaseUser.uid } : u
      );
      await updateDoc(familyRef(familyId), { users: updatedUsers });
    }

    // 3. Launch UI
    set({ isNewFamily: false, familyId });
    subscribeToFamily(familyId);
  },

  // ── (Old Single Step joinFamilyAsKid - keeping for compat) ──────────
  joinFamilyAsKid: async (kidCode) => {
    const { firebaseUser } = get();
    if (!firebaseUser) throw new Error('請先登入 Google 帳號');
    set({ isLoading: true });
    try {
      const { getDocs } = await import('firebase/firestore');
      const q = query(collection(db, 'families'), where('kidInviteCode', '==', kidCode.toUpperCase()));
      const results = await getDocs(q);

      if (results.empty) {
        set({ isLoading: false });
        throw new Error('找不到此小孩邀請碼');
      }

      const familySnap = results.docs[0];
      const familyId = familySnap.id;
      await setDoc(doc(db, 'userFamilyMap', firebaseUser.uid), { familyId });
      set({ isNewFamily: false, familyId });
      get().subscribeToFamily(familyId);
    } catch (err) {
      console.error('[Firebase] joinFamilyAsKid 失敗:', err);
      set({ isLoading: false });
      throw err;
    }
  },

  // ── regenerateInviteCode ──────────────────────────────────────
  regenerateInviteCode: async (type) => {
    const { familyId } = get();
    if (!familyId) return;
    const newCode = generateInviteCode();
    const field = type === 'admin' ? 'adminInviteCode' : 'kidInviteCode';
    await updateFamilyField(familyId, { [field]: newCode });
    // onSnapshot will update state automatically
  },

  // ── subscribeToFamily ─────────────────────────────────────────
  subscribeToFamily: (familyId) => {
    get().unsubscribeAll();
    const unsubs: Unsubscribe[] = [];

    // 1) Family doc
    unsubs.push(onSnapshot(
      familyRef(familyId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as FamilyDoc;
        const users = data.users ?? [];
        // Auto-match currentUser if Google UID is linked to a family member
        // Keep currentUser in sync with the latest users array (gems/exp/level may change)
        const prevCurrentUser = get().currentUser;
        const freshCurrentUser = prevCurrentUser
          ? users.find(u => u.id === prevCurrentUser.id) ?? prevCurrentUser
          : null;

        set({
          familyId,
          familyName: data.name,
          adminInviteCode: data.adminInviteCode ?? null,
          kidInviteCode: data.kidInviteCode ?? null,
          users,
          envelopes: data.envelopes ?? [],
          expenseCategories: data.expenseCategories ?? [],
          badges: data.badges ?? [],
          treasureBoxes: data.treasureBoxes ?? [],
          treasureClaims: data.treasureClaims ?? [],
          gamificationSettings: data.gamificationSettings ?? undefined,
          routineQuests: data.routineQuests ?? [],
          nextAllowanceDate: data.nextAllowanceDate ?? null,
          allowanceSettings: data.allowanceSettings ?? null,
          lastRoutineGenerateDate: data.lastRoutineGenerateDate ?? null,
          interestSettings: data.interestSettings ?? null,
          themeSettings: data.themeSettings ?? null,
          timezoneOffset: data.timezoneOffset ?? 480,
          currencySymbol: data.currencySymbol ?? 'NT$',
          isLoading: false,
          isNewFamily: false,
          currentUser: freshCurrentUser,
        });

        // Auto-check interest
        get().calculateInterest();
      },
      (err) => {
        console.error('[Firebase] families onSnapshot error:', err);
        set({ isLoading: false });
      }
    ));

    // 2) Quests sub-collection
    unsubs.push(onSnapshot(questsQuery(familyId), (snap) => {
      const quests = snap.docs.map(d => ({ id: d.id, ...d.data() } as Quest));
      set({ quests });
    }));

    // 3) Transactions sub-collection
    unsubs.push(onSnapshot(txQuery(familyId), (snap) => {
      const transactions = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Transaction))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      set({ transactions });
    }));

    set({ _unsubscribers: unsubs });
  },

  // ── unsubscribeAll ────────────────────────────────────────────
  unsubscribeAll: () => {
    get()._unsubscribers.forEach(u => u());
    set({ _unsubscribers: [] });
  },

  // ── Interest & Theme Logic ────────────────────────────────────
  updateInterestSettings: async (rate, period) => {
    const { familyId } = get();
    await updateFamilyField(familyId, { interestSettings: { rate, period, lastInterestCheck: familyId ? (await getDoc(familyRef(familyId))).data()?.interestSettings?.lastInterestCheck ?? null : null } });
  },

  calculateInterest: async () => {
    const { familyId, users, envelopes } = get();
    if (!familyId) return;

    const snap = await getDoc(familyRef(familyId));
    if (!snap.exists()) return;
    const data = snap.data() as FamilyDoc;
    const settings = data.interestSettings;
    if (!settings || settings.rate <= 0) return;

    const today = new Date();
    const lastCheck = settings.lastInterestCheck ? new Date(settings.lastInterestCheck) : null;

    // Check if period passed
    let shouldCalc = false;
    if (!lastCheck) {
      shouldCalc = true;
    } else {
      if (settings.period === 'monthly') {
        if (today.getMonth() !== lastCheck.getMonth() || today.getFullYear() !== lastCheck.getFullYear()) shouldCalc = true;
      } else {
        if (today.getFullYear() !== lastCheck.getFullYear()) shouldCalc = true;
      }
    }

    if (!shouldCalc) return;

    const timestamp = today.toISOString();
    let updatedEnvelopes = [...envelopes];
    const batch = writeBatch(db);

    users.forEach(kid => {
      if (kid.role !== 'kid') return;
      const investEnvs = updatedEnvelopes.filter(e => e.ownerId === kid.id && e.type === 'investing');
      const totalInvest = investEnvs.reduce((sum, e) => sum + e.balance, 0);
      const interest = Math.floor(totalInvest * settings.rate);

      if (interest > 0 && investEnvs.length > 0) {
        const targetEnv = investEnvs[0];
        updatedEnvelopes = updatedEnvelopes.map(e =>
          e.id === targetEnv.id ? { ...e, balance: e.balance + interest } : e
        );
        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, { familyId, envelopeId: targetEnv.id, amount: interest, timestamp, note: `利息發放 (${settings.period === 'monthly' ? '月' : '年'}結)`, status: 'approved' });
      }
    });

    batch.update(familyRef(familyId), {
      envelopes: updatedEnvelopes,
      'interestSettings.lastInterestCheck': today.toISOString().split('T')[0]
    });
    await batch.commit();
  },

  updateThemeSettings: async (backgroundUrl) => {
    await updateFamilyField(get().familyId, { themeSettings: { backgroundUrl } });
  },

  // ── logout ────────────────────────────────────────────────────
  logout: async () => {
    const { signOut } = await import('firebase/auth');
    get().unsubscribeAll();
    const { auth } = await import('../services/firebase');
    await signOut(auth);
    set({ firebaseUser: null, familyId: null, currentUser: null, isNewFamily: false, users: [], envelopes: [], transactions: [], quests: [], routineQuests: [] });
  },

  // ── login (select family member, links googleUid on first selection) ──────
  login: (userId) => {
    const { users, familyId, firebaseUser } = get();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    set({ currentUser: user });
    // Link/Sync Google UID + email to this profile
    if (firebaseUser && familyId) {
      const isAlreadyLinkedToThis = user.googleUid === firebaseUser.uid;
      const isUnlinked = !user.googleUid;

      if (isUnlinked || isAlreadyLinkedToThis) {
        // Update if unlinked OR if we want to ensure email is up to date for this UID
        if (user.googleEmail !== firebaseUser.email || user.googleUid !== firebaseUser.uid) {
          const updatedUsers = users.map(u =>
            u.id === userId ? { ...u, googleUid: firebaseUser.uid, googleEmail: firebaseUser.email ?? undefined } : u
          );
          updateFamilyField(familyId, { users: updatedUsers });
        }
      }
    }
  },


  // ── Expense Categories ──────────────────────────────────────
  addExpenseCategory: async (name, icon) => {
    const { familyId, expenseCategories } = get();
    if (!familyId) return;
    await updateFamilyField(familyId, {
      expenseCategories: [...expenseCategories, { id: uuidv4(), name, icon }]
    });
  },

  updateExpenseCategory: async (id, name, icon) => {
    const { familyId, expenseCategories } = get();
    if (!familyId) return;
    await updateFamilyField(familyId, {
      expenseCategories: expenseCategories.map(c => c.id === id ? { ...c, name, icon } : c)
    });
  },

  deleteExpenseCategory: async (id) => {
    const { familyId, expenseCategories } = get();
    if (!familyId) return;
    await updateFamilyField(familyId, {
      expenseCategories: expenseCategories.filter(c => c.id !== id)
    });
  },

  // ── Game / Settings ───────────────────────────────────────────
  addBadge: async (badge) => {
    const { familyId, badges } = get();
    if (!familyId) return;

    // Remove undefined fields to prevent Firestore errors
    const newBadge = { id: uuidv4(), ...badge };
    if (newBadge.boxRewardId === undefined) delete newBadge.boxRewardId;

    await updateFamilyField(familyId, { badges: [...badges, newBadge] });
  },

  updateBadge: async (id, badge) => {
    const { familyId, badges } = get();
    if (!familyId) return;

    const updatedBadge = { id, ...badge };
    if (updatedBadge.boxRewardId === undefined) delete updatedBadge.boxRewardId;

    await updateFamilyField(familyId, { badges: badges.map(b => b.id === id ? updatedBadge : b) });
  },

  deleteBadge: async (id) => {
    const { familyId, badges } = get();
    if (!familyId) return;
    await updateFamilyField(familyId, { badges: badges.filter(b => b.id !== id) });
  },

  addTreasureBox: async (box) => {
    const { familyId, treasureBoxes } = get();
    if (!familyId) return;
    const newBox = { id: uuidv4(), ...box };
    if (newBox.purchasable === undefined) delete newBox.purchasable;
    await updateFamilyField(familyId, { treasureBoxes: [...treasureBoxes, newBox] });
  },

  updateTreasureBox: async (id, box) => {
    const { familyId, treasureBoxes } = get();
    if (!familyId) return;
    const updated = { id, ...box };
    if (updated.purchasable === undefined) delete updated.purchasable;
    await updateFamilyField(familyId, { treasureBoxes: treasureBoxes.map(b => b.id === id ? updated : b) });
  },

  deleteTreasureBox: async (id) => {
    const { familyId, treasureBoxes } = get();
    if (!familyId) return;
    await updateFamilyField(familyId, { treasureBoxes: treasureBoxes.filter(b => b.id !== id) });
  },

  updateGamificationSettings: async (settings) => {
    const { familyId } = get();
    if (familyId) await updateFamilyField(familyId, { gamificationSettings: settings });
  },

  approveTreasureClaim: async (claimId) => {
    const { familyId, treasureClaims } = get();
    if (!familyId) return;
    const newClaims = (treasureClaims || []).map(c => c.id === claimId ? { ...c, status: 'approved' as const } : c);
    await updateFamilyField(familyId, { treasureClaims: newClaims });
  },

  // ── purchaseTreasureBox: deduct gems, add box instance to ownedBoxes ───────
  purchaseTreasureBox: async (boxId) => {
    const { familyId, treasureBoxes, currentUser, users } = get();
    if (!familyId || !currentUser) throw new Error('未登入');
    const box = treasureBoxes.find(b => b.id === boxId);
    if (!box) throw new Error('找不到寶箱');
    if (!(box.purchasable !== false)) throw new Error('此寶箱無法購買');
    if ((currentUser.gems || 0) < box.costGems) throw new Error('寶石不足');

    const newInstance: OwnedBoxInstance = {
      instanceId: uuidv4(), boxId: box.id, boxName: box.name,
      obtainedAt: new Date().toISOString(),
    };
    const newUser = {
      ...currentUser,
      gems: (currentUser.gems || 0) - box.costGems,
      ownedBoxes: [...(currentUser.ownedBoxes || []), newInstance],
    };
    await updateFamilyField(familyId, { users: users.map(u => u.id === currentUser.id ? newUser : u) });
  },

  // ── openOwnedBox: draw from a held instance, remove it after ─────────────
  openOwnedBox: async (instanceId) => {
    const { familyId, users, currentUser, treasureBoxes, badges, gamificationSettings, treasureClaims } = get();
    if (!familyId || !currentUser) throw new Error('未登入');

    const instance = (currentUser.ownedBoxes || []).find(ob => ob.instanceId === instanceId);
    if (!instance) throw new Error('找不到此寶箱實例');

    const box = treasureBoxes.find(b => b.id === instance.boxId);
    if (!box) throw new Error('寶箱資料不存在（可能已被刪除）');

    // Random draw
    const rand = Math.random() * 100;
    let cumulative = 0;
    let wonItem: TreasureBoxItem = box.items[box.items.length - 1];
    for (const item of box.items) {
      cumulative += item.probability;
      if (rand <= cumulative) { wonItem = item; break; }
    }

    // Apply virtual rewards (EXP/gems)
    const newUser = applyUserRewards(currentUser, wonItem.expReward || 0, wonItem.gemReward || 0, gamificationSettings, badges, treasureBoxes);

    // Add to item inventory if it's a regular item (not physical, not virtual-only)
    if (!wonItem.isPhysical && !wonItem.expReward && !wonItem.gemReward) {
      newUser.inventory = [...(newUser.inventory || [])];
      const existInfo = newUser.inventory.find(i => i.name === wonItem.name);
      if (existInfo) existInfo.quantity += 1;
      else newUser.inventory.push({ name: wonItem.name, quantity: 1 });
    }

    // Remove the used instance from ownedBoxes
    newUser.ownedBoxes = (newUser.ownedBoxes || []).filter(ob => ob.instanceId !== instanceId);

    const updatedUsers = users.map(u => u.id === currentUser.id ? newUser : u);

    // Create physical claim if needed
    const extraData: Partial<FamilyDoc> = {};
    if (wonItem.isPhysical) {
      const claim: TreasureClaim = {
        id: uuidv4(), userId: currentUser.id, boxId: box.id, boxName: box.name,
        itemId: wonItem.id, itemName: wonItem.name, status: 'pending', timestamp: new Date().toISOString(),
      };
      extraData.treasureClaims = [...(treasureClaims || []), claim];
    }

    await updateFamilyField(familyId, { users: updatedUsers, ...extraData });
    return { wonItemName: wonItem.name, isPhysical: !!wonItem.isPhysical, expReward: wonItem.expReward, gemReward: wonItem.gemReward };
  },

  // ── drawTreasureBox (LEGACY - kept for backward compat) ───────────────────
  drawTreasureBox: async (boxId) => {
    const { familyId, treasureBoxes, currentUser, users, badges, gamificationSettings, treasureClaims } = get();
    if (!familyId || !currentUser) throw new Error('未登入');
    const box = treasureBoxes.find(b => b.id === boxId);
    if (!box) throw new Error('找不到寶箱');
    if ((currentUser.gems || 0) < box.costGems) throw new Error('寶石不足');
    const rand = Math.random() * 100;
    let cumulative = 0;
    let wonItem: TreasureBoxItem = box.items[box.items.length - 1];
    for (const item of box.items) {
      cumulative += item.probability;
      if (rand <= cumulative) { wonItem = item; break; }
    }
    const newUser = applyUserRewards(currentUser, wonItem.expReward || 0, wonItem.gemReward || 0, gamificationSettings, badges, treasureBoxes);
    newUser.gems = (newUser.gems || 0) - box.costGems;
    if (!wonItem.isPhysical && !wonItem.expReward && !wonItem.gemReward) {
      newUser.inventory = [...(newUser.inventory || [])];
      const existInfo = newUser.inventory.find(i => i.name === wonItem.name);
      if (existInfo) existInfo.quantity += 1;
      else newUser.inventory.push({ name: wonItem.name, quantity: 1 });
    }
    const updatedUsers = users.map(u => u.id === currentUser.id ? newUser : u);
    const extraData: Partial<FamilyDoc> = {};
    if (wonItem.isPhysical) {
      const claim: TreasureClaim = { id: uuidv4(), userId: currentUser.id, boxId: box.id, boxName: box.name, itemId: wonItem.id, itemName: wonItem.name, status: 'pending', timestamp: new Date().toISOString() };
      extraData.treasureClaims = [...(treasureClaims || []), claim];
    }
    await updateFamilyField(familyId, { users: updatedUsers, ...extraData });
    return { wonItemName: wonItem.name, isPhysical: !!wonItem.isPhysical };
  },

  // ── addTransaction ────────────────────────────────────────────
  addTransaction: async (envelopeId, amount, note, categoryId) => {
    const { familyId, envelopes, users, currentUser } = get();
    if (!familyId || !currentUser) return;

    // Kids spending (amount < 0) requires approval
    const status = (currentUser.role === 'kid' && amount < 0) ? 'pending' : 'approved';

    // Add transaction doc
    await addDoc(collection(db, 'transactions'), {
      familyId, envelopeId, amount, note,
      ...(categoryId ? { categoryId } : {}),
      timestamp: new Date().toISOString(),
      status,
    });

    // Update envelope balance
    const updatedEnvelopes = envelopes.map(e =>
      e.id === envelopeId ? { ...e, balance: e.balance + amount } : e
    );

    // Update consecutive days logic
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedUsers = users.map(u => {
      if (u.id !== currentUser.id) return u;
      const stats = u.stats || { questsCount: 0, totalGemsEarned: 0, consecutiveRecordDays: 0, lastRecordDate: null, consecutiveAllQuestsDays: 0, lastAllQuestsDay: null, consecutiveAllQuestsWeeks: 0, lastAllQuestsWeek: null };

      let newConsecutive = stats.consecutiveRecordDays;
      if (stats.lastRecordDate !== todayStr) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (stats.lastRecordDate === yesterdayStr) {
          newConsecutive += 1;
        } else {
          newConsecutive = 1;
        }
      }

      return { ...u, stats: { ...stats, consecutiveRecordDays: newConsecutive, lastRecordDate: todayStr } };
    });

    await updateFamilyField(familyId, { envelopes: updatedEnvelopes, users: updatedUsers });
  },

  approveTransaction: async (transactionId) => {
    const { familyId } = get();
    if (!familyId) return;
    await updateDoc(doc(db, 'transactions', transactionId), { status: 'approved' });
  },

  rejectTransaction: async (transactionId) => {
    const { familyId, transactions, envelopes } = get();
    if (!familyId) return;

    const tx = transactions.find(t => t.id === transactionId);
    if (!tx || tx.status !== 'pending') return;

    const batch = writeBatch(db);

    // 1. Mark as rejected
    batch.update(doc(db, 'transactions', transactionId), { status: 'rejected' });

    // 2. Refund the amount (since amount was < 0, we subtract it to add it back)
    const env = envelopes.find(e => e.id === tx.envelopeId);
    if (env) {
      const updatedEnvelopes = envelopes.map(e =>
        e.id === env.id ? { ...e, balance: e.balance - tx.amount } : e
      );
      batch.update(familyRef(familyId), { envelopes: updatedEnvelopes });
    }

    await batch.commit();
  },

  // ── createQuest ───────────────────────────────────────────────
  createQuest: async (ownerId, title, expReward, moneyReward, gemReward, icon = '📜', dueDate, boxRewardId) => {
    const { familyId } = get();
    if (!familyId) return;
    try {
      const id = uuidv4();
      const newQuest: Quest = {
        id, ownerId, title, expReward, moneyReward, gemReward, status: 'open',
        icon, dueDate, boxRewardId, familyId,
        createdAt: new Date().toISOString()
      };
      // Remove undefined fields
      if (newQuest.dueDate === undefined) delete newQuest.dueDate;
      if (newQuest.boxRewardId === undefined) delete newQuest.boxRewardId;

      await setDoc(doc(db, 'quests', id), newQuest);
    } catch (err) {
      console.error('Error creating quest:', err);
    }
  },

  // ── submitQuest ───────────────────────────────────────────────
  submitQuest: async (questId) => {
    await updateDoc(doc(db, 'quests', questId), { status: 'pending_approval' });
  },

  // ── failQuest ─────────────────────────────────────────────────
  failQuest: async (questId) => {
    await updateDoc(doc(db, 'quests', questId), { status: 'failed' });
  },

  // ── approveQuest ──────────────────────────────────────────────
  approveQuest: async (questId) => {
    const { quests, users, envelopes, familyId, badges } = get();
    if (!familyId) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest || quest.status === 'completed') return;

    // Rewards logic
    const updatedUsers = users.map(u => {
      if (u.id !== quest.ownerId) return u;

      // 1. EXP & Level
      let newExp = u.exp + quest.expReward;
      let newLevel = u.level;
      while (newExp >= 100 * newLevel) {
        newExp -= 100 * newLevel;
        newLevel += 1;
      }

      // 2. Gems
      const addedGems = quest.gemReward || 0;
      const newGems = (u.gems || 0) + addedGems;

      // 3. Stats
      const stats = u.stats || { questsCount: 0, totalGemsEarned: 0, consecutiveRecordDays: 0, lastRecordDate: null, consecutiveAllQuestsDays: 0, lastAllQuestsDay: null, consecutiveAllQuestsWeeks: 0, lastAllQuestsWeek: null };
      const newStats = {
        ...stats,
        questsCount: stats.questsCount + 1,
        totalGemsEarned: stats.totalGemsEarned + addedGems
      };

      // 4. Badge Checking
      const unlocked = [...(u.unlockedBadges || [])];
      badges.forEach(b => {
        if (unlocked.includes(b.id)) return;

        const allMet = b.conditions.every(cond => {
          switch (cond.type) {
            case 'quests_count': return newStats.questsCount >= cond.value;
            case 'level': return newLevel >= cond.value;
            case 'total_gems': return newStats.totalGemsEarned >= cond.value;
            case 'consecutive_record_days': return newStats.consecutiveRecordDays >= cond.value;
            case 'savings_amount': {
              const totalSavings = envelopes.filter(e => e.ownerId === u.id && e.type === 'investing').reduce((sum, e) => sum + e.balance, 0);
              return totalSavings >= cond.value;
            }
            // Continuous all quests days/weeks would require more complex checking during generation/reset
            default: return false;
          }
        });

        if (allMet) unlocked.push(b.id);
      });

      return { ...u, exp: newExp, level: newLevel, gems: newGems, stats: newStats, unlockedBadges: unlocked };
    });

    // Give money
    let updatedEnvelopes = [...envelopes];
    if (quest.moneyReward > 0) {
      const spendableEnv = envelopes.find(e => e.ownerId === quest.ownerId && e.type === 'spendable');
      if (spendableEnv) {
        updatedEnvelopes = envelopes.map(e =>
          e.id === spendableEnv.id ? { ...e, balance: e.balance + quest.moneyReward } : e
        );
        await addDoc(collection(db, 'transactions'), {
          familyId, envelopeId: spendableEnv.id, amount: quest.moneyReward,
          timestamp: new Date().toISOString(), note: `任務獎勵：${quest.title}`,
        });
      }
    }

    const batch = writeBatch(db);
    batch.update(doc(db, 'quests', questId), { status: 'completed' });
    batch.update(familyRef(familyId), { users: updatedUsers, envelopes: updatedEnvelopes });
    await batch.commit();
  },

  // ── addKid ────────────────────────────────────────────────────
  addKid: async (name) => {
    const { familyId, users, envelopes } = get();
    if (!familyId) return;
    const newKidId = uuidv4();
    const newKid: User = { id: newKidId, name, role: 'kid', level: 1, exp: 0, isHidden: false, allowanceAmount: 100, allowanceRatio: 80, pin: '0000' };
    const newEnvelopes: Envelope[] = [
      { id: uuidv4(), ownerId: newKidId, name: '隨身錢包', type: 'spendable', balance: 0, isHidden: false },
      { id: uuidv4(), ownerId: newKidId, name: '存錢筒', type: 'investing', balance: 0, isHidden: false },
    ];
    await updateFamilyField(familyId, { users: [...users, newKid], envelopes: [...envelopes, ...newEnvelopes] });
  },

  // ── updateKid ─────────────────────────────────────────────────
  updateKid: async (kidId, name) => {
    const { familyId, users } = get();
    await updateFamilyField(familyId, { users: users.map(u => u.id === kidId ? { ...u, name } : u) });
  },

  setUserPin: async (userId: string, newPin: string) => {
    const { familyId, users } = get();
    if (!familyId) return;
    await updateFamilyField(familyId, {
      users: users.map(u => u.id === userId ? { ...u, pin: newPin } : u)
    });
  },

  // ── deleteKid ─────────────────────────────────────────────────
  deleteKid: async (kidId) => {
    const { familyId, users, envelopes, quests } = get();
    if (!familyId) return;
    const batch = writeBatch(db);
    // delete quests
    quests.filter(q => q.ownerId === kidId).forEach(q => batch.delete(doc(db, 'quests', q.id)));
    batch.update(familyRef(familyId), {
      users: users.filter(u => u.id !== kidId),
      envelopes: envelopes.filter(e => e.ownerId !== kidId),
    });
    await batch.commit();
  },

  // ── toggleHideKid ─────────────────────────────────────────────
  toggleHideKid: async (kidId) => {
    const { familyId, users } = get();
    await updateFamilyField(familyId, {
      users: users.map(u => u.id === kidId ? { ...u, isHidden: !u.isHidden } : u),
    });
  },

  // ── distributeAllowance ───────────────────────────────────────
  distributeAllowance: async (targetKidId?: string) => {
    const { familyId, users, envelopes, allowanceSettings: familySettings } = get();
    if (!familyId) return;
    const timestamp = new Date().toISOString();
    let updatedEnvelopes = [...envelopes];
    const batch = writeBatch(db);

    let updatedUsers = [...users];
    let changed = false;

    updatedUsers = updatedUsers.map(kid => {
      if (kid.role !== 'kid' || kid.isHidden) return kid;
      if (targetKidId && kid.id !== targetKidId) return kid;

      // Check if it's time for this kid
      const kSettings = kid.allowanceSettings || familySettings || { period: 'weekly' as const, days: [1], hour: 0, minute: 0 };
      const kNextDate = kid.nextAllowanceDate || get().nextAllowanceDate;

      // If we are calling for a specific kid, we assume it's time
      // OR if we are doing a general check, we check the date
      if (targetKidId || (kNextDate && new Date() >= new Date(kNextDate))) {
        changed = true;
        const totalAmount = kid.allowanceAmount ?? 0;
        const ratio = kid.allowanceRatio ?? 100;

        const spendableAmount = Math.floor(totalAmount * (ratio / 100));
        const investingAmount = totalAmount - spendableAmount;

        if (spendableAmount > 0) {
          const env = updatedEnvelopes.find(e => e.ownerId === kid.id && e.type === 'spendable');
          if (env) {
            updatedEnvelopes = updatedEnvelopes.map(e =>
              e.id === env.id ? { ...e, balance: e.balance + spendableAmount } : e
            );
            const txRef = doc(collection(db, 'transactions'));
            batch.set(txRef, { familyId, envelopeId: env.id, amount: spendableAmount, timestamp, note: '定期零用錢 (可動用)', status: 'approved' });
          }
        }

        if (investingAmount > 0) {
          const env = updatedEnvelopes.find(e => e.ownerId === kid.id && e.type === 'investing');
          if (env) {
            updatedEnvelopes = updatedEnvelopes.map(e =>
              e.id === env.id ? { ...e, balance: e.balance + investingAmount } : e
            );
            const txRef = doc(collection(db, 'transactions'));
            batch.set(txRef, { familyId, envelopeId: env.id, amount: investingAmount, timestamp, note: '定期零用錢 (儲蓄投資)', status: 'approved' });
          }
        }

        const nextDateStr = getNextAllowanceDate(new Date(), kSettings);
        return { ...kid, nextAllowanceDate: nextDateStr };
      }
      return kid;
    });

    if (!changed && !targetKidId) return; // Nothing to do

    const nextFamilyDate = get().nextAllowanceDate ? getNextAllowanceDate(new Date(), familySettings || { period: 'weekly', days: [1] }) : null;

    batch.update(familyRef(familyId), {
      envelopes: updatedEnvelopes,
      users: updatedUsers,
      ...(nextFamilyDate ? { nextAllowanceDate: nextFamilyDate } : {})
    });
    await batch.commit();
  },

  // ── manualDistributeAllowance ──────────────────────────────────
  manualDistributeAllowance: async (targetKidId, amount, ratio) => {
    const { familyId, users, envelopes } = get();
    if (!familyId) return;
    const timestamp = new Date().toISOString();
    let updatedEnvelopes = [...envelopes];
    const batch = writeBatch(db);

    users.forEach(kid => {
      if (kid.role !== 'kid' || kid.isHidden) return;
      if (targetKidId !== 'all' && kid.id !== targetKidId) return;

      const spendableAmount = Math.floor(amount * (ratio / 100));
      const investingAmount = amount - spendableAmount;

      if (spendableAmount > 0) {
        let env = updatedEnvelopes.find(e => e.ownerId === kid.id && e.type === 'spendable');
        if (!env) {
          env = updatedEnvelopes.find(e => e.ownerId === kid.id);
        }
        if (env) {
          updatedEnvelopes = updatedEnvelopes.map(e =>
            e.id === env?.id ? { ...e, balance: e.balance + spendableAmount } : e
          );
          const txRef = doc(collection(db, 'transactions'));
          batch.set(txRef, { familyId, envelopeId: env.id, amount: spendableAmount, timestamp, note: '單次手動派發 (可動用)', status: 'approved' });
        }
      }

      if (investingAmount > 0) {
        const env = updatedEnvelopes.find(e => e.ownerId === kid.id && e.type === 'investing');
        if (env) {
          updatedEnvelopes = updatedEnvelopes.map(e =>
            e.id === env.id ? { ...e, balance: e.balance + investingAmount } : e
          );
          const txRef = doc(collection(db, 'transactions'));
          batch.set(txRef, { familyId, envelopeId: env.id, amount: investingAmount, timestamp, note: '單次手動派發 (儲蓄投資)', status: 'approved' });
        }
      }
    });

    batch.update(familyRef(familyId), { envelopes: updatedEnvelopes });
    await batch.commit();
  },

  // ── updateNextAllowanceDate ───────────────────────────────────
  updateNextAllowanceDate: async (nextDate: string) => {
    await updateFamilyField(get().familyId, { nextAllowanceDate: nextDate });
  },

  updateAllowanceSettings: async (period, days, hour = 0, minute = 0) => {
    const { familyId } = get();
    if (!familyId) return;
    const settings: AllowanceSettings = { period, days, hour, minute };
    const nextDateStr = getNextAllowanceDate(new Date(), settings);
    await updateFamilyField(familyId, { allowanceSettings: settings, nextAllowanceDate: nextDateStr });
  },

  // ── updateKidAllowance ────────────────────────────────────────
  updateKidAllowance: async (kidId: string, amount: number, ratio: number, settings?: AllowanceSettings) => {
    const { familyId, users } = get();
    const nextDate = settings ? getNextAllowanceDate(new Date(), settings) : undefined;
    await updateFamilyField(familyId, {
      users: users.map(u => u.id === kidId ? {
        ...u,
        allowanceAmount: amount,
        allowanceRatio: ratio,
        ...(settings ? { allowanceSettings: settings, nextAllowanceDate: nextDate } : {})
      } : u)
    });
  },

  // ── updateFamilyName ──────────────────────────────────────────
  updateFamilyName: async (newName: string) => {
    const { familyId } = get();
    await updateFamilyField(familyId, { name: newName });
    // Also update local state immediately
    set({ familyName: newName });
  },

  // ── Envelope CRUD ─────────────────────────────────────────────
  addEnvelope: async (ownerId: string, name: string, type: EnvelopeType, icon = '✉️') => {
    const { familyId, envelopes } = get();
    const newEnv: Envelope = { id: uuidv4(), ownerId, name, type, balance: 0, isHidden: false, icon };
    await updateFamilyField(familyId, { envelopes: [...envelopes, newEnv] });
  },
  updateEnvelope: async (envelopeId: string, name: string, icon?: string) => {
    const { familyId, envelopes } = get();
    await updateFamilyField(familyId, { envelopes: envelopes.map(e => e.id === envelopeId ? { ...e, name, ...(icon !== undefined ? { icon } : {}) } : e) });
  },
  deleteEnvelope: async (envelopeId: string) => {
    const { familyId, envelopes } = get();
    await updateFamilyField(familyId, { envelopes: envelopes.filter(e => e.id !== envelopeId) });
  },
  toggleHideEnvelope: async (envelopeId: string) => {
    const { familyId, envelopes } = get();
    await updateFamilyField(familyId, { envelopes: envelopes.map(e => e.id === envelopeId ? { ...e, isHidden: !e.isHidden } : e) });
  },

  // ── RoutineQuest CRUD ─────────────────────────────────────────
  addRoutineQuest: async (ownerId, title, expReward, moneyReward, gemReward, daysOfWeek, icon = '📅', dueDays, boxRewardId) => {
    const { familyId, routineQuests } = get();
    const newRqList: RoutineQuest[] = (Array.isArray(ownerId) ? ownerId : [ownerId]).map(uid => {
      const rq: RoutineQuest = { id: uuidv4(), ownerId: uid, title, expReward, moneyReward, gemReward, daysOfWeek, icon, dueDays, boxRewardId };
      if (rq.dueDays === undefined) delete rq.dueDays;
      if (rq.boxRewardId === undefined) delete rq.boxRewardId;
      return rq;
    });
    await updateFamilyField(familyId, { routineQuests: [...routineQuests, ...newRqList] });

    // Immediately generate today's quest instances if today is one of the selected days
    const todayDow = new Date().getDay();
    if (daysOfWeek.includes(todayDow)) {
      const batch = writeBatch(db);
      const dueDayCount = dueDays ?? 0;
      const dueDate = new Date(Date.now() + dueDayCount * 86400000).toISOString().split('T')[0];
      for (const rq of newRqList) {
        const questRef = doc(collection(db, 'quests'));
        batch.set(questRef, {
          familyId, ownerId: rq.ownerId,
          title: `(例行) ${rq.title}`,
          expReward: rq.expReward, moneyReward: rq.moneyReward, gemReward: rq.gemReward || 0,
          status: 'open', icon: rq.icon || '📅',
          createdAt: new Date().toISOString(),
          dueDate,
          ...(boxRewardId ? { boxRewardId } : {}),
        });
      }
      await batch.commit();
    }
  },

  deleteRoutineQuest: async (id) => {
    const { familyId, routineQuests } = get();
    await updateFamilyField(familyId, { routineQuests: routineQuests.filter(rq => rq.id !== id) });
  },

  updateRoutineQuest: async (id, title, expReward, moneyReward, gemReward, daysOfWeek, icon, dueDays, boxRewardId) => {
    const { familyId, routineQuests } = get();
    if (!familyId) return;

    const updatedRqList = routineQuests.map(rq => {
      if (rq.id !== id) return rq;
      const updated: RoutineQuest = {
        ...rq,
        title, expReward, moneyReward, gemReward, daysOfWeek,
        icon: icon || rq.icon,
        dueDays,
        boxRewardId
      };
      if (updated.dueDays === undefined) delete updated.dueDays;
      if (updated.boxRewardId === undefined) delete updated.boxRewardId;
      return updated;
    });

    await updateFamilyField(familyId, { routineQuests: updatedRqList });
  },

  // ── generateRoutineQuests ─────────────────────────────────────
  generateRoutineQuests: async () => {
    const { familyId, lastRoutineGenerateDate, routineQuests } = get();
    if (!familyId) return;
    const todayStr = new Date().toISOString().split('T')[0];
    if (lastRoutineGenerateDate === todayStr) return;

    const dayOfWeek = new Date().getDay();
    const batch = writeBatch(db);
    routineQuests.filter(rq => rq.daysOfWeek.includes(dayOfWeek)).forEach(rq => {
      const questRef = doc(collection(db, 'quests'));
      const dueDayCount = rq.dueDays ?? 0;
      const dueDate = new Date(Date.now() + dueDayCount * 86400000).toISOString().split('T')[0];
      batch.set(questRef, {
        familyId, ownerId: rq.ownerId,
        title: `(例行) ${rq.title}`,
        expReward: rq.expReward, moneyReward: rq.moneyReward, gemReward: rq.gemReward || 0,
        status: 'open', icon: rq.icon || '📅',
        createdAt: new Date().toISOString(),
        dueDate,
      });
    });
    batch.update(familyRef(familyId), { lastRoutineGenerateDate: todayStr });
    await batch.commit();
  },

  // ── forceGenerateRoutineQuests ────────────────────────────────
  // Like generateRoutineQuests but ignores the daily lock — used by admin to push existing routine quests immediately
  forceGenerateRoutineQuests: async () => {
    const { familyId, routineQuests } = get();
    if (!familyId) return;
    const dayOfWeek = new Date().getDay();
    const todayStr = new Date().toISOString().split('T')[0];
    const toGenerate = routineQuests.filter(rq => rq.daysOfWeek.includes(dayOfWeek));
    if (toGenerate.length === 0) return;
    const batch = writeBatch(db);
    toGenerate.forEach(rq => {
      const questRef = doc(collection(db, 'quests'));
      const dueDayCount = rq.dueDays ?? 0;
      const dueDate = new Date(Date.now() + dueDayCount * 86400000).toISOString().split('T')[0];
      batch.set(questRef, {
        familyId, ownerId: rq.ownerId,
        title: `(例行) ${rq.title}`,
        expReward: rq.expReward, moneyReward: rq.moneyReward, gemReward: rq.gemReward || 0,
        status: 'open', icon: rq.icon || '📅',
        createdAt: new Date().toISOString(),
        dueDate,
      });
    });
    // Also reset the lock so normal generation works tomorrow
    batch.update(familyRef(familyId), { lastRoutineGenerateDate: todayStr });
    await batch.commit();
  },

  // ── approveQuestWithFeedback ──────────────────────────────────
  approveQuestWithFeedback: async (questId, grade, emoji, comment, expMult, moneyMult, gemMult) => {
    const store = get();
    const { quests, users, envelopes, familyId, badges, gamificationSettings } = store;
    if (!familyId) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest || quest.status === 'completed') return;

    const actualExp = Math.round(quest.expReward * expMult);
    const actualMoney = Math.round(quest.moneyReward * moneyMult);
    const actualGems = Math.round((quest.gemReward || 0) * gemMult);
    const feedback: QuestFeedback = { grade, emoji, comment, actualExp, actualMoney, actualGems, timestamp: new Date().toISOString() };

    const targetUser = users.find(u => u.id === quest.ownerId);
    if (!targetUser) return;

    let newUser = applyUserRewards(targetUser, actualExp, actualGems, gamificationSettings, badges, get().treasureBoxes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newUser = { ...newUser, stats: { ...(newUser.stats || {}), questsCount: (newUser.stats?.questsCount || 0) + 1 } as any };

    const updatedUsers = users.map(u => u.id === newUser.id ? newUser : u);

    let updatedEnvelopes = [...envelopes];
    if (actualMoney > 0) {
      const spendableEnv = envelopes.find(e => e.ownerId === quest.ownerId && e.type === 'spendable');
      if (spendableEnv) {
        updatedEnvelopes = envelopes.map(e => e.id === spendableEnv.id ? { ...e, balance: e.balance + actualMoney } : e);
        await addDoc(collection(db, 'transactions'), {
          familyId, envelopeId: spendableEnv.id, amount: actualMoney,
          timestamp: new Date().toISOString(),
          note: `任務獎勵：${quest.title} ${emoji}${comment ? ' · ' + comment : ''}`,
          status: 'approved',
        });
      }
    }
    // Grant box reward if quest has one and box still exists
    let finalUsers = [...updatedUsers];
    if (quest.boxRewardId) {
      const rewardBox = get().treasureBoxes.find(b => b.id === quest.boxRewardId);
      if (rewardBox) {
        const boxInstance: OwnedBoxInstance = {
          instanceId: uuidv4(), boxId: rewardBox.id, boxName: rewardBox.name,
          obtainedAt: new Date().toISOString(),
        };
        finalUsers = finalUsers.map(u =>
          u.id === newUser.id
            ? { ...u, ownedBoxes: [...(u.ownedBoxes || []), boxInstance] }
            : u
        );
      }
    }

    const batch = writeBatch(db);
    batch.update(doc(db, 'quests', questId), { status: 'completed', feedback });
    batch.update(familyRef(familyId), { users: finalUsers, envelopes: updatedEnvelopes });
    await batch.commit();
  },

  rejectQuest: async (questId, comment, emoji) => {
    const feedback: QuestFeedback = { grade: 'rejected', emoji, comment, actualExp: 0, actualMoney: 0, actualGems: 0, timestamp: new Date().toISOString() };
    await updateDoc(doc(db, 'quests', questId), { status: 'rejected', feedback });
  },

  delayQuest: async (questId, comment, emoji) => {
    const feedback: QuestFeedback = { grade: 'delayed', emoji, comment, actualExp: 0, actualMoney: 0, actualGems: 0, timestamp: new Date().toISOString() };
    await updateDoc(doc(db, 'quests', questId), { status: 'delayed', feedback });
  },

  updateTimezone: async (offset) => {
    const { familyId } = get();
    await updateFamilyField(familyId, { timezoneOffset: offset });
    set({ timezoneOffset: offset });
  },

  // ── updateCurrencySymbol ─────────────────────────────────────
  updateCurrencySymbol: async (symbol) => {
    const { familyId } = get();
    await updateFamilyField(familyId, { currencySymbol: symbol });
    set({ currencySymbol: symbol });
  },

  // ── transferMoney ────────────────────────────────────────────
  transferMoney: async (fromEnvId, toEnvId, amount, note = '信封轉帳') => {
    const { familyId, envelopes, currentUser } = get();
    if (!familyId || !currentUser) throw new Error('未登入');
    if (amount <= 0) throw new Error('轉帳金額必須大於零');

    const fromEnv = envelopes.find(e => e.id === fromEnvId);
    const toEnv = envelopes.find(e => e.id === toEnvId);
    if (!fromEnv) throw new Error('找不到轉出信封');
    if (!toEnv) throw new Error('找不到轉入信封');
    if (fromEnv.balance < amount) throw new Error(`轉出信封餘額不足（目前 ${fromEnv.balance}）`);

    const timestamp = new Date().toISOString();
    const batch = writeBatch(db);

    // Write two transaction docs
    const outRef = doc(collection(db, 'transactions'));
    batch.set(outRef, {
      familyId, envelopeId: fromEnvId, amount: -amount,
      note: `${note}（轉出至 ${toEnv.name}）`, timestamp,
      status: 'approved',
    });
    const inRef = doc(collection(db, 'transactions'));
    batch.set(inRef, {
      familyId, envelopeId: toEnvId, amount: amount,
      note: `${note}（從 ${fromEnv.name} 轉入）`, timestamp,
      status: 'approved',
    });

    // Update envelope balances
    const updatedEnvelopes = envelopes.map(e => {
      if (e.id === fromEnvId) return { ...e, balance: e.balance - amount };
      if (e.id === toEnvId) return { ...e, balance: e.balance + amount };
      return e;
    });
    batch.update(familyRef(familyId), { envelopes: updatedEnvelopes });

    await batch.commit();
  },

  // ── Backup & Restore ───────────────────────────────────────
  exportFamilyData: () => {
    const s = get();
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      familyId: s.familyId,
      familyName: s.familyName,
      users: s.users,
      envelopes: s.envelopes,
      expenseCategories: s.expenseCategories,
      badges: s.badges,
      treasureBoxes: s.treasureBoxes,
      routineQuests: s.routineQuests,
      nextAllowanceDate: s.nextAllowanceDate,
      lastRoutineGenerateDate: s.lastRoutineGenerateDate,
      interestSettings: s.interestSettings,
      themeSettings: s.themeSettings,
      timezoneOffset: s.timezoneOffset,
      currencySymbol: s.currencySymbol,
      gamificationSettings: s.gamificationSettings,
      quests: s.quests,
      transactions: s.transactions,
    };
    return {
      data: JSON.stringify(backup, null, 2),
      filename: `family_budget_backup_${s.familyName}_${new Date().toISOString().split('T')[0]}.json`
    };
  },

  importFamilyData: async (jsonData) => {
    const { familyId } = get();
    if (!familyId) throw new Error('未載入家庭資料，無法匯入');

    const backup = JSON.parse(jsonData);
    if (!backup.users || !backup.envelopes) throw new Error('無效的備份檔案格式');

    const batch = writeBatch(db);
    const fRef = familyRef(familyId);

    // 1. Update main family document
    const familyUpdate: Partial<FamilyDoc> = {
      name: backup.familyName || get().familyName,
      users: backup.users,
      envelopes: backup.envelopes,
      expenseCategories: backup.expenseCategories || [],
      badges: backup.badges || [],
      treasureBoxes: backup.treasureBoxes || [],
      routineQuests: backup.routineQuests || [],
      nextAllowanceDate: backup.nextAllowanceDate || null,
      lastRoutineGenerateDate: backup.lastRoutineGenerateDate || null,
      interestSettings: backup.interestSettings || null,
      themeSettings: backup.themeSettings || null,
      timezoneOffset: backup.timezoneOffset || 480,
      currencySymbol: backup.currencySymbol || 'NT$',
      gamificationSettings: backup.gamificationSettings || undefined,
    };
    batch.update(fRef, familyUpdate);

    await batch.commit();
    // After commit, the onSnapshot listener will update the local state automatically.
  },

  // ── verifyAndUseSystemInviteCode ─────────────────────────────
  verifyAndUseSystemInviteCode: async (code) => {
    const { firebaseUser } = get();
    if (!firebaseUser) return false;
    const upperCode = code.trim().toUpperCase();
    const codeRef = doc(db, 'inviteCodes', upperCode);
    const codeSnap = await getDoc(codeRef);
    if (!codeSnap.exists()) return false;
    const data = codeSnap.data() as InviteCode;
    if (data.isUsed) return false;
    await updateDoc(codeRef, {
      isUsed: true,
      usedBy: firebaseUser.uid,
      usedByEmail: firebaseUser.email ?? '',
      usedAt: new Date().toISOString(),
    });
    set({ needsInviteCode: false, isNewFamily: true });
    return true;
  },

  // ── generateSystemInviteCode ──────────────────────────────────
  generateSystemInviteCode: async () => {
    const { firebaseUser, systemAdminRole } = get();
    if (!firebaseUser || !systemAdminRole) return null;
    // Check quota for senior admins
    if (systemAdminRole === 'senior') {
      const adminSnap = await getDoc(doc(db, 'systemAdmins', firebaseUser.uid));
      if (adminSnap.exists()) {
        const { inviteQuota, inviteUsed = 0 } = adminSnap.data() as SystemAdmin;
        if (inviteQuota !== undefined && inviteUsed >= inviteQuota) return null;
      }
      await updateDoc(doc(db, 'systemAdmins', firebaseUser.uid), { inviteUsed: increment(1) });
    }
    // Generate unique code
    let code = generateInviteCode() + generateInviteCode().slice(0, 2); // 8 chars
    code = code.toUpperCase();
    const codeDoc: InviteCode = {
      code, createdBy: firebaseUser.uid,
      createdByEmail: firebaseUser.email ?? '',
      createdAt: new Date().toISOString(),
      isUsed: false, creatorRole: systemAdminRole,
    };
    await setDoc(doc(db, 'inviteCodes', code), codeDoc);
    return code;
  },

  // ── listAllFamilies ───────────────────────────────────────────
  listAllFamilies: async () => {
    const { systemAdminRole } = get();
    if (!systemAdminRole) return [];
    const snap = await getDocs(collection(db, 'families'));
    return snap.docs.map(d => {
      const data = d.data() as FamilyDoc & { name?: string; createdAt?: string };
      const members = (data.users || []).map((u: { name: string; role: string; googleEmail?: string }) => ({
        name: u.name, role: u.role, googleEmail: u.googleEmail,
      }));
      return { familyId: d.id, familyName: data.name || '未命名家庭', members, createdAt: data.createdAt as string | undefined };
    });
  },

  // ── listAllInviteCodes ────────────────────────────────────────
  listAllInviteCodes: async () => {
    const { systemAdminRole, firebaseUser } = get();
    if (!systemAdminRole || !firebaseUser) return [];
    const q = systemAdminRole === 'super'
      ? collection(db, 'inviteCodes')
      : query(collection(db, 'inviteCodes'), where('createdBy', '==', firebaseUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as InviteCode);
  },

  // ── listSystemAdmins ──────────────────────────────────────────
  listSystemAdmins: async () => {
    const { systemAdminRole } = get();
    if (systemAdminRole !== 'super') return [];
    const snap = await getDocs(collection(db, 'systemAdmins'));
    return snap.docs.map(d => d.data() as SystemAdmin);
  },

  // ── setSystemAdmin ────────────────────────────────────────────
  setSystemAdmin: async (uid, email, role, quota) => {
    const { firebaseUser, systemAdminRole } = get();
    if (systemAdminRole !== 'super' || !firebaseUser) return;
    const data: SystemAdmin = {
      uid, email, role,
      inviteQuota: role === 'senior' ? (quota ?? 10) : undefined,
      inviteUsed: 0,
      createdAt: new Date().toISOString(),
      createdBy: firebaseUser.uid,
    };
    if (data.inviteQuota === undefined) delete data.inviteQuota;
    await setDoc(doc(db, 'systemAdmins', uid), data, { merge: true });
  },

  // ── removeSystemAdmin ─────────────────────────────────────────
  removeSystemAdmin: async (uid) => {
    const { systemAdminRole } = get();
    if (systemAdminRole !== 'super') return;
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'systemAdmins', uid));
  },

  // ── updateAdminQuota ──────────────────────────────────────────
  updateAdminQuota: async (uid, quota) => {
    const { systemAdminRole } = get();
    if (systemAdminRole !== 'super') return;
    await updateDoc(doc(db, 'systemAdmins', uid), { inviteQuota: quota ?? null });
  },
}));
