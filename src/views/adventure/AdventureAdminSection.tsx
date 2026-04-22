/**
 * AdventureAdminSection
 *
 * 超級管理者專用：管理冒險區所有可設定資料
 * 5 個 Tab：
 *   子分類設定 | 販賣部商品 | 寵物物種 | 遠征目的地 | 投資資產
 *
 * - allowSeniorEdit 旗標預留（目前僅 super admin 可存取）
 * - 販賣部商品使用全域共用折扣梯度（一組套用所有商品）
 * - 子分類支援 visible / disabled / hidden 三種狀態
 */
import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  LayoutGrid, ShoppingBag, Cat, MapPin, TrendingUp,
  Plus, Trash2, Eye, EyeOff, Save, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useStore } from '../../store/index';
import type {
  ManagedShopItem, ManagedPetSpecies, ManagedDestination, ManagedAsset,
  ShopItemCategory, AssetType, PetSpecies,
  SectionConfig, SectionKey, SectionStatus,
} from '../../types/adventure';

// ── Firestore doc IDs ────────────────────────────────────────────────────────
const DOC_SECTIONS = 'sections';
const DOC_SHOP     = 'shopItems';
const DOC_SPECIES  = 'petSpecies';
const DOC_DEST     = 'destinations';
const DOC_ASSETS   = 'assets';

// ── Default data ──────────────────────────────────────────────────────────────

const DEFAULT_SECTIONS: SectionConfig[] = [
  { key: 'base',   status: 'visible', name: '冒險基地', desc: '打造你的專屬數位分身！' },
  { key: 'pets',   status: 'visible', name: '冒險夥伴', desc: '養育寵物，一起踏上冒險！' },
  { key: 'shop',   status: 'visible', name: '販賣部',   desc: '購買裝備、食物與寵物蛋！' },
  { key: 'invest', status: 'visible', name: '投資部',   desc: '學習理財，模擬股票外匯！' },
  { key: 'portal', status: 'visible', name: '傳送門',   desc: '派遣夥伴出征，帶回寶物！' },
];

const DEFAULT_SHOP_TIERS = [
  { minSavings: 200,  discountPct: 10 },
  { minSavings: 500,  discountPct: 15 },
  { minSavings: 1000, discountPct: 25 },
  { minSavings: 3000, discountPct: 30 },
];

const DEFAULT_SHOP_ITEMS: ManagedShopItem[] = [
  { id: 'w_sword',    hidden: false, name: '勇士劍',   category: 'avatar_weapon',    emoji: '⚔️', description: '閃閃發光的勇者之劍', basePrice: 50  },
  { id: 'w_staff',    hidden: false, name: '魔法杖',   category: 'avatar_weapon',    emoji: '🪄', description: '蘊含神秘魔力的法杖', basePrice: 60  },
  { id: 'w_bow',      hidden: false, name: '精靈弓',   category: 'avatar_weapon',    emoji: '🏹', description: '精準無誤的精靈之弓', basePrice: 55  },
  { id: 'a_robe',     hidden: false, name: '魔法袍',   category: 'avatar_armor',     emoji: '👘', description: '增幅魔力的神秘長袍', basePrice: 80  },
  { id: 'a_armor',    hidden: false, name: '戰士甲',   category: 'avatar_armor',     emoji: '🥋', description: '堅不可摧的重型戰甲', basePrice: 90  },
  { id: 'a_cloak',    hidden: false, name: '英雄披風', category: 'avatar_armor',     emoji: '🦸', description: '傳說英雄穿戴的披風', basePrice: 120 },
  { id: 'ac_hat',     hidden: false, name: '魔術帽',   category: 'avatar_accessory', emoji: '🎩', description: '神奇的魔術師帽子',   basePrice: 40  },
  { id: 'ac_crown',   hidden: false, name: '勇者冠',   category: 'avatar_accessory', emoji: '👑', description: '象徵勇氣的王冠',     basePrice: 100 },
  { id: 'ac_wings',   hidden: false, name: '天使翅膀', category: 'avatar_accessory', emoji: '🪽', description: '純潔天使的羽翼',     basePrice: 150 },
  { id: 'pf_meat',    hidden: false, name: '烤肉',     category: 'pet_food',         emoji: '🍖', description: '增加體力 +20',       basePrice: 20  },
  { id: 'pf_fish',    hidden: false, name: '鮮魚',     category: 'pet_food',         emoji: '🐟', description: '提升敏捷 +10',       basePrice: 25  },
  { id: 'pf_cake',    hidden: false, name: '星光蛋糕', category: 'pet_food',         emoji: '🎂', description: '提升心情至狂喜',     basePrice: 50  },
  { id: 'pe_dragon',  hidden: false, name: '火龍蛋',   category: 'pet_egg',          emoji: '🥚', description: '傳說中的火龍蛋',     basePrice: 200 },
  { id: 'pe_phoenix', hidden: false, name: '鳳凰蛋',   category: 'pet_egg',          emoji: '🪺', description: '極稀有的鳳凰蛋！',   basePrice: 500 },
];

const DEFAULT_SPECIES: ManagedPetSpecies[] = [
  { id: 'dragon',  hidden: false, speciesKey: 'dragon',  name: '小火龍', emoji: '🐉', desc: '力量超強，天生的戰士！',   colorFrom: 'from-red-500/30',    colorTo: 'to-orange-500/30' },
  { id: 'cat',     hidden: false, speciesKey: 'cat',     name: '靈貓',   emoji: '🐱', desc: '敏捷迅速，行動如風！',     colorFrom: 'from-purple-500/30', colorTo: 'to-pink-500/30'   },
  { id: 'fox',     hidden: false, speciesKey: 'fox',     name: '狡狐',   emoji: '🦊', desc: '聰明機靈，智力驚人！',     colorFrom: 'from-amber-500/30',  colorTo: 'to-yellow-500/30' },
  { id: 'wolf',    hidden: false, speciesKey: 'wolf',    name: '銀狼',   emoji: '🐺', desc: '全能型夥伴，均衡發展！',   colorFrom: 'from-slate-500/30',  colorTo: 'to-blue-500/30'   },
  { id: 'bunny',   hidden: false, speciesKey: 'bunny',   name: '幸運兔', emoji: '🐰', desc: '幸運值爆表，寶物收集王！', colorFrom: 'from-pink-500/30',   colorTo: 'to-rose-500/30'   },
  { id: 'phoenix', hidden: false, speciesKey: 'phoenix', name: '鳳凰',   emoji: '🦅', desc: '傳說中的神鳥，超稀有！',   colorFrom: 'from-cyan-500/30',   colorTo: 'to-teal-500/30'   },
];

const DEFAULT_DESTINATIONS: ManagedDestination[] = [
  { id: 'ancient_forest', hidden: false, emoji: '🌲', name: '古老森林', desc: '蒼翠的森林中藏有許多寶物，適合初心者探索！', durationHours: 2,  requiredLevel: 1,  baseGemRewardMin: 10,  baseGemRewardMax: 30,  baseExpRewardMin: 20,  baseExpRewardMax: 50,  successRate: 80 },
  { id: 'crystal_cave',   hidden: false, emoji: '💎', name: '水晶洞穴', desc: '閃耀的水晶礦脈，寶石豐富但地形複雜！',       durationHours: 4,  requiredLevel: 3,  baseGemRewardMin: 25,  baseGemRewardMax: 60,  baseExpRewardMin: 40,  baseExpRewardMax: 90,  successRate: 65 },
  { id: 'sky_citadel',    hidden: false, emoji: '🏰', name: '天空城堡', desc: '漂浮在雲端的神秘城堡，傳說中有巨大寶藏！',   durationHours: 8,  requiredLevel: 5,  baseGemRewardMin: 50,  baseGemRewardMax: 120, baseExpRewardMin: 80,  baseExpRewardMax: 180, successRate: 55 },
  { id: 'deep_ocean',     hidden: false, emoji: '🌊', name: '深海遺跡', desc: '沉睡在海底的古代文明，危機四伏卻寶藏無數！', durationHours: 12, requiredLevel: 8,  baseGemRewardMin: 80,  baseGemRewardMax: 200, baseExpRewardMin: 120, baseExpRewardMax: 260, successRate: 45 },
  { id: 'volcano_isle',   hidden: false, emoji: '🌋', name: '火山島',   desc: '熔岩與火焰的領域，最強夥伴才能征服！',       durationHours: 24, requiredLevel: 12, baseGemRewardMin: 150, baseGemRewardMax: 400, baseExpRewardMin: 200, baseExpRewardMax: 500, successRate: 35 },
];

const DEFAULT_ASSETS: ManagedAsset[] = [
  { id: 'AAPL',   hidden: false, name: '蘋果公司',  type: 'stock',  symbol: 'AAPL',    emoji: '🍎', baseFeeRate: 1.5, discountTiers: [{ minSavings: 500, discountPct: 20 }, { minSavings: 2000, discountPct: 40 }] },
  { id: 'TSLA',   hidden: false, name: '特斯拉',    type: 'stock',  symbol: 'TSLA',    emoji: '🚗', baseFeeRate: 1.5, discountTiers: [{ minSavings: 500, discountPct: 20 }, { minSavings: 2000, discountPct: 40 }] },
  { id: 'NVDA',   hidden: false, name: 'NVIDIA',    type: 'stock',  symbol: 'NVDA',    emoji: '💻', baseFeeRate: 1.5, discountTiers: [{ minSavings: 500, discountPct: 20 }, { minSavings: 2000, discountPct: 40 }] },
  { id: 'USDJPY', hidden: false, name: '美元/日圓', type: 'forex',  symbol: 'USD/JPY', emoji: '💴', baseFeeRate: 1.0, discountTiers: [{ minSavings: 300, discountPct: 15 }, { minSavings: 1500, discountPct: 35 }] },
  { id: 'EURUSD', hidden: false, name: '歐元/美元', type: 'forex',  symbol: 'EUR/USD', emoji: '💶', baseFeeRate: 1.0, discountTiers: [{ minSavings: 300, discountPct: 15 }, { minSavings: 1500, discountPct: 35 }] },
  { id: 'BTC',    hidden: false, name: '比特幣',    type: 'crypto', symbol: 'BTC',     emoji: '₿',  baseFeeRate: 2.0, discountTiers: [{ minSavings: 1000, discountPct: 20 }, { minSavings: 5000, discountPct: 50 }] },
  { id: 'ETH',    hidden: false, name: '以太幣',    type: 'crypto', symbol: 'ETH',     emoji: '⟠',  baseFeeRate: 2.0, discountTiers: [{ minSavings: 1000, discountPct: 20 }, { minSavings: 5000, discountPct: 50 }] },
];

// ── Constants ─────────────────────────────────────────────────────────────────
const SHOP_CATEGORIES: { value: ShopItemCategory; label: string }[] = [
  { value: 'avatar_weapon',    label: '⚔️ 武器'    },
  { value: 'avatar_armor',     label: '🛡️ 裝甲'   },
  { value: 'avatar_accessory', label: '✨ 飾品'    },
  { value: 'pet_weapon',       label: '🗡️ 寵物武器' },
  { value: 'pet_armor',        label: '🧤 寵物裝甲' },
  { value: 'pet_food',         label: '🍖 寵物食物' },
  { value: 'pet_egg',          label: '🥚 寵物蛋'  },
];

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'stock',     label: '📈 美股'         },
  { value: 'stock_tw',  label: '🇹🇼 台股（上市）' },
  { value: 'stock_otc', label: '🇹🇼 台股（上櫃）' },
  { value: 'forex',     label: '💱 外匯'          },
  { value: 'crypto',    label: '🪙 加密貨幣'      },
];

const SPECIES_KEYS: PetSpecies[] = ['dragon', 'cat', 'fox', 'wolf', 'bunny', 'phoenix'];

const SECTION_META: Record<SectionKey, { emoji: string; icon: string }> = {
  base:   { emoji: '🧑‍🎤', icon: '🧑‍🎤' },
  pets:   { emoji: '🐾',   icon: '🐾'   },
  shop:   { emoji: '🏪',   icon: '🏪'   },
  invest: { emoji: '📈',   icon: '📈'   },
  portal: { emoji: '🌀',   icon: '🌀'   },
};

const STATUS_OPTIONS: { value: SectionStatus; label: string; color: string }[] = [
  { value: 'visible',  label: '✅ 顯示',      color: 'border-green-400/50 bg-green-400/10 text-green-300'  },
  { value: 'disabled', label: '🔒 禁用（反灰）', color: 'border-yellow-400/50 bg-yellow-400/10 text-yellow-300' },
  { value: 'hidden',   label: '🙈 隱藏',      color: 'border-slate-400/30 bg-slate-400/10 text-slate-400'  },
];

// ── Shared components ─────────────────────────────────────────────────────────
type DiscountTier = { minSavings: number; discountPct: number };

const DiscountTierEditor: React.FC<{
  tiers: DiscountTier[];
  onChange: (t: DiscountTier[]) => void;
}> = ({ tiers, onChange }) => {
  const update = (i: number, field: keyof DiscountTier, val: string) =>
    onChange(tiers.map((t, idx) => idx === i ? { ...t, [field]: Number(val) } : t));
  const add    = () => onChange([...tiers, { minSavings: 500, discountPct: 10 }]);
  const remove = (i: number) => onChange(tiers.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted">
        <span>折扣梯度（儲蓄餘額 → 折扣百分比）</span>
        <button type="button" onClick={add} className="text-indigo-400 hover:text-indigo-300 font-bold">+ 新增</button>
      </div>
      {tiers.map((t, i) => (
        <div key={i} className="flex gap-1 items-center">
          <span className="text-[10px] text-muted w-10 shrink-0">滿</span>
          <input type="number" value={t.minSavings} onChange={e => update(i, 'minSavings', e.target.value)}
            className="input-field py-1 text-xs w-24" placeholder="最低儲蓄" />
          <span className="text-[10px] text-muted shrink-0">折</span>
          <input type="number" value={t.discountPct} onChange={e => update(i, 'discountPct', e.target.value)}
            className="input-field py-1 text-xs w-16" placeholder="%" min="1" max="99" />
          <span className="text-[10px] text-muted shrink-0">%</span>
          <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-300 p-0.5">
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      {tiers.length === 0 && <div className="text-[10px] text-muted italic">（無折扣梯度）</div>}
    </div>
  );
};

const FieldRow: React.FC<{ label: string; children: React.ReactNode; span2?: boolean }> = ({ label, children, span2 }) => (
  <div className={span2 ? 'col-span-2 flex flex-col gap-0.5' : 'flex flex-col gap-0.5'}>
    <label className="text-[10px] text-muted font-bold">{label}</label>
    {children}
  </div>
);

const SaveBar: React.FC<{
  dirty: boolean; saving: boolean; error: string | null;
  onSave: () => void; onReset: () => void;
}> = ({ dirty, saving, error, onSave, onReset }) => (
  <div className="flex flex-col gap-2 mt-2">
    {error && (
      <div className="text-xs text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-3 py-2.5 leading-relaxed">
        ❌ <strong>儲存失敗：</strong>{error}
        <br />
        <span className="text-[10px] text-red-400/70">
          提示：請確認 Firebase Console 的 Firestore 規則已包含 adventureConfig 集合，或查看瀏覽器 Console 取得詳細錯誤。
        </span>
      </div>
    )}
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border backdrop-blur-md transition-all
      ${dirty ? 'bg-indigo-500/10 border-indigo-400/30' : 'bg-white/5 border-white/10 opacity-50 pointer-events-none'}`}>
      <span className="text-xs font-bold text-indigo-300">{dirty ? '⚠️ 有未儲存的變更' : '✓ 已與 Firestore 同步'}</span>
      <div className="flex gap-2">
        <button onClick={onReset} className="btn btn-ghost text-xs py-1.5 px-3">重設預設值</button>
        <button onClick={onSave} disabled={saving}
          className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
          <Save size={13} />{saving ? '儲存中...' : '儲存到 Firestore'}
        </button>
      </div>
    </div>
  </div>
);

// ── Sections tab ──────────────────────────────────────────────────────────────
const SectionsTab: React.FC<{
  sections: SectionConfig[];
  onChange: (s: SectionConfig[]) => void;
}> = ({ sections, onChange }) => {
  const update = (key: SectionKey, patch: Partial<SectionConfig>) =>
    onChange(sections.map(s => s.key === key ? { ...s, ...patch } : s));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">控制每個子分類在小孩端的顯示狀態，以及自訂名稱與說明文字。</p>
      {sections.map(sec => {
        const meta = SECTION_META[sec.key];
        return (
          <div key={sec.key} className="glass-card flex flex-col gap-3">
            {/* Header row */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">{meta.emoji}</span>
              <div className="flex-1 font-black text-sm">{sec.name}</div>
              <span className="text-[10px] font-mono text-muted bg-white/5 px-2 py-0.5 rounded">{sec.key}</span>
            </div>

            {/* Status toggle */}
            <div>
              <div className="text-[10px] text-muted font-bold mb-1.5">顯示狀態</div>
              <div className="flex gap-1.5 flex-wrap">
                {STATUS_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => update(sec.key, { status: opt.value })}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all
                      ${sec.status === opt.value ? opt.color : 'border-white/10 text-muted hover:border-white/30'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Name + Desc */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <FieldRow label="顯示名稱">
                <input className="input-field py-1.5 text-sm" value={sec.name}
                  onChange={e => update(sec.key, { name: e.target.value })} />
              </FieldRow>
              <FieldRow label="副標題說明">
                <input className="input-field py-1.5 text-sm" value={sec.desc}
                  onChange={e => update(sec.key, { desc: e.target.value })} />
              </FieldRow>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Shop tab (with global discount tiers) ────────────────────────────────────
const ShopTab: React.FC<{
  items: ManagedShopItem[];
  tiers: DiscountTier[];
  onItemsChange: (items: ManagedShopItem[]) => void;
  onTiersChange: (tiers: DiscountTier[]) => void;
}> = ({ items, tiers, onItemsChange, onTiersChange }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const updateItem = (id: string, patch: Partial<ManagedShopItem>) =>
    onItemsChange(items.map(it => it.id === id ? { ...it, ...patch } : it));
  const deleteItem = (id: string) => {
    if (!confirm('確定刪除此商品？')) return;
    onItemsChange(items.filter(it => it.id !== id));
  };
  const addItem = () => {
    const id = uuidv4();
    const newItem: ManagedShopItem = { id, hidden: false, name: '新商品', category: 'pet_food', emoji: '🎁', description: '', basePrice: 50 };
    onItemsChange([...items, newItem]);
    setExpandedId(id);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Global discount tiers */}
      <div className="glass-card border border-green-400/20 bg-green-400/5">
        <div className="font-black text-sm text-green-400 mb-1">💰 全域儲蓄折扣梯度</div>
        <p className="text-[10px] text-muted mb-3">此折扣梯度套用到<strong>所有販賣部商品</strong>，不再個別設定。</p>
        <DiscountTierEditor tiers={tiers} onChange={onTiersChange} />
      </div>

      {/* Item list */}
      <div className="flex flex-col gap-2">
        <div className="text-xs font-bold text-muted">商品列表</div>
        {items.map(item => (
          <div key={item.id} className={`rounded-xl border transition-all ${item.hidden ? 'opacity-50 border-white/5' : 'border-white/10'}`}>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-xl">
              <span className="text-xl shrink-0">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{item.name}</div>
                <div className="text-[10px] text-muted">
                  {SHOP_CATEGORIES.find(c => c.value === item.category)?.label} · 💎{item.basePrice}
                </div>
              </div>
              {item.hidden && <span className="text-[10px] bg-slate-600/40 text-muted px-1.5 py-0.5 rounded font-bold">隱藏</span>}
              <div className="flex gap-1 shrink-0">
                <button onClick={() => updateItem(item.id, { hidden: !item.hidden })}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white" title={item.hidden ? '顯示' : '隱藏'}>
                  {item.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white">
                  {expandedId === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button onClick={() => deleteItem(item.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {expandedId === item.id && (
              <div className="px-3 pb-3 pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
                <FieldRow label="名稱">
                  <input className="input-field py-1.5 text-sm" value={item.name}
                    onChange={e => updateItem(item.id, { name: e.target.value })} />
                </FieldRow>
                <FieldRow label="Emoji">
                  <input className="input-field py-1.5 text-sm" value={item.emoji}
                    onChange={e => updateItem(item.id, { emoji: e.target.value })} />
                </FieldRow>
                <FieldRow label="分類">
                  <select className="input-field py-1.5 text-sm" value={item.category}
                    onChange={e => updateItem(item.id, { category: e.target.value as ShopItemCategory })}>
                    {SHOP_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="基本價格（寶石）">
                  <input type="number" min="1" className="input-field py-1.5 text-sm" value={item.basePrice}
                    onChange={e => updateItem(item.id, { basePrice: Number(e.target.value) })} />
                </FieldRow>
                <FieldRow label="描述" span2>
                  <input className="input-field py-1.5 text-sm" value={item.description}
                    onChange={e => updateItem(item.id, { description: e.target.value })} />
                </FieldRow>
              </div>
            )}
          </div>
        ))}
        <button onClick={addItem} className="btn btn-ghost flex items-center gap-1.5 text-xs self-start mt-1">
          <Plus size={14} /> 新增商品
        </button>
      </div>
    </div>
  );
};

// ── Pet Species tab ───────────────────────────────────────────────────────────
const SpeciesTab: React.FC<{
  items: ManagedPetSpecies[];
  onChange: (items: ManagedPetSpecies[]) => void;
}> = ({ items, onChange }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const updateItem = (id: string, patch: Partial<ManagedPetSpecies>) =>
    onChange(items.map(it => it.id === id ? { ...it, ...patch } : it));
  const deleteItem = (id: string) => { if (!confirm('確定刪除？')) return; onChange(items.filter(it => it.id !== id)); };
  const addItem = () => {
    const id = uuidv4();
    onChange([...items, { id, hidden: false, speciesKey: 'dragon', name: '新物種', emoji: '🐾', desc: '', colorFrom: 'from-slate-500/30', colorTo: 'to-gray-500/30' }]);
    setExpandedId(id);
  };
  return (
    <div className="flex flex-col gap-2">
      {items.map(item => (
        <div key={item.id} className={`rounded-xl border transition-all ${item.hidden ? 'opacity-50 border-white/5' : 'border-white/10'}`}>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-xl">
            <span className="text-xl shrink-0">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{item.name}</div>
              <div className="text-[10px] text-muted">{item.speciesKey} · {item.desc}</div>
            </div>
            {item.hidden && <span className="text-[10px] bg-slate-600/40 text-muted px-1.5 py-0.5 rounded font-bold">隱藏</span>}
            <div className="flex gap-1 shrink-0">
              <button onClick={() => updateItem(item.id, { hidden: !item.hidden })} className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white">
                {item.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white">
                {expandedId === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
            </div>
          </div>
          {expandedId === item.id && (
            <div className="px-3 pb-3 pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
              <FieldRow label="物種 Key">
                <select className="input-field py-1.5 text-sm" value={item.speciesKey} onChange={e => updateItem(item.id, { speciesKey: e.target.value as PetSpecies })}>
                  {SPECIES_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Emoji"><input className="input-field py-1.5 text-sm" value={item.emoji} onChange={e => updateItem(item.id, { emoji: e.target.value })} /></FieldRow>
              <FieldRow label="顯示名稱"><input className="input-field py-1.5 text-sm" value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} /></FieldRow>
              <FieldRow label="描述"><input className="input-field py-1.5 text-sm" value={item.desc} onChange={e => updateItem(item.id, { desc: e.target.value })} /></FieldRow>
              <FieldRow label="漸層起始 class"><input className="input-field py-1.5 text-sm font-mono" value={item.colorFrom} onChange={e => updateItem(item.id, { colorFrom: e.target.value })} placeholder="from-red-500/30" /></FieldRow>
              <FieldRow label="漸層結束 class"><input className="input-field py-1.5 text-sm font-mono" value={item.colorTo} onChange={e => updateItem(item.id, { colorTo: e.target.value })} placeholder="to-orange-500/30" /></FieldRow>
            </div>
          )}
        </div>
      ))}
      <button onClick={addItem} className="btn btn-ghost flex items-center gap-1.5 text-xs self-start mt-1"><Plus size={14} /> 新增物種</button>
    </div>
  );
};

// ── Destinations tab ──────────────────────────────────────────────────────────
const DestinationsTab: React.FC<{
  items: ManagedDestination[];
  onChange: (items: ManagedDestination[]) => void;
}> = ({ items, onChange }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const updateItem = (id: string, patch: Partial<ManagedDestination>) => onChange(items.map(it => it.id === id ? { ...it, ...patch } : it));
  const numPatch = (id: string, field: keyof ManagedDestination, val: string) => updateItem(id, { [field]: Number(val) } as Partial<ManagedDestination>);
  const deleteItem = (id: string) => { if (!confirm('確定刪除？')) return; onChange(items.filter(it => it.id !== id)); };
  const addItem = () => {
    const id = uuidv4();
    onChange([...items, { id, hidden: false, emoji: '🗺️', name: '新目的地', desc: '', durationHours: 4, requiredLevel: 1, baseGemRewardMin: 10, baseGemRewardMax: 50, baseExpRewardMin: 20, baseExpRewardMax: 60, successRate: 70 }]);
    setExpandedId(id);
  };
  return (
    <div className="flex flex-col gap-2">
      {items.map(item => (
        <div key={item.id} className={`rounded-xl border transition-all ${item.hidden ? 'opacity-50 border-white/5' : 'border-white/10'}`}>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-xl">
            <span className="text-xl shrink-0">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{item.name}</div>
              <div className="text-[10px] text-muted">⏱{item.durationHours}h · Lv.{item.requiredLevel}+ · 成功{item.successRate}% · 💎{item.baseGemRewardMin}–{item.baseGemRewardMax}</div>
            </div>
            {item.hidden && <span className="text-[10px] bg-slate-600/40 text-muted px-1.5 py-0.5 rounded font-bold">隱藏</span>}
            <div className="flex gap-1 shrink-0">
              <button onClick={() => updateItem(item.id, { hidden: !item.hidden })} className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white">
                {item.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white">
                {expandedId === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
            </div>
          </div>
          {expandedId === item.id && (
            <div className="px-3 pb-3 pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
              <FieldRow label="名稱"><input className="input-field py-1.5 text-sm" value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} /></FieldRow>
              <FieldRow label="Emoji"><input className="input-field py-1.5 text-sm" value={item.emoji} onChange={e => updateItem(item.id, { emoji: e.target.value })} /></FieldRow>
              <FieldRow label="描述" span2><input className="input-field py-1.5 text-sm" value={item.desc} onChange={e => updateItem(item.id, { desc: e.target.value })} /></FieldRow>
              <FieldRow label="耗時（小時）"><input type="number" min="1" className="input-field py-1.5 text-sm" value={item.durationHours} onChange={e => numPatch(item.id, 'durationHours', e.target.value)} /></FieldRow>
              <FieldRow label="所需等級"><input type="number" min="1" className="input-field py-1.5 text-sm" value={item.requiredLevel} onChange={e => numPatch(item.id, 'requiredLevel', e.target.value)} /></FieldRow>
              <FieldRow label="基礎成功率（%）"><input type="number" min="1" max="99" className="input-field py-1.5 text-sm" value={item.successRate} onChange={e => numPatch(item.id, 'successRate', e.target.value)} /></FieldRow>
              <div />
              <FieldRow label="💎 獎勵 最低"><input type="number" min="0" className="input-field py-1.5 text-sm" value={item.baseGemRewardMin} onChange={e => numPatch(item.id, 'baseGemRewardMin', e.target.value)} /></FieldRow>
              <FieldRow label="💎 獎勵 最高"><input type="number" min="0" className="input-field py-1.5 text-sm" value={item.baseGemRewardMax} onChange={e => numPatch(item.id, 'baseGemRewardMax', e.target.value)} /></FieldRow>
              <FieldRow label="EXP 獎勵 最低"><input type="number" min="0" className="input-field py-1.5 text-sm" value={item.baseExpRewardMin} onChange={e => numPatch(item.id, 'baseExpRewardMin', e.target.value)} /></FieldRow>
              <FieldRow label="EXP 獎勵 最高"><input type="number" min="0" className="input-field py-1.5 text-sm" value={item.baseExpRewardMax} onChange={e => numPatch(item.id, 'baseExpRewardMax', e.target.value)} /></FieldRow>
            </div>
          )}
        </div>
      ))}
      <button onClick={addItem} className="btn btn-ghost flex items-center gap-1.5 text-xs self-start mt-1"><Plus size={14} /> 新增目的地</button>
    </div>
  );
};

// ── GemRates editor ───────────────────────────────────────────────────────────
const GemRatesEditor: React.FC = () => {
  const { gemRates, updateGemRates } = useStore();
  const [rates, setRates] = useState(gemRates);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await updateGemRates(rates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      {[
        { key: 'stockTw' as const, label: '台灣股票', unit: 'TWD/寶石', hint: '例：10 代表 1寶石=NT$10' },
        { key: 'stockUs' as const, label: '美股',     unit: 'USD/寶石', hint: '例：3 代表 1寶石=$3美元' },
        { key: 'crypto'  as const, label: '加密貨幣', unit: 'TWD/寶石', hint: '例：100 代表 1寶石=NT$100' },
      ].map(({ key, label, unit, hint }) => (
        <div key={key} className="flex flex-col gap-1">
          <label className="text-xs text-muted font-bold">{label} <span className="text-slate-500 font-normal">({unit})</span></label>
          <div className="text-[10px] text-slate-600 mb-1">{hint}</div>
          <input type="number" min="0.001" step="0.001"
            className="input-field text-sm"
            value={rates[key]}
            onChange={e => setRates(r => ({ ...r, [key]: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      ))}
      <button onClick={handleSave} className="btn btn-primary text-sm">
        {saved ? '✅ 已儲存' : '💾 儲存換算比例'}
      </button>
    </div>
  );
};

// ── Assets tab ────────────────────────────────────────────────────────────────
const AssetsTab: React.FC<{
  items: ManagedAsset[];
  onChange: (items: ManagedAsset[]) => void;
}> = ({ items, onChange }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const updateItem = (id: string, patch: Partial<ManagedAsset>) => onChange(items.map(it => it.id === id ? { ...it, ...patch } : it));
  const deleteItem = (id: string) => { if (!confirm('確定刪除？')) return; onChange(items.filter(it => it.id !== id)); };
  const addItem = () => {
    const id = uuidv4();
    onChange([...items, { id, hidden: false, name: '新資產', type: 'stock', symbol: 'NEW', emoji: '📊', baseFeeRate: 1.5, discountTiers: [] }]);
    setExpandedId(id);
  };
  return (
    <div className="flex flex-col gap-2">
      {items.map(item => (
        <div key={item.id} className={`rounded-xl border transition-all ${item.hidden ? 'opacity-50 border-white/5' : 'border-white/10'}`}>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-xl">
            <span className="text-xl shrink-0">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{item.name}</div>
              <div className="text-[10px] text-muted">{item.symbol} · {ASSET_TYPES.find(t => t.value === item.type)?.label} · {item.baseFeeRate}%</div>
            </div>
            {item.hidden && <span className="text-[10px] bg-slate-600/40 text-muted px-1.5 py-0.5 rounded font-bold">隱藏</span>}
            <div className="flex gap-1 shrink-0">
              <button onClick={() => updateItem(item.id, { hidden: !item.hidden })} className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white">
                {item.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white">
                {expandedId === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
            </div>
          </div>
          {expandedId === item.id && (
            <div className="px-3 pb-3 pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
              <FieldRow label="名稱"><input className="input-field py-1.5 text-sm" value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} /></FieldRow>
              <FieldRow label="Emoji"><input className="input-field py-1.5 text-sm" value={item.emoji} onChange={e => updateItem(item.id, { emoji: e.target.value })} /></FieldRow>
              <FieldRow label="代號 (Symbol)"><input className="input-field py-1.5 text-sm font-mono" value={item.symbol} onChange={e => updateItem(item.id, { symbol: e.target.value })} /></FieldRow>
              <FieldRow label="類型">
                <select className="input-field py-1.5 text-sm" value={item.type} onChange={e => updateItem(item.id, { type: e.target.value as AssetType })}>
                  {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="基本手續費 (%)">
                <input type="number" step="0.1" min="0" className="input-field py-1.5 text-sm" value={item.baseFeeRate} onChange={e => updateItem(item.id, { baseFeeRate: parseFloat(e.target.value) })} />
              </FieldRow>
              <div />
              <div className="col-span-2">
                <DiscountTierEditor tiers={item.discountTiers} onChange={t => updateItem(item.id, { discountTiers: t })} />
              </div>
            </div>
          )}
        </div>
      ))}
      <button onClick={addItem} className="btn btn-ghost flex items-center gap-1.5 text-xs self-start mt-1"><Plus size={14} /> 新增資產</button>

      {/* GemRates settings */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="text-xs text-muted font-bold uppercase">🪙 寶石換算比例設定</div>
        <div className="text-[10px] text-slate-500">設定各資產類型中，1顆寶石相當於多少現實貨幣單位</div>
        <GemRatesEditor />
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
type ConfigTab = 'sections' | 'shop' | 'species' | 'destinations' | 'assets';

const CONFIG_TABS: { key: ConfigTab; icon: React.ReactNode; label: string }[] = [
  { key: 'sections',     icon: <LayoutGrid size={14} />,  label: '子分類設定' },
  { key: 'shop',         icon: <ShoppingBag size={14} />, label: '販賣部商品' },
  { key: 'species',      icon: <Cat size={14} />,         label: '寵物物種'   },
  { key: 'destinations', icon: <MapPin size={14} />,      label: '遠征目的地' },
  { key: 'assets',       icon: <TrendingUp size={14} />,  label: '投資資產'   },
];

const AdventureAdminSection: React.FC<{ isSuperAdmin: boolean }> = ({ isSuperAdmin }) => {
  const { getAdventureConfigDoc, setAdventureConfigDoc, firebaseUser, systemAdminRole } = useStore();

  const [configTab, setConfigTab] = useState<ConfigTab>('sections');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving,  setIsSaving]  = useState(false);
  const [dirty,     setDirty]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // State per category
  const [sections,    setSectionsRaw]    = useState<SectionConfig[]>(DEFAULT_SECTIONS);
  const [shopItems,   setShopItemsRaw]   = useState<ManagedShopItem[]>(DEFAULT_SHOP_ITEMS);
  const [shopTiers,   setShopTiersRaw]   = useState<DiscountTier[]>(DEFAULT_SHOP_TIERS);
  const [petSpecies,  setPetSpeciesRaw]  = useState<ManagedPetSpecies[]>(DEFAULT_SPECIES);
  const [destinations,setDestinationsRaw]= useState<ManagedDestination[]>(DEFAULT_DESTINATIONS);
  const [assets,      setAssetsRaw]      = useState<ManagedAsset[]>(DEFAULT_ASSETS);
  const [allowSeniorEdit, setAllowSeniorEditMap] = useState<Record<ConfigTab, boolean>>({
    sections: false, shop: false, species: false, destinations: false, assets: false,
  });

  // Dirty-marking wrappers
  const mark = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (val: T | ((p: T) => T)) => { setter(val); setDirty(true); }, []);

  const setSections    = mark(setSectionsRaw);
  const setShopItems   = mark(setShopItemsRaw);
  const setShopTiers   = mark(setShopTiersRaw);
  const setPetSpecies  = mark(setPetSpeciesRaw);
  const setDestinations= mark(setDestinationsRaw);
  const setAssets      = mark(setAssetsRaw);
  const setAllowSenior = (tab: ConfigTab, val: boolean) => {
    setAllowSeniorEditMap(p => ({ ...p, [tab]: val }));
    setDirty(true);
  };

  // Doc ID map
  const docId = { sections: DOC_SECTIONS, shop: DOC_SHOP, species: DOC_SPECIES, destinations: DOC_DEST, assets: DOC_ASSETS }[configTab];

  // Load from Firestore on tab change
  const load = useCallback(async () => {
    setIsLoading(true);
    setSaveError(null);
    try {
      const data = await getAdventureConfigDoc(docId);
      if (!data) return;
      const ase = (data.allowSeniorEdit as boolean) ?? false;
      setAllowSeniorEditMap(p => ({ ...p, [configTab]: ase }));
      if (configTab === 'sections' && Array.isArray(data.sections)) {
        setSectionsRaw(data.sections as SectionConfig[]);
      } else if (configTab === 'shop') {
        if (Array.isArray(data.items))       setShopItemsRaw(data.items as ManagedShopItem[]);
        if (Array.isArray(data.discountTiers)) setShopTiersRaw(data.discountTiers as DiscountTier[]);
      } else if (configTab === 'species'      && Array.isArray(data.items)) setPetSpeciesRaw(data.items as ManagedPetSpecies[]);
      else if (configTab === 'destinations'   && Array.isArray(data.items)) setDestinationsRaw(data.items as ManagedDestination[]);
      else if (configTab === 'assets'         && Array.isArray(data.items)) setAssetsRaw(data.items as ManagedAsset[]);
    } finally {
      setIsLoading(false);
      setDirty(false);
    }
  }, [configTab, docId, getAdventureConfigDoc]);

  useEffect(() => { load(); }, [load]);

  // Save current tab to Firestore
  const save = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      let payload: Record<string, unknown>;
      if (configTab === 'sections') {
        payload = { sections, updatedAt: new Date().toISOString(), updatedBy: firebaseUser?.uid ?? '' };
      } else if (configTab === 'shop') {
        payload = { allowSeniorEdit: allowSeniorEdit.shop, items: shopItems, discountTiers: shopTiers, updatedAt: new Date().toISOString(), updatedBy: firebaseUser?.uid ?? '' };
      } else {
        const items = configTab === 'species' ? petSpecies : configTab === 'destinations' ? destinations : assets;
        payload = { allowSeniorEdit: allowSeniorEdit[configTab], items, updatedAt: new Date().toISOString(), updatedBy: firebaseUser?.uid ?? '' };
      }
      await setAdventureConfigDoc(docId, payload);
      setDirty(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[AdventureAdmin] save failed:', e);
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm('確定重設為預設值？')) return;
    if      (configTab === 'sections')     setSections(DEFAULT_SECTIONS);
    else if (configTab === 'shop')       { setShopItems(DEFAULT_SHOP_ITEMS); setShopTiers(DEFAULT_SHOP_TIERS); }
    else if (configTab === 'species')     setPetSpecies(DEFAULT_SPECIES);
    else if (configTab === 'destinations')setDestinations(DEFAULT_DESTINATIONS);
    else                                   setAssets(DEFAULT_ASSETS);
  };

  // Access guard
  const canEdit = isSuperAdmin || (systemAdminRole === 'senior' && allowSeniorEdit[configTab]);
  if (!canEdit) return <div className="text-center text-muted py-12 text-sm">🔒 此功能目前僅開放給超級管理者</div>;

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1.5 flex-wrap">
        {CONFIG_TABS.map(t => (
          <button key={t.key} onClick={() => setConfigTab(t.key)}
            className={`btn flex items-center gap-1.5 text-xs py-1.5 px-3 ${configTab === t.key ? 'btn-primary' : 'btn-ghost'}`}>
            {t.icon} {t.label}
          </button>
        ))}
        <button onClick={load} disabled={isLoading}
          className="btn btn-ghost text-xs py-1.5 px-2 ml-auto flex items-center gap-1">
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> 重新載入
        </button>
      </div>

      {/* allowSeniorEdit (non-sections tabs only) */}
      {configTab !== 'sections' && (
        <div className="glass-card border border-yellow-400/20 bg-yellow-400/5 py-2.5">
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
            <input type="checkbox" checked={allowSeniorEdit[configTab]}
              onChange={e => setAllowSenior(configTab, e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-yellow-500" />
            ⚠️ 預留：開放「{CONFIG_TABS.find(t => t.key === configTab)?.label}」給高級管理者編輯
          </label>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="text-center text-muted py-8 text-sm">載入中...</div>
      ) : (
        <>
          {configTab === 'sections'     && <SectionsTab     sections={sections}   onChange={setSections} />}
          {configTab === 'shop'         && <ShopTab         items={shopItems} tiers={shopTiers} onItemsChange={setShopItems} onTiersChange={setShopTiers} />}
          {configTab === 'species'      && <SpeciesTab      items={petSpecies}    onChange={setPetSpecies} />}
          {configTab === 'destinations' && <DestinationsTab items={destinations}  onChange={setDestinations} />}
          {configTab === 'assets'       && <AssetsTab       items={assets}        onChange={setAssets} />}
        </>
      )}

      <SaveBar dirty={dirty} saving={isSaving} error={saveError} onSave={save} onReset={reset} />
    </div>
  );
};

export default AdventureAdminSection;
