import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, getNextAllowanceDate } from '../store/index';
import type { AllowancePeriod, User } from '../store/index';
import {
  Eye, EyeOff, Trash2, Edit2, PlusCircle, Check, X,
  RefreshCw, TrendingUp, Image as ImageIcon, ChevronDown,
  ChevronUp, Copy, ArrowRightLeft, Save, Lock, LogOut, Shield,
  Target,
} from 'lucide-react';
import type { Envelope } from '../types/envelope';
import { calcGoalProgress } from '../domain/goal';
import { calcCurrentEnergy, daysToFull } from '../domain/energy';
import ReportModal from './ReportModal';
import { GamificationAdmin } from './GamificationAdmin';
import { EmojiInput } from '../components/EmojiInput';
import { DigitalClock } from '../components/DigitalClock';

// ─── shared mobile-size constants ─────────────────────────────────────────────
const BTN = 'min-h-[48px] px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95';
const INPUT = 'w-full bg-slate-900/70 border border-white/10 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted transition';
const CARD = 'bg-slate-800/60 backdrop-blur border border-white/10 rounded-3xl p-5 shadow-xl';

// ─── Collapsible section ───────────────────────────────────────────────────────
const Section: React.FC<{ emoji: string; title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ emoji, title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={CARD}>
      <button className="flex w-full items-center gap-2 min-h-[44px] text-left mb-0" onClick={() => setOpen(v => !v)}>
        <span className="text-2xl leading-none">{emoji}</span>
        <span className="flex-1 font-black text-base">{title}</span>
        {open ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </button>
      {open && <div className="mt-5 animate-in slide-in-from-top-2 fade-in duration-200">{children}</div>}
    </div>
  );
};

// ─── Main dashboard ───────────────────────────────────────────────────────────
const ParentDashboard: React.FC = () => {
  const {
    currentUser, logout, systemAdminRole,
    priceErrors,
    users, envelopes, transactions, quests,
    routineQuests = [], expenseCategories = [],
    addExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
    approveQuestWithFeedback, rejectQuest, delayQuest,
    createQuest, addRoutineQuest, updateRoutineQuest, deleteRoutineQuest, forceGenerateRoutineQuests,
    addKid, updateKid, toggleHideKid, deleteKid,
    manualDistributeAllowance,
    updateKidAllowance, addEnvelope, updateEnvelope, deleteEnvelope, toggleHideEnvelope,
    setEnvelopeGoal, clearEnvelopeGoal, updateKidLicense,
    setUserPin,
    addTransaction, approveTransaction, rejectTransaction,
    adminInviteCode, kidInviteCode, regenerateInviteCode,
    familyName, updateFamilyName,
    interestSettings, updateInterestSettings,
    themeSettings, updateThemeSettings,
    timezoneOffset = 480, updateTimezone,
    treasureClaims = [], approveTreasureClaim,
    treasureBoxes = [],
    currencySymbol, updateCurrencySymbol,
    kidTheme, setKidTheme,
    allowanceSettings, updateAllowanceSettings,
    transferMoney,
    exportFamilyData,
    importFamilyData,
    enterKidPreview,
  } = useStore();

  const navigate = useNavigate();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [parentTab, setParentTab] = useState<'pending' | 'quests' | 'family' | 'settings'>('pending');

  // ── Quest form ─────────────────────────────────────────────────────────────
  const [qTitle, setQTitle] = useState('');
  const [qExp, setQExp] = useState('20');
  const [qMoney, setQMoney] = useState('0');
  const [qGem, setQGem] = useState('0');
  const [qIcon, setQIcon] = useState('📜');
  const [qKid, setQKid] = useState('');
  const [qBoxRewardId, setQBoxRewardId] = useState('');
  const [questTab, setQuestTab] = useState<'single' | 'routine'>('single');
  const [qDueMode, setQDueMode] = useState<'days' | 'date'>('days');
  const [qDueDays, setQDueDays] = useState('1');
  const [qDueDate, setQDueDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Review state ───────────────────────────────────────────────────────────
  const [reviewingQuestId, setReviewingQuestId] = useState<string | null>(null);
  const [reviewExpMult, setReviewExpMult] = useState('1');
  const [reviewMoneyMult, setReviewMoneyMult] = useState('1');
  const [reviewGemMult, setReviewGemMult] = useState('1');
  const [reviewEmoji, setReviewEmoji] = useState('😊');
  const [reviewComment, setReviewComment] = useState('');

  // ── History tab ────────────────────────────────────────────────────────────
  const [historyTab, setHistoryTab] = useState<'quests' | 'transactions'>('quests');

  // ── Kid mgmt ───────────────────────────────────────────────────────────────
  const [newKidName, setNewKidName] = useState('');
  const [editingKidId, setEditingKidId] = useState<string | null>(null);
  const [editingKidName, setEditingKidName] = useState('');
  const [expandedKidId, setExpandedKidId] = useState<string | null>(null);
  const [pinEditingId, setPinEditingId] = useState<string | null>(null);
  const [pinEditingValue, setPinEditingValue] = useState('');

  // ── Envelope add ───────────────────────────────────────────────────────────
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvIcon, setNewEnvIcon] = useState('✉️');
  const [newEnvType, setNewEnvType] = useState<'spendable' | 'investing'>('spendable');
  const [expandedEnvKidId, setExpandedEnvKidId] = useState<string | null>(null);

  // ── Family name ────────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(familyName || '');
  const [familyIcon, setFamilyIcon] = useState('🏠');

  // ── Category add / edit ────────────────────────────────────────────────────
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('🛒');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('🛒');

  // ── Allowance distribution ─────────────────────────────────────────────────
  const [allowTab, setAllowTab] = useState<'auto' | 'manual'>('auto');
  const [allowAmount, setAllowAmount] = useState('100');
  const [allowTarget, setAllowTarget] = useState('all');
  const [allowWalletPct, setAllowWalletPct] = useState('70');
  const [allowMode, setAllowMode] = useState<AllowancePeriod>('weekly');
  const [autoAllowDays, setAutoAllowDays] = useState<number[]>([]);
  const [monthlyDay, setMonthlyDay] = useState('1');
  const [allowHour, setAllowHour] = useState(0);
  const [allowMinute, setAllowMinute] = useState(0);

  React.useEffect(() => {
    if (allowanceSettings) {
      setAllowMode(allowanceSettings.period);
      setAutoAllowDays(allowanceSettings.days);
      setAllowHour(allowanceSettings.hour ?? 0);
      setAllowMinute(allowanceSettings.minute ?? 0);
      if (allowanceSettings.period === 'monthly' && allowanceSettings.days.length > 0) {
        setMonthlyDay(String(allowanceSettings.days[0]));
      }
    } else {
      setAllowMode('weekly');
      setAutoAllowDays([1]);
      setAllowHour(0);
      setAllowMinute(0);
    }
  }, [allowanceSettings]);

  // Per-kid allowance edit state
  const [editingKidAllowId, setEditingKidAllowId] = useState<string | null>(null);
  const [kaAmount, setKaAmount] = useState('100');
  const [kaRatio, setKaRatio] = useState('70');
  const [kaMode, setKaMode] = useState<AllowancePeriod>('weekly');
  const [kaDays, setKaDays] = useState<number[]>([]);
  const [kaHour, setKaHour] = useState(0);
  const [kaMinute, setKaMinute] = useState(0);

  const startEditingKidAllowance = (kid: User) => {
    setEditingKidAllowId(kid.id);
    setKaAmount(String(kid.allowanceAmount || 100));
    setKaRatio(String(kid.allowanceRatio || 70));
    const s = kid.allowanceSettings || allowanceSettings || { period: 'weekly', days: [1], hour: 0, minute: 0 };
    setKaMode(s.period);
    setKaDays(s.days);
    setKaHour(s.hour ?? 0);
    setKaMinute(s.minute ?? 0);
  };

  // ── Price error dismiss ────────────────────────────────────────────────────
  const [priceErrorDismissed, setPriceErrorDismissed] = useState(false);

  // ── Invite copy ────────────────────────────────────────────────────────────
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [copiedKid, setCopiedKid] = useState(false);

  // ── Parent Transfer ────────────────────────────────────────────────────────
  const [ptFromId, setPtFromId] = useState('');
  const [ptToId, setPtToId] = useState('');
  const [ptAmount, setPtAmount] = useState('');
  const [ptNote, setPtNote] = useState('');
  const [ptError, setPtError] = useState<string | null>(null);
  const [ptLoading, setPtLoading] = useState(false);

  // ── Backup ─────────────────────────────────────────────────────────────────
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message?: string }>({ type: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Spending sub-tab (for charts ③ ④) ─────────────────────────────────────
  const [spendingSubTab, setSpendingSubTab] = useState<'pie' | 'trend' | 'monthly'>('pie');
  const [showReport, setShowReport] = useState(false);

  // ── Derived data ───────────────────────────────────────────────────────────
  const allKids = users.filter(u => u.role === 'kid');
  const kidEnvIds = envelopes.filter(e => allKids.some(k => k.id === e.ownerId)).map(e => e.id);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(t => t.amount < 0 && t.categoryId && kidEnvIds.includes(t.envelopeId))
      .forEach(t => { map[t.categoryId!] = (map[t.categoryId!] || 0) + Math.abs(t.amount); });
    return Object.entries(map).map(([id, value]) => {
      const c = expenseCategories.find(c => c.id === id);
      return { name: c?.name || '其他', icon: c?.icon || '❓', value };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, expenseCategories, kidEnvIds]);

  // ── Monthly income/expense data for charts ③ ④ ────────────────────────────
  const monthlyData = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    transactions
      .filter(t => kidEnvIds.includes(t.envelopeId))
      .forEach(t => {
        const d = new Date(Number(t.timestamp));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!map[key]) map[key] = { income: 0, expense: 0 };
        if (t.amount >= 0) map[key].income += t.amount;
        else map[key].expense += Math.abs(t.amount);
      });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, v]) => ({ month: month.slice(5), ...v, balance: v.income - v.expense }));
  }, [transactions, kidEnvIds]);

  if (!currentUser) return null;

  const activeKids = allKids.filter(u => !u.isHidden);
  const pendingQuests = quests.filter(q => q.status === 'pending_approval');
  const pendingClaims = treasureClaims.filter(c => c.status === 'pending');
  const pendingTransactions = transactions.filter(t => t.status === 'pending');
  const pendingCount = pendingQuests.length + pendingClaims.length + pendingTransactions.length;
  const totalCat = categoryData.reduce((s, d) => s + d.value, 0);
  const COLORS = ['#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#a78bfa'];

  const copyCode = (code: string, type: 'admin' | 'kid') => {
    navigator.clipboard.writeText(code);
    if (type === 'admin') { setCopiedAdmin(true); setTimeout(() => setCopiedAdmin(false), 2000); }
    else { setCopiedKid(true); setTimeout(() => setCopiedKid(false), 2000); }
  };

  const handleExportJSON = () => {
    const { data, filename } = exportFamilyData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) { alert('尚無交易紀錄可匯出'); return; }
    const headers = ['日期', '對象', '信封', '金額', '類別', '備註'];
    const rows = transactions.map(tx => {
      const kid = users.find(u => u.id === (envelopes.find(e => e.id === tx.envelopeId)?.ownerId));
      const env = envelopes.find(e => e.id === tx.envelopeId);
      const cat = expenseCategories.find(c => c.id === tx.categoryId);
      return [new Date(tx.timestamp).toLocaleString(), kid?.name || '系統', env?.name || '未知', tx.amount, cat?.name || '未分類', `"${tx.note || ''}"`].join(',');
    });
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions_${familyName || 'family'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  const onImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportStatus({ type: 'loading' });
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        await importFamilyData(text);
        setImportStatus({ type: 'success', message: '資料匯入成功！' });
        setTimeout(() => setImportStatus({ type: 'idle' }), 3000);
      } catch (err) { setImportStatus({ type: 'error', message: (err as Error)?.message || '匯入失敗' }); }
    };
    reader.onerror = () => setImportStatus({ type: 'error', message: '讀取檔案失敗' });
    reader.readAsText(file); e.target.value = '';
  };

  const submitQuest = async (e: React.FormEvent) => {
    e.preventDefault(); if (!qKid || !qTitle) return;
    let dueDate: string | undefined;
    if (qDueMode === 'days') { dueDate = new Date(Date.now() + Number(qDueDays) * 86400000).toISOString().split('T')[0]; }
    else { dueDate = qDueDate; }
    const boxId = qBoxRewardId || undefined;
    if (qKid === 'all') { await Promise.all(activeKids.map(k => createQuest(k.id, qTitle, +qExp, +qMoney, +qGem, qIcon, dueDate, boxId))); }
    else { await createQuest(qKid, qTitle, +qExp, +qMoney, +qGem, qIcon, dueDate, boxId); }
    setQTitle(''); setQExp('20'); setQMoney('0'); setQGem('0'); setQIcon('📜'); setQBoxRewardId('');
  };

  // ── Tab content renderers ──────────────────────────────────────────────────

  const renderPendingTab = () => (
    <div className="flex flex-col gap-4">
      {pendingCount === 0 ? (
        <div className={`${CARD} text-center py-10`}>
          <div className="text-4xl mb-3">✅</div>
          <div className="font-bold text-slate-300">目前沒有待審事項</div>
          <div className="text-xs text-muted mt-1">孩子提交任務或支出後會顯示於此</div>
        </div>
      ) : (
        <Section emoji="🔔" title={`待審事項 (${pendingCount})`} defaultOpen={true}>
          <div className="flex flex-col gap-3">
            {pendingClaims.map(c => {
              const kid = users.find(u => u.id === c.userId);
              return (
                <div key={c.id} className="rounded-2xl border border-pink-500/20 bg-pink-500/5 p-4 flex items-center gap-3">
                  <span className="text-2xl flex-shrink-0">📦</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{kid?.name} 抽中實體獎勵</div>
                    <div className="text-xs text-muted">{c.boxName} · {c.itemName}</div>
                  </div>
                  <button onClick={() => approveTreasureClaim(c.id)} className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-colors">核准發放</button>
                </div>
              );
            })}

            {pendingTransactions.map(t => {
              const env = envelopes.find(e => e.id === t.envelopeId);
              const kid = allKids.find(k => k.id === env?.ownerId);
              return (
                <div key={t.id} className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex items-center gap-3">
                  <span className="text-2xl flex-shrink-0">💰</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{kid?.name} 的支出</div>
                    <div className="text-xs text-muted leading-tight">{t.note} · {env?.name}</div>
                    <div className="text-xs font-black text-indigo-400 mt-1">{currencySymbol}{Math.abs(t.amount)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approveTransaction(t.id)} className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors">核准</button>
                    <button onClick={() => { if(confirm('確定駁回此支出並退還金額？')) rejectTransaction(t.id); }} className="px-3 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-500/60 hover:text-red-400 transition-colors">駁回</button>
                  </div>
                </div>
              );
            })}

            {pendingQuests.map(q => {
              const kid = users.find(u => u.id === q.ownerId);
              const isReviewing = reviewingQuestId === q.id;
              return (
                <div key={q.id} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <span className="text-2xl flex-shrink-0">{q.icon || '📜'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{q.title}</div>
                      <div className="text-xs text-muted">{kid?.name} · ⭐{q.expReward}EXP{q.moneyReward > 0 ? ` · ${q.moneyReward}` : ''}</div>
                    </div>
                    <button onClick={() => {
                      if (isReviewing) { setReviewingQuestId(null); return; }
                      setReviewingQuestId(q.id);
                      setReviewExpMult('1'); setReviewMoneyMult('1'); setReviewGemMult('1');
                      setReviewEmoji('😊'); setReviewComment('');
                    }} className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${isReviewing ? 'bg-white/10 text-white' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'}`}>
                      {isReviewing ? '✕ 取消' : '審核 →'}
                    </button>
                  </div>
                  {isReviewing && (
                    <div className="px-4 pb-4 border-t border-amber-500/10 pt-3 flex flex-col gap-3">
                      <div className="text-xs text-muted font-bold">評級預設（可自由調整倍率）</div>
                      <div className="grid grid-cols-3 gap-2">
                        {[{label:'🌟太棒了',em:'🌟',mult:'1.5'},{label:'😊不錯',em:'😊',mult:'1'},{label:'💪加油',em:'💪',mult:'0.5'}].map(p => (
                          <button key={p.label} type="button"
                            onClick={() => { setReviewExpMult(p.mult); setReviewMoneyMult(p.mult); setReviewGemMult(p.mult); setReviewEmoji(p.em); }}
                            className={`py-2 rounded-xl text-xs font-bold border transition-colors ${reviewEmoji === p.em ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-muted hover:border-white/30'}`}
                          >{p.label}</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {([['EXP倍率', reviewExpMult, setReviewExpMult],['$倍率', reviewMoneyMult, setReviewMoneyMult],['💎倍率', reviewGemMult, setReviewGemMult]] as const).map(([lbl, val, setter]) => (
                          <div key={String(lbl)}>
                            <label className="text-[10px] text-muted block mb-1">{String(lbl)}</label>
                            <input type="number" step="0.1" min="0" max="5" className={`${INPUT} text-sm py-2 text-center`}
                              value={String(val)} onChange={e => setter(e.target.value)} />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 text-[11px] flex-wrap">
                        <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">⭐ {Math.round(q.expReward * +reviewExpMult)} EXP</span>
                        {q.moneyReward > 0 && <span className="bg-green-500/20 text-green-300 px-2 py-0.5 rounded">💰 ${Math.round(q.moneyReward * +reviewMoneyMult)}</span>}
                        {(q.gemReward || 0) > 0 && <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">💎 {Math.round((q.gemReward || 0) * +reviewGemMult)}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {['😊','👏','🌟','💪','😉','🤔','💯','❤️','👍','👎'].map(em => (
                          <button key={em} type="button" onClick={() => setReviewEmoji(em)}
                            className={`w-8 h-8 rounded-lg text-lg transition-all ${reviewEmoji === em ? 'bg-primary/30 scale-110' : 'bg-white/5 hover:bg-white/10'}`}>{em}</button>
                        ))}
                      </div>
                      <input className={`${INPUT} text-sm`} placeholder="評語（選填）" value={reviewComment} onChange={e => setReviewComment(e.target.value)} />
                      <div className="grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => { delayQuest(q.id, reviewComment, reviewEmoji); setReviewingQuestId(null); }}
                          className="py-2.5 rounded-xl text-xs font-bold bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors">⏳ 延期</button>
                        <button type="button" onClick={() => { rejectQuest(q.id, reviewComment, reviewEmoji); setReviewingQuestId(null); }}
                          className="py-2.5 rounded-xl text-xs font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">❌ 拒絕</button>
                        <button type="button" onClick={() => {
                          approveQuestWithFeedback(q.id, 'good', reviewEmoji, reviewComment, +reviewExpMult, +reviewMoneyMult, +reviewGemMult);
                          setReviewingQuestId(null);
                        }} className="py-2.5 rounded-xl text-xs font-bold bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors">✅ 核准</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );

  const renderQuestsTab = () => (
    <div className="flex flex-col gap-4">
      <Section emoji="⚔️" title="任務管理" defaultOpen={true}>
        <div className="flex gap-1 bg-black/30 p-1 rounded-2xl mb-4 border border-white/5">
          {(['single', 'routine'] as const).map(tab => (
            <button key={tab} onClick={() => setQuestTab(tab)} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${questTab === tab ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}>
              {tab === 'single' ? '➕ 單次任務' : '🔁 固定任務'}
            </button>
          ))}
        </div>
        {questTab === 'single' ? (
          <form onSubmit={submitQuest} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <EmojiInput value={qIcon} onChange={setQIcon} label="圖示" />
              <div className="flex-1">
                <label className="text-xs text-slate-400 block mb-1.5">任務名稱</label>
                <input className={INPUT} placeholder="洗碗、倒垃圾..." value={qTitle} onChange={e => setQTitle(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">指派給</label>
              <select className={INPUT} value={qKid} onChange={e => setQKid(e.target.value)} required>
                <option value="">選擇孩子...</option>
                <option value="all">全部孩子</option>
                {activeKids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[{label:'⭐ EXP',val:qExp,set:setQExp},{label:'💰 金錢',val:qMoney,set:setQMoney},{label:'💎 寶石',val:qGem,set:setQGem}].map(({label,val,set}) => (
                <div key={label}>
                  <label className="text-xs text-slate-400 block mb-1.5">{label}</label>
                  <input type="number" min="0" className={INPUT} value={val} onChange={e => set(e.target.value)} />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">截止日期</label>
              <div className="flex gap-2 items-center">
                <select className={`${INPUT} flex-shrink-0`} style={{width:'120px'}} value={qDueMode} onChange={e => setQDueMode(e.target.value as 'days' | 'date')}>
                  <option value="days">天數後</option>
                  <option value="date">指定日期</option>
                </select>
                {qDueMode === 'days'
                  ? <input type="number" min="0" className={`${INPUT} flex-1`} value={qDueDays} onChange={e => setQDueDays(e.target.value)} placeholder="1" />
                  : <input type="date" className={`${INPUT} flex-1`} value={qDueDate} onChange={e => setQDueDate(e.target.value)} />}
              </div>
            </div>
            {treasureBoxes.length > 0 && (
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">🎁 寶箱獎勵 (選填)</label>
                <select className={INPUT} value={qBoxRewardId} onChange={e => setQBoxRewardId(e.target.value)}>
                  <option value="">(無寶箱獎勵)</option>
                  {treasureBoxes.map(box => <option key={box.id} value={box.id}>{box.name}</option>)}
                </select>
              </div>
            )}
            <button type="submit" className={`${BTN} w-full bg-primary text-white text-base mt-1`}>發布任務</button>
          </form>
        ) : (
          <RoutineQuestPanel activeKids={activeKids} allKids={allKids} routineQuests={routineQuests} treasureBoxes={treasureBoxes} addRoutineQuest={addRoutineQuest} updateRoutineQuest={updateRoutineQuest} deleteRoutineQuest={deleteRoutineQuest} forceGenerateRoutineQuests={forceGenerateRoutineQuests} />
        )}
        <div className="mt-6"><GamificationAdmin /></div>

        {/* ② 任務完成率統計 */}
        {allKids.length > 0 && (() => {
          const kidStats = allKids.map(kid => {
            const kidQuests = quests.filter(q => q.ownerId === kid.id);
            const done = kidQuests.filter(q => q.status === 'completed').length;
            const total = kidQuests.length;
            const rate = total > 0 ? Math.round((done / total) * 100) : 0;
            return { name: kid.name, done, total, rate };
          });
          return (
            <div className="rounded-2xl bg-white/5 border border-white/5 p-4 flex flex-col gap-3 mt-4">
              <div className="text-xs text-muted font-bold uppercase tracking-wider">任務完成率</div>
              {kidStats.map(({ name, done, total, rate }) => (
                <div key={name} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{name}</span>
                    <span className="text-muted">{done}/{total} 任務 · {rate}%</span>
                  </div>
                  <div className="h-4 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${rate}%`, background: rate >= 80 ? 'linear-gradient(90deg,#10b981,#34d399)' : rate >= 50 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#ef4444,#f87171)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </Section>
    </div>
  );

  const renderFamilyTab = () => (
    <div className="flex flex-col gap-4">
      {/* Kids management */}
      <Section emoji="👨‍👩‍👧" title="孩子帳戶" defaultOpen={true}>
        <div className="flex flex-col gap-4">
          {/* ① 孩子資產對比長條圖 */}
          {allKids.length > 0 && (() => {
            const kidAssets = allKids.map(kid => {
              const kidEnvs = envelopes.filter(e => e.ownerId === kid.id);
              const spend = kidEnvs.filter(e => e.type === 'spendable').reduce((s, e) => s + e.balance, 0);
              const invest = kidEnvs.filter(e => e.type === 'investing').reduce((s, e) => s + e.balance, 0);
              return { name: kid.name, spend, invest, total: spend + invest };
            });
            const maxTotal = Math.max(...kidAssets.map(k => k.total), 1);
            return (
              <div className="rounded-2xl bg-white/5 border border-white/5 p-4 flex flex-col gap-3">
                <div className="text-xs text-muted font-bold uppercase tracking-wider">孩子資產對比</div>
                {kidAssets.map(({ name, spend, invest, total }) => (
                  <div key={name} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold">{name}</span>
                      <span className="text-muted">{currencySymbol}{total}</span>
                    </div>
                    <div className="h-5 rounded-full bg-white/5 overflow-hidden flex">
                      <div
                        className="h-full rounded-l-full transition-all duration-700"
                        style={{ width: `${(spend / maxTotal) * 100}%`, background: 'linear-gradient(90deg,#6366f1,#818cf8)' }}
                        title={`可動用 ${currencySymbol}${spend}`}
                      />
                      <div
                        className="h-full transition-all duration-700"
                        style={{ width: `${(invest / maxTotal) * 100}%`, background: 'linear-gradient(90deg,#10b981,#34d399)', borderRadius: invest > 0 && spend === 0 ? '9999px' : '0 9999px 9999px 0' }}
                        title={`儲蓄 ${currencySymbol}${invest}`}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex gap-4 mt-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />可動用
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />儲蓄
                  </div>
                </div>
              </div>
            );
          })()}
          <form onSubmit={e => { e.preventDefault(); if (newKidName) { addKid(newKidName); setNewKidName(''); } }} className="flex gap-2">
            <input className={`${INPUT} flex-1`} placeholder="新增孩子名稱..." value={newKidName} onChange={e => setNewKidName(e.target.value)} />
            <button type="submit" className={`${BTN} bg-primary text-white px-5`}><PlusCircle size={18} /></button>
          </form>
          {allKids.map(kid => {
            const kidEnvs = envelopes.filter(e => e.ownerId === kid.id);
            const spend = kidEnvs.filter(e => e.type === 'spendable').reduce((s, e) => s + e.balance, 0);
            const invest = kidEnvs.filter(e => e.type === 'investing').reduce((s, e) => s + e.balance, 0);
            const isOpen = expandedKidId === kid.id;
            return (
              <div key={kid.id} className={`rounded-2xl border ${kid.isHidden ? 'border-white/5 opacity-60' : 'border-white/10'} overflow-hidden`}>
                <div className="flex items-center gap-3 p-4 bg-white/5">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/50 to-info/50 flex items-center justify-center font-black text-lg flex-shrink-0">{kid.name.charAt(0)}</div>
                  {editingKidId === kid.id ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input className={`${INPUT} flex-1 min-w-0 text-sm py-2`} value={editingKidName} onChange={e => setEditingKidName(e.target.value)} autoFocus />
                      <button onClick={() => { updateKid(kid.id, editingKidName); setEditingKidId(null); }} className="p-2 text-green-400"><Check size={18} /></button>
                      <button onClick={() => setEditingKidId(null)} className="p-2 text-slate-400"><X size={18} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm flex items-center gap-2 flex-wrap">
                          {kid.name}
                          <span className="text-[11px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">Lv.{kid.level}</span>
                          {kid.isHidden && <span className="text-[10px] bg-white/10 text-muted px-1.5 rounded-full">隱藏</span>}
                        </div>
                        <div className="text-xs text-muted mt-0.5">💎 {kid.gems || 0} · ⭐ {kid.exp} EXP</div>
                        {(kid.googleUid || kid.googleEmail) ? (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] bg-blue-500/15 border border-blue-500/25 text-blue-300 px-2 py-0.5 rounded-full">
                              {kid.googleEmail ? `已綁定: ${kid.googleEmail}` : '已綁定 Google 帳號'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] bg-white/5 border border-white/10 text-slate-500 px-2 py-0.5 rounded-full">未綁定 Google 帳號</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => { enterKidPreview(kid.id); navigate('/kid'); }} className="p-2.5 rounded-xl hover:bg-amber-500/20 text-amber-400/60 hover:text-amber-400 transition-colors" title={`以 ${kid.name} 身份查看`}><Eye size={16} /></button>
                        <button onClick={() => { setEditingKidId(kid.id); setEditingKidName(kid.name); }} className="p-2.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => toggleHideKid(kid.id)} className="p-2.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">{kid.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                        <button onClick={() => { if (confirm(`刪除「${kid.name}」？`)) deleteKid(kid.id); }} className="p-2.5 rounded-xl hover:bg-error/20 text-error/60 hover:text-error transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 border-t border-white/5">
                  <div className="p-3 text-center border-r border-white/5">
                    <div className="text-[10px] text-muted mb-0.5">可動用</div>
                    <div className="font-black text-primary text-lg">{currencySymbol}{spend}</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[10px] text-muted mb-0.5">儲蓄</div>
                    <div className="font-black text-green-400 text-lg">{currencySymbol}{invest}</div>
                  </div>
                </div>
                <button onClick={() => setExpandedKidId(isOpen ? null : kid.id)}
                  className="w-full py-3 flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors border-t border-white/5">
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {isOpen ? '收起設定' : '展開設定'}
                </button>
                {isOpen && (
                  <div className="p-4 border-t border-white/5 bg-black/20 flex flex-col gap-5">
                    {/* PIN */}
                    <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted font-bold uppercase flex items-center gap-1"><Lock size={12} /> 認證 PIN 碼</div>
                        <div className="text-[10px] text-slate-500 italic">預設為 0000</div>
                      </div>
                      {pinEditingId === kid.id ? (
                        <div className="flex gap-2">
                          <input type="text" className={`${INPUT} flex-1 font-mono tracking-widest text-center`}
                            value={pinEditingValue} onChange={e => setPinEditingValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            maxLength={4} placeholder="4 位數字" autoFocus />
                          <button onClick={() => { if (pinEditingValue.length === 4) { setUserPin(kid.id, pinEditingValue); setPinEditingId(null); } }} className="btn btn-primary px-3"><Check size={16} /></button>
                          <button onClick={() => setPinEditingId(null)} className="btn btn-ghost px-3 text-muted"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-lg font-bold tracking-[0.3em] text-white bg-black/40 px-3 py-1 rounded-lg border border-white/5">{kid.pin || '0000'}</span>
                            <span className="text-[10px] text-slate-500">家長可直接查看</span>
                          </div>
                          <button onClick={() => { setPinEditingId(kid.id); setPinEditingValue(kid.pin || '0000'); }}
                            className="text-xs text-primary font-bold flex items-center gap-1"><Edit2 size={12} /> 修改</button>
                        </div>
                      )}
                    </div>
                    {/* Individual Allowance */}
                    <div className="flex flex-col gap-3 p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-indigo-300 font-bold uppercase flex items-center gap-1.5"><TrendingUp size={12} /> 自動派發設定</div>
                        {editingKidAllowId !== kid.id && (
                          <button onClick={() => startEditingKidAllowance(kid)} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"><Edit2 size={10} /> 修改設定</button>
                        )}
                      </div>
                      {editingKidAllowId === kid.id ? (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted ml-1">派發金額 ({currencySymbol})</span>
                              <input type="number" className={INPUT} value={kaAmount} onChange={e => setKaAmount(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted ml-1">可動用比例 (%)</span>
                              <input type="number" className={INPUT} value={kaRatio} onChange={e => setKaRatio(e.target.value)} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted ml-1">派發週期</span>
                            <div className="flex gap-1 bg-black/20 p-1 rounded-xl">
                              {(['weekly', 'monthly'] as const).map(m => (
                                <button key={m} onClick={() => setKaMode(m)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${kaMode === m ? 'bg-indigo-500 text-white shadow-lg' : 'text-muted hover:text-white'}`}>
                                  {m === 'weekly' ? '每週' : '每月'}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted ml-1">派發日期</span>
                            {kaMode === 'weekly' ? (
                              <div className="flex justify-between gap-1">
                                {[1,2,3,4,5,6,0].map(d => (
                                  <button key={d} onClick={() => setKaDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${kaDays.includes(d) ? 'bg-indigo-500 text-white' : 'bg-white/5 text-muted'}`}>
                                    {['日','一','二','三','四','五','六'][d]}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <select className={INPUT} value={kaDays[0] || 1} onChange={e => setKaDays([Number(e.target.value)])}>
                                {Array.from({length: 28}, (_, i) => <option key={i+1} value={i+1}>{i+1} 號</option>)}
                              </select>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted ml-1">派發時間</span>
                            <div className="flex items-center gap-2">
                              <select className={`${INPUT} py-2 text-sm`} value={kaHour} onChange={e => setKaHour(Number(e.target.value))}>
                                {Array.from({length: 24}, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                              </select>
                              <span className="text-white">:</span>
                              <select className={`${INPUT} py-2 text-sm`} value={kaMinute} onChange={e => setKaMinute(Number(e.target.value))}>
                                {Array.from({length: 12}, (_, i) => <option key={i*5} value={i*5}>{String(i*5).padStart(2, '0')}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => { if (kaDays.length === 0) return alert('請選擇派發日期'); updateKidAllowance(kid.id, Number(kaAmount), Number(kaRatio), { period: kaMode, days: kaDays, hour: kaHour, minute: kaMinute }); setEditingKidAllowId(null); }}
                              className={`${BTN} flex-1 bg-indigo-500 text-white text-xs h-10`}>儲存設定</button>
                            <button onClick={() => setEditingKidAllowId(null)} className={`${BTN} px-3 bg-white/10 text-muted text-xs h-10`}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-[11px]">
                          <div className="flex flex-col gap-0.5">
                            <div className="text-muted">定期金額</div>
                            <div className="font-bold text-white">{currencySymbol}{kid.allowanceAmount || 0} ({kid.allowanceRatio || 0}% 可用)</div>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <div className="text-muted">派發時程</div>
                            <div className="font-bold text-white">
                              {kid.allowanceSettings ? (
                                <>
                                  {kid.allowanceSettings.period === 'weekly'
                                    ? '每週 ' + kid.allowanceSettings.days.sort().map((d:number) => ['日','一','二','三','四','五','六'][d]).join('、')
                                    : '每月 ' + kid.allowanceSettings.days[0] + ' 號'}
                                  <span className="ml-1 text-indigo-300">
                                    {String(kid.allowanceSettings.hour ?? 0).padStart(2, '0')}:{String(kid.allowanceSettings.minute ?? 0).padStart(2, '0')}
                                  </span>
                                </>
                              ) : <span className="text-slate-500 italic">依家庭預設設定</span>}
                            </div>
                          </div>
                          {kid.nextAllowanceDate && (
                            <div className="col-span-2 mt-1 py-1 px-2 bg-black/30 rounded-lg flex items-center justify-between border border-white/5">
                              <span className="text-muted">預計下次派發</span>
                              <span className="font-mono text-indigo-300">{new Date(kid.nextAllowanceDate).toLocaleString('zh-TW', { month:'numeric', day:'numeric', hour:'numeric', minute:'numeric', hour12: false })}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Spending license */}
                    <KidLicenseRow kid={kid} currencySymbol={currencySymbol} updateKidLicense={updateKidLicense} />
                    {/* Envelopes */}
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-muted font-bold uppercase">信封列表</div>
                      {kidEnvs.map(env => {
                        const isProtected = env.name === '存錢筒' || env.name === '隨身錢包';
                        return <KidEnvelopeRow key={env.id} env={env} transactions={transactions} currencySymbol={currencySymbol} addTransaction={addTransaction} updateEnvelope={updateEnvelope} deleteEnvelope={deleteEnvelope} toggleHideEnvelope={toggleHideEnvelope} setEnvelopeGoal={setEnvelopeGoal} clearEnvelopeGoal={clearEnvelopeGoal} protected={isProtected} />;
                      })}
                      {expandedEnvKidId === kid.id ? (
                        <div className="flex flex-col gap-2 mt-1 p-3 bg-black/20 rounded-2xl border border-white/5">
                          <div className="flex gap-2">
                            <EmojiInput value={newEnvIcon} onChange={setNewEnvIcon} />
                            <input className={`${INPUT} flex-1`} placeholder="信封名稱..." value={newEnvName} onChange={e => setNewEnvName(e.target.value)} />
                          </div>
                          <select className={INPUT} value={newEnvType} onChange={e => setNewEnvType(e.target.value as 'spendable' | 'investing')}>
                            <option value="spendable">可動用</option>
                            <option value="investing">儲蓄（不可動用）</option>
                          </select>
                          <div className="flex gap-2">
                            <button onClick={() => { if (newEnvName) { addEnvelope(kid.id, newEnvName, newEnvType, newEnvIcon); setNewEnvName(''); setNewEnvIcon('✉️'); setExpandedEnvKidId(null); } }} className={`${BTN} flex-1 bg-primary text-white`}>確認新增</button>
                            <button onClick={() => setExpandedEnvKidId(null)} className={`${BTN} px-4 bg-white/10 text-muted`}><X size={16} /></button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setExpandedEnvKidId(kid.id)} className={`${BTN} w-full bg-white/5 text-muted hover:bg-white/10 hover:text-white`}><PlusCircle size={16} /> 新增信封</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Allowance */}
      <Section emoji="💸" title="零用錢派發" defaultOpen={false}>
        {(() => {
          const walletPct = Math.min(100, Math.max(0, Number(allowWalletPct) || 70));
          const piggyPct = 100 - walletPct;
          const totalAmt = Math.max(0, Number(allowAmount) || 0);
          const walletAmt = Math.floor(totalAmt * walletPct / 100);
          const piggyAmt = totalAmt - walletAmt;
          return (
            <div className="flex flex-col gap-4">
              <div className="flex gap-1 bg-black/30 p-1 rounded-2xl border border-white/5">
                {(['auto', 'manual'] as const).map(tab => (
                  <button key={tab} onClick={() => setAllowTab(tab)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${allowTab === tab ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}>
                    {tab === 'auto' ? '🔁 每周自動派發' : '✋ 單次手動派發'}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">💰 派發總金額（{currencySymbol}）</label>
                    <input type="number" min="0" className={INPUT} value={allowAmount} onChange={e => setAllowAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">👤 派發對象</label>
                    <select className={INPUT} value={allowTarget} onChange={e => setAllowTarget(e.target.value)}>
                      <option value="all">所有孩子</option>
                      {activeKids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400">👛 隨身錢包 vs 🐷 存錢筒 比例</label>
                    <span className="text-xs font-bold text-primary">{walletPct}% / {piggyPct}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5" className="w-full accent-primary" value={walletPct} onChange={e => setAllowWalletPct(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-2.5 text-center">
                      <div className="text-[10px] text-slate-400 mb-0.5">👛 隨身錢包</div>
                      <div className="font-black text-primary text-lg">{currencySymbol}{walletAmt}</div>
                      <div className="text-[10px] text-slate-500">{walletPct}%</div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2.5 text-center">
                      <div className="text-[10px] text-slate-400 mb-0.5">🐷 存錢筒</div>
                      <div className="font-black text-green-400 text-lg">{currencySymbol}{piggyAmt}</div>
                      <div className="text-[10px] text-slate-500">{piggyPct}%</div>
                    </div>
                  </div>
                </div>
              </div>
              {allowTab === 'auto' && (
                <div className="flex flex-col gap-3 p-3 bg-black/20 rounded-2xl border border-white/5">
                  <div className="text-xs text-muted font-bold uppercase">設定派發金額與比例</div>
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-300">
                    💡 您在此設定孩子每次派發時應領取的金額。實際派發日期請於「自動派發排程」區塊設定。
                  </div>
                  <button onClick={() => { if (confirm(`確定設定自動派發金額 ${currencySymbol}${totalAmt} 給${allowTarget === 'all' ? '所有孩子' : activeKids.find(k=>k.id===allowTarget)?.name}？`)) {
                    const targets = allowTarget === 'all' ? activeKids : activeKids.filter(k => k.id === allowTarget);
                    targets.forEach(k => updateKidAllowance(k.id, totalAmt, walletPct));
                  }}} className={`${BTN} w-full bg-primary/80 hover:bg-primary text-white`}>💾 儲存派發金額設定</button>
                </div>
              )}
              {allowTab === 'manual' && (
                <div className="flex flex-col gap-3 p-3 bg-black/20 rounded-2xl border border-white/5">
                  <div className="text-xs text-muted font-bold uppercase">單次立即派發</div>
                  {(() => {
                    const targets = allowTarget === 'all' ? activeKids : activeKids.filter(k => k.id === allowTarget);
                    const missingSpendable = targets.filter(k => !envelopes.some(e => e.ownerId === k.id && e.type === 'spendable'));
                    const missingInvesting = piggyPct > 0 ? targets.filter(k => !envelopes.some(e => e.ownerId === k.id && e.type === 'investing')) : [];
                    if (missingSpendable.length > 0 || missingInvesting.length > 0) {
                      return (
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-xs text-orange-300 flex flex-col gap-1">
                          <span className="font-bold">⚠️ 信封警告</span>
                          {missingSpendable.map(k => <span key={k.id}>「{k.name}」沒有可動用信封，可動用部分將無法派發</span>)}
                          {missingInvesting.map(k => <span key={k.id}>「{k.name}」沒有儲蓄信封，{currencySymbol}{Math.round(totalAmt * piggyPct / 100)} 將無法存入</span>)}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                    ⚠️ 將立即把 <strong>{currencySymbol}{totalAmt}</strong> 派發給 <strong>{allowTarget === 'all' ? '所有孩子' : activeKids.find(k=>k.id===allowTarget)?.name}</strong>，並按 {walletPct}%/{piggyPct}% 分配到隨身錢包和存錢筒。
                  </div>
                  <button onClick={() => { if (totalAmt <= 0) { alert('請輸入有效金額'); return; } if (confirm(`確定立即派發 ${currencySymbol}${totalAmt}？`)) { manualDistributeAllowance(allowTarget, totalAmt, walletPct); } }}
                    className={`${BTN} w-full bg-gradient-to-r from-primary to-info text-white text-base font-black`}>🚀 立即執行派發</button>
                </div>
              )}
            </div>
          );
        })()}
      </Section>

      {/* Allowance Schedule */}
      <Section emoji="📅" title="自動派發排程" defaultOpen={false}>
        <div className="flex flex-col gap-4">
          <div className="text-xs text-muted leading-relaxed">設定系統自動發放零用錢的時間。系統會根據此設定自動計算下次派發日。</div>
          <div className="flex gap-1 bg-black/30 p-1 rounded-2xl border border-white/5">
            {(['weekly', 'monthly'] as const).map(mode => (
              <button key={mode} onClick={() => setAllowMode(mode)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${allowMode === mode ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}>
                {mode === 'weekly' ? '每週派發' : '每月派發'}
              </button>
            ))}
          </div>
          {allowMode === 'weekly' ? (
            <div className="flex flex-col gap-3 p-4 bg-black/20 rounded-2xl border border-white/5">
              <div className="text-xs text-muted font-bold uppercase tracking-wider">選擇每週派發日（可多選）</div>
              <div className="grid grid-cols-7 gap-2">
                {[{l:'日',v:0},{l:'一',v:1},{l:'二',v:2},{l:'三',v:3},{l:'四',v:4},{l:'五',v:5},{l:'六',v:6}].map(d => (
                  <button key={d.v} type="button" onClick={() => setAutoAllowDays(p => p.includes(d.v) ? p.filter(x => x !== d.v) : [...p, d.v])}
                    className={`aspect-square rounded-full font-black text-sm transition-all active:scale-90 flex items-center justify-center ${autoAllowDays.includes(d.v) ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white/10 text-muted hover:bg-white/20'}`}>
                    {d.l}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-4 bg-black/20 rounded-2xl border border-white/5">
              <div className="text-xs text-muted font-bold uppercase tracking-wider">選擇每月固定日期</div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                  <button key={d} type="button" onClick={() => setMonthlyDay(String(d))}
                    className={`aspect-square rounded-lg font-bold text-xs transition-all active:scale-90 flex items-center justify-center ${monthlyDay === String(d) ? 'bg-primary text-white shadow-lg' : 'bg-white/5 text-muted hover:bg-white/10'}`}>
                    {d}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 italic">* 若當月無此日期，系統將於次月 1 號處理（建議設定 1-28 號）。</div>
            </div>
          )}
          <div className="flex flex-col gap-3 p-4 bg-black/20 rounded-2xl border border-white/5">
            <div className="text-xs text-muted font-bold uppercase tracking-wider">選擇派發時間</div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <select className={INPUT} value={allowHour} onChange={e => setAllowHour(Number(e.target.value))}>
                  {Array.from({ length: 24 }).map((_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')} 點</option>)}
                </select>
              </div>
              <span className="text-white font-bold">:</span>
              <div className="flex-1">
                <select className={INPUT} value={allowMinute} onChange={e => setAllowMinute(Number(e.target.value))}>
                  {Array.from({ length: 12 }).map((_, i) => <option key={i * 5} value={i * 5}>{String(i * 5).padStart(2, '0')} 分</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex flex-col gap-2">
            <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5"><RefreshCw size={12} /> 預計下次派發時程</div>
            <div className="text-sm font-medium text-slate-300">
              {(() => {
                const days = allowMode === 'weekly' ? autoAllowDays : [Number(monthlyDay)];
                if (days.length === 0) return '請先選擇派發日期';
                const nextIso = getNextAllowanceDate(new Date(), { period: allowMode, days, hour: allowHour, minute: allowMinute });
                const nextDate = new Date(nextIso);
                const formattedDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')} ${String(nextDate.getHours()).padStart(2, '0')}:${String(nextDate.getMinutes()).padStart(2, '0')}`;
                return (
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-white font-bold text-lg">{formattedDate}</span>
                    <span className="text-xs text-slate-400">
                      {allowMode === 'weekly'
                        ? `每週 ${autoAllowDays.sort((a,b)=>a-b).map(d => ['日','一','二','三','四','五','六'][d]).join('、')} ${String(allowHour).padStart(2,'0')}:${String(allowMinute).padStart(2,'0')} 自動執行`
                        : `每月 ${monthlyDay} 號 ${String(allowHour).padStart(2,'0')}:${String(allowMinute).padStart(2,'0')} 自動執行`}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
          <button onClick={() => { const days = allowMode === 'weekly' ? autoAllowDays : [Number(monthlyDay)]; if (days.length === 0) return alert('請至少選擇一個派發日期'); updateAllowanceSettings(allowMode, days, allowHour, allowMinute); alert('自動派發設定已儲存！'); }}
            className={`${BTN} w-full bg-primary text-white shadow-lg shadow-primary/20 mt-2`}>💾 儲存排程設定</button>
        </div>
      </Section>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="flex flex-col gap-4">
      {/* Weekly/monthly report */}
      <button
        onClick={() => setShowReport(true)}
        className={`${CARD} flex items-center gap-4 hover:border-indigo-400/40 transition-colors active:scale-[0.99]`}
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>📈</div>
        <div className="flex-1 text-left">
          <div className="font-black text-base">週報 / 月報</div>
          <div className="text-xs text-muted">每週/月自動彙整收支、任務、能量、目標進度，可匯出圖片分享</div>
        </div>
        <span className="text-indigo-300 font-bold">→</span>
      </button>

      {/* Chart */}
      <Section emoji="📊" title="花費統計" defaultOpen={false}>
        {/* Sub-tab selector */}
        <div className="flex gap-1 bg-black/30 p-1 rounded-2xl mb-5 border border-white/5">
          {([['pie', '圓餅圖'], ['trend', '趨勢折線'], ['monthly', '月度收支']] as const).map(([t, l]) => (
            <button key={t} onClick={() => setSpendingSubTab(t)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${spendingSubTab === t ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}>{l}</button>
          ))}
        </div>

        {/* Original pie chart */}
        {spendingSubTab === 'pie' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-44 h-44 rounded-full border-4 border-white/5 shadow-xl"
              style={{ background: totalCat === 0 ? '#1e293b' : `conic-gradient(${(() => { let c = 0; return categoryData.map((d, i) => { const s = c, e = c + (d.value / totalCat) * 100; c = e; return `${COLORS[i % COLORS.length]} ${s}% ${e}%`; }).join(', '); })()})` }} />
            <div className="w-full space-y-2.5">
              {categoryData.length === 0
                ? <p className="text-center text-muted text-sm">尚無分類支出</p>
                : categoryData.slice(0, 6).map((d, i) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-sm w-20 truncate">{d.icon} {d.name}</span>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / totalCat) * 100}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                    <span className="text-sm font-black w-14 text-right">{currencySymbol}{d.value}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ③ 收支趨勢折線圖 */}
        {spendingSubTab === 'trend' && (() => {
          if (monthlyData.length === 0) return <p className="text-center text-muted text-sm py-4">尚無交易紀錄</p>;
          const maxVal = Math.max(...monthlyData.flatMap(m => [m.income, m.expense]), 1);
          const H = 120;
          const W = 100 / (monthlyData.length - 1 || 1);
          return (
            <div className="flex flex-col gap-3">
              <div className="text-xs text-muted font-bold uppercase tracking-wider">近6個月收支趨勢</div>
              <div className="relative w-full" style={{ height: `${H + 24}px` }}>
                <svg className="absolute inset-0 w-full" style={{ height: `${H}px` }} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
                  {/* grid lines */}
                  {[0, 25, 50, 75, 100].map(p => (
                    <line key={p} x1="0" y1={H * p / 100} x2="100" y2={H * p / 100} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                  ))}
                  {/* income line */}
                  <polyline points={monthlyData.map((m, i) => `${(i * W).toFixed(1)},${(H - (m.income / maxVal) * H).toFixed(1)}`).join(' ')}
                    fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {/* expense line */}
                  <polyline points={monthlyData.map((m, i) => `${(i * W).toFixed(1)},${(H - (m.expense / maxVal) * H).toFixed(1)}`).join(' ')}
                    fill="none" stroke="#f87171" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {/* income dots */}
                  {monthlyData.map((m, i) => (
                    <circle key={`in${i}`} cx={`${(i * W).toFixed(1)}%`} cy={(H - (m.income / maxVal) * H).toFixed(1)} r="2.5" fill="#34d399" />
                  ))}
                  {/* expense dots */}
                  {monthlyData.map((m, i) => (
                    <circle key={`ex${i}`} cx={`${(i * W).toFixed(1)}%`} cy={(H - (m.expense / maxVal) * H).toFixed(1)} r="2.5" fill="#f87171" />
                  ))}
                </svg>
                {/* x-axis labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between">
                  {monthlyData.map(m => (
                    <span key={m.month} className="text-[10px] text-muted">{m.month}月</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />收入</div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" />支出</div>
              </div>
            </div>
          );
        })()}

        {/* ④ 月度收支平衡長條圖 */}
        {spendingSubTab === 'monthly' && (() => {
          if (monthlyData.length === 0) return <p className="text-center text-muted text-sm py-4">尚無交易紀錄</p>;
          const maxTotal = Math.max(...monthlyData.flatMap(m => [m.income, m.expense]), 1);
          return (
            <div className="flex flex-col gap-3">
              <div className="text-xs text-muted font-bold uppercase tracking-wider">近6個月收支平衡</div>
              {monthlyData.map(m => (
                <div key={m.month} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{m.month}月</span>
                    <span className={m.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {m.balance >= 0 ? '+' : ''}{currencySymbol}{m.balance}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(m.income / maxTotal) * 100}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
                    </div>
                    <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(m.expense / maxTotal) * 100}%`, background: 'linear-gradient(90deg,#ef4444,#f87171)' }} />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />收入</div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" />支出</div>
              </div>
            </div>
          );
        })()}
      </Section>

      {/* Categories */}
      <Section emoji="🏷️" title="花費類別" defaultOpen={false}>
        <div className="flex flex-col gap-4">
          <form onSubmit={e => { e.preventDefault(); if (catName) { addExpenseCategory(catName, catIcon); setCatName(''); setCatIcon('🛒'); } }} className="flex items-end gap-2">
            <EmojiInput value={catIcon} onChange={setCatIcon} label="圖示" />
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1.5">類別名稱</label>
              <input className={INPUT} placeholder="食物、娛樂..." value={catName} onChange={e => setCatName(e.target.value)} required />
            </div>
            <button type="submit" className={`${BTN} bg-primary text-white px-4 self-end`}><PlusCircle size={18} /></button>
          </form>
          <div className="grid grid-cols-3 gap-2">
            {expenseCategories.map(cat => (
              editingCatId === cat.id ? (
                <div key={cat.id} className="flex flex-col items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-2xl p-3">
                  <EmojiInput value={editCatIcon} onChange={setEditCatIcon} />
                  <input className="w-full bg-slate-900/70 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-primary text-center"
                    value={editCatName} onChange={e => setEditCatName(e.target.value)} autoFocus />
                  <div className="flex gap-1 mt-0.5">
                    <button onClick={() => { updateExpenseCategory(cat.id, editCatName, editCatIcon); setEditingCatId(null); }} className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"><Check size={13} /></button>
                    <button onClick={() => setEditingCatId(null)} className="p-1.5 rounded-lg bg-white/10 text-muted hover:bg-white/20 transition-colors"><X size={13} /></button>
                  </div>
                </div>
              ) : (
                <div key={cat.id} className="relative group flex flex-col items-center gap-1.5 bg-white/5 border border-white/5 rounded-2xl p-3 hover:border-white/20 transition-colors">
                  <span className="text-3xl">{cat.icon}</span>
                  <span className="text-xs font-bold text-center leading-tight">{cat.name}</span>
                  <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); setEditCatIcon(cat.icon); }} className="p-1 rounded-lg bg-info/20 text-info hover:bg-info/30 transition-colors"><Edit2 size={11} /></button>
                    <button onClick={() => deleteExpenseCategory(cat.id)} className="p-1 rounded-lg bg-error/20 text-error hover:bg-error/30 transition-colors"><X size={11} /></button>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </Section>

      {/* Control Center */}
      <Section emoji={familyIcon} title={familyName || '家長控制中心'} defaultOpen={false}>
        <div className="flex flex-col gap-6">
          {/* Family name */}
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted font-bold uppercase">家庭設定</div>
            <div className="flex gap-2">
              <EmojiInput value={familyIcon} onChange={setFamilyIcon} label="圖示" />
              <div className="flex-1">
                <label className="text-xs text-slate-400 block mb-1.5">家庭名稱</label>
                {editingName ? (
                  <div className="flex gap-2">
                    <input className={`${INPUT} flex-1`} value={tempName} onChange={e => setTempName(e.target.value)} autoFocus />
                    <button onClick={() => { updateFamilyName(tempName); setEditingName(false); }} className="p-3 rounded-xl bg-green-500/20 text-green-400"><Check size={18} /></button>
                    <button onClick={() => { setTempName(familyName || ''); setEditingName(false); }} className="p-3 rounded-xl bg-white/10 text-muted"><X size={18} /></button>
                  </div>
                ) : (
                  <button onClick={() => { setTempName(familyName || ''); setEditingName(true); }} className="flex items-center gap-2 w-full bg-slate-900/70 border border-white/10 rounded-xl px-4 py-3 text-left hover:border-primary/40 transition-colors">
                    <span className="flex-1 font-bold">{familyName || '我的家庭'}</span>
                    <Edit2 size={15} className="text-muted" />
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Invite codes */}
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted font-bold uppercase">邀請碼</div>
            {[
              { label: '👨‍👩‍👧 管理員', code: adminInviteCode, type: 'admin' as const, color: 'text-primary', bg: 'bg-primary/10 border-primary/30', copied: copiedAdmin },
              { label: '🧒 小孩', code: kidInviteCode, type: 'kid' as const, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', copied: copiedKid },
            ].map(({ label, code, type, color, bg, copied }) => (
              <div key={type} className={`rounded-2xl border p-4 ${bg}`}>
                <div className="text-xs text-muted mb-2">{label}</div>
                <div className="flex items-center justify-between gap-3">
                  <span className={`font-mono text-2xl font-black tracking-widest ${color}`}>{code ?? '—'}</span>
                  <div className="flex gap-2">
                    <button onClick={() => code && copyCode(code, type)} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                      {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-muted" />}
                    </button>
                    <button onClick={() => regenerateInviteCode(type)} className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500/20 hover:text-amber-400 transition-colors text-muted"><RefreshCw size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Currency */}
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted font-bold uppercase flex items-center gap-1.5">🌐 幣別設定</div>
            <div className="grid grid-cols-3 gap-2">
              {[{code:'NT$',label:'TWD 新臺幣'},{code:'$',label:'USD 美元'},{code:'¥',label:'JPY 日圓'},{code:'€',label:'EUR 歐元'},{code:'HK$',label:'HKD 港幣'},{code:'¥',label:'CNY 人民幣'}].map(({ code, label }) => (
                <button key={label} onClick={() => updateCurrencySymbol(code)}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all ${currencySymbol === code ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-muted hover:border-white/30 hover:text-white'}`}>
                  <div className="text-lg">{code}</div>
                  <div className="text-[9px] mt-0.5 opacity-70">{label}</div>
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-500 text-center">目前幣別符號：<span className="text-white font-black">{currencySymbol}</span></div>
          </div>
          {/* Theme Picker */}
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted font-bold uppercase flex items-center gap-1.5">🎨 介面主題</div>
            <div className="grid grid-cols-2 gap-3">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setKidTheme(theme.id)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                    kidTheme === theme.id
                      ? 'border-primary bg-primary/10'
                      : 'border-white/10 bg-white/5 hover:border-white/30'
                  }`}
                >
                  {/* Mini preview */}
                  <div className="w-full h-10 rounded-xl mb-3 flex gap-1 p-1.5" style={{ background: theme.previewBg }}>
                    <div className="flex-1 rounded-lg" style={{ background: theme.previewCard }} />
                    <div className="flex-1 rounded-lg" style={{ background: theme.previewCard }} />
                  </div>
                  <div className="text-base mb-0.5">{theme.emoji}</div>
                  <div className="font-bold text-sm">{theme.name}</div>
                  <div className="text-xs text-muted mt-0.5">{theme.desc}</div>
                  {kidTheme === theme.id && (
                    <div className="text-[10px] text-primary font-bold mt-1.5 flex items-center gap-1">
                      <Check size={10} /> 目前使用
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted text-center">主題設定同時套用至家長與孩子端</div>
          </div>

          {/* Parent Transfer */}
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted font-bold uppercase flex items-center gap-1.5"><ArrowRightLeft size={13} /> 家長金額互轉（雙向）</div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 text-xs text-indigo-300">家長可在任意信封間雙向轉帳（含可動 ↔ 不可動）</div>
            <form onSubmit={async (e) => {
              e.preventDefault(); setPtError(null);
              const amount = Number(ptAmount);
              if (!ptFromId || !ptToId) { setPtError('請選擇轉出與轉入信封'); return; }
              if (ptFromId === ptToId) { setPtError('轉出與轉入信封不能相同'); return; }
              if (amount <= 0) { setPtError('金額必須大於 0'); return; }
              const fromEnv = envelopes.find(e => e.id === ptFromId);
              if (fromEnv && amount > fromEnv.balance) { setPtError(`「${fromEnv.name}」餘額不足（剩餘 ${currencySymbol}${fromEnv.balance}）`); return; }
              setPtLoading(true);
              try { await transferMoney(ptFromId, ptToId, amount, ptNote || '家長互轉'); setPtAmount(''); setPtNote(''); setPtError(null); }
              catch (err) { setPtError((err as Error)?.message || '轉帳失敗'); }
              finally { setPtLoading(false); }
            }} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">轉出信封</label>
                  <select className={INPUT} value={ptFromId} onChange={e => { setPtFromId(e.target.value); setPtError(null); }} required>
                    <option value="">選擇...</option>
                    {envelopes.filter(env => allKids.some(k => k.id === env.ownerId)).map(env => {
                      const owner = allKids.find(k => k.id === env.ownerId);
                      return <option key={env.id} value={env.id}>{owner?.name} · {env.name} ({currencySymbol}{env.balance})</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">轉入信封</label>
                  <select className={INPUT} value={ptToId} onChange={e => { setPtToId(e.target.value); setPtError(null); }} required>
                    <option value="">選擇...</option>
                    {envelopes.filter(env => allKids.some(k => k.id === env.ownerId) && env.id !== ptFromId).map(env => {
                      const owner = allKids.find(k => k.id === env.ownerId);
                      return <option key={env.id} value={env.id}>{owner?.name} · {env.name} ({currencySymbol}{env.balance})</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">金額</label>
                  <input type="number" min="0.01" step="0.01" placeholder="金額" className={`${INPUT} ${ptError ? 'border-red-500/60' : ''}`} value={ptAmount} onChange={e => { setPtAmount(e.target.value); setPtError(null); }} required />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">備註（選填）</label>
                  <input type="text" placeholder="家長互轉..." className={INPUT} value={ptNote} onChange={e => setPtNote(e.target.value)} />
                </div>
              </div>
              {ptError && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-red-400"><span>⚠️</span><span>{ptError}</span></div>}
              <button type="submit" disabled={ptLoading} className={`${BTN} w-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 disabled:opacity-40`}>
                <ArrowRightLeft size={16} />{ptLoading ? '轉帳中...' : '確認轉帳'}
              </button>
            </form>
          </div>
          {/* Interest */}
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted font-bold uppercase flex items-center gap-1.5"><TrendingUp size={13} /> 利息系統</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">利率 (小數)</label>
                <input type="number" step="0.001" min="0" className={INPUT} placeholder="0.05 = 5%" defaultValue={interestSettings?.rate ?? 0} onBlur={e => updateInterestSettings(+e.target.value, interestSettings?.period ?? 'monthly')} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">結算週期</label>
                <select className={INPUT} value={interestSettings?.period ?? 'monthly'} onChange={e => updateInterestSettings(interestSettings?.rate ?? 0, e.target.value as 'monthly' | 'yearly')}>
                  <option value="monthly">每月</option>
                  <option value="yearly">每年</option>
                </select>
              </div>
            </div>
          </div>
          {/* Theme */}
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted font-bold uppercase flex items-center gap-1.5"><ImageIcon size={13} /> 背景圖片</div>
            <input type="text" className={INPUT} placeholder="https://... 背景圖網址" defaultValue={themeSettings?.backgroundUrl ?? ''} onBlur={e => updateThemeSettings(e.target.value)} />
            {themeSettings?.backgroundUrl && (
              <div className="h-24 rounded-2xl overflow-hidden border border-white/10">
                <img src={themeSettings.backgroundUrl} alt="bg preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          {/* Stats */}
          <div className="flex flex-col gap-2">
            <div className="text-xs text-muted font-bold uppercase">家庭快速總覽</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '孩子總數', val: allKids.length, color: 'text-primary' },
                { label: '進行中任務', val: quests.filter(q => q.status === 'open').length, color: 'text-info' },
                { label: '家庭總資產', val: `${currencySymbol}${envelopes.reduce((s, e) => s + e.balance, 0)}`, color: 'text-green-400' },
                { label: '待審核任務', val: pendingQuests.length, color: 'text-amber-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-white/5 border border-white/5 rounded-2xl p-3 text-center">
                  <div className="text-[11px] text-muted mb-0.5">{label}</div>
                  <div className={`text-xl font-black ${color}`}>{val}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Backup */}
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted font-bold uppercase flex items-center gap-1.5"><Save size={13} /> 資料備份與還原</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleExportJSON} className="flex items-center justify-center gap-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 py-2 rounded-xl text-xs font-bold transition-colors">📥 匯出 JSON</button>
              <button onClick={handleExportCSV} className="flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 py-2 rounded-xl text-xs font-bold transition-colors">📊 匯出 CSV (交易)</button>
            </div>
            <div className="relative">
              <input type="file" ref={fileInputRef} onChange={onImportFileChange} accept=".json" className="hidden" />
              <button onClick={() => { if(confirm('⚠️ 警告：匯入資料將覆蓋目前的家庭設定。建議匯入前先手動備份目前資料。確定要繼續嗎？')) fileInputRef.current?.click(); }}
                className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white/70 py-2 rounded-xl text-xs font-bold transition-colors border border-dashed border-white/20">
                📤 匯入 JSON 備份
              </button>
            </div>
            {importStatus.type !== 'idle' && (
              <div className={`text-[10px] px-3 py-2 rounded-lg flex items-center gap-2 ${importStatus.type === 'loading' ? 'bg-blue-500/10 text-blue-300' : importStatus.type === 'success' ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'}`}>
                {importStatus.type === 'loading' ? '⌛ 處理中...' : importStatus.type === 'success' ? '✅ ' : '❌ '}{importStatus.message}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* History */}
      <Section emoji="📋" title="系統歷史紀錄" defaultOpen={false}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-1 bg-black/30 p-1 rounded-2xl border border-white/5">
            {(['quests','transactions'] as const).map(t => (
              <button key={t} onClick={() => setHistoryTab(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${historyTab===t?'bg-primary text-white shadow-lg':'text-muted hover:text-white'}`}>
                {t==='quests' ? '⚔️ 任務紀錄' : '💰 交易紀錄'}
              </button>
            ))}
          </div>
          {historyTab === 'quests' ? (
            <div className="flex flex-col gap-2">
              {quests.filter(q => q.status !== 'open' && q.status !== 'pending_approval').slice(0, 30).map(q => {
                const kid = users.find(u => u.id === q.ownerId);
                const SM: Record<string,{label:string;color:string}> = { completed:{label:'✅ 完成',color:'text-green-400'}, rejected:{label:'❌ 拒絕',color:'text-red-400'}, delayed:{label:'⏳ 延期',color:'text-orange-400'} };
                const s = SM[q.status] ?? {label:q.status,color:'text-muted'};
                return (
                  <div key={q.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/5 rounded-2xl">
                    <span className="text-xl flex-shrink-0">{q.icon||'📜'}</span>
                    <div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{q.title}</div><div className="text-xs text-muted">{kid?.name}</div></div>
                    <span className={`text-xs font-bold flex-shrink-0 ${s.color}`}>{s.label}</span>
                  </div>
                );
              })}
              {quests.filter(q => q.status!=='open'&&q.status!=='pending_approval').length===0 && <p className="text-center text-muted text-sm py-4">尚無歷史任務</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {[...transactions].sort((a,b) => Number(b.timestamp) - Number(a.timestamp)).slice(0,30).map(t => {
                const env = envelopes.find(e => e.id === t.envelopeId);
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/5 rounded-2xl">
                    <span className={`text-xl flex-shrink-0 ${t.amount>=0?'text-green-400':'text-red-400'}`}>{t.amount>=0?'📈':'📉'}</span>
                    <div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{t.note||(t.amount>=0?'收入':'支出')}</div><div className="text-xs text-muted">{env?.name}</div></div>
                    <span className={`font-black text-sm flex-shrink-0 ${t.amount>=0?'text-green-400':'text-red-400'}`}>{t.amount>=0?'+':''}{currencySymbol}{t.amount}</span>
                  </div>
                );
              })}
              {transactions.length===0 && <p className="text-center text-muted text-sm py-4">尚無交易紀錄</p>}
            </div>
          )}
        </div>
      </Section>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  // ── Available themes ───────────────────────────────────────────────────────
  const THEMES = [
    { id: 'pilot',  name: 'Pilot Interface', emoji: '🌟', desc: '明亮現代介面', previewBg: '#e8eef5', previewCard: '#ffffff' },
    { id: 'dark',   name: 'Dark Galactic',   emoji: '🌌', desc: '深色宇宙風格', previewBg: '#0b1120', previewCard: '#111827' },
  ] as const;

  return (
    <div data-theme={kidTheme} className="flex flex-col min-h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-info flex items-center justify-center text-white font-black text-lg flex-shrink-0">
          {currentUser.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="font-black text-base truncate">{familyName || '我的家庭'}</div>
          <div className="text-xs text-muted">家長主控台</div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <DigitalClock timezoneOffset={timezoneOffset} onChangeTimezone={updateTimezone} isAdmin={true} />
          {pendingCount > 0 && (
            <button onClick={() => setParentTab('pending')} className="flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-bold px-2.5 py-1.5 rounded-full">
              <span>🔔</span> {pendingCount}
            </button>
          )}
          {systemAdminRole && (
            <button onClick={() => navigate('/admin')} title="管理員面板"
              className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 hover:bg-amber-400/20 transition-colors">
              <Shield size={16} />
            </button>
          )}
          <button onClick={() => logout()} title="登出"
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Price fetch error notification */}
      {priceErrors.length > 0 && !priceErrorDismissed && (
        <div className="mx-3 mt-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black text-amber-400">⚠️ 投資價格備援通知</div>
            <button onClick={() => setPriceErrorDismissed(true)} className="text-[10px] text-muted">忽略</button>
          </div>
          {priceErrors.map((err, i) => (
            <div key={i} className="text-[10px] text-amber-300">
              {err.assetType}：{err.failedSource} 失效，改用 {err.fallbackSource}（{new Date(err.timestamp).toLocaleString('zh-TW')}）
            </div>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 px-3 pb-24 flex flex-col gap-4 mt-2">
        {parentTab === 'pending' && renderPendingTab()}
        {parentTab === 'quests' && renderQuestsTab()}
        {parentTab === 'family' && renderFamilyTab()}
        {parentTab === 'settings' && renderSettingsTab()}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {([
          { id: 'pending', emoji: '🔔', label: '待辦', badge: pendingCount },
          { id: 'quests',  emoji: '📋', label: '任務' },
          { id: 'family',  emoji: '👪', label: '家庭' },
          { id: 'settings',emoji: '⚙️', label: '設定' },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setParentTab(tab.id)}
            className={`bottom-nav-btn ${parentTab === tab.id ? 'active' : ''}`}>
            <div className="relative">
              <span style={{ fontSize: '22px', lineHeight: 1 }}>{tab.emoji}</span>
              {'badge' in tab && tab.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </div>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {showReport && (
        <ReportModal
          kids={allKids}
          envelopes={envelopes}
          transactions={transactions}
          quests={quests}
          expenseCategories={expenseCategories}
          currencySymbol={currencySymbol}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
};

export default ParentDashboard;

// ─── KidLicenseRow (spending cap + energy license) ───────────────────────────
const KidLicenseRow: React.FC<{
  kid: User;
  currencySymbol: string;
  updateKidLicense: (kidId: string, max: number) => Promise<void>;
}> = ({ kid, currencySymbol, updateKidLicense }) => {
  const lic = kid.spendingLicense;
  const [editing, setEditing] = useState(false);
  const [maxInput, setMaxInput] = useState(lic ? String(lic.max) : '');

  const enabled = !!lic && lic.max > 0;
  const energy = enabled ? calcCurrentEnergy(lic) : 0;
  const daysLeft = enabled ? daysToFull(lic) : 0;
  const percent = enabled && lic.max > 0 ? Math.max(0, Math.min(100, (energy / lic.max) * 100)) : 0;

  const save = async () => {
    const n = Number(maxInput);
    if (!Number.isFinite(n) || n < 0) return;
    await updateKidLicense(kid.id, n);
    setEditing(false);
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted font-bold uppercase flex items-center gap-1">
          <Lock size={12} /> 花費許可證 {enabled ? '' : <span className="text-slate-500 normal-case font-normal">（未啟用）</span>}
        </div>
        <button onClick={() => { setMaxInput(lic ? String(lic.max) : ''); setEditing(v => !v); }} className="text-[11px] text-indigo-300 hover:text-indigo-200 font-bold">
          {editing ? '收合' : (enabled ? '調整' : '啟用')}
        </button>
      </div>

      {enabled && !editing && (
        <>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted">目前能量</span>
            <span className="font-black text-white">{currencySymbol}{Math.floor(energy)} / {currencySymbol}{lic.max}</span>
          </div>
          <div className="h-2 bg-black/30 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="text-[10px] text-muted">
            {daysLeft > 0 ? `約 ${daysLeft} 天後充滿（每日 +${currencySymbol}${(lic.max / 30).toFixed(1)}）` : '✨ 已充滿'}
          </div>
          <div className="text-[10px] text-slate-500 leading-relaxed">
            🔹 小孩在能量內可自主消費（不需審核）<br />
            🔹 超過能量的消費仍會進入待審核
          </div>
        </>
      )}

      {editing && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] text-muted leading-relaxed">
            設定能量上限（此額度內小孩可自主消費，上限於 30 天內線性充滿）。設為 0 可關閉系統。
          </div>
          <div className="flex gap-2">
            <span className="flex items-center px-2 text-muted text-sm">{currencySymbol}</span>
            <input type="number" min="0" className="flex-1 bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
              placeholder="能量上限（0 = 關閉）" value={maxInput} onChange={e => setMaxInput(e.target.value)} autoFocus />
            <button onClick={save} className={`${BTN} px-3 bg-emerald-500 text-white text-xs h-10`}>儲存</button>
            <button onClick={() => setEditing(false)} className={`${BTN} px-3 bg-white/10 text-muted text-xs h-10`}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── KidEnvelopeRow ───────────────────────────────────────────────────────────
const BTN_ROW = 'h-10 w-10 flex items-center justify-center rounded-xl transition-colors';

const KidEnvelopeRow: React.FC<{
  env: Envelope;
  transactions: { id: string; envelopeId: string; amount: number; timestamp: string; note: string; status: 'pending' | 'approved' | 'rejected' }[];
  currencySymbol: string;
  addTransaction: (id: string, amt: number, note: string) => Promise<void>;
  updateEnvelope: (id: string, name: string, icon?: string) => Promise<void>;
  deleteEnvelope: (id: string) => Promise<void>;
  toggleHideEnvelope: (id: string) => Promise<void>;
  setEnvelopeGoal: (id: string, amount: number, deadline?: string, note?: string) => Promise<void>;
  clearEnvelopeGoal: (id: string) => Promise<void>;
  protected?: boolean;
}> = ({ env, transactions, currencySymbol, addTransaction, updateEnvelope, deleteEnvelope, toggleHideEnvelope, setEnvelopeGoal, clearEnvelopeGoal, protected: isProtected = false }) => {
  const INPUT_LOCAL = 'bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary w-full';
  const [showAdj, setShowAdj] = useState(false);
  const [adjAmt, setAdjAmt] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [eName, setEName] = useState(env.name);
  const [eIcon, setEIcon] = useState(env.icon || '✉️');

  // Wish-goal UI state
  const [showGoal, setShowGoal] = useState(false);
  const [gAmount, setGAmount] = useState(env.goalAmount ? String(env.goalAmount) : '');
  const [gDeadline, setGDeadline] = useState(env.goalDeadline ?? '');
  const [gNote, setGNote] = useState(env.goalNote ?? '');

  const progress = useMemo(
    () => calcGoalProgress(env, transactions as never),
    [env, transactions],
  );

  const doAdj = () => {
    const n = Number(adjAmt);
    if (!adjAmt || isNaN(n)) return;
    addTransaction(env.id, n, adjNote || (n > 0 ? '加入' : '扣除'));
    setAdjAmt(''); setAdjNote(''); setShowAdj(false);
  };

  const doSaveGoal = () => {
    const n = Number(gAmount);
    if (!Number.isFinite(n) || n <= 0) return;
    setEnvelopeGoal(env.id, n, gDeadline || undefined, gNote || undefined);
    setShowGoal(false);
  };

  const doClearGoal = () => {
    if (!confirm(`取消「${env.name}」的願望目標？`)) return;
    clearEnvelopeGoal(env.id);
    setGAmount(''); setGDeadline(''); setGNote('');
    setShowGoal(false);
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${isProtected ? 'border-primary/20' : 'border-white/5'} ${env.isHidden ? 'opacity-50' : ''}`}>
      {isProtected && <div className="text-[10px] text-primary/60 font-bold px-4 pt-2 flex items-center gap-1"><span>🔒</span> 受保護（不可刪除）</div>}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/5">
        {editing ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input className="w-12 h-10 bg-slate-900/70 border border-white/10 rounded-xl text-center text-xl focus:outline-none focus:border-primary" value={eIcon} onChange={e => setEIcon(e.target.value)} maxLength={4} />
            <input className={`${INPUT_LOCAL} flex-1`} value={eName} onChange={e => setEName(e.target.value)} autoFocus />
            <button onClick={() => { updateEnvelope(env.id, eName, eIcon); setEditing(false); }} className="p-2 text-green-400"><Check size={16} /></button>
            <button onClick={() => setEditing(false)} className="p-2 text-slate-400"><X size={16} /></button>
          </div>
        ) : (
          <>
            <span className="text-xl flex-shrink-0">{env.icon || (env.type === 'spendable' ? '👛' : '🏦')}</span>
            <span className="font-bold text-sm flex-1 min-w-0 truncate">{env.name}</span>
            <span className={`font-black text-base flex-shrink-0 ${env.type === 'spendable' ? 'text-primary' : 'text-green-400'}`}>${env.balance}</span>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => setShowAdj(v => !v)} className={`${BTN_ROW} hover:bg-info/20 text-muted hover:text-info`} title="調整餘額"><span className="text-sm font-bold">±</span></button>
              <button onClick={() => setShowGoal(v => !v)} className={`${BTN_ROW} hover:bg-amber-500/20 ${progress.hasGoal ? 'text-amber-300' : 'text-muted hover:text-amber-300'}`} title="設定願望目標"><Target size={14} /></button>
              <button onClick={() => { setEditing(true); setEName(env.name); setEIcon(env.icon || '✉️'); }} className={`${BTN_ROW} hover:bg-white/10 text-muted hover:text-white`}><Edit2 size={14} /></button>
              {!isProtected && <button onClick={() => toggleHideEnvelope(env.id)} className={`${BTN_ROW} hover:bg-white/10 text-muted hover:text-white`}>{env.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}</button>}
              {!isProtected ? (
                <button onClick={() => { if (confirm(`刪除「${env.name}」？`)) deleteEnvelope(env.id); }} className={`${BTN_ROW} hover:bg-error/20 text-error/50 hover:text-error`}><Trash2 size={14} /></button>
              ) : (
                <span className={`${BTN_ROW} text-slate-700 cursor-not-allowed`} title="受保護信封不可刪除"><Trash2 size={14} /></span>
              )}
            </div>
          </>
        )}
      </div>
      {showAdj && (
        <div className="flex gap-2 p-3 bg-black/30 border-t border-white/5">
          <input type="number" placeholder="±金額" className={`${INPUT_LOCAL} w-24`} value={adjAmt} onChange={e => setAdjAmt(e.target.value)} />
          <input type="text" placeholder="備註..." className={`${INPUT_LOCAL} flex-1`} value={adjNote} onChange={e => setAdjNote(e.target.value)} />
          <button onClick={doAdj} className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm flex-shrink-0">確認</button>
          <button onClick={() => setShowAdj(false)} className="p-2 text-muted"><X size={16} /></button>
        </div>
      )}

      {/* Goal progress summary (always visible if goal set) */}
      {progress.hasGoal && !showGoal && (
        <div className="px-4 py-2 bg-amber-500/5 border-t border-amber-500/10">
          <div className="flex items-center justify-between text-[11px] text-muted mb-1">
            <span className="font-bold text-amber-300 flex items-center gap-1"><Target size={11} /> 願望 {env.goalNote ? `· ${env.goalNote}` : ''}</span>
            <span className="font-black text-amber-300">
              {currencySymbol}{env.balance} / {currencySymbol}{progress.goalAmount}
              {progress.achieved && <span className="ml-2">🎉</span>}
            </span>
          </div>
          <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted mt-1">
            <span>{progress.achieved ? '已達成' : progress.etaDays !== null ? `預計 ${progress.etaDays} 天達成` : '近 30 天無存款紀錄'}</span>
            {progress.deadlineDays !== null && (
              <span className={progress.onTrack === false ? 'text-red-400 font-bold' : progress.onTrack ? 'text-green-400' : 'text-muted'}>
                {progress.deadlineDays >= 0 ? `期限剩 ${progress.deadlineDays} 天` : `已逾期 ${-progress.deadlineDays} 天`}
                {progress.onTrack === false && ' ⚠️'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Goal editor */}
      {showGoal && (
        <div className="p-3 bg-black/30 border-t border-white/5 flex flex-col gap-2">
          <div className="text-xs text-amber-300 font-bold flex items-center gap-1"><Target size={12} /> 願望目標</div>
          <input type="number" min="1" placeholder={`目標金額（${currencySymbol}）`} className={INPUT_LOCAL} value={gAmount} onChange={e => setGAmount(e.target.value)} />
          <input type="text" placeholder="我想買什麼？（選填）" className={INPUT_LOCAL} value={gNote} onChange={e => setGNote(e.target.value)} maxLength={40} />
          <input type="date" className={INPUT_LOCAL} value={gDeadline ? gDeadline.slice(0, 10) : ''} onChange={e => setGDeadline(e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : '')} />
          <div className="flex gap-2">
            <button onClick={doSaveGoal} className="flex-1 px-3 py-2 rounded-xl bg-amber-500 text-black font-bold text-sm">{env.goalAmount ? '更新' : '設定'}</button>
            {env.goalAmount && (
              <button onClick={doClearGoal} className="px-3 py-2 rounded-xl bg-red-500/20 text-red-300 font-bold text-sm">清除</button>
            )}
            <button onClick={() => setShowGoal(false)} className="px-3 py-2 rounded-xl bg-white/5 text-muted font-bold text-sm">取消</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── RoutineQuestPanel ─────────────────────────────────────────────────────────
const DAYS_MAP = [
  { l: '日', v: 0 }, { l: '一', v: 1 }, { l: '二', v: 2 }, { l: '三', v: 3 },
  { l: '四', v: 4 }, { l: '五', v: 5 }, { l: '六', v: 6 },
];

const RoutineQuestPanel: React.FC<{
  activeKids: { id: string; name: string }[];
  allKids: { id: string; name: string }[];
  routineQuests: { id: string; ownerId: string; title: string; expReward: number; moneyReward: number; gemReward: number; daysOfWeek: number[]; icon?: string; dueDays?: number; boxRewardId?: string }[];
  treasureBoxes: { id: string; name: string }[];
  addRoutineQuest: (ownerId: string | string[], title: string, exp: number, money: number, gem: number, days: number[], icon?: string, dueDays?: number, boxRewardId?: string) => Promise<void>;
  updateRoutineQuest: (id: string, title: string, exp: number, money: number, gem: number, days: number[], icon?: string, dueDays?: number, boxRewardId?: string) => Promise<void>;
  deleteRoutineQuest: (id: string) => Promise<void>;
  forceGenerateRoutineQuests: () => Promise<void>;
}> = ({ activeKids, allKids, routineQuests, treasureBoxes, addRoutineQuest, updateRoutineQuest, deleteRoutineQuest, forceGenerateRoutineQuests }) => {
  const INPUT_L = 'bg-slate-900/70 border border-white/10 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-primary w-full';
  const [kid, setKid] = useState('');
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('📅');
  const [exp, setExp] = useState('10');
  const [money, setMoney] = useState('10');
  const [gem, setGem] = useState('0');
  const [days, setDays] = useState<number[]>([]);
  const [boxRewardId, setBoxRewardId] = useState('');
  const [generating, setGenerating] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editIcon, setEditIcon] = useState('📅');
  const [editExp, setEditExp] = useState('');
  const [editMoney, setEditMoney] = useState('');
  const [editGem, setEditGem] = useState('');
  const [editDays, setEditDays] = useState<number[]>([]);
  const [editBoxRewardId, setEditBoxRewardId] = useState('');

  const toggleDay = (d: number) => setDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  const toggleEditDay = (d: number) => setEditDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kid || !title || !days.length) return;
    const boxId = boxRewardId || undefined;
    if (kid === 'all') { await addRoutineQuest(activeKids.map(k => k.id), title, +exp, +money, +gem, days, icon, undefined, boxId); }
    else { await addRoutineQuest(kid, title, +exp, +money, +gem, days, icon, undefined, boxId); }
    setTitle(''); setDays([]); setExp('10'); setMoney('10'); setGem('0'); setIcon('📅'); setKid(''); setBoxRewardId('');
  };

  const startEdit = (rq: typeof routineQuests[0]) => {
    setEditId(rq.id); setEditTitle(rq.title); setEditIcon(rq.icon || '📅');
    setEditExp(String(rq.expReward)); setEditMoney(String(rq.moneyReward)); setEditGem(String(rq.gemReward));
    setEditDays([...rq.daysOfWeek]); setEditBoxRewardId(rq.boxRewardId || '');
  };

  const handleUpdate = async (rqId: string) => {
    if (!editTitle || !editDays.length) return;
    await updateRoutineQuest(rqId, editTitle, +editExp, +editMoney, +editGem, editDays, editIcon, undefined, editBoxRewardId || undefined);
    setEditId(null);
  };

  const handleForceGenerate = async () => {
    setGenerating(true);
    try { await forceGenerateRoutineQuests(); } finally { setGenerating(false); }
  };

  const todayDow = new Date().getDay();
  const todayName = DAYS_MAP.find(d => d.v === todayDow)?.l;
  const hasQuestsForToday = routineQuests.some(rq => rq.daysOfWeek.includes(todayDow));

  return (
    <div className="flex flex-col gap-4">
      {hasQuestsForToday && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-400/20 rounded-2xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-amber-300">今天（週{todayName}）有固定任務</div>
            <div className="text-xs text-muted mt-0.5">若孩子未看到今日任務，可手動派發</div>
          </div>
          <button onClick={handleForceGenerate} disabled={generating}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-all active:scale-95 disabled:opacity-50">
            {generating ? '派發中...' : '立即派發今日任務'}
          </button>
        </div>
      )}
      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <EmojiInput value={icon} onChange={setIcon} label="圖示" />
          <div className="flex-1">
            <label className="text-xs text-slate-400 block mb-1.5">任務名稱</label>
            <input className={INPUT_L} placeholder="洗碗、整理書包..." value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
        </div>
        <select className={INPUT_L} value={kid} onChange={e => setKid(e.target.value)} required>
          <option value="">指派給哪個孩子？</option>
          <option value="all">全部孩子</option>
          {activeKids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <div>
          <div className="text-xs text-slate-400 mb-2">發布日期（可多選）</div>
          <div className="flex gap-2 flex-wrap">
            {DAYS_MAP.map(d => (
              <button key={d.v} type="button" onClick={() => toggleDay(d.v)} className={`w-11 h-11 rounded-full font-black text-sm transition-all active:scale-90 ${days.includes(d.v) ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white/10 text-muted hover:bg-white/20'}`}>
                {d.l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[['⭐ EXP', exp, setExp], ['💰 金錢', money, setMoney], ['💎 寶石', gem, setGem]].map(([lbl, val, set]) => (
            <div key={lbl as string}>
              <label className="text-xs text-slate-400 block mb-1.5">{lbl as string}</label>
              <input type="number" min="0" className={INPUT_L} value={val as string} onChange={e => (set as (v: string) => void)(e.target.value)} />
            </div>
          ))}
        </div>
        {treasureBoxes.length > 0 && (
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">🎁 寶箱獎勵 (選填)</label>
            <select className={INPUT_L} value={boxRewardId} onChange={e => setBoxRewardId(e.target.value)}>
              <option value="">(無寶箱獎勵)</option>
              {treasureBoxes.map(box => <option key={box.id} value={box.id}>{box.name}</option>)}
            </select>
          </div>
        )}
        <button type="submit" disabled={!days.length} className="min-h-[48px] px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 w-full bg-primary text-white disabled:opacity-40">
          新增固定任務
        </button>
      </form>
      {routineQuests.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <div className="text-xs text-muted font-bold uppercase">已設定固定任務 ({routineQuests.length})</div>
          {routineQuests.map(rq => {
            const k = allKids.find(x => x.id === rq.ownerId);
            const dStr = DAYS_MAP.filter(d => rq.daysOfWeek.includes(d.v)).map(d => d.l).join('、');
            const isEditing = editId === rq.id;
            if (isEditing) {
              return (
                <div key={rq.id} className="flex flex-col gap-3 bg-primary/10 border border-primary/30 rounded-2xl px-4 py-4">
                  <div className="text-xs font-bold text-primary">✏️ 修改固定任務（指派給：{k?.name ?? '未知'}）</div>
                  <div className="flex gap-2">
                    <EmojiInput value={editIcon} onChange={setEditIcon} label="圖示" />
                    <div className="flex-1">
                      <label className="text-xs text-slate-400 block mb-1">任務名稱</label>
                      <input className={INPUT_L} value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-2">發布日期</div>
                    <div className="flex gap-2 flex-wrap">
                      {DAYS_MAP.map(d => (
                        <button key={d.v} type="button" onClick={() => toggleEditDay(d.v)} className={`w-10 h-10 rounded-full font-black text-sm transition-all ${editDays.includes(d.v) ? 'bg-primary text-white' : 'bg-white/10 text-muted'}`}>{d.l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[['⭐ EXP', editExp, setEditExp], ['💰 金錢', editMoney, setEditMoney], ['💎 寶石', editGem, setEditGem]].map(([lbl, val, set]) => (
                      <div key={lbl as string}>
                        <label className="text-xs text-slate-400 block mb-1">{lbl as string}</label>
                        <input type="number" min="0" className={INPUT_L} value={val as string} onChange={e => (set as (v: string) => void)(e.target.value)} />
                      </div>
                    ))}
                  </div>
                  {treasureBoxes.length > 0 && (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">🎁 寶箱獎勵 (選填)</label>
                      <select className={INPUT_L} value={editBoxRewardId} onChange={e => setEditBoxRewardId(e.target.value)}>
                        <option value="">(無寶箱獎勵)</option>
                        {treasureBoxes.map(box => <option key={box.id} value={box.id}>{box.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(rq.id)} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-sm">✅ 儲存</button>
                    <button onClick={() => setEditId(null)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-muted font-bold text-sm">取消</button>
                  </div>
                </div>
              );
            }
            return (
              <div key={rq.id} className="flex items-center justify-between gap-3 bg-black/30 border border-white/5 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0">{rq.icon || '📅'}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{k?.name ?? '?'} · {rq.title}</div>
                    <div className="text-xs text-muted">[{dStr}] EXP {rq.expReward} / ${rq.moneyReward}</div>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(rq)} className="p-2.5 rounded-xl hover:bg-primary/20 text-primary/60 hover:text-primary transition-colors"><Edit2 size={15} /></button>
                  <button onClick={() => { if (confirm('刪除此固定任務？')) deleteRoutineQuest(rq.id); }} className="p-2.5 rounded-xl hover:bg-error/20 text-error/60 hover:text-error transition-colors"><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
