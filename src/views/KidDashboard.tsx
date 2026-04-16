import React, { useState, useMemo } from 'react';
import { useStore, calculateExpToNextLevel, calculateLevelProgress } from '../store/index';
import type { TreasureClaim, Quest } from '../store/index';
import { Wallet, TrendingUp, Award, Gift, Sparkles, Info, ChevronRight, ChevronLeft, MessageSquare, Package, ArrowRightLeft, Lock, Swords, Plus, X } from 'lucide-react';
import { DigitalClock } from '../components/DigitalClock';
import AdventureZone from './adventure/AdventureZone';

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

// Simple collapsible section (no drag)
const Section: React.FC<{
  emoji: string; title: string; defaultOpen?: boolean;
  rightElement?: React.ReactNode; children: React.ReactNode;
}> = ({ emoji, title, defaultOpen = true, rightElement, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="section-block">
      <button className="section-block-header w-full text-left" onClick={() => setIsOpen(v => !v)}>
        <span className="text-2xl leading-none">{emoji}</span>
        <span className="font-black text-lg flex-1">{title}</span>
        {rightElement}
        <span className="text-xs text-muted font-normal bg-black/30 px-2.5 py-1 rounded-full border border-white/5 flex-shrink-0">
          {isOpen ? '收起' : '展開'}
        </span>
      </button>
      {isOpen && <div className="section-block-body">{children}</div>}
    </div>
  );
};

// Bottom sheet overlay
const BottomSheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="bottom-sheet-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="bottom-sheet">
      <div className="bottom-sheet-handle" />
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-[#0d1526] z-10">
        <h3 className="font-black text-lg">{title}</h3>
        <button onClick={onClose} className="p-2 text-muted hover:text-white rounded-xl hover:bg-white/10 transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const KidDashboard: React.FC = () => {
  const {
    currentUser, envelopes, quests, transactions, expenseCategories,
    badges, treasureBoxes, treasureClaims, gamificationSettings,
    purchaseTreasureBox, openOwnedBox, addTransaction, submitQuest, failQuest, timezoneOffset = 480,
    currencySymbol, transferMoney,
    setUserPin,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'badges' | 'treasure' | 'adventure'>('dashboard');

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
  const [openingInstanceId, setOpeningInstanceId] = useState<string | null>(null);
  const [purchasingBoxId, setPurchasingBoxId] = useState<string | null>(null);
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

  // Bottom sheet visibility
  const [showExpenseSheet, setShowExpenseSheet] = useState(false);
  const [showTransferSheet, setShowTransferSheet] = useState(false);
  const [showTxLogSheet, setShowTxLogSheet] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [questTab, setQuestTab] = useState<'flash' | 'weekly'>('flash');

  // ── Derived data: must be before early return (Rules of Hooks) ───────────────
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
  const weekStartStr = weekStart.toDateString();
  const DAYS_TW = ['一', '二', '三', '四', '五', '六', '日'];

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [weekStartStr]);

  const weekQuests = useMemo(() => myQuests.filter(q => {
    if (!q.title.startsWith('(例行)')) return false;
    if (q.status === 'failed') return false;
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

    myQuests
      .filter(q => q.status === 'completed' || q.status === 'rejected' || q.status === 'delayed' || q.status === 'failed')
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

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  if (!currentUser) return null;

  const myEnvelopes = envelopes.filter(e => e.ownerId === currentUser.id && !e.isHidden);
  const spendableEnvelopes = myEnvelopes.filter(e => e.type === 'spendable');
  const investingEnvelopes = myEnvelopes.filter(e => e.type === 'investing');
  const myTransactions = transactions.filter(t => myEnvelopes.find(e => e.id === t.envelopeId));

  const unlockedBadges = badges.filter(b => (currentUser.unlockedBadges || []).includes(b.id));

  const formula = gamificationSettings?.levelFormula || 'Math.floor(exp / 100) + 1';
  const expToNextLevel = calculateExpToNextLevel(currentUser.exp, formula);
  const { progressPercent } = calculateLevelProgress(currentUser.exp, formula);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError(null);
    if (!selectedEnvId || !expenseAmount) return;
    const amount = Number(expenseAmount);
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

  const flashQuests = myQuests.filter(q =>
    !q.title.startsWith('(例行)') &&
    (q.status === 'open' || q.status === 'pending_approval')
  );

  const renderQuestCard = (quest: Quest) => {
    const isOverdue = quest.status === 'open' && !!quest.dueDate && new Date(quest.dueDate) < todayStart;
    const borderClass = isOverdue
      ? 'border-l-4 border-l-red-500 opacity-80'
      : quest.status === 'completed' ? 'border-l-4 border-l-green-500'
      : quest.status === 'open' ? 'border-l-4 border-l-info'
      : quest.status === 'pending_approval' ? 'border-l-4 border-l-amber-400'
      : 'border-l-4 border-l-red-500 opacity-70';
    const badgeClass = isOverdue
      ? 'bg-red-500/20 text-red-400'
      : quest.status === 'open' ? 'bg-info/20 text-info'
      : quest.status === 'completed' ? 'bg-green-500/20 text-green-400'
      : quest.status === 'pending_approval' ? 'bg-amber-500/20 text-amber-400'
      : quest.status === 'rejected' ? 'bg-red-500/20 text-red-400'
      : 'bg-orange-500/20 text-orange-400';
    const badgeLabel = isOverdue ? '💀 任務失敗'
      : quest.status === 'open' ? '執行中'
      : quest.status === 'completed' ? '✅ 完成'
      : quest.status === 'pending_approval' ? '⏳ 審核中'
      : quest.status === 'rejected' ? '❌ 拒絕'
      : '⏳ 延期';

    return (
      <div key={quest.id} className={`glass-card relative overflow-hidden ${borderClass}`}>
        <div className="flex justify-between items-start mb-1.5">
          <span className="font-black text-sm flex items-center gap-1.5"><span>{quest.icon || '📜'}</span> {quest.title}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${badgeClass}`}>
            {badgeLabel}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] mb-2">
          <span className="bg-white/10 px-2 py-0.5 rounded text-blue-300">⭐ {quest.expReward} EXP</span>
          {quest.moneyReward > 0 && <span className="bg-white/10 px-2 py-0.5 rounded text-green-300">💰 {currencySymbol}{quest.moneyReward}</span>}
          {(quest.gemReward || 0) > 0 && <span className="bg-white/10 px-2 py-0.5 rounded text-amber-300">💎 {quest.gemReward}</span>}
          {quest.dueDate && <span className={`px-2 py-0.5 rounded ${isOverdue ? 'bg-red-500/10 text-red-300' : 'bg-white/5 text-muted'}`}>截止: {quest.dueDate}</span>}
        </div>
        {quest.feedback?.comment && (
          <div className="flex items-center gap-2 text-xs text-muted bg-amber-500/5 border border-amber-500/10 rounded-lg px-2 py-1.5 mb-2">
            <span className="text-base flex-shrink-0">{quest.feedback.emoji || '💬'}</span><span className="italic">{quest.feedback.comment}</span>
          </div>
        )}
        {isOverdue ? (
          <button
            className="btn text-xs py-1.5 w-full flex items-center justify-center gap-1 mt-1 bg-slate-600/60 hover:bg-slate-500/60 text-white border border-slate-500/30"
            onClick={() => failQuest(quest.id)}
          >
            💪 加油，下次一定可以！
          </button>
        ) : quest.status === 'open' ? (
          <button className="btn btn-primary text-xs py-1.5 w-full flex items-center justify-center gap-1 mt-1" onClick={() => submitQuest(quest.id)}>
            完成任務 <ChevronRight size={14} />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Top status bar ── */}
      <div className="kid-top-bar">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-base font-bold border-2 border-white/20">
            {currentUser.name.charAt(0)}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 bg-amber-400 text-slate-900 text-[9px] font-black px-1 py-0.5 rounded-full border border-slate-900 leading-none">
            {currentUser.level}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-base leading-tight truncate">{currentUser.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-700" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-[10px] text-muted flex-shrink-0">{expToNextLevel} EXP</span>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1.5 rounded-xl flex-shrink-0">
          <Sparkles size={14} className="text-amber-400" fill="currentColor" />
          <span className="font-black text-amber-400 text-sm">{currentUser.gems || 0}</span>
        </div>
        <button onClick={() => setShowSettingsSheet(true)} className="p-2 text-muted hover:text-white rounded-xl hover:bg-white/10 transition-colors flex-shrink-0" aria-label="帳號設定">
          <Lock size={18} />
        </button>
      </div>

      {/* ── Main scrollable content ── */}
      <div className="flex-1 pb-nav">

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="max-w-2xl mx-auto px-4 pt-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="flex justify-end">
              <DigitalClock timezoneOffset={timezoneOffset} isAdmin={false} />
            </div>

            {/* Wallet section */}
            <Section emoji="💰" title="我的錢包與儲蓄">
              <div className="envelope-scroll">
                {spendableEnvelopes.map(env => (
                  <div key={env.id} className="envelope-card">
                    <div className="absolute -right-2 -top-2 text-primary/5"><Wallet size={56} /></div>
                    <div className="text-xs font-bold text-muted mb-1 relative z-10">{env.name}</div>
                    <div className="text-3xl font-black text-primary relative z-10 leading-tight">{currencySymbol}{env.balance}</div>
                    <div className="text-[10px] text-muted mt-1 relative z-10">可動用</div>
                  </div>
                ))}
                {investingEnvelopes.map(env => (
                  <div key={env.id} className="envelope-card border-l-4 border-l-emerald-500/60">
                    <div className="absolute -right-2 -top-2 text-emerald-500/5"><TrendingUp size={56} /></div>
                    <div className="text-xs font-bold text-muted mb-1 relative z-10">{env.name}</div>
                    <div className="text-3xl font-black text-emerald-400 relative z-10 leading-tight">{currencySymbol}{env.balance}</div>
                    <div className="text-[10px] text-emerald-400/60 mt-1 relative z-10">儲蓄</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowTxLogSheet(true)} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-muted hover:text-white transition-colors">
                  📝 交易日誌
                </button>
                {investingEnvelopes.length > 0 && spendableEnvelopes.length > 0 && (
                  <button onClick={() => setShowTransferSheet(true)} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-sm font-bold text-indigo-300 transition-colors">
                    <ArrowRightLeft size={15} /> 累積資金
                  </button>
                )}
              </div>
            </Section>

            {/* Quest section (tabbed) */}
            <Section emoji="⚔️" title="冒險任務">
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1 mb-4">
                {([['flash', '⚡', '冒險任務快報'], ['weekly', '🗺️', '冒險任務週報']] as const).map(([t, em, label]) => (
                  <button key={t} onClick={() => setQuestTab(t)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${questTab === t ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-white'}`}>
                    {em} {label}
                  </button>
                ))}
              </div>
              {questTab === 'flash' && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-200">
                  {flashQuests.length === 0 ? (
                    <div className="text-center text-muted py-6 text-sm bg-white/5 rounded-xl">⚡ 目前沒有進行中的快報任務</div>
                  ) : flashQuests.map(q => renderQuestCard(q))}
                </div>
              )}
              {questTab === 'weekly' && (
                <div className="animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-xl hover:bg-white/10 text-muted hover:text-white transition-colors"><ChevronLeft size={18} /></button>
                    <span className="text-sm text-muted flex-1 text-center font-bold">
                      {weekOffset === 0 ? '本週' : weekOffset === -1 ? '上週' : `${weekStart.getMonth() + 1}/${weekStart.getDate()} 週`}
                    </span>
                    <button onClick={() => setWeekOffset(w => Math.min(w + 1, 0))} disabled={weekOffset >= 0} className="p-2 rounded-xl hover:bg-white/10 text-muted hover:text-white transition-colors disabled:opacity-30"><ChevronRight size={18} /></button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted mb-1">
                    {DAYS_TW.map(d => <div key={d}>週{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-4">
                    {weekDays.map((day, i) => {
                      const dayStart = new Date(day); dayStart.setHours(0,0,0,0);
                      const dayEnd = new Date(day); dayEnd.setHours(23,59,59,999);
                      const dq = weekQuests.filter(q => { const c = q.createdAt ? new Date(q.createdAt) : null; const du = q.dueDate ? new Date(q.dueDate) : null; return (c && c>=dayStart && c<=dayEnd)||(du && du>=dayStart && du<=dayEnd); });
                      const done = dq.filter(q => q.status === 'completed').length;
                      const isToday = day.toDateString() === new Date().toDateString();
                      return (
                        <div key={i} className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border ${isToday ? 'border-primary/50 bg-primary/10' : 'border-white/5 bg-white/5'}`}>
                          <span className={`text-[10px] font-bold ${isToday ? 'text-primary' : 'text-muted'}`}>{day.getDate()}</span>
                          {dq.length === 0 ? <span className="text-slate-600 text-xs">—</span> : done === dq.length ? <span className="text-green-400 text-base">✅</span> : <span className="text-amber-400 text-[10px] font-bold">{done}/{dq.length}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-3">
                    {weekQuests.length === 0 ? <div className="text-center text-muted py-6 text-sm bg-white/5 rounded-xl">🗺️ 本週無任務紀錄</div> : weekQuests.map(q => renderQuestCard(q))}
                  </div>
                </div>
              )}
            </Section>

            {/* Adventure log (5 entries) */}
            <Section emoji="📖" title="冒險日誌">
              {adventureLog.length === 0 ? (
                <div className="text-center text-muted py-6 text-sm bg-white/5 rounded-xl">尚無冒險紀錄</div>
              ) : (
                <div className="divide-y divide-white/5 border-l-2 border-amber-400/40 pl-3">
                  {adventureLog.slice(0, 5).map(entry => {
                    if (entry.type === 'quest') {
                      return (
                        <div key={entry.id} className="py-3 flex items-start gap-3">
                          <span className="text-xl flex-shrink-0 mt-0.5">{entry.feedbackEmoji || (entry.status === 'completed' ? '✅' : entry.status === 'rejected' ? '❌' : entry.status === 'failed' ? '💀' : '⏳')}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate">{entry.icon || '📜'} {entry.title}</div>
                            {entry.feedbackComment && <div className="text-sm text-white mt-0.5 flex items-center gap-1.5"><MessageSquare size={11} className="text-amber-400 flex-shrink-0" /><span className="italic">{entry.feedbackComment}</span></div>}
                            <div className="flex gap-2 text-xs mt-1 flex-wrap">
                              {entry.status === 'completed' && <>{(entry.expReward??0)>0&&<span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-lg">⭐ +{entry.expReward} EXP</span>}{(entry.moneyReward??0)>0&&<span className="bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded-lg">💰 +{currencySymbol}{entry.moneyReward}</span>}{(entry.gemReward??0)>0&&<span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-lg">💎 +{entry.gemReward}</span>}</>}
                              {entry.status==='rejected'&&<span className="text-red-400 text-xs">❌ 任務被拒絕</span>}
                              {entry.status==='delayed'&&<span className="text-orange-400 text-xs">⏳ 任務延期</span>}
                              {entry.status==='failed'&&<span className="text-red-400 text-xs">💀 任務失敗</span>}
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 flex-shrink-0 mt-0.5">{entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('zh-TW') : ''}</div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={entry.id} className="py-3 flex items-start gap-3">
                          <span className="text-xl flex-shrink-0 mt-0.5">🎁</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-muted">開箱 · {entry.boxName}</div>
                            <div className="text-sm text-white mt-0.5">獲得：{entry.itemName}</div>
                            <div className="flex gap-2 text-xs mt-1 flex-wrap">
                              {entry.itemIsPhysical && <span className={`px-1.5 py-0.5 rounded-lg ${entry.claimStatus==='approved'?'bg-green-500/20 text-green-300':'bg-amber-500/20 text-amber-300'}`}>{entry.claimStatus==='approved'?'✅ 實體獎勵已發放':'⏳ 實體獎勵審核中'}</span>}
                              {(entry.itemExpReward??0)>0&&<span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-lg">⭐ +{entry.itemExpReward} EXP</span>}
                              {(entry.itemGemReward??0)>0&&<span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-lg">💎 +{entry.itemGemReward}</span>}
                              {!entry.itemIsPhysical&&!entry.itemExpReward&&!entry.itemGemReward&&<span className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-lg">📦 道具已入庫</span>}
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 flex-shrink-0 mt-0.5">{entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('zh-TW') : ''}</div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* BADGES TAB */}
        {activeTab === 'badges' && (
          <div className="max-w-2xl mx-auto px-4 pt-4 animate-in zoom-in-95 fade-in duration-300">
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

        {/* TREASURE TAB */}
        {activeTab === 'treasure' && (
          <div className="max-w-2xl mx-auto px-4 pt-4 animate-in zoom-in-95 fade-in duration-300 flex flex-col gap-6">
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

        {/* ADVENTURE TAB */}
        {activeTab === 'adventure' && (
          <div className="max-w-2xl mx-auto px-4 pt-4 animate-in fade-in duration-300">
            <AdventureZone kidName={currentUser.name} />
          </div>
        )}
      </div>

      {/* Fixed bottom tab nav */}
      <nav className="bottom-nav">
        {([['dashboard', Wallet, '儀表板'], ['badges', Award, '成就牆'], ['treasure', Gift, '寶物庫'], ['adventure', Swords, '冒險區']] as const).map(([t, Icon, label]) => (
          <button key={t} className={`bottom-nav-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>

      {/* FAB - only on dashboard */}
      {activeTab === 'dashboard' && (
        <button className="fab" onClick={() => setShowExpenseSheet(true)} aria-label="紀錄新支出">
          <Plus size={26} />
        </button>
      )}

      {/* EXPENSE BOTTOM SHEET */}
      {showExpenseSheet && (
        <BottomSheet title="📝 紀錄新支出" onClose={() => { setShowExpenseSheet(false); setExpenseError(null); }}>
          <form onSubmit={e => { handleAddExpense(e); if (!expenseError) setShowExpenseSheet(false); }} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-muted ml-1 mb-1.5 block font-bold">扣款信封</label>
              <select className="input-field" value={selectedEnvId} onChange={e => { setSelectedEnvId(e.target.value); setExpenseError(null); }} required>
                <option value="">選擇信封...</option>
                {spendableEnvelopes.map(env => <option key={env.id} value={env.id}>{env.name}（{currencySymbol}{env.balance}）</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted ml-1 mb-1.5 block font-bold">花費類別（選填）</label>
              <select className="input-field" value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}>
                <option value="">(不選擇)</option>
                {expenseCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted ml-1 mb-1.5 block font-bold">金額</label>
              <input type="number" placeholder="輸入金額" min="0.01" step="0.01" className={`input-field ${expenseError ? 'border-red-500/60' : ''}`} value={expenseAmount} onChange={e => { setExpenseAmount(e.target.value); setExpenseError(null); }} required />
            </div>
            <div>
              <label className="text-xs text-muted ml-1 mb-1.5 block font-bold">備註（選填）</label>
              <input type="text" placeholder="備註內容..." className="input-field" value={expenseNote} onChange={e => setExpenseNote(e.target.value)} />
            </div>
            {expenseError && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400"><span>⚠️</span><span>{expenseError}</span></div>}
            <button type="submit" className="btn btn-primary w-full text-base">確認送出</button>
          </form>
        </BottomSheet>
      )}

      {/* TRANSFER BOTTOM SHEET */}
      {showTransferSheet && (
        <BottomSheet title="🏦 累積資金" onClose={() => { setShowTransferSheet(false); setTransferError(null); }}>
          <div className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <ArrowRightLeft size={14} /><span>只能從「可動用」信封存錢進「儲蓄」信封（單向）</span>
          </div>
          <form onSubmit={async e => { await handleTransfer(e); if (!transferError) setShowTransferSheet(false); }} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-muted ml-1 mb-1.5 block font-bold">轉出信封（可動用）</label>
              <select className="input-field" value={transferFromId} onChange={e => { setTransferFromId(e.target.value); setTransferError(null); }} required>
                <option value="">選擇...</option>
                {spendableEnvelopes.map(env => <option key={env.id} value={env.id}>{env.name}（{currencySymbol}{env.balance}）</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted ml-1 mb-1.5 block font-bold">轉入信封（儲蓄）</label>
              <select className="input-field" value={transferToId} onChange={e => { setTransferToId(e.target.value); setTransferError(null); }} required>
                <option value="">選擇...</option>
                {investingEnvelopes.map(env => <option key={env.id} value={env.id}>{env.name}（{currencySymbol}{env.balance}）</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted ml-1 mb-1.5 block font-bold">轉帳金額</label>
              <input type="number" min="0.01" step="0.01" placeholder="金額" className={`input-field ${transferError ? 'border-red-500/60' : ''}`} value={transferAmount} onChange={e => { setTransferAmount(e.target.value); setTransferError(null); }} required />
            </div>
            <div>
              <label className="text-xs text-muted ml-1 mb-1.5 block font-bold">備註（選填）</label>
              <input type="text" placeholder="存入累積資金..." className="input-field" value={transferNote} onChange={e => setTransferNote(e.target.value)} />
            </div>
            {transferError && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400"><span>⚠️</span><span>{transferError}</span></div>}
            <button type="submit" disabled={isTransferring} className="btn btn-primary w-full text-base disabled:opacity-50 flex items-center justify-center gap-2">
              <ArrowRightLeft size={18} />{isTransferring ? '轉帳中...' : '確認存錢'}
            </button>
          </form>
        </BottomSheet>
      )}

      {/* TX LOG BOTTOM SHEET */}
      {showTxLogSheet && (
        <BottomSheet title="📝 交易日誌" onClose={() => setShowTxLogSheet(false)}>
          <div className="divide-y divide-white/5 rounded-2xl overflow-hidden bg-white/5">
            {myTransactions.length === 0 && <div className="text-center py-8 text-muted text-sm">尚無交易紀錄</div>}
            {myTransactions.slice(0, 20).map(tx => {
              const cat = expenseCategories.find(c => c.id === tx.categoryId);
              return (
                <div key={tx.id} className="flex justify-between items-center px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cat ? cat.icon + ' ' : ''}{tx.note}</span>
                      {tx.status === 'pending' && <span className="bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded font-bold">待核准</span>}
                      {tx.status === 'rejected' && <span className="bg-red-500/20 text-red-400 text-[9px] px-1.5 py-0.5 rounded font-bold">已駁回</span>}
                    </div>
                    <span className="text-xs text-muted">{new Date(tx.timestamp).toLocaleString('zh-TW')}</span>
                  </div>
                  <span className={`font-black text-base ${tx.amount < 0 ? 'text-error' : 'text-success'} ${tx.status === 'rejected' ? 'line-through opacity-50' : ''}`}>
                    {tx.amount < 0 ? '' : '+'}{currencySymbol}{tx.amount}
                  </span>
                </div>
              );
            })}
          </div>
        </BottomSheet>
      )}

      {/* SETTINGS BOTTOM SHEET */}
      {showSettingsSheet && (
        <BottomSheet title="🛡️ 帳號安全設定" onClose={() => setShowSettingsSheet(false)}>
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary flex-shrink-0"><Lock size={20} /></div>
              <div>
                <div className="font-bold">修改認證 PIN 碼</div>
                <div className="text-xs text-muted">目前 PIN 碼：<span className="font-mono text-white/80">{currentUser?.pin || '0000'}</span></div>
              </div>
            </div>
            <input type="text" className="input-field text-center font-mono text-2xl tracking-[0.5em]" placeholder="輸入新 PIN 碼 (4位數字)" value={newPin} onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,4); setNewPin(v); setPinChangeSuccess(false); setPinChangeError(''); }} maxLength={4} />
            {pinChangeError && <p className="text-red-400 text-sm font-bold text-center">⚠️ {pinChangeError}</p>}
            {pinChangeSuccess && <p className="text-green-400 text-sm font-bold text-center">✅ 修改成功！下次登入請使用新 PIN 碼。</p>}
            <button onClick={async () => { if (newPin.length !== 4) { setPinChangeError('請輸入完整的 4 位數字'); return; } try { await setUserPin(currentUser!.id, newPin); setPinChangeSuccess(true); setNewPin(''); } catch { setPinChangeError('修改失敗，請稍後再試'); } }} disabled={newPin.length !== 4} className={`btn w-full text-base ${newPin.length === 4 ? 'btn-primary' : 'bg-white/5 text-slate-500 cursor-not-allowed'}`}>
              確認修改 PIN 碼
            </button>
            <p className="text-xs text-muted text-center italic">💡 忘記 PIN 碼？請向家長詢問，家長可以在管理界面重設。</p>
          </div>
        </BottomSheet>
      )}

      {/* DRAW RESULT MODAL */}
      {drawResult && (
        <div className="bottom-sheet-overlay" onClick={() => setDrawResult(null)}>
          <div className="bottom-sheet">
            <div className="bottom-sheet-handle" />
            <div className="p-6 text-center flex flex-col items-center gap-4">
              <div className="text-7xl animate-bounce">🎉</div>
              <h3 className="text-2xl font-black">恭喜！</h3>
              <p className="text-lg text-muted">你獲得了</p>
              <div className="text-3xl font-black text-amber-400">{drawResult.wonItemName}</div>
              {drawResult.isPhysical && <div className="badge badge-warning">📦 實體獎勵，等待家長發放</div>}
              {(drawResult.expReward ?? 0) > 0 && <div className="badge badge-info">⭐ +{drawResult.expReward} EXP</div>}
              {(drawResult.gemReward ?? 0) > 0 && <div className="badge badge-warning">💎 +{drawResult.gemReward} 寶石</div>}
              <button onClick={() => setDrawResult(null)} className="btn btn-primary w-full mt-2">收下！</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KidDashboard;
