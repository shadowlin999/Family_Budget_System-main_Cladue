/**
 * Phase 3 — Store Action Tests
 *
 * Strategy: mock all Firebase I/O; test business logic inside store actions.
 * Since most actions write to Firestore then rely on onSnapshot to update local
 * state, we verify:
 *   1. Actions succeed / throw under the right conditions
 *   2. The correct data shape is passed to Firestore mocks
 *   3. Return values are correct (e.g. openOwnedBox)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firebase mocks (must be declared before store import) ──────────────────────
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockBatch = { set: mockBatchSet, update: mockBatchUpdate, commit: mockBatchCommit };

const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'new-tx-id' });
const mockDoc = vi.fn((...args: unknown[]) => `doc::${args.slice(1).join('/')}`);
const mockCollection = vi.fn((...args: unknown[]) => `col::${args[1]}`);
const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args as [unknown, unknown]),
  addDoc: (...args: unknown[]) => mockAddDoc(...args as [unknown, unknown]),
  collection: (...args: unknown[]) => mockCollection(...args),
  writeBatch: vi.fn(() => mockBatch),
  getDoc: (...args: unknown[]) => mockGetDoc(...args as [unknown]),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  onSnapshot: vi.fn(() => vi.fn()),   // returns unsubscribe fn
  query: vi.fn((...a: unknown[]) => a),
  where: vi.fn((...a: unknown[]) => a),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  // Timestamp must be a real class so `instanceof Timestamp` in deepClean works
  Timestamp: class MockTimestamp {
    static fromDate = vi.fn();
    static now = vi.fn();
  },
  increment: vi.fn((v: number) => v),
}));

vi.mock('../services/firebase', () => ({
  db: 'mock-db',
  auth: {},
  googleProvider: {},
}));

// ── Import store AFTER mocks are in place ─────────────────────────────────────
import { useStore } from './index';
import type { User, Envelope, Quest, TreasureBox } from './index';

// ── Fixture builders ──────────────────────────────────────────────────────────
const makeKid = (overrides: Partial<User> = {}): User => ({
  id: 'kid1',
  name: '小明',
  role: 'kid',
  level: 1,
  exp: 0,
  gems: 20,
  allowanceAmount: 100,
  allowanceRatio: 70,
  ownedBoxes: [],
  ...overrides,
});

const makeEnvelope = (overrides: Partial<Envelope> = {}): Envelope => ({
  id: 'env1',
  ownerId: 'kid1',
  name: '零花錢',
  type: 'spendable',
  balance: 0,
  isHidden: false,
  ...overrides,
});

const makeQuest = (overrides: Partial<Quest> = {}): Quest => ({
  id: 'q1',
  ownerId: 'kid1',
  familyId: 'fam1',
  title: '掃地',
  expReward: 100,
  moneyReward: 50,
  gemReward: 5,
  status: 'pending_approval',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeBox = (overrides: Partial<TreasureBox> = {}): TreasureBox => ({
  id: 'box1',
  name: '冒險箱',
  costGems: 10,
  purchasable: true,
  items: [
    { id: 'item1', name: '🗡️ 短劍', probability: 50 },
    { id: 'item2', name: '🧪 藥水', probability: 50 },
  ],
  ...overrides,
});

// Reset store state before each test
const BASE_STATE = {
  familyId: 'fam1',
  users: [],
  envelopes: [],
  quests: [],
  transactions: [],
  badges: [],
  treasureBoxes: [],
  currentUser: null,
  allowanceSettings: { period: 'weekly' as const, days: [1], hour: 9, minute: 0 },
  nextAllowanceDate: null,
  gamificationSettings: undefined,
  treasureClaims: [],
};

beforeEach(() => {
  useStore.setState(BASE_STATE);
  vi.clearAllMocks();
  mockBatchCommit.mockResolvedValue(undefined);
  mockUpdateDoc.mockResolvedValue(undefined);
  mockAddDoc.mockResolvedValue({ id: 'new-tx-id' });
});

// ─────────────────────────────────────────────────────────────────────────────
// distributeAllowance
// ─────────────────────────────────────────────────────────────────────────────
describe('distributeAllowance', () => {
  it('does nothing when familyId is null', async () => {
    useStore.setState({ familyId: null });
    await useStore.getState().distributeAllowance();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('does nothing when kid has no nextAllowanceDate and no targetKidId', async () => {
    const kid = makeKid({ nextAllowanceDate: undefined });
    useStore.setState({ users: [kid] });
    await useStore.getState().distributeAllowance();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('distributes to a specific kid when targetKidId is given', async () => {
    const kid = makeKid();
    const spendEnv = makeEnvelope({ id: 'env-spend', type: 'spendable', balance: 0 });
    const investEnv = makeEnvelope({ id: 'env-invest', type: 'investing', balance: 0 });
    useStore.setState({ users: [kid], envelopes: [spendEnv, investEnv] });

    await useStore.getState().distributeAllowance('kid1');

    // Should have called batch.commit
    expect(mockBatchCommit).toHaveBeenCalledOnce();
    // Should have written two transactions (spendable + investing)
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
  });

  it('splits allowance correctly (70% spendable, 30% investing)', async () => {
    // allowanceAmount=100, ratio=70 → spend=70, invest=30
    const kid = makeKid({ allowanceAmount: 100, allowanceRatio: 70 });
    const spendEnv = makeEnvelope({ id: 'env-spend', type: 'spendable' });
    const investEnv = makeEnvelope({ id: 'env-invest', type: 'investing' });
    useStore.setState({ users: [kid], envelopes: [spendEnv, investEnv] });

    await useStore.getState().distributeAllowance('kid1');

    // Find the spend tx call
    const setCalls = mockBatchSet.mock.calls;
    const spendCall = setCalls.find(([, data]) => data.envelopeId === 'env-spend');
    const investCall = setCalls.find(([, data]) => data.envelopeId === 'env-invest');
    expect(spendCall?.[1].amount).toBe(70);
    expect(investCall?.[1].amount).toBe(30);
  });

  it('only sends spendable tx when investing amount is 0 (ratio=100)', async () => {
    const kid = makeKid({ allowanceAmount: 100, allowanceRatio: 100 });
    const spendEnv = makeEnvelope({ id: 'env-spend', type: 'spendable' });
    useStore.setState({ users: [kid], envelopes: [spendEnv] });

    await useStore.getState().distributeAllowance('kid1');

    // Only one transaction (spendable)
    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchSet.mock.calls[0][1].envelopeId).toBe('env-spend');
  });

  it('skips hidden kids', async () => {
    const hiddenKid = makeKid({ isHidden: true });
    useStore.setState({ users: [hiddenKid] });

    await useStore.getState().distributeAllowance('kid1');

    // Hidden kids are skipped — no tx, no commit (changed=false and targetKidId given but kid skipped)
    expect(mockBatchSet).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// purchaseTreasureBox
// ─────────────────────────────────────────────────────────────────────────────
describe('purchaseTreasureBox', () => {
  it('throws when not logged in (no currentUser)', async () => {
    useStore.setState({ currentUser: null });
    await expect(useStore.getState().purchaseTreasureBox('box1'))
      .rejects.toThrow('未登入');
  });

  it('throws when box not found', async () => {
    const kid = makeKid();
    useStore.setState({ currentUser: kid, treasureBoxes: [] });
    await expect(useStore.getState().purchaseTreasureBox('box1'))
      .rejects.toThrow('找不到寶箱');
  });

  it('throws when kid has insufficient gems', async () => {
    const kid = makeKid({ gems: 5 });
    const box = makeBox({ costGems: 10 });
    useStore.setState({ currentUser: kid, users: [kid], treasureBoxes: [box] });
    await expect(useStore.getState().purchaseTreasureBox('box1'))
      .rejects.toThrow('寶石不足');
  });

  it('calls updateDoc with deducted gems and new box instance', async () => {
    const kid = makeKid({ gems: 20 });
    const box = makeBox({ costGems: 10 });
    useStore.setState({ currentUser: kid, users: [kid], treasureBoxes: [box] });

    await useStore.getState().purchaseTreasureBox('box1');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    const updatedUser = (payload.users as User[]).find(u => u.id === 'kid1');
    expect(updatedUser?.gems).toBe(10); // 20 - 10
    expect(updatedUser?.ownedBoxes).toHaveLength(1);
    expect(updatedUser?.ownedBoxes?.[0].boxId).toBe('box1');
  });

  it('stores the correct box name in the instance', async () => {
    const kid = makeKid({ gems: 20 });
    const box = makeBox({ costGems: 10, name: '黃金寶箱' });
    useStore.setState({ currentUser: kid, users: [kid], treasureBoxes: [box] });

    await useStore.getState().purchaseTreasureBox('box1');

    const [, payload] = mockUpdateDoc.mock.calls[0];
    const updatedUser = (payload.users as User[]).find(u => u.id === 'kid1');
    expect(updatedUser?.ownedBoxes?.[0].boxName).toBe('黃金寶箱');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// openOwnedBox
// ─────────────────────────────────────────────────────────────────────────────
describe('openOwnedBox', () => {
  const INSTANCE_ID = 'inst-abc';

  it('throws when box instance not found in ownedBoxes', async () => {
    const kid = makeKid({ ownedBoxes: [] });
    useStore.setState({ currentUser: kid });
    await expect(useStore.getState().openOwnedBox('missing-inst'))
      .rejects.toThrow('找不到此寶箱實例');
  });

  it('throws when underlying box definition was deleted', async () => {
    const kid = makeKid({
      ownedBoxes: [{ instanceId: INSTANCE_ID, boxId: 'box1', boxName: '冒險箱', obtainedAt: new Date().toISOString() }],
    });
    useStore.setState({ currentUser: kid, treasureBoxes: [] }); // no box definition
    await expect(useStore.getState().openOwnedBox(INSTANCE_ID))
      .rejects.toThrow('寶箱資料不存在');
  });

  it('returns wonItemName and isPhysical=false for a virtual item', async () => {
    const kid = makeKid({
      ownedBoxes: [{ instanceId: INSTANCE_ID, boxId: 'box1', boxName: '冒險箱', obtainedAt: new Date().toISOString() }],
    });
    const box = makeBox({
      items: [{ id: 'item1', name: '🗡️ 短劍', probability: 100 }], // 100% chance
    });
    useStore.setState({ currentUser: kid, users: [kid], treasureBoxes: [box] });

    const result = await useStore.getState().openOwnedBox(INSTANCE_ID);

    expect(result.wonItemName).toBe('🗡️ 短劍');
    expect(result.isPhysical).toBe(false);
  });

  it('removes the used box instance from ownedBoxes in Firestore update', async () => {
    const kid = makeKid({
      ownedBoxes: [{ instanceId: INSTANCE_ID, boxId: 'box1', boxName: '冒險箱', obtainedAt: new Date().toISOString() }],
    });
    const box = makeBox({ items: [{ id: 'item1', name: '🗡️ 短劍', probability: 100 }] });
    useStore.setState({ currentUser: kid, users: [kid], treasureBoxes: [box] });

    await useStore.getState().openOwnedBox(INSTANCE_ID);

    const [, payload] = mockUpdateDoc.mock.calls[0];
    const updatedUser = (payload.users as User[]).find(u => u.id === 'kid1');
    expect(updatedUser?.ownedBoxes).toHaveLength(0);
  });

  it('adds item to inventory for non-physical, non-virtual items', async () => {
    const kid = makeKid({
      ownedBoxes: [{ instanceId: INSTANCE_ID, boxId: 'box1', boxName: '冒險箱', obtainedAt: new Date().toISOString() }],
    });
    const box = makeBox({
      // No expReward, no gemReward, not physical → goes to inventory
      items: [{ id: 'item1', name: '🗡️ 短劍', probability: 100 }],
    });
    useStore.setState({ currentUser: kid, users: [kid], treasureBoxes: [box] });

    await useStore.getState().openOwnedBox(INSTANCE_ID);

    const [, payload] = mockUpdateDoc.mock.calls[0];
    const updatedUser = (payload.users as User[]).find(u => u.id === 'kid1');
    const swordEntry = updatedUser?.inventory?.find(i => i.name === '🗡️ 短劍');
    expect(swordEntry?.quantity).toBe(1);
  });

  it('creates a treasureClaim for physical items', async () => {
    const kid = makeKid({
      ownedBoxes: [{ instanceId: INSTANCE_ID, boxId: 'box1', boxName: '冒險箱', obtainedAt: new Date().toISOString() }],
    });
    const box = makeBox({
      items: [{ id: 'item1', name: '🎮 實體玩具', probability: 100, isPhysical: true }],
    });
    useStore.setState({ currentUser: kid, users: [kid], treasureBoxes: [box], treasureClaims: [] });

    await useStore.getState().openOwnedBox(INSTANCE_ID);

    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.treasureClaims).toHaveLength(1);
    expect((payload.treasureClaims as { itemName: string }[])[0].itemName).toBe('🎮 實體玩具');
  });

  it('applies EXP reward when item has expReward', async () => {
    const kid = makeKid({
      exp: 0, level: 1,
      ownedBoxes: [{ instanceId: INSTANCE_ID, boxId: 'box1', boxName: '冒險箱', obtainedAt: new Date().toISOString() }],
    });
    const box = makeBox({
      items: [{ id: 'item1', name: '⭐ 星光', probability: 100, expReward: 50 }],
    });
    useStore.setState({ currentUser: kid, users: [kid], treasureBoxes: [box] });

    const result = await useStore.getState().openOwnedBox(INSTANCE_ID);

    expect(result.expReward).toBe(50);
    // Also verify user EXP was updated in the Firestore payload
    const [, payload] = mockUpdateDoc.mock.calls[0];
    const updatedUser = (payload.users as User[]).find(u => u.id === 'kid1');
    expect(updatedUser?.exp).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// approveQuestWithFeedback
// ─────────────────────────────────────────────────────────────────────────────
describe('approveQuestWithFeedback', () => {
  it('does nothing when familyId is null', async () => {
    useStore.setState({ familyId: null });
    await useStore.getState().approveQuestWithFeedback('q1', 'good', '⭐', '', 1, 1, 1);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('does nothing when quest not found', async () => {
    useStore.setState({ quests: [] });
    await useStore.getState().approveQuestWithFeedback('q1', 'good', '⭐', '', 1, 1, 1);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('does nothing when quest already completed', async () => {
    const quest = makeQuest({ status: 'completed' });
    useStore.setState({ quests: [quest] });
    await useStore.getState().approveQuestWithFeedback('q1', 'good', '⭐', '', 1, 1, 1);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('marks quest as completed in Firestore', async () => {
    const quest = makeQuest();
    const kid = makeKid();
    useStore.setState({ quests: [quest], users: [kid], envelopes: [] });

    await useStore.getState().approveQuestWithFeedback('q1', 'good', '⭐', '做得好', 1, 1, 1);

    // batch.update should have been called for the quest doc
    const questUpdate = mockBatchUpdate.mock.calls.find(([ref]) => typeof ref === 'string' && ref.includes('quests'));
    expect(questUpdate?.[1].status).toBe('completed');
  });

  it('applies expMult to actualExp', async () => {
    const quest = makeQuest({ expReward: 100 });
    const kid = makeKid();
    useStore.setState({ quests: [quest], users: [kid], envelopes: [] });

    await useStore.getState().approveQuestWithFeedback('q1', 'great', '🌟', '', 1.5, 1, 1);

    const questUpdate = mockBatchUpdate.mock.calls.find(([ref]) => typeof ref === 'string' && ref.includes('quests'));
    expect(questUpdate?.[1].feedback.actualExp).toBe(150); // 100 * 1.5
  });

  it('creates a transaction when moneyReward > 0', async () => {
    const quest = makeQuest({ moneyReward: 50 });
    const kid = makeKid();
    const spendEnv = makeEnvelope({ type: 'spendable' });
    useStore.setState({ quests: [quest], users: [kid], envelopes: [spendEnv] });

    await useStore.getState().approveQuestWithFeedback('q1', 'good', '⭐', '', 1, 1, 1);

    expect(mockAddDoc).toHaveBeenCalledOnce();
    const [, txData] = mockAddDoc.mock.calls[0];
    expect(txData.amount).toBe(50);
    expect(txData.status).toBe('approved');
  });

  it('does NOT create a transaction when moneyMult=0', async () => {
    const quest = makeQuest({ moneyReward: 50 });
    const kid = makeKid();
    const spendEnv = makeEnvelope({ type: 'spendable' });
    useStore.setState({ quests: [quest], users: [kid], envelopes: [spendEnv] });

    await useStore.getState().approveQuestWithFeedback('q1', 'good', '⭐', '', 1, 0, 1);

    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('increments questsCount in user stats', async () => {
    const quest = makeQuest();
    const kid = makeKid({ stats: { questsCount: 3, totalGemsEarned: 0, consecutiveRecordDays: 0, lastRecordDate: null, consecutiveAllQuestsDays: 0, lastAllQuestsDay: null, consecutiveAllQuestsWeeks: 0, lastAllQuestsWeek: null } });
    useStore.setState({ quests: [quest], users: [kid], envelopes: [] });

    await useStore.getState().approveQuestWithFeedback('q1', 'good', '⭐', '', 1, 1, 1);

    const familyUpdate = mockBatchUpdate.mock.calls.find(([ref]) => typeof ref === 'string' && ref.includes('families'));
    const updatedUser = (familyUpdate?.[1].users as User[])?.find(u => u.id === 'kid1');
    expect(updatedUser?.stats?.questsCount).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// manualDistributeAllowance
// ─────────────────────────────────────────────────────────────────────────────
describe('manualDistributeAllowance', () => {
  it('distributes to all non-hidden kids when targetKidId is "all"', async () => {
    const kid1 = makeKid({ id: 'kid1' });
    const kid2 = makeKid({ id: 'kid2', name: '小花' });
    const env1 = makeEnvelope({ id: 'env1', ownerId: 'kid1', type: 'spendable' });
    const env2 = makeEnvelope({ id: 'env2', ownerId: 'kid2', type: 'spendable' });
    useStore.setState({ users: [kid1, kid2], envelopes: [env1, env2] });

    await useStore.getState().manualDistributeAllowance('all', 100, 100);

    // Should create 2 transactions (one per kid, 100% spendable)
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
  });

  it('skips hidden kids', async () => {
    const kid = makeKid({ isHidden: true });
    const env = makeEnvelope({ type: 'spendable' });
    useStore.setState({ users: [kid], envelopes: [env] });

    await useStore.getState().manualDistributeAllowance('all', 100, 100);

    expect(mockBatchSet).not.toHaveBeenCalled();
  });

  it('sends only to the specified kid', async () => {
    const kid1 = makeKid({ id: 'kid1' });
    const kid2 = makeKid({ id: 'kid2', name: '小花' });
    const env1 = makeEnvelope({ id: 'env1', ownerId: 'kid1' });
    const env2 = makeEnvelope({ id: 'env2', ownerId: 'kid2' });
    useStore.setState({ users: [kid1, kid2], envelopes: [env1, env2] });

    await useStore.getState().manualDistributeAllowance('kid1', 200, 100);

    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchSet.mock.calls[0][1].envelopeId).toBe('env1');
  });
});
