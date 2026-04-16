import React, { useState } from 'react';
import { ShoppingBag, Tag, Gem, ChevronDown, ChevronUp } from 'lucide-react';
import type { ShopItemCategory } from '../../types/adventure';

// ── Static shop catalogue ─────────────────────────────────────────────────────
interface DisplayShopItem {
  id: string;
  name: string;
  category: ShopItemCategory;
  emoji: string;
  description: string;
  basePrice: number;
  discountTiers: { minSavings: number; discountPct: number }[];
}

const SHOP_ITEMS: DisplayShopItem[] = [
  // Avatar weapons
  { id: 'w_sword',    name: '勇士劍',   category: 'avatar_weapon',    emoji: '⚔️', description: '閃閃發光的勇者之劍', basePrice: 50,  discountTiers: [{ minSavings: 500, discountPct: 10 }, { minSavings: 1000, discountPct: 20 }] },
  { id: 'w_staff',    name: '魔法杖',   category: 'avatar_weapon',    emoji: '🪄', description: '蘊含神秘魔力的法杖', basePrice: 60,  discountTiers: [{ minSavings: 500, discountPct: 10 }, { minSavings: 1000, discountPct: 20 }] },
  { id: 'w_bow',      name: '精靈弓',   category: 'avatar_weapon',    emoji: '🏹', description: '精準無誤的精靈之弓', basePrice: 55,  discountTiers: [{ minSavings: 500, discountPct: 10 }, { minSavings: 1000, discountPct: 20 }] },
  // Avatar armor
  { id: 'a_robe',     name: '魔法袍',   category: 'avatar_armor',     emoji: '👘', description: '增幅魔力的神秘長袍', basePrice: 80,  discountTiers: [{ minSavings: 500, discountPct: 10 }, { minSavings: 1000, discountPct: 25 }] },
  { id: 'a_armor',    name: '戰士甲',   category: 'avatar_armor',     emoji: '🥋', description: '堅不可摧的重型戰甲', basePrice: 90,  discountTiers: [{ minSavings: 500, discountPct: 10 }, { minSavings: 1000, discountPct: 25 }] },
  { id: 'a_cloak',    name: '英雄披風', category: 'avatar_armor',     emoji: '🦸', description: '傳說英雄穿戴的披風', basePrice: 120, discountTiers: [{ minSavings: 500, discountPct: 10 }, { minSavings: 2000, discountPct: 30 }] },
  // Avatar accessories
  { id: 'ac_hat',     name: '魔術帽',   category: 'avatar_accessory', emoji: '🎩', description: '神奇的魔術師帽子', basePrice: 40,  discountTiers: [{ minSavings: 300, discountPct: 10 }] },
  { id: 'ac_crown',   name: '勇者冠',   category: 'avatar_accessory', emoji: '👑', description: '象徵勇氣的王冠',   basePrice: 100, discountTiers: [{ minSavings: 1000, discountPct: 20 }] },
  { id: 'ac_wings',   name: '天使翅膀', category: 'avatar_accessory', emoji: '🪽', description: '純潔天使的羽翼',   basePrice: 150, discountTiers: [{ minSavings: 2000, discountPct: 30 }] },
  // Pet food
  { id: 'pf_meat',    name: '烤肉',     category: 'pet_food',         emoji: '🍖', description: '增加體力 +20',    basePrice: 20,  discountTiers: [{ minSavings: 200, discountPct: 10 }] },
  { id: 'pf_fish',    name: '鮮魚',     category: 'pet_food',         emoji: '🐟', description: '提升敏捷 +10',   basePrice: 25,  discountTiers: [{ minSavings: 200, discountPct: 10 }] },
  { id: 'pf_cake',    name: '星光蛋糕', category: 'pet_food',         emoji: '🎂', description: '提升心情至狂喜', basePrice: 50,  discountTiers: [{ minSavings: 500, discountPct: 15 }] },
  // Pet eggs
  { id: 'pe_dragon',  name: '火龍蛋',   category: 'pet_egg',          emoji: '🥚', description: '傳說中的火龍蛋', basePrice: 200, discountTiers: [{ minSavings: 1000, discountPct: 10 }, { minSavings: 3000, discountPct: 25 }] },
  { id: 'pe_phoenix', name: '鳳凰蛋',   category: 'pet_egg',          emoji: '🪺', description: '極稀有的鳳凰蛋！', basePrice: 500, discountTiers: [{ minSavings: 5000, discountPct: 30 }] },
];

const CATEGORY_LABELS: Record<ShopItemCategory, string> = {
  avatar_weapon:    '⚔️ 武器',
  avatar_armor:     '🛡️ 裝甲',
  avatar_accessory: '✨ 飾品',
  pet_weapon:       '🗡️ 寵物武器',
  pet_armor:        '🧤 寵物裝甲',
  pet_food:         '🍖 寵物食物',
  pet_egg:          '🥚 寵物蛋',
};

const CATEGORY_ORDER: ShopItemCategory[] = [
  'avatar_weapon', 'avatar_armor', 'avatar_accessory', 'pet_food', 'pet_egg',
];

// Simulated savings balance for discount preview (in real app: from store)
const DEMO_SAVINGS = 800;

function calcPrice(item: DisplayShopItem, savings: number): { price: number; discount: number } {
  let discount = 0;
  for (const tier of item.discountTiers) {
    if (savings >= tier.minSavings) discount = tier.discountPct;
  }
  const price = Math.floor(item.basePrice * (1 - discount / 100));
  return { price, discount };
}

// ── Sub-components ────────────────────────────────────────────────────────────
const ShopSection: React.FC<{ category: ShopItemCategory; items: DisplayShopItem[]; savings: number }> = ({ category, items, savings }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="glass-card">
      <button className="w-full flex items-center justify-between font-black text-sm mb-0"
        onClick={() => setOpen(o => !o)}>
        <span>{CATEGORY_LABELS[category]}</span>
        {open ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
      </button>
      {open && (
        <div className="flex flex-col gap-2 mt-3">
          {items.map(item => {
            const { price, discount } = calcPrice(item, savings);
            return (
              <div key={item.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
                <span className="text-2xl shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold leading-tight">{item.name}</div>
                  <div className="text-[10px] text-muted">{item.description}</div>
                  {discount > 0 && (
                    <div className="text-[10px] text-green-400 font-bold mt-0.5">
                      💰 儲蓄折扣 -{discount}%
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {discount > 0 && (
                    <span className="text-[10px] text-muted line-through">{item.basePrice}</span>
                  )}
                  <div className="flex items-center gap-1 text-amber-400 font-black text-sm">
                    <Gem size={12} />
                    {price}
                  </div>
                  <button className="text-[10px] bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-bold px-2 py-0.5 rounded-lg hover:bg-indigo-500/30 transition-colors active:scale-95">
                    購買
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const AdventureShop: React.FC = () => {
  const savings = DEMO_SAVINGS;

  const itemsByCategory = CATEGORY_ORDER.reduce<Record<string, DisplayShopItem[]>>((acc, cat) => {
    const filtered = SHOP_ITEMS.filter(i => i.category === cat);
    if (filtered.length > 0) acc[cat] = filtered;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
          <ShoppingBag size={28} className="text-amber-400" />
        </div>
        <h4 className="text-xl font-black">販賣部</h4>
        <p className="text-xs text-muted">用寶石購買裝備和道具！</p>
      </div>

      {/* Savings discount info */}
      <div className="glass-card bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-400/20">
        <div className="flex items-center gap-2 mb-2">
          <Tag size={14} className="text-green-400" />
          <span className="text-sm font-black text-green-400">儲蓄折扣優惠</span>
        </div>
        <div className="text-xs text-muted mb-3">儲蓄信封餘額越高，購物折扣越大！現在折扣計算中...</div>
        <div className="flex flex-col gap-1.5">
          {[
            { minSavings: 200,  discountPct: 10, label: '基礎折扣' },
            { minSavings: 500,  discountPct: 15, label: '中級折扣' },
            { minSavings: 1000, discountPct: 25, label: '高級折扣' },
            { minSavings: 3000, discountPct: 30, label: '頂級折扣' },
          ].map(tier => (
            <div key={tier.minSavings}
              className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-xl border transition-all
                ${savings >= tier.minSavings ? 'border-green-400/30 bg-green-400/10 text-green-300' : 'border-white/10 text-muted'}`}>
              <span>💰 儲蓄滿 {tier.minSavings.toLocaleString()}</span>
              <span className="font-bold">折 {tier.discountPct}%{savings >= tier.minSavings ? ' ✓' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gem balance reminder */}
      <div className="flex items-center gap-2 text-xs text-muted bg-white/5 rounded-xl px-4 py-2.5 border border-white/10">
        <Gem size={14} className="text-amber-400" />
        <span>完成任務和日常挑戰來累積寶石餘額！</span>
      </div>

      {/* Sections */}
      {CATEGORY_ORDER.filter(cat => itemsByCategory[cat]).map(cat => (
        <ShopSection key={cat} category={cat} items={itemsByCategory[cat]} savings={savings} />
      ))}
    </div>
  );
};

export default AdventureShop;
