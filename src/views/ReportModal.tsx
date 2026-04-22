import React, { useMemo, useRef, useState } from 'react';
import { X, Download, TrendingUp, TrendingDown, Award, Target, Zap } from 'lucide-react';
import type { User } from '../types/user';
import type { Envelope, Transaction, ExpenseCategory } from '../types/envelope';
import type { Quest } from '../types/quest';
import { generateReport, type ReportPeriod } from '../domain/report';

interface Props {
  kids: User[];
  envelopes: Envelope[];
  transactions: Transaction[];
  quests: Quest[];
  expenseCategories: ExpenseCategory[];
  currencySymbol: string;
  onClose: () => void;
}

/**
 * ReportModal — weekly/monthly kid report with shareable image export.
 * html2canvas is dynamically imported so it only loads when the user clicks export.
 */
export const ReportModal: React.FC<Props> = ({
  kids, envelopes, transactions, quests, expenseCategories, currencySymbol, onClose,
}) => {
  const visibleKids = kids.filter(k => !k.isHidden);
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const [selectedKidId, setSelectedKidId] = useState<string>(visibleKids[0]?.id ?? '');
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const kid = visibleKids.find(k => k.id === selectedKidId);
  const report = useMemo(() => {
    if (!kid) return null;
    return generateReport({ period, kid, transactions, envelopes, quests, expenseCategories });
  }, [kid, period, transactions, envelopes, quests, expenseCategories]);

  const handleExport = async () => {
    if (!reportRef.current || !report) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      const label = period === 'week' ? '週報' : '月報';
      a.download = `${report.kid.name}-${label}-${report.range.periodLabel.replace(/\//g, '-').replace(/\s/g, '')}.png`;
      a.click();
    } catch (e) {
      console.error('[ReportModal] export failed:', e);
      alert('匯出失敗，請重試');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="w-full max-w-lg my-4" onClick={e => e.stopPropagation()}>
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3 sticky top-0 z-10">
          <div className="flex gap-2">
            <button onClick={() => setPeriod('week')} className={`px-4 py-2 rounded-xl text-xs font-bold ${period === 'week' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-muted'}`}>週報</button>
            <button onClick={() => setPeriod('month')} className={`px-4 py-2 rounded-xl text-xs font-bold ${period === 'month' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-muted'}`}>月報</button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} disabled={exporting || !report} className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white disabled:opacity-40 flex items-center gap-1">
              <Download size={12} /> {exporting ? '產生中...' : '匯出圖片'}
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white"><X size={16} /></button>
          </div>
        </div>

        {/* Kid selector */}
        {visibleKids.length > 1 && (
          <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
            {visibleKids.map(k => (
              <button key={k.id} onClick={() => setSelectedKidId(k.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${selectedKidId === k.id ? 'bg-primary text-white' : 'bg-white/10 text-muted'}`}>
                {k.name}
              </button>
            ))}
          </div>
        )}

        {/* Report card (capture target) */}
        {report ? (
          <div ref={reportRef} className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <ReportCard report={report} currencySymbol={currencySymbol} />
          </div>
        ) : (
          <div className="p-8 text-center text-muted bg-slate-900/60 rounded-3xl">請選擇小孩</div>
        )}
      </div>
    </div>
  );
};

// ─── Inner report card (designed to be captured as image) ───────────────────
const ReportCard: React.FC<{ report: NonNullable<ReturnType<typeof generateReport>>; currencySymbol: string }> = ({ report, currencySymbol }) => {
  const { period, range, kid, income, spending, netFlow, savings, quests, energy, goals, topExpenses } = report;
  const periodLabel = period === 'week' ? '本週回顧' : '本月回顧';

  return (
    <div className="p-5 flex flex-col gap-4 text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div className="text-center border-b border-white/10 pb-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-300 font-bold">{periodLabel}</div>
        <div className="text-2xl font-black mt-1">{kid.name} 的理財報告</div>
        <div className="text-xs text-muted mt-1">{range.periodLabel}</div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard icon={<TrendingUp size={14} />} label="收入" value={`${currencySymbol}${income.total}`} color="#10b981" />
        <KpiCard icon={<TrendingDown size={14} />} label="花費" value={`${currencySymbol}${spending.total}`} color="#f59e0b" />
        <KpiCard icon={netFlow >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} label="淨結餘" value={`${netFlow >= 0 ? '+' : ''}${currencySymbol}${netFlow}`} color={netFlow >= 0 ? '#34d399' : '#f87171'} />
      </div>

      {/* Savings trend */}
      <Section title="💰 儲蓄成長">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">期初</span>
          <span className="text-sm font-bold">{currencySymbol}{savings.startBalance}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">期末</span>
          <span className="text-sm font-bold">{currencySymbol}{savings.endBalance}</span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          <span className="text-xs font-bold">變化</span>
          <span className={`text-base font-black ${savings.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {savings.delta >= 0 ? '+' : ''}{currencySymbol}{savings.delta}
          </span>
        </div>
      </Section>

      {/* Category breakdown */}
      {spending.byCategory.length > 0 && (
        <Section title="🍱 花費分類">
          {spending.byCategory.slice(0, 5).map(c => (
            <div key={c.categoryId ?? '_'} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1"><span>{c.icon}</span><span className="font-bold">{c.name}</span><span className="text-muted">×{c.count}</span></span>
                <span className="font-bold">{currencySymbol}{c.amount} · {c.percent.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${c.percent}%` }} />
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Quests */}
      {quests.totalClosed > 0 && (
        <Section title="⚔️ 任務表現">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted flex items-center gap-1"><Award size={12} /> 完成 / 總結案</span>
            <span className="text-sm font-black">{quests.completed} / {quests.totalClosed}</span>
          </div>
          <div className="h-2 bg-black/40 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-400" style={{ width: `${quests.completionRate * 100}%` }} />
          </div>
          <div className="text-[10px] text-muted text-right">完成率 {(quests.completionRate * 100).toFixed(0)}%</div>
        </Section>
      )}

      {/* Energy */}
      {energy.hasLicense && (
        <Section title="⚡ 能量使用">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted flex items-center gap-1"><Zap size={12} /> 本期花費 / 能量上限</span>
            <span className="text-sm font-black">{currencySymbol}{spending.total} / {currencySymbol}{energy.max}</span>
          </div>
          <div className="h-2 bg-black/40 rounded-full overflow-hidden">
            <div className={`h-full ${energy.utilizationRate > 1 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, energy.utilizationRate * 100)}%` }} />
          </div>
          <div className="text-[10px] text-muted">
            目前剩餘能量 {currencySymbol}{Math.floor(energy.currentEnergy)}
          </div>
        </Section>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <Section title="🎯 願望進度">
          {goals.map(g => (
            <div key={g.envelopeId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 font-bold"><Target size={10} /> {g.envelopeName}</span>
                <span className={g.achieved ? 'text-green-400 font-bold' : 'text-muted'}>
                  {g.achieved ? '🎉 已達成' : `${g.currentPercent.toFixed(0)}% / ${currencySymbol}${g.goalAmount}`}
                </span>
              </div>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${g.currentPercent}%` }} />
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Top expenses */}
      {topExpenses.length > 0 && (
        <Section title="🔥 最大花費 Top 3">
          {topExpenses.map((e, i) => (
            <div key={i} className="flex items-center justify-between text-xs border-b border-white/5 py-1 last:border-0">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-bold truncate">{i + 1}. {e.note}</span>
                <span className="text-[10px] text-muted">
                  {e.categoryName ?? '其他'}{e.envelopeName ? ` · ${e.envelopeName}` : ''}
                </span>
              </div>
              <span className="font-black text-amber-400 ml-2">{currencySymbol}{e.amount}</span>
            </div>
          ))}
        </Section>
      )}

      {/* Empty state hint */}
      {income.count === 0 && spending.count === 0 && quests.totalClosed === 0 && (
        <div className="text-center py-6 text-muted text-sm">這段期間沒有紀錄 📭</div>
      )}

      {/* Footer */}
      <div className="text-[9px] text-center text-slate-500 mt-2 pt-2 border-t border-white/5">
        家庭預算系統 · {new Date().toLocaleDateString('zh-TW')}
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{title}</div>
    {children}
  </div>
);

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
  <div className="rounded-2xl p-3 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
    <div className="text-[10px] text-muted flex items-center gap-1" style={{ color }}>{icon} {label}</div>
    <div className="text-base font-black" style={{ color }}>{value}</div>
  </div>
);

export default ReportModal;
