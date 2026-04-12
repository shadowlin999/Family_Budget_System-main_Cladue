import React, { useState, useMemo } from 'react';
import { useStore, calculateExpToNextLevel, calculateLevelProgress } from '../store/index';
import type { TreasureClaim, Quest } from '../store/index';
import { Wallet, TrendingUp, Target, Award, Gift, Sparkles, Info, ChevronRight, ChevronLeft, MessageSquare, GripVertical, Package, ArrowRightLeft, Lock } from 'lucide-react';
import { DigitalClock } from '../components/DigitalClock';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableSection: React.FC<{ id: string; emoji: string; title: string; defaultOpen?: boolean; isDraggable?: boolean; children: React.ReactNode }> = ({ id, emoji, title, defaultOpen = true, isDraggable = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled: !isDraggable });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="bg-slate-900/40 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl w-full">
      <div className="flex flex-col bg-black/20">
        <div className="flex items-center">
          {isDraggable && (
            <div {...attributes} {...listeners} className="p-3 text-slate-500 hover:text-white cursor-grab active:cursor-grabbing border-r border-white/5">
              <GripVertical size={20} />
            </div>
          )}
          <button onClick={() => setIsOpen(!isOpen)} className="flex-1 flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left font-black">
            <div className="flex items-center gap-3">
              <span className="text-2xl drop-shadow-md">{emoji}</span>
              <span className="text-base tracking-wide drop-shadow-sm">{title}</span>
            </div>
            <span className="text-xs text-muted font-normal bg-black/30 px-2 py-1 rounded-full border border-white/5">
              {isOpen ? '收起' : '展開'}
            </span>
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="p-4 sm:p-5 border-t border-white/5 bg-gradient-to-b from-transparent to-black/20">
          {children}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────
// Type for a unified adventure log entry (quest reward OR treasure draw)
// ──────────────────────────────────────────────────────────
interface AdventureLogEntry {
  id: string;
  type: 'quest' | 'treasure';
  timestamp: string;
  // quest fields
  icon?: string;
  title?: string;
  status?: string;
  feedbackEmoji?: string;
  feedbackComment?: string;
  expReward?: number;
  moneyReward?: number;
  gemReward?: number;
  // treasure fields
  boxName?: string;
  itemName?: string;
  itemIsPhysical?: boolean;
  itemExpReward?: number;
  itemGemReward?: number;
  claimStatus?: TreasureClaim['status'];
}

const KidDashboard: React.FC = () => {
  const {
    currentUser, envelopes, quests, transactions, expenseCategories,
    badges, treasureBoxes, treasureClaims, gamificationSettings,
    purchaseTreasureBox, openOwnedBox, addTransaction, submitQuest, timezoneOffset = 480,
    currencySymbol, transferMoney,
    setUserPin,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'badges' | 'treasure'>('dashboard');

  // Expense
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [selectedEnvId, setSelectedEnvId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Transfer (kid: spendable → investing only)
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Chest open result
  const [isOpening, setIsOpening] = useState(false);
  const [openingInstanceId, setOpeningInstanceId] = useState<string | null>(null); // which instance is being opened
  const [purchasingBoxId, setPurchasingBoxId] = useState<string | null>(null); // which box is in purchase flow
  interface DrawResult {
    wonItemName: string;
    isPhysical: boolean;
    expReward?: number;
    gemReward?: number;
  }
  const [drawResult, setDrawResult] = useState<DrawResult | null>(null);
  // PIN change
  const [newPin, setNewPin] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);
  const [pinChangeError, setPinChangeError] = useState('');

  // Week View
  const [weekOffset, setWeekOffset] = useState(0);

  // DnD Order (removed quests_daily)
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`kid_section_order_${currentUser?.id}`);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        // Remove quests_daily, ensure transaction_log exists
        const filtered = parsed.filter((id: string) => id !== 'quests_daily');
        if (!filtered.includes('transaction_log')) filtered.push('transaction_log');
        if (!filtered.includes('log')) filtered.push('log');
        if (!filtered.includes('settings')) filtered.push('settings');
        return filtered;
      }
    } catch { /* ignore parse errors, use default order */ }
    return ['wallet', 'expense', 'transfer', 'quests_flash', 'quests_weekly', 'log', 'transaction_log', 'settings'];
  });

  // ── Derived data: must be before early return (Rules of Hooks) ───────────────
  // Wrapped in useMemo so the reference is stable and doesn't cause downstream useMemo to re-run
  const myQuests = useMemo(
    () => (currentUser ? quests.filter(q => q.ownerId === currentUser.id) : []),
    [quests, currentUser],
  );

  // Week quest computation — placed here so useMemo hooks below are unconditional
  const getWeekRange = (offset: number) => {
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dow + 6) % 7) + offset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  };
  const { monday: weekStart } = getWeekRange(weekOffset);
  const weekStartStr = weekStart.toDateString(); // stable string for useMemo dep
  const DAYS_TW = ['一', '二', '三', '四', '五', '六', '日'];

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
    // weekStart changes only when weekOffset changes; weekStartStr captures that
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [weekStartStr]);

  const weekQuests = useMemo(() => myQuests.filter(q => {
    if (!q.title.startsWith('(例行)')) return false;
    const start = new Date(weekStartStr);
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    const created = q.createdAt ? new Date(q.createdAt) : null;
    const due = q.dueDate ? new Date(q.dueDate) : null;
    return (created && created >= start && created <= end) || (due && due >= start && due <= end);
  }), [myQuests, weekStartStr]);

  // ── Build unified adventure log ─────────────────────────────
  const adventureLog = useMemo<AdventureLogEntry[]>(() => {
    if (!currentUser) return [];
    const entries: AdventureLogEntry[] = [];

    // 1. All completed / rejected / delayed quests for this kid
    myQuests
      .filter(q => q.status === 'completed' || q.status === 'rejected' || q.status === 'delayed')
      .forEach(q => {
        entries.push({
          id: `quest-${q.id}`,
          type: 'quest',
          timestamp: q.feedback?.timestamp || q.createdAt || '',
          icon: q.icon,
          title: q.title,
          status: q.status,
          feedbackEmoji: q.feedback?.emoji,
          feedbackComment: q.feedback?.comment,
          expReward: q.feedback?.actualExp ?? q.expReward,
          moneyReward: q.feedback?.actualMoney ?? q.moneyReward,
          gemReward: q.feedback?.actualGems ?? q.gemReward,
        });
      });

    // 2. Treasure claims for this kid
    (treasureClaims || [])
      .filter(c => c.userId === currentUser.id)
      .forEach(c => {
        const box = treasureBoxes.find(b => b.id === c.boxId);
        const wonItem = box?.items.find(it => it.id === c.itemId);
        entries.push({
          id: `claim-${c.id}`,
          type: 'treasure',
          timestamp: c.timestamp,
          boxName: c.boxName,
          itemName: c.itemName,
          itemIsPhysical: wonItem?.isPhysical ?? false,
          itemExpReward: wonItem?.expReward,
          itemGemReward: wonItem?.gemReward,
          claimStatus: c.status,
        });
      });

    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 30);
  }, [myQuests, treasureClaims, currentUser, treasureBoxes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setSectionOrder(items => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over!.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        if (currentUser) {
          localStorage.setItem(`kid_section_order_${currentUser.id}`, JSON.stringify(newOrder));
        }
        return newOrder;
      });
    }
  };

  if (!currentUser) return null;

  const myEnvelopes = envelopes.filter(e => e.ownerId === currentUser.id && !e.isHidden);
  const spendableEnvelopes = myEnvelopes.filter(e => e.type === 'spendable');
  const investingEnvelopes = myEnvelopes.filter(e => e.type === 'investing');
  const myTransactions = transactions.filter(t => myEnvelopes.find(e => e.id === t.envelopeId));

  const unlockedBadges = badges.filter(b => (currentUser.unlockedBadges || []).includes(b.id));

  const formula = gamificationSettings?.levelFormula || 'Math.floor(exp / 100) + 1';
  const expToNextLevel = calculateExpToNextLevel(currentUser.exp, formula);
  const { progressPercent, currentLevelStartExp, nextLevelStartExp } = calculateLevelProgress(currentUser.exp, formula);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError(null);
    if (!selectedEnvId || !expenseAmount) return;
    const amount = Number(expenseAmount);
    // Feature 7: Validation - must be positive and not exceed envelope balance
    if (amount <= 0) {
      setExpenseError('花費金額必須大於 0！');
      return;
    }
    const env = myEnvelopes.find(e => e.id === selectedEnvId);
    if (env && amount > env.balance) {
      setExpenseError(`金額超出「${env.name}」的餘額（目前剩餘 ${currencySymbol}${env.balance}）`);
      return;
    }
    addTransaction(selectedEnvId, -amount, expenseNote || '一般消費', selectedCategoryId || undefined);
    setExpenseAmount(''); setExpenseNote(''); setSelectedCategoryId(''); setExpenseError(null);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);
    const amount = Number(transferAmount);
    if (!transferFromId || !transferToId) { setTransferError('請選擇轉出與轉入信封'); return; }
    if (transferFromId === transferToId) { setTransferError('轉出與轉入信封不能相同'); return; }
    if (amount <= 0) { setTransferError('轉帳金額必須大於 0'); return; }
    const fromEnv = myEnvelopes.find(e => e.id === transferFromId);
    if (fromEnv && amount > fromEnv.balance) {
      setTransferError(`「${fromEnv.name}」餘額不足（目前剩餘 ${currencySymbol}${fromEnv.balance}）`);
      return;
    }
    setIsTransferring(true);
    try {
      await transferMoney(transferFromId, transferToId, amount, transferNote || '累積資金');
      setTransferAmount(''); setTransferNote(''); setTransferError(null);
    } catch (err) {
      setTransferError((err as Error)?.message || '轉帳失敗');
    } finally {
      setIsTransferring(false);
    }
  };

  // Purchase a box (deduct gems, add to ownedBoxes)
  const handlePurchaseBox = async (boxId: string) => {
    setPurchasingBoxId(boxId);
    try {
      await purchaseTreasureBox(boxId);
    } catch (err) {
      alert((err as Error)?.message || '購買失敗');
    } finally {
      setPurchasingBoxId(null);
    }
  };

  // Open an already-owned box instance
  const handleOpenOwnedBox = async (instanceId: string) => {
    setOpeningInstanceId(instanceId);
    setIsOpening(true);
    try {
      const res = await openOwnedBox(instanceId);
      setDrawResult(res);
    } catch (err) {
      alert((err as Error)?.message || '開箱失敗');
    } finally {
      setIsOpening(false);
      setOpeningInstanceId(null);
    }
  };

  const flashQuests = myQuests.filter(q => !q.title.startsWith('(例行)') && (q.status === 'open' || q.status === 'pending_approval'));

  const renderSection = (id: string) => {
    switch (id) {
      case 'wallet':
        return (
          <SortableSection key="wallet" id="wallet" emoji="💰" title="我的錢包與儲蓄" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              {spendableEnvelopes.map(env => (
                <div key={env.id} className="glass-card hover:border-primary/40 transition-colors p-4 relative overflow-hidden group">
                  <div className="absolute -right-2 -top-2 text-primary/5 group-hover:text-primary/10 transition-colors"><Wallet size={64} /></div>
                  <div className="text-sm font-bold text-muted mb-1 relative z-10">{env.name}</div>
                  <div className="text-3xl font-black text-primary relative z-10">{currencySymbol}{env.balance}</div>
                </div>
              ))}
            </div>
            {investingEnvelopes.length > 0 && (
              <div className="mt-4 border-t border-white/5 pt-4">
                <div className="text-xs text-muted font-bold mb-3 flex items-center gap-1.5"><TrendingUp size={14} /> 儲蓄與投資區塊</div>
                <div className="grid grid-cols-2 gap-4">
                  {investingEnvelopes.map(env => (
                    <div key={env.id} className="glass-card p-4 text-center border-l-4 border-l-success">
                      <div className="text-sm font-bold text-muted mb-1">{env.name}</div>
                      <div className="text-2xl font-black text-success">{currencySymbol}{env.balance}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SortableSection>
        );

      case 'expense':
        return (
          <SortableSection key="expense" id="expense" emoji="📝" title="紀錄新支出" defaultOpen={false}>
            <form onSubmit={handleAddExpense} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] text-muted ml-1 mb-1 block">扣款信封</label>
                  <select className="bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white w-full" value={selectedEnvId} onChange={e => { setSelectedEnvId(e.target.value); setExpenseError(null); }} required>
                    <option value="">選擇...</option>
                    {spendableEnvelopes.map(env => <option key={env.id} value={env.id}>{env.name} ({currencySymbol}{env.balance})</option>)}
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] text-muted ml-1 mb-1 block">花費類別</label>
                  <select className="bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white w-full" value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}>
                    <option value="">(選填)</option>
                    {expenseCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <input
                    type="number" placeholder="金額" min="0.01" step="0.01"
                    className={`bg-slate-900/70 border rounded-xl px-3 py-2 text-sm text-white w-full transition-colors ${expenseError ? 'border-red-500/60 focus:border-red-500' : 'border-white/10'}`}
                    value={expenseAmount}
                    onChange={e => { setExpenseAmount(e.target.value); setExpenseError(null); }}
                    required
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <input type="text" placeholder="備註內容" className="bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white w-full" value={expenseNote} onChange={e => setExpenseNote(e.target.value)} />
                </div>
              </div>
              {expenseError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-red-400">
                  <span>⚠️</span><span>{expenseError}</span>
                </div>
              )}
              <button type="submit" className="w-full bg-primary/20 hover:bg-primary/30 text-primary py-2 rounded-xl font-bold transition-colors">確認送出</button>
            </form>
          </SortableSection>
        );

      case 'quests_flash':
        return (
          <SortableSection key="quests_flash" id="quests_flash" emoji="⚡" title="冒險任務快報" defaultOpen={true}>
            {flashQuests.length === 0 ? (
              <div className="text-center text-muted py-4 text-sm bg-white/5 rounded-xl">目前沒有進行中的快報任務</div>
            ) : (
              <div className="flex flex-col gap-2">
                {flashQuests.map(q => renderQuestCard(q))}
              </div>
            )}
          </SortableSection>
        );

      case 'quests_weekly':
        return (
          <SortableSection key="quests_weekly" id="quests_weekly" emoji="🗺️" title="冒險任務週報" defaultOpen={true}>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white transition-colors"><ChevronLeft size={16} /></button>
              <span className="text-xs text-muted flex-1 text-center font-bold">
                {weekOffset === 0 ? '本週' : weekOffset === -1 ? '上週' : `${weekStart.getMonth() + 1}/${weekStart.getDate()} 週`}
              </span>
              <button onClick={() => setWeekOffset(w => Math.min(w + 1, 0))} disabled={weekOffset >= 0} className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white transition-colors disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted mb-1">
              {DAYS_TW.map(d => <div key={d}>週{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 mb-4">
              {weekDays.map((day, i) => {
                const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
                const dq = weekQuests.filter(q => {
                  const c = q.createdAt ? new Date(q.createdAt) : null;
                  const du = q.dueDate ? new Date(q.dueDate) : null;
                  return (c && c >= dayStart && c <= dayEnd) || (du && du >= dayStart && du <= dayEnd);
                });
                const done = dq.filter(q => q.status === 'completed').length;
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={i} className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border ${isToday ? 'border-primary/50 bg-primary/10' : 'border-white/5 bg-white/5'}`}>
                    <span className={`text-[10px] font-bold ${isToday ? 'text-primary' : 'text-muted'}`}>{day.getDate()}</span>
                    {dq.length === 0 ? <span className="text-slate-600 text-xs">—</span>
                      : done === dq.length ? <span className="text-green-400 text-base">✅</span>
                        : <span className="text-amber-400 text-[10px] font-bold">{done}/{dq.length}</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              {weekQuests.length === 0 ? <div className="text-center text-muted py-4 text-sm bg-white/5 rounded-xl">本週無任務紀綠</div> : weekQuests.map(q => renderQuestCard(q))}
            </div>
          </SortableSection>
        );

      case 'log':
        return (
          <SortableSection key="log" id="log" emoji="📖" title="冒險日誌" defaultOpen={true}>
            {adventureLog.length === 0 ? (
              <div className="text-center text-muted py-4 text-sm bg-white/5 rounded-xl">尚無冒險紀錄</div>
            ) : (
              <div className="divide-y divide-white/5 border-l-2 border-amber-400/50 pl-3">
                {adventureLog.map(entry => {
                  if (entry.type === 'quest') {
                    return (
                      <div key={entry.id} className="py-2.5 flex items-start gap-3">
                        <span className="text-xl flex-shrink-0 mt-0.5">{entry.feedbackEmoji || (entry.status === 'completed' ? '✅' : entry.status === 'rejected' ? '❌' : '⏳')}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-muted truncate">{entry.icon || '📜'} {entry.title}</div>
                          {entry.feedbackComment && (
                            <div className="text-sm text-white mt-0.5 flex items-center gap-1.5">
                              <MessageSquare size={11} className="text-amber-400 flex-shrink-0" />
                              <span>{entry.feedbackComment}</span>
                            </div>
                          )}
                          <div className="flex gap-2 text-[10px] mt-1 flex-wrap">
                            {entry.status === 'completed' && <>
                              {(entry.expReward ?? 0) > 0 && <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">⭐ +{entry.expReward} EXP</span>}
                              {(entry.moneyReward ?? 0) > 0 && <span className="bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded">💰 +${entry.moneyReward}</span>}
                              {(entry.gemReward ?? 0) > 0 && <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">💎 +{entry.gemReward}</span>}
                            </>}
                            {entry.status === 'rejected' && <span className="text-red-400">❌ 任務被拒絕</span>}
                            {entry.status === 'delayed' && <span className="text-orange-400">⏳ 任務延期</span>}
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-500 flex-shrink-0 mt-0.5">{entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('zh-TW') : ''}</div>
                      </div>
                    );
                  } else {
                    // treasure entry
                    return (
                      <div key={entry.id} className="py-2.5 flex items-start gap-3">
                        <span className="text-xl flex-shrink-0 mt-0.5">🎁</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-muted">開箱 · {entry.boxName}</div>
                          <div className="text-sm text-white mt-0.5">獲得：{entry.itemName}</div>
                          <div className="flex gap-2 text-[10px] mt-1 flex-wrap">
                            {entry.itemIsPhysical && (
                              <span className={`px-1.5 py-0.5 rounded ${entry.claimStatus === 'approved' ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                {entry.claimStatus === 'approved' ? '✅ 實體獎勵已發放' : '⏳ 實體獎勵審核中'}
                              </span>
                            )}
                            {(entry.itemExpReward ?? 0) > 0 && <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">⭐ +{entry.itemExpReward} EXP</span>}
                            {(entry.itemGemReward ?? 0) > 0 && <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">💎 +{entry.itemGemReward}</span>}
                            {!entry.itemIsPhysical && !entry.itemExpReward && !entry.itemGemReward && (
                              <span className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">📦 道具已入庫</span>
                            )}
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-500 flex-shrink-0 mt-0.5">{entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('zh-TW') : ''}</div>
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </SortableSection>
        );

      case 'transaction_log':
        return (
          <SortableSection key="transaction_log" id="transaction_log" emoji="📝" title="交易日誌" defaultOpen={false}>
            <div className="flex flex-col gap-2 mt-2">
              <div className="divide-y divide-white/5 bg-white/5 px-4 rounded-2xl">
                {myTransactions.slice(0, 5).map(tx => {
                  const cat = expenseCategories.find(c => c.id === tx.categoryId);
                  return (
                    <div key={tx.id} className="flex justify-between items-center py-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{cat ? cat.icon + ' ' : ''}{tx.note}</span>
                          {tx.status === 'pending' && <span className="bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded font-bold">待核准</span>}
                          {tx.status === 'rejected' && <span className="bg-red-500/20 text-red-400 text-[9px] px-1.5 py-0.5 rounded font-bold">已駁回</span>}
                        </div>
                        <span className="text-[10px] text-muted">{new Date(tx.timestamp).toLocaleString()}</span>
                      </div>
                      <span className={`font-black ${tx.amount < 0 ? 'text-error' : 'text-success'} ${tx.status === 'rejected' ? 'line-through opacity-50' : ''}`}>{tx.amount < 0 ? '' : '+'}{currencySymbol}{tx.amount}</span>
                    </div>
                  );
                })}
                {myTransactions.length === 0 && <div className="text-center py-6 text-muted text-sm">尚無交易紀錄</div>}
              </div>
            </div>
          </SortableSection>
        );

      case 'transfer':
        return (
          <SortableSection key="transfer" id="transfer" emoji="🏦" title="累積資金" defaultOpen={false}>
            <div className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
              <ArrowRightLeft size={14} />
              <span>只能從「可動用」信封存錢進「不可動 / 儲蓄」信封（單向）</span>
            </div>
            <form onSubmit={handleTransfer} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted ml-1 mb-1 block">轉出信封（可動用）</label>
                  <select
                    className="bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white w-full"
                    value={transferFromId}
                    onChange={e => { setTransferFromId(e.target.value); setTransferError(null); }}
                    required
                  >
                    <option value="">選擇...</option>
                    {spendableEnvelopes.map(env => <option key={env.id} value={env.id}>{env.name} ({currencySymbol}{env.balance})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted ml-1 mb-1 block">轉入信封（儲蓄）</label>
                  <select
                    className="bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white w-full"
                    value={transferToId}
                    onChange={e => { setTransferToId(e.target.value); setTransferError(null); }}
                    required
                  >
                    <option value="">選擇...</option>
                    {investingEnvelopes.map(env => <option key={env.id} value={env.id}>{env.name} ({currencySymbol}{env.balance})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted ml-1 mb-1 block">轉帳金額</label>
                  <input
                    type="number" min="0.01" step="0.01" placeholder="金額"
                    className={`bg-slate-900/70 border rounded-xl px-3 py-2 text-sm text-white w-full transition-colors ${transferError ? 'border-red-500/60' : 'border-white/10'}`}
                    value={transferAmount}
                    onChange={e => { setTransferAmount(e.target.value); setTransferError(null); }}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted ml-1 mb-1 block">備註（選填）</label>
                  <input type="text" placeholder="存入累積資金..." className="bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white w-full" value={transferNote} onChange={e => setTransferNote(e.target.value)} />
                </div>
              </div>
              {transferError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-red-400">
                  <span>⚠️</span><span>{transferError}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isTransferring || investingEnvelopes.length === 0 || spendableEnvelopes.length === 0}
                className="w-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 py-2 rounded-xl font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <ArrowRightLeft size={16} />
                {isTransferring ? '轉帳中...' : '確認存錢'}
              </button>
              {investingEnvelopes.length === 0 && <p className="text-xs text-center text-muted">目前沒有儲蓄信封可供轉入</p>}
            </form>
          </SortableSection>
        );
      case 'settings':
        return (
          <SortableSection key="settings" id="settings" emoji="🛡️" title="帳號安全設定" defaultOpen={false}>
            <div className="flex flex-col gap-6">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">修改認證 PIN 碼</h3>
                    <p className="text-xs text-muted">目前 PIN 碼：<span className="font-mono text-white/80">{currentUser?.pin || '0000'}</span></p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-5 text-center font-mono text-2xl tracking-[0.5em] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      placeholder="輸入新 PIN 碼 (4位數字)"
                      value={newPin}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setNewPin(val);
                        setPinChangeSuccess(false);
                        setPinChangeError('');
                      }}
                      maxLength={4}
                    />
                  </div>

                  {pinChangeError && <p className="text-red-400 text-xs font-bold text-center">⚠️ {pinChangeError}</p>}
                  {pinChangeSuccess && <p className="text-green-400 text-xs font-bold text-center">✅ 修改成功！下次登入請使用新 PIN 碼。</p>}

                  <button
                    onClick={async () => {
                      if (newPin.length !== 4) {
                        setPinChangeError('請輸入完整的 4 位數字');
                        return;
                      }
                      try {
                        await setUserPin(currentUser!.id, newPin);
                        setPinChangeSuccess(true);
                        setNewPin('');
                      } catch {
                        setPinChangeError('修改失敗，請稍後再試');
                      }
                    }}
                    disabled={newPin.length !== 4}
                    className={`w-full py-4 rounded-2xl font-bold transition-all ${newPin.length === 4 ? 'bg-primary text-white shadow-lg active:scale-95' : 'bg-white/5 text-slate-500 cursor-not-allowed'}`}
                  >
                    確認修改 PIN 碼
                  </button>
                </div>
              </div>
              
              <div className="text-[10px] text-muted leading-relaxed px-2 italic text-center">
                💡 提示：如果您忘記了 PIN 碼，請向家長詢問，家長可以在管理界面查看或幫您重設。
              </div>
            </div>
          </SortableSection>
        );

      default: return null;
    }
  };

  const renderQuestCard = (quest: Quest) => (
    <div key={quest.id} className={`glass-card relative overflow-hidden ${quest.status === 'completed' ? 'border-l-4 border-l-green-500' : quest.status === 'open' ? 'border-l-4 border-l-info' : quest.status === 'pending_approval' ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-red-500 opacity-70'}`}>
      <div className="flex justify-between items-start mb-1.5">
        <span className="font-black text-sm flex items-center gap-1.5"><span>{quest.icon || '📜'}</span> {quest.title}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${quest.status === 'open' ? 'bg-info/20 text-info' : quest.status === 'completed' ? 'bg-green-500/20 text-green-400' : quest.status === 'pending_approval' ? 'bg-amber-500/20 text-amber-400' : quest.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
          {quest.status === 'open' ? '執行中' : quest.status === 'completed' ? '✅ 完成' : quest.status === 'pending_approval' ? '⏳ 審核中' : quest.status === 'rejected' ? '❌ 拒絕' : '⏳ 延期'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[10px] mb-2">
        <span className="bg-white/10 px-2 py-0.5 rounded text-blue-300">⭐ {quest.expReward} EXP</span>
        {quest.moneyReward > 0 && <span className="bg-white/10 px-2 py-0.5 rounded text-green-300">💰 {currencySymbol}{quest.moneyReward}</span>}
        {(quest.gemReward || 0) > 0 && <span className="bg-white/10 px-2 py-0.5 rounded text-amber-300">💎 {quest.gemReward}</span>}
        {quest.dueDate && <span className="bg-white/5 px-2 py-0.5 rounded text-muted">截止: {quest.dueDate}</span>}
      </div>
      {quest.feedback?.comment && (
        <div className="flex items-center gap-2 text-xs text-muted bg-amber-500/5 border border-amber-500/10 rounded-lg px-2 py-1.5 mb-2">
          <span className="text-base flex-shrink-0">{quest.feedback.emoji || '💬'}</span><span className="italic">{quest.feedback.comment}</span>
        </div>
      )}
      {quest.status === 'open' && (
        <button className="btn btn-primary text-xs py-1.5 w-full flex items-center justify-center gap-1 mt-1" onClick={() => submitQuest(quest.id)}>
          完成任務 <ChevronRight size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto px-4 pb-20">
      <section className="glass-card overflow-hidden !p-0 shadow-lg">
        <div className="bg-gradient-to-r from-indigo-600/30 to-purple-600/30 p-5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="w-full flex justify-end mb-1"><DigitalClock timezoneOffset={timezoneOffset} isAdmin={false} /></div>
          <div className="flex items-center gap-5 w-full">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-xl border-4 border-white/20">{currentUser.name.charAt(0)}</div>
              <div className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full border-2 border-slate-900">Lv.{currentUser.level}</div>
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{currentUser.name}</h2>
              {currentUser.googleEmail && (
                <div className="text-[10px] text-indigo-300 font-medium opacity-80 mt-0.5 flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/></svg>
                  {currentUser.googleEmail}
                </div>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded text-sm border border-amber-400/20"><Sparkles size={14} fill="currentColor" /> 💎 {currentUser.gems || 0}</span>
                <span className="text-xs text-muted flex items-center gap-1"><Target size={12} /> 任務完成: {currentUser.stats?.questsCount || 0}</span>
              </div>
            </div>
          </div>
          <div className="w-full md:w-56 mt-2 md:mt-0 flex flex-col items-end gap-1">
            <div className="text-xs text-primary-light font-bold">距離下次升級還差 <span className="text-white">{expToNextLevel} EXP</span></div>
            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-muted">{currentLevelStartExp} → {nextLevelStartExp} EXP ({progressPercent}%)</div>
          </div>
        </div>
      </section>

      <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 sticky top-4 z-40 backdrop-blur-md">
        {(['dashboard', 'badges', 'treasure'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === t ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}>
            {t === 'dashboard' ? <><Wallet size={18} /> 儀表板</> : t === 'badges' ? <><Award size={18} /> 成就牆</> : <><Gift size={18} /> 寶物庫</>}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'dashboard' && (
          <div className="animate-in slide-in-from-bottom-4 fade-in duration-500 flex flex-col gap-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
                {sectionOrder.map(id => renderSection(id))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="animate-in zoom-in-95 fade-in duration-500">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-amber-400/20 text-amber-400 rounded-full flex items-center justify-center mb-2"><Award size={40} /></div>
              <h3 className="text-2xl font-black">我的成就牆</h3>
              <p className="text-sm text-muted">目前解鎖 {unlockedBadges.length} 個徽章</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {badges.map(b => {
                const un = (currentUser.unlockedBadges || []).includes(b.id);
                return (
                  <div key={b.id} className={`glass-card flex flex-col items-center gap-3 p-6 group transition-all relative ${un ? 'border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.1)]' : 'opacity-40 grayscale pointer-events-none'}`}>
                    <div className={`text-6xl mb-2 ${un ? 'group-hover:scale-110 duration-300' : ''}`}>{b.icon}</div>
                    <div className="text-center"><div className="font-black text-sm">{b.name}</div><div className="text-[10px] text-muted mt-1 px-2">{b.description}</div></div>
                    {!un && <div className="absolute inset-0 flex items-center justify-center"><div className="bg-slate-900/80 p-1.5 rounded-full"><Info size={16} /></div></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'treasure' && (
          <div className="animate-in zoom-in-95 fade-in duration-500 flex flex-col gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-fuchsia-500/20 text-fuchsia-400 rounded-full flex items-center justify-center mb-2 mx-auto"><Package size={40} /></div>
              <h3 className="text-2xl font-black">寶物庫</h3>
              <p className="text-sm text-muted">購買寶箱或開啟已取得的寶箱</p>
            </div>
            <div className="flex justify-center items-center gap-2 p-3 bg-white/5 rounded-2xl">
              <span className="text-muted">目前寶石</span>
              <span className="text-xl font-black text-amber-400 flex items-center gap-1"><Sparkles size={20} fill="currentColor" /> {currentUser.gems || 0}</span>
            </div>

            {/* ─── 我的寶箱（擁有區塊）─── */}
            {(currentUser.ownedBoxes && currentUser.ownedBoxes.length > 0) && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs font-bold text-fuchsia-400 flex items-center gap-1"><Gift size={14} /> 我的寶箱 ({currentUser.ownedBoxes.length})</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {currentUser.ownedBoxes.map(ob => {
                    const boxDef = treasureBoxes.find(b => b.id === ob.boxId);
                    const isThisOpening = openingInstanceId === ob.instanceId;
                    return (
                      <div key={ob.instanceId} className="relative overflow-hidden rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/5 flex flex-col items-center gap-3 p-4 text-center">
                        <div className={`text-5xl drop-shadow-xl ${isThisOpening ? 'animate-bounce' : 'animate-pulse'}`}>🎁</div>
                        <div className="text-sm font-black text-white">{ob.boxName}</div>
                        {boxDef && (
                          <div className="w-full text-left bg-white/5 rounded-xl p-2 text-[10px] space-y-1">
                            {boxDef.items.map(item => (
                              <div key={item.id} className="flex justify-between items-center text-muted">
                                <span>{item.isPhysical ? '📦' : item.expReward ? '⭐' : item.gemReward ? '💎' : '🎀'} {item.name}</span>
                                <span className="text-slate-500">{item.probability}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!boxDef && <div className="text-[10px] text-orange-400 bg-orange-400/10 px-2 py-1 rounded">寶箱資料已刪除</div>}
                        <button
                          disabled={isOpening || !boxDef}
                          onClick={() => handleOpenOwnedBox(ob.instanceId)}
                          className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${boxDef ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-lg' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                        >
                          {isThisOpening ? '開箱中...' : <><Sparkles size={16} fill="currentColor" /> 開展寶箱</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── 購買區塊 ─── */}
            {treasureBoxes.filter(b => b.purchasable !== false).length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs font-bold text-amber-400">💰 購買寶箱（消耗寶石）</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                {treasureBoxes.filter(b => b.purchasable !== false).map(box => {
                  const canAfford = (currentUser.gems || 0) >= box.costGems;
                  const isPurchasing = purchasingBoxId === box.id;
                  return (
                    <div key={box.id} className={`relative overflow-hidden rounded-3xl border transition-all duration-300 ${canAfford ? 'border-amber-400/30 bg-amber-400/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-400/10' : 'border-white/10 bg-black/40 grayscale opacity-60'}`}>
                      <div className="p-5 flex flex-col items-center gap-4 text-center">
                        <div className={`text-6xl drop-shadow-xl ${isPurchasing ? 'animate-bounce' : canAfford ? 'animate-pulse' : ''}`}>🎁</div>
                        <div><h4 className="text-xl font-black text-white">{box.name}</h4><p className="text-xs text-muted mt-1">消耗 {box.costGems} 寶石可購買一個</p></div>
                        {box.items.length > 0 && (
                          <div className="w-full text-left bg-white/5 rounded-xl p-3 text-xs space-y-1">
                            {box.items.map(item => (
                              <div key={item.id} className="flex justify-between items-center text-muted">
                                <span>{item.isPhysical ? '📦' : item.expReward ? '⭐' : item.gemReward ? '💎' : '🎀'} {item.name}</span>
                                <span className="text-[10px] text-slate-500">{item.probability}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          disabled={!canAfford || isPurchasing || isOpening}
                          onClick={() => handlePurchaseBox(box.id)}
                          className={`w-full py-4 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${canAfford ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 shadow-lg' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                        >
                          {isPurchasing ? '購買中...' : <><Sparkles size={18} fill="currentColor" /> 消耗 {box.costGems} 寶石購買</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* empty state */}
            {treasureBoxes.filter(b => b.purchasable !== false).length === 0 && (!currentUser.ownedBoxes || currentUser.ownedBoxes.length === 0) && (
              <div className="text-center text-muted py-12 text-sm bg-white/5 rounded-2xl">尚無寶箱可用🎁</div>
            )}
          </div>
        )}
      </div>

      {/* Draw result modal */}
      {drawResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-6 animate-in zoom-in-50 duration-500 spin-in-12">
            <h3 className="text-2xl font-black text-white">🎉 獲得獎勵！</h3>
            <div className="text-6xl animate-bounce">🎁</div>
            <div className="w-full flex flex-col gap-3">
              <div className="text-xl font-black text-amber-400 bg-amber-400/10 px-6 py-3 rounded-2xl border border-amber-400/30">{drawResult.wonItemName}</div>
              {((drawResult.expReward ?? 0) > 0 || (drawResult.gemReward ?? 0) > 0) && (
                <div className="flex gap-2 justify-center flex-wrap">
                  {(drawResult.expReward ?? 0) > 0 && <span className="bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-xl text-sm font-bold">⭐ +{drawResult.expReward} EXP</span>}
                  {(drawResult.gemReward ?? 0) > 0 && <span className="bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-xl text-sm font-bold">💎 +{drawResult.gemReward} 寶石</span>}
                </div>
              )}
              {drawResult.isPhysical && (
                <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 font-medium">
                  📦 此為實體獎勵，已通知家長審核，等待發放中
                </div>
              )}
            </div>
            <button onClick={() => setDrawResult(null)} className="w-full btn btn-primary py-3">太棒了！</button>
          </div>
        </div>
      )}
    </div>
  );
};
export default KidDashboard;
