import React, { useState, useRef, useEffect } from 'react';

/* ── Categorised icon library ─────────────────────────────────── */
const ICON_CATEGORIES: { label: string; icons: string[] }[] = [
  {
    label: '🍽 食物飲品',
    icons: ['🍔', '🍕', '🍜', '🍱', '🍣', '🥗', '🥩', '🍰', '🧃', '☕', '🧋', '🍦', '🥐', '🍎', '🥦'],
  },
  {
    label: '🛍 購物生活',
    icons: ['🛒', '🛍️', '👕', '👗', '👟', '🧴', '🧼', '🪥', '💊', '🧺', '🪣', '🖊️', '📦', '🏠', '🪑'],
  },
  {
    label: '🎮 娛樂休閒',
    icons: ['🎮', '🎬', '🎵', '🎁', '🎪', '🎠', '🎯', '🎲', '🧩', '🃏', '🎤', '🎹', '🎨', '📚', '📖'],
  },
  {
    label: '🚗 交通出行',
    icons: ['🚗', '🚌', '✈️', '🚲', '🛵', '🚕', '🚂', '⛽', '🚧', '🅿️', '🛳️', '🚁', '🛺', '🏍️', '🚦'],
  },
  {
    label: '🏥 醫療健康',
    icons: ['🏥', '💊', '🩺', '🦷', '👓', '🏋️', '🧘', '🤸', '🏊', '⚕️', '🩹', '💉', '🧬', '🩻', '❤️‍🩹'],
  },
  {
    label: '📈 財務投資',
    icons: ['💰', '💳', '📈', '📉', '🏦', '💎', '🪙', '💵', '📊', '🔐', '🏆', '💼', '🤑', '🪄', '📑'],
  },
  {
    label: '🎓 教育學習',
    icons: ['📚', '✏️', '🖊️', '📐', '📏', '🔭', '🔬', '🎓', '🏫', '💻', '🖥️', '📓', '📝', '📌', '🗂️'],
  },
  {
    label: '🐾 寵物動物',
    icons: ['🐶', '🐱', '🐹', '🐰', '🦜', '🐟', '🐢', '🦴', '🐾', '🌿', '🪴', '🐇', '🦊', '🐻', '🐼'],
  },
  {
    label: '⭐ 獎勵成就',
    icons: ['⭐', '🏆', '🥇', '🎖️', '🌟', '✨', '🔥', '🚀', '👑', '🌈', '🎉', '🎊', '💪', '🦸', '🌠'],
  },
  {
    label: '🏡 家庭雜項',
    icons: ['🏠', '🔑', '🧹', '🪛', '🔧', '🪚', '💡', '🔌', '📱', '📷', '🎒', '🧸', '🪆', '🖼️', '🕯️'],
  },
];

const ALL_ICONS = ICON_CATEGORIES.flatMap(c => c.icons);

interface EmojiInputProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}

export const EmojiInput: React.FC<EmojiInputProps> = ({ value, onChange, label }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredIcons = search.trim()
    ? ALL_ICONS.filter(ic => ic.includes(search))
    : ICON_CATEGORIES[activeCategory].icons;

  const handleSelect = (em: string) => {
    onChange(em);
    setShowPicker(false);
    setSearch('');
  };

  return (
    <div className="flex flex-col gap-1.5 text-left relative" ref={containerRef}>
      {label && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>}
      <button
        type="button"
        className="w-14 min-h-[48px] bg-slate-900/70 border border-white/10 rounded-xl text-center text-2xl focus:outline-none focus:border-primary transition flex items-center justify-center hover:bg-slate-800 hover:border-primary/40"
        onClick={() => setShowPicker(!showPicker)}
        title="選擇圖示"
      >
        {value}
      </button>

      {showPicker && (
        <div className="absolute top-full left-0 mt-2 bg-slate-850 border border-white/10 rounded-2xl w-[320px] z-50 shadow-2xl overflow-hidden"
          style={{ background: '#1a2235' }}>
          {/* Search */}
          <div className="p-2 border-b border-white/10">
            <input
              autoFocus
              type="text"
              placeholder="搜尋圖示..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary placeholder:text-slate-500"
            />
          </div>

          {/* Category tabs */}
          {!search.trim() && (
            <div className="flex gap-1 p-2 border-b border-white/10 overflow-x-auto scrollbar-none">
              {ICON_CATEGORIES.map((cat, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveCategory(i)}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeCategory === i
                      ? 'bg-primary text-white'
                      : 'text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {cat.label.split(' ')[0]}
                </button>
              ))}
            </div>
          )}

          {/* Category label when not searching */}
          {!search.trim() && (
            <div className="px-3 pt-2 pb-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {ICON_CATEGORIES[activeCategory].label}
            </div>
          )}

          {/* Icon grid */}
          <div className="p-2 grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
            {filteredIcons.length > 0 ? filteredIcons.map(em => (
              <button
                key={em}
                type="button"
                onClick={() => handleSelect(em)}
                className={`text-xl p-1.5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center aspect-square ${value === em ? 'bg-primary/20 ring-1 ring-primary' : ''}`}
                title={em}
              >
                {em}
              </button>
            )) : (
              <div className="col-span-8 text-center text-muted text-xs py-4">找不到符合的圖示</div>
            )}
          </div>

          {/* Custom input */}
          <div className="p-2 border-t border-white/10 flex items-center gap-2">
            <span className="text-xs text-slate-400 flex-shrink-0">自訂：</span>
            <input
              type="text"
              placeholder="輸入任意 emoji..."
              maxLength={4}
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary placeholder:text-slate-500"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) handleSelect(val);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
