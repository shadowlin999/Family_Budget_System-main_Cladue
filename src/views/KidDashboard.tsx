import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, calculateExpToNextLevel, calculateLevelProgress } from '../store/index';
import type { TreasureClaim, Quest } from '../store/index';
import { Wallet, TrendingUp, Award, Gift, Sparkles, Info, ChevronRight, ChevronLeft, MessageSquare, Package, ArrowRightLeft, Lock, Swords, Plus, X, Target } from 'lucide-react';
import { calcGoalProgress } from '../domain/goal';
import { calcCurrentEnergy, daysToFull } from '../domain/energy';
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
        <span className="text-xs text-muted font-normal bg-black/10 px-2.5 py-1 rounded-full border border-black/5 flex-shrink-0">
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
      <div className="bottom-sheet-sticky-header">
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
    parentReturnId, exitKidPreview,
    kidTheme,
  } = useStore();

  const navigate = useNavigate();

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

  // ── Chart ⑦: kid expense category data ───────────────────────────────────
  const myKidCategoryData = useMemo(() => {
    if (!currentUser) return [];
    const myEnvIds = envelopes.filter(e => e.ownerId === currentUser.id).map(e => e.id);
    const map: Record<string, number> = {};
    transactions
      .filter(t => t.amount < 0 && t.categoryId && myEnvIds.includes(t.envelopeId))
      .forEach(t => { map[t.categoryId!] = (map[t.categoryId!] || 0) + Math.abs(t.amount); });
    return Object.entries(map).map(([id, value]) => {
      const c = expenseCategories.find(x => x.id === id);
      return { name: c?.name || '其他', icon: c?.icon || '❓', value };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, expenseCategories, envelopes, currentUser]);

  // ── Chart ⑤: monthly savings trend (investing envelopes) ────────────────
  const mySavingsTrend = useMemo(() => {
    if (!currentUser) return [];
    const myInvestIds = envelopes.filter(e => e.ownerId === currentUser.id && e.type === 'investing').map(e => e.id);
    if (myInvestIds.length === 0) return [];
    const map: Record<string, number> = {};
    transactions
      .filter(t => myInvestIds.includes(t.envelopeId))
      .forEach(t => {
        const d = new Date(Number(t.timestamp));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        map[key] = (map[key] || 0) + t.amount;
      });
    const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    let running = 0;
    return sorted.map(([month, delta]) => {
      running += delta;
      return { month: month.slice(5), balance: Math.max(0, running) };
    });
  }, [transactions, envelopes, currentUser]);

  // ── Chart ⑧: 30-day quest completion streak ──────────────────────────────
  const streakDays = useMemo(() => {
    if (!currentUser) return [];
    const days: { date: Date; completed: number; total: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dEnd = new Date(d); dEnd.setHours(23, 59, 59, 999);
      const dayQ = quests.filter(q => {
        if (q.ownerId !== currentUser.id) return false;
        const ts = q.createdAt ? new Date(q.createdAt) : null;
        return ts && ts >= d && ts <= dEnd;
      });
      days.push({ date: d, completed: dayQ.filter(q => q.status === 'completed').length, total: dayQ.length });
    }
    return days;
  }, [quests, currentUser]);

  if (!currentUser) return null;

  const myEnvelopes = envelopes.filter(e => e.ownerId === currentUser.id && !e.isHidden);
  const spendableEnvelopes = myEnvelopes.filter(e => e.type === 'spendable');
  const investingEnvelopes = myEnvelopes.filter(e => e.type === 'investing');
  const myTransactions = transactions.filter(t => myEnvelopes.find(e => e.id === t.envelopeId));

  const unlockedBadges = badges.filter(b => (currentUser.unlockedBadges || []).includes(b.id));

  const formula = gamificationSettings?.levelFormula || 'Math.floor(exp / 100) + 1';
  const expToNextLevel = calculateExpToNextLevel(currentUser.exp, formula);
  const { progressPercent } = calculateLevelProgress(currentUser.exp, formula);


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

  const handleNumpadPress = (key: string) => {
    setExpenseError(null);
    if (key === '⌫') {
      setExpenseAmount(s => s.slice(0, -1));
    } else if (key === '.') {
      if (!expenseAmount.includes('.')) setExpenseAmount(s => s + '.');
    } else {
      const parts = expenseAmount.split('.');
      if (parts[1] && parts[1].length >= 2) return;
      if (expenseAmount.replace('.', '').length >= 7) return;
      setExpenseAmount(s => s + key);
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
    <div data-theme={kidTheme} className="min-h-screen flex flex-col">

      {/* ── Parent preview banner ── */}
      {parentReturnId && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/20 border-b border-amber-500/30 text-amber-300 text-sm font-bold sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span>👨 家長預覽模式</span>
            <span className="text-amber-400/70 font-normal">· 正在查看 {currentUser.name} 的面板</span>
          </div>
          <button
            onClick={() => { exitKidPreview(); navigate('/parent'); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 text-xs font-bold transition-colors"
          >
            ← 返回家長面板
          </button>
        </div>
      )}

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

            {/* Spending license / energy bar */}
            {currentUser.spendingLicense && currentUser.spendingLicense.max > 0 && (() => {
              const lic = currentUser.spendingLicense;
              const energy = calcCurrentEnergy(lic);
              const pct = Math.max(0, Math.min(100, (energy / lic.max) * 100));
              const days = daysToFull(lic);
              return (
                <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#047857' }}>⚡ 花費能量</span>
                    <span className="text-sm font-black" style={{ color: '#065f46' }}>
                      {currencySymbol}{Math.floor(energy)} / {currencySymbol}{lic.max}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
                    <div className="h-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
                  </div>
                  <div className="text-[10px] mt-1.5" style={{ color: '#065f46' }}>
                    {days > 0 ? `再 ${days} 天充滿能量（能量內可自主花費，超過需家長同意）` : '✨ 能量已滿！可以盡情規劃'}
                  </div>
                </div>
              );
            })()}

            {/* Wallet section */}
            <Section emoji="💰" title="我的錢包與儲蓄">
              <div className="grid grid-cols-2 gap-3 mb-1">
                {spendableEnvelopes.map(env => {
                  const gp = calcGoalProgress(env, transactions);
                  return (
                  <div key={env.id} className="rounded-2xl p-4 relative overflow-hidden" style={{ background: '#dbeafe' }}>
                    <div className="absolute right-2 bottom-2 opacity-10"><Wallet size={48} className="text-blue-600" /></div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1 relative z-10" style={{ color: '#3b82f6' }}>POWER MODULE</div>
                    <div className="text-xs font-bold mb-1 relative z-10" style={{ color: '#64748b' }}>{env.name}</div>
                    <div className="text-3xl font-black relative z-10 leading-tight" style={{ color: '#1e40af' }}>{currencySymbol}{env.balance}</div>
                    <div className="text-[10px] mt-1 relative z-10" style={{ color: '#64748b' }}>可動用</div>
                    {gp.hasGoal && <GoalStripe gp={gp} note={env.goalNote} currencySymbol={currencySymbol} tone="blue" />}
                  </div>
                  );
                })}
                {investingEnvelopes.map(env => {
                  const gp = calcGoalProgress(env, transactions);
                  return (
                  <div key={env.id} className="rounded-2xl p-4 relative overflow-hidden border-2" style={{ background: '#dcfce7', borderColor: 'rgba(22,163,74,0.3)' }}>
                    <div className="absolute right-2 bottom-2 opacity-10"><TrendingUp size={48} className="text-green-600" /></div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1 relative z-10" style={{ color: '#16a34a' }}>GROWTH FUND</div>
                    <div className="text-xs font-bold mb-1 relative z-10" style={{ color: '#64748b' }}>{env.name}</div>
                    <div className="text-3xl font-black relative z-10 leading-tight" style={{ color: '#16a34a' }}>{currencySymbol}{env.balance}</div>
                    <div className="text-[10px] mt-1 relative z-10" style={{ color: '#16a34a' }}>儲蓄</div>
                    {gp.hasGoal && <GoalStripe gp={gp} note={env.goalNote} currencySymbol={currencySymbol} tone="green" />}
                  </div>
                  );
                })}
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

              {/* ⑤ 儲蓄成長折線圖 */}
              {mySavingsTrend.length >= 2 && (() => {
                const maxB = Math.max(...mySavingsTrend.map(m => m.balance), 1);
                const H = 80;
                const W = 100 / (mySavingsTrend.length - 1);
                const pts = mySavingsTrend.map((m, i) => `${(i * W).toFixed(1)},${(H - (m.balance / maxB) * H).toFixed(1)}`).join(' ');
                return (
                  <div className="mt-4 rounded-2xl bg-white/5 border border-white/5 p-4">
                    <div className="text-xs text-muted font-bold uppercase tracking-wider mb-3">儲蓄成長趨勢</div>
                    <div className="relative w-full" style={{ height: `${H + 20}px` }}>
                      <svg className="absolute inset-0 w-full" style={{ height: `${H}px` }} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
                        {[0, 50, 100].map(p => (
                          <line key={p} x1="0" y1={H * p / 100} x2="100" y2={H * p / 100} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                        ))}
                        {/* fill area */}
                        <polygon
                          points={`0,${H} ${pts} 100,${H}`}
                          fill="rgba(52,211,153,0.12)"
                        />
                        <polyline points={pts} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                        {mySavingsTrend.map((m, i) => (
                          <circle key={i} cx={`${(i * W).toFixed(1)}%`} cy={(H - (m.balance / maxB) * H).toFixed(1)} r="3" fill="#34d399" />
                        ))}
                      </svg>
                      <div className="absolute bottom-0 left-0 right-0 flex justify-between">
                        {mySavingsTrend.map(m => (
                          <span key={m.month} className="text-[10px] text-muted">{m.month}月</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right text-xs text-emerald-400 font-bold mt-1">
                      目前儲蓄 {currencySymbol}{investingEnvelopes.reduce((s, e) => s + e.balance, 0)}
                    </div>
                  </div>
                );
              })()}
            </Section>

            {/* Quest section (tabbed) */}
            <Section emoji="⚔️" title="冒險任務">
              {/* ⑥ 任務完成率環圈圖 */}
              {(() => {
                const total = myQuests.length;
                const done = myQuests.filter(q => q.status === 'completed').length;
                const rate = total > 0 ? Math.round((done / total) * 100) : 0;
                const r = 22, C = 2 * Math.PI * r;
                const dash = (rate / 100) * C;
                return (
                  <div className="flex items-center gap-4 mb-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                    <svg width="60" height="60" viewBox="0 0 60 60" className="flex-shrink-0">
                      <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                      <circle cx="30" cy="30" r={r} fill="none" stroke="#6366f1" strokeWidth="6"
                        strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={C * 0.25}
                        strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.7s ease' }} />
                      <text x="30" y="35" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">{rate}%</text>
                    </svg>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-sm font-bold">任務完成率</div>
                      <div className="text-xs text-muted">{done} / {total} 已完成</div>
                      <div className="text-xs text-emerald-400">{total > 0 ? (rate >= 80 ? '🏆 表現優秀！' : rate >= 50 ? '💪 繼續加油！' : '⚡ 挑戰自己！') : '尚無任務'}</div>
                    </div>
                  </div>
                );
              })()}
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
              {/* ⑦ 花費分類圓餅圖 */}
              {myKidCategoryData.length > 0 && (() => {
                const PIE_COLORS = ['#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#a78bfa'];
                const totalCatVal = myKidCategoryData.reduce((s, d) => s + d.value, 0);
                let cumPct = 0;
                const gradient = myKidCategoryData.slice(0, 6).map((d, i) => {
                  const s = cumPct, e = cumPct + (d.value / totalCatVal) * 100;
                  cumPct = e;
                  return `${PIE_COLORS[i % PIE_COLORS.length]} ${s.toFixed(1)}% ${e.toFixed(1)}%`;
                }).join(', ');
                return (
                  <div className="flex items-center gap-4 mb-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-16 h-16 rounded-full flex-shrink-0"
                      style={{ background: `conic-gradient(${gradient})`, boxShadow: '0 0 0 3px rgba(255,255,255,0.05)' }} />
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="text-xs font-bold text-muted">我的花費分類</div>
                      {myKidCategoryData.slice(0, 3).map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate text-muted">{d.icon} {d.name}</span>
                          <span className="ml-auto font-bold">{currencySymbol}{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
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
            {/* ⑧ 連續完成日曆 */}
            {(() => {
              const streak = (() => {
                let s = 0;
                for (let i = streakDays.length - 1; i >= 0; i--) {
                  if (streakDays[i].total > 0 && streakDays[i].completed === streakDays[i].total) s++;
                  else if (i < streakDays.length - 1) break;
                }
                return s;
              })();
              return (
                <div className="glass-card mb-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="pilot-section-label">PERFORMANCE LOG</span>
                      <div className="text-xs text-muted font-bold">近30天任務連續完成</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl">🔥</span>
                      <div>
                        <div className="text-lg font-black" style={{ color: '#d97706' }}>{streak} Day Win Streak!</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
                    {streakDays.map((day, i) => {
                      const isToday = day.date.toDateString() === new Date().toDateString();
                      const bg = day.total === 0 ? 'rgba(255,255,255,0.04)' : day.completed === day.total ? '#10b981' : day.completed > 0 ? '#f59e0b' : '#ef4444';
                      return (
                        <div
                          key={i}
                          title={`${day.date.getMonth()+1}/${day.date.getDate()} ${day.completed}/${day.total}`}
                          className={`rounded-md aspect-square ${isToday ? 'ring-2 ring-white/40' : ''}`}
                          style={{ background: bg }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex gap-3">
                    {[['#10b981','全部完成'],['#f59e0b','部分完成'],['#ef4444','未完成'],['rgba(255,255,255,0.04)','無任務']].map(([c,l]) => (
                      <div key={l as string} className="flex items-center gap-1 text-[10px] text-muted">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c as string }} />{l}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
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
        <BottomSheet title="紀錄支出" onClose={() => { setShowExpenseSheet(false); setExpenseError(null); setExpenseAmount(''); setExpenseNote(''); setSelectedCategoryId(''); }}>
          {/* Big amount display */}
          <div className="rounded-2xl p-5 mb-4 text-center" style={{ background: '#e8eef5' }}>
            <span className="pilot-section-label">LOG TRANSMISSION · 支出金額</span>
            <div className="flex items-center justify-center gap-1 mt-2">
              <span className="text-2xl font-black" style={{ color: '#2563eb' }}>{currencySymbol}</span>
              <span className="text-5xl font-black tracking-tight" style={{ color: '#0f172a' }}>{expenseAmount || '0'}</span>
              <span className="inline-block w-0.5 h-10 ml-1 rounded-full animate-pulse" style={{ background: '#2563eb' }} />
            </div>
          </div>

          {/* Envelope */}
          <div className="mb-4">
            <span className="pilot-section-label">ASSIGNED ENVELOPE</span>
            <select className="input-field mt-1" value={selectedEnvId} onChange={e => { setSelectedEnvId(e.target.value); setExpenseError(null); }}>
              <option value="">選擇信封...</option>
              {spendableEnvelopes.map(env => <option key={env.id} value={env.id}>{env.name}（{currencySymbol}{env.balance}）</option>)}
            </select>
          </div>

          {/* Category pills */}
          {expenseCategories.length > 0 && (
            <div className="mb-4">
              <span className="pilot-section-label">MODULE CATEGORY</span>
              <div className="category-pills mt-2">
                {expenseCategories.map(cat => (
                  <button key={cat.id} type="button"
                    className={`category-pill ${selectedCategoryId === cat.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategoryId(prev => prev === cat.id ? '' : cat.id)}>
                    <span className="category-pill-icon">{cat.icon}</span>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <div className="mb-2">
            <span className="pilot-section-label">PILOT MEMO</span>
            <input type="text" placeholder="這筆錢花在哪裡？" className="input-field mt-1"
              value={expenseNote} onChange={e => setExpenseNote(e.target.value)} />
          </div>

          {expenseError && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm mb-2"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}>
              <span>⚠️</span><span>{expenseError}</span>
            </div>
          )}

          {/* Energy preview: whether this spend will auto-approve or need parent */}
          {currentUser.spendingLicense && currentUser.spendingLicense.max > 0 && expenseAmount && Number(expenseAmount) > 0 && (() => {
            const lic = currentUser.spendingLicense;
            const energy = calcCurrentEnergy(lic);
            const amt = Number(expenseAmount);
            const willAuto = amt <= energy;
            return (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm mb-2"
                style={willAuto
                  ? { background: 'rgba(16,185,129,0.08)', color: '#047857', border: '1px solid rgba(16,185,129,0.2)' }
                  : { background: 'rgba(245,158,11,0.08)', color: '#92400e', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span>{willAuto ? '⚡' : '🙋'}</span>
                <span>
                  {willAuto
                    ? `在能量內（${currencySymbol}${Math.floor(energy)} → ${currencySymbol}${Math.floor(energy - amt)}），會自動核准`
                    : `超過能量 ${currencySymbol}${Math.ceil(amt - energy)}，送出後需家長審核`}
                </span>
              </div>
            );
          })()}

          {/* Numpad */}
          <div className="numpad-grid">
            {(['1','2','3','4','5','6','7','8','9','.','0','⌫'] as const).map(key => (
              <button key={key} type="button"
                className={`numpad-btn ${key === '⌫' || key === '.' ? 'numpad-action' : ''}`}
                onClick={() => handleNumpadPress(key as string)}>
                {key}
              </button>
            ))}
          </div>

          <button type="button" className="numpad-btn numpad-submit"
            disabled={!expenseAmount || !selectedEnvId}
            onClick={() => {
              setExpenseError(null);
              if (!selectedEnvId || !expenseAmount) { setExpenseError('請選擇信封並輸入金額'); return; }
              const amount = Number(expenseAmount);
              if (isNaN(amount) || amount <= 0) { setExpenseError('花費金額必須大於 0！'); return; }
              const env = myEnvelopes.find(e => e.id === selectedEnvId);
              if (env && amount > env.balance) {
                setExpenseError(`金額超出「${env.name}」的餘額（目前剩餘 ${currencySymbol}${env.balance}）`);
                return;
              }
              addTransaction(selectedEnvId, -amount, expenseNote || '一般消費', selectedCategoryId || undefined);
              setExpenseAmount(''); setExpenseNote(''); setSelectedCategoryId(''); setExpenseError(null);
              setShowExpenseSheet(false);
            }}>
            ✓ 確認送出
          </button>
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

// ─── GoalStripe (wish-goal progress overlay on envelope card) ────────────
type Tone = 'blue' | 'green';
const GoalStripe: React.FC<{
  gp: ReturnType<typeof calcGoalProgress>;
  note?: string;
  currencySymbol: string;
  tone: Tone;
}> = ({ gp, note, currencySymbol, tone }) => {
  if (!gp.hasGoal) return null;
  const label = tone === 'blue' ? '#1e40af' : '#166534';
  const barBg = 'rgba(0,0,0,0.08)';
  const barFill = tone === 'blue'
    ? 'linear-gradient(90deg,#3b82f6,#60a5fa)'
    : 'linear-gradient(90deg,#16a34a,#4ade80)';
  return (
    <div className="mt-2 relative z-10">
      <div className="flex items-center justify-between text-[10px] font-bold mb-1" style={{ color: label }}>
        <span className="flex items-center gap-0.5"><Target size={10} /> {note ? note : '願望'}</span>
        <span>{currencySymbol}{gp.balance} / {currencySymbol}{gp.goalAmount} {gp.achieved && '🎉'}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: barBg }}>
        <div className="h-full" style={{ width: `${gp.percent}%`, background: barFill }} />
      </div>
      <div className="flex items-center justify-between text-[9px] mt-0.5" style={{ color: label, opacity: 0.75 }}>
        <span>{gp.achieved ? '已達成！' : gp.etaDays !== null ? `再 ${gp.etaDays} 天達成` : '繼續存錢就能達成！'}</span>
        {gp.deadlineDays !== null && (
          <span style={{ color: gp.onTrack === false ? '#dc2626' : undefined, fontWeight: gp.onTrack === false ? 700 : undefined }}>
            {gp.deadlineDays >= 0 ? `剩 ${gp.deadlineDays} 天` : `逾期 ${-gp.deadlineDays} 天`}
          </span>
        )}
      </div>
    </div>
  );
};
