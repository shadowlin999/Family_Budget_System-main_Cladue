import React, { useState } from 'react';
import { ChevronLeft, Shirt, Cat, ShoppingBag, TrendingUp, MapPin } from 'lucide-react';
import AdventureBase from './AdventureBase';
import AdventurePets from './AdventurePets';
import AdventureShop from './AdventureShop';
import AdventureInvest from './AdventureInvest';
import AdventurePortal from './AdventurePortal';

// ── Section definitions ───────────────────────────────────────────────────────
type SectionKey = 'base' | 'pets' | 'shop' | 'invest' | 'portal';

interface SectionDef {
  key: SectionKey;
  emoji: string;
  icon: React.ReactNode;
  name: string;
  desc: string;
  color: string;
  borderColor: string;
  textColor: string;
}

const SECTIONS: SectionDef[] = [
  {
    key: 'base',
    emoji: '🧑‍🎤',
    icon: <Shirt size={22} />,
    name: '冒險基地',
    desc: '打造你的專屬數位分身！',
    color: 'from-indigo-500/20 to-blue-500/20',
    borderColor: 'border-indigo-400/30',
    textColor: 'text-indigo-300',
  },
  {
    key: 'pets',
    emoji: '🐾',
    icon: <Cat size={22} />,
    name: '冒險夥伴',
    desc: '養育寵物，一起踏上冒險！',
    color: 'from-emerald-500/20 to-green-500/20',
    borderColor: 'border-emerald-400/30',
    textColor: 'text-emerald-300',
  },
  {
    key: 'shop',
    emoji: '🏪',
    icon: <ShoppingBag size={22} />,
    name: '販賣部',
    desc: '購買裝備、食物與寵物蛋！',
    color: 'from-amber-500/20 to-yellow-500/20',
    borderColor: 'border-amber-400/30',
    textColor: 'text-amber-300',
  },
  {
    key: 'invest',
    emoji: '📈',
    icon: <TrendingUp size={22} />,
    name: '投資部',
    desc: '學習理財，模擬股票外匯！',
    color: 'from-blue-500/20 to-sky-500/20',
    borderColor: 'border-blue-400/30',
    textColor: 'text-blue-300',
  },
  {
    key: 'portal',
    emoji: '🌀',
    icon: <MapPin size={22} />,
    name: '傳送門',
    desc: '派遣夥伴出征，帶回寶物！',
    color: 'from-violet-500/20 to-purple-500/20',
    borderColor: 'border-violet-400/30',
    textColor: 'text-violet-300',
  },
];

// ── Section renderer ──────────────────────────────────────────────────────────
const renderSection = (key: SectionKey, kidName: string) => {
  switch (key) {
    case 'base':    return <AdventureBase kidName={kidName} />;
    case 'pets':    return <AdventurePets />;
    case 'shop':    return <AdventureShop />;
    case 'invest':  return <AdventureInvest />;
    case 'portal':  return <AdventurePortal />;
  }
};

// ── Main hub component ────────────────────────────────────────────────────────
const AdventureZone: React.FC<{ kidName: string }> = ({ kidName }) => {
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);

  // Sub-page view
  if (activeSection !== null) {
    const section = SECTIONS.find(s => s.key === activeSection)!;
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        {/* Sub-page header */}
        <div className={`flex items-center gap-3 mb-5 glass-card bg-gradient-to-r ${section.color} border ${section.borderColor}`}>
          <button onClick={() => setActiveSection(null)}
            className="p-1.5 rounded-xl hover:bg-white/10 transition-colors text-muted hover:text-white">
            <ChevronLeft size={18} />
          </button>
          <span className="text-2xl">{section.emoji}</span>
          <div>
            <div className={`font-black text-base ${section.textColor}`}>{section.name}</div>
            <div className="text-[10px] text-muted">{section.desc}</div>
          </div>
        </div>

        {/* Sub-page content */}
        {renderSection(activeSection, kidName)}
      </div>
    );
  }

  // Hub view
  return (
    <div className="animate-in zoom-in-95 fade-in duration-300 flex flex-col gap-5">
      {/* Hero header */}
      <div className="text-center py-2">
        <div className="text-5xl mb-2">⚔️</div>
        <h3 className="text-2xl font-black tracking-wide">冒險區</h3>
        <p className="text-xs text-muted mt-1">探索屬於你的奇幻世界，成為傳說冒險者！</p>
      </div>

      {/* Section cards */}
      <div className="flex flex-col gap-3">
        {SECTIONS.map(section => (
          <button
            key={section.key}
            onClick={() => setActiveSection(section.key)}
            className={`glass-card bg-gradient-to-r ${section.color} border ${section.borderColor}
              flex items-center gap-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99]`}>
            {/* Icon */}
            <div className={`w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 ${section.textColor}`}>
              {section.icon}
            </div>
            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">{section.emoji}</span>
                <span className={`font-black text-base ${section.textColor}`}>{section.name}</span>
              </div>
              <div className="text-xs text-muted mt-0.5">{section.desc}</div>
            </div>
            {/* Arrow */}
            <ChevronLeft size={16} className="text-muted rotate-180 shrink-0" />
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted bg-white/5 rounded-xl py-3 px-4 border border-white/10">
        🌟 完成任務、累積儲蓄可解鎖更多功能！繼續努力吧冒險者！
      </div>
    </div>
  );
};

export default AdventureZone;
