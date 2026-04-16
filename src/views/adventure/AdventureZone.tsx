import React, { useState, useEffect } from 'react';
import { ChevronLeft, Shirt, Cat, ShoppingBag, TrendingUp, MapPin } from 'lucide-react';
import { useStore } from '../../store/index';
import type { SectionConfig, SectionKey } from '../../types/adventure';
import AdventureBase from './AdventureBase';
import AdventurePets from './AdventurePets';
import AdventureShop from './AdventureShop';
import AdventureInvest from './AdventureInvest';
import AdventurePortal from './AdventurePortal';

// ── Static section definitions (display metadata) ─────────────────────────────
interface SectionDef {
  key: SectionKey;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  textColor: string;
}

const SECTION_DEFS: SectionDef[] = [
  { key: 'base',   icon: <Shirt size={22} />,       color: 'from-indigo-500/20 to-blue-500/20',   borderColor: 'border-indigo-400/30', textColor: 'text-indigo-300'  },
  { key: 'pets',   icon: <Cat size={22} />,          color: 'from-emerald-500/20 to-green-500/20', borderColor: 'border-emerald-400/30',textColor: 'text-emerald-300' },
  { key: 'shop',   icon: <ShoppingBag size={22} />,  color: 'from-amber-500/20 to-yellow-500/20',  borderColor: 'border-amber-400/30',  textColor: 'text-amber-300'   },
  { key: 'invest', icon: <TrendingUp size={22} />,   color: 'from-blue-500/20 to-sky-500/20',      borderColor: 'border-blue-400/30',   textColor: 'text-blue-300'    },
  { key: 'portal', icon: <MapPin size={22} />,       color: 'from-violet-500/20 to-purple-500/20', borderColor: 'border-violet-400/30', textColor: 'text-violet-300'  },
];

// Default section text (overridden by Firestore config if saved by admin)
const DEFAULT_SECTION_CONFIGS: SectionConfig[] = [
  { key: 'base',   status: 'visible', name: '冒險基地', desc: '打造你的專屬數位分身！'     },
  { key: 'pets',   status: 'visible', name: '冒險夥伴', desc: '養育寵物，一起踏上冒險！'   },
  { key: 'shop',   status: 'visible', name: '販賣部',   desc: '購買裝備、食物與寵物蛋！'   },
  { key: 'invest', status: 'visible', name: '投資部',   desc: '學習理財，模擬股票外匯！'   },
  { key: 'portal', status: 'visible', name: '傳送門',   desc: '派遣夥伴出征，帶回寶物！'   },
];

// Emoji per key (used in hub + sub-page header)
const SECTION_EMOJI: Record<SectionKey, string> = {
  base: '🧑‍🎤', pets: '🐾', shop: '🏪', invest: '📈', portal: '🌀',
};

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
  const { getAdventureConfigDoc } = useStore();
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const [sectionConfigs, setSectionConfigs] = useState<SectionConfig[]>(DEFAULT_SECTION_CONFIGS);

  // Load section config from Firestore (admin-controlled)
  useEffect(() => {
    getAdventureConfigDoc('sections').then(data => {
      if (data && Array.isArray(data.sections) && data.sections.length > 0) {
        setSectionConfigs(data.sections as SectionConfig[]);
      }
    }).catch(() => { /* fall back to defaults silently */ });
  }, [getAdventureConfigDoc]);

  // Merge static defs with Firestore config
  const mergedSections = SECTION_DEFS.map(def => {
    const cfg = sectionConfigs.find(c => c.key === def.key) ?? DEFAULT_SECTION_CONFIGS.find(c => c.key === def.key)!;
    return { ...def, status: cfg.status, name: cfg.name, desc: cfg.desc };
  });

  // Sub-page view
  if (activeSection !== null) {
    const merged = mergedSections.find(s => s.key === activeSection)!;
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        {/* Sub-page header */}
        <div className={`flex items-center gap-3 mb-5 glass-card bg-gradient-to-r ${merged.color} border ${merged.borderColor}`}>
          <button onClick={() => setActiveSection(null)}
            className="p-1.5 rounded-xl hover:bg-white/10 transition-colors text-muted hover:text-white">
            <ChevronLeft size={18} />
          </button>
          <span className="text-2xl">{SECTION_EMOJI[activeSection]}</span>
          <div>
            <div className={`font-black text-base ${merged.textColor}`}>{merged.name}</div>
            <div className="text-[10px] text-muted">{merged.desc}</div>
          </div>
        </div>
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
        {mergedSections.map(section => {
          // Hidden → don't render at all
          if (section.status === 'hidden') return null;

          const isDisabled = section.status === 'disabled';

          return (
            <button
              key={section.key}
              onClick={() => !isDisabled && setActiveSection(section.key)}
              disabled={isDisabled}
              className={`glass-card bg-gradient-to-r ${section.color} border ${section.borderColor}
                flex items-center gap-4 text-left transition-all
                ${isDisabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:scale-[1.01] active:scale-[0.99]'}`}>
              {/* Icon */}
              <div className={`w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 ${section.textColor}`}>
                {section.icon}
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">{SECTION_EMOJI[section.key]}</span>
                  <span className={`font-black text-base ${section.textColor}`}>{section.name}</span>
                  {isDisabled && (
                    <span className="text-[10px] bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-lg font-bold">
                      暫停使用
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted mt-0.5">{section.desc}</div>
              </div>
              {/* Arrow (only when clickable) */}
              {!isDisabled && <ChevronLeft size={16} className="text-muted rotate-180 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted bg-white/5 rounded-xl py-3 px-4 border border-white/10">
        🌟 完成任務、累積儲蓄可解鎖更多功能！繼續努力吧冒險者！
      </div>
    </div>
  );
};

export default AdventureZone;
