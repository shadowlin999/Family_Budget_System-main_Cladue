import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Gem, AlertCircle, RefreshCw } from 'lucide-react';
import type { AssetType } from '../../types/adventure';

// ── Static asset catalogue ────────────────────────────────────────────────────
interface DisplayAsset {
  id: string;
  name: string;
  type: AssetType;
  symbol: string;
  emoji: string;
  baseFeeRate: number; // %
  discountTiers: { minSavings: number; discountPct: number }[];
}

const ASSETS: DisplayAsset[] = [
  // Stocks
  { id: 'AAPL',   name: '蘋果公司',     type: 'stock',  symbol: 'AAPL',    emoji: '🍎', baseFeeRate: 1.5, discountTiers: [{ minSavings: 500, discountPct: 20 }, { minSavings: 2000, discountPct: 40 }] },
  { id: 'TSLA',   name: '特斯拉',       type: 'stock',  symbol: 'TSLA',    emoji: '🚗', baseFeeRate: 1.5, discountTiers: [{ minSavings: 500, discountPct: 20 }, { minSavings: 2000, discountPct: 40 }] },
  { id: 'NVDA',   name: 'NVIDIA',       type: 'stock',  symbol: 'NVDA',    emoji: '💻', baseFeeRate: 1.5, discountTiers: [{ minSavings: 500, discountPct: 20 }, { minSavings: 2000, discountPct: 40 }] },
  // Forex
  { id: 'USDJPY', name: '美元/日圓',    type: 'forex',  symbol: 'USD/JPY', emoji: '💴', baseFeeRate: 1.0, discountTiers: [{ minSavings: 300, discountPct: 15 }, { minSavings: 1500, discountPct: 35 }] },
  { id: 'EURUSD', name: '歐元/美元',    type: 'forex',  symbol: 'EUR/USD', emoji: '💶', baseFeeRate: 1.0, discountTiers: [{ minSavings: 300, discountPct: 15 }, { minSavings: 1500, discountPct: 35 }] },
  // Crypto
  { id: 'BTC',    name: '比特幣',       type: 'crypto', symbol: 'BTC',     emoji: '₿',  baseFeeRate: 2.0, discountTiers: [{ minSavings: 1000, discountPct: 20 }, { minSavings: 5000, discountPct: 50 }] },
  { id: 'ETH',    name: '以太幣',       type: 'crypto', symbol: 'ETH',     emoji: '⟠',  baseFeeRate: 2.0, discountTiers: [{ minSavings: 1000, discountPct: 20 }, { minSavings: 5000, discountPct: 50 }] },
];

// Demo price data (in real app: fetched from public market data API)
const DEMO_PRICES: Record<string, { price: number; change: number }> = {
  AAPL:   { price: 18520, change: +2.34 },
  TSLA:   { price: 7650,  change: -1.82 },
  NVDA:   { price: 89300, change: +4.67 },
  USDJPY: { price: 15183, change: +0.23 },
  EURUSD: { price: 10881, change: -0.14 },
  BTC:    { price: 2850000, change: +3.12 },
  ETH:    { price: 178000, change: +1.45 },
};

// Demo holdings
const DEMO_HOLDINGS = [
  { assetId: 'AAPL', quantity: 2, avgCostGems: 180 },
  { assetId: 'USDJPY', quantity: 5, avgCostGems: 95 },
];

const TYPE_LABELS: Record<AssetType, string> = {
  stock:  '📈 股票',
  forex:  '💱 外匯',
  crypto: '🪙 加密貨幣',
};

const DEMO_SAVINGS = 800;

function calcFee(asset: DisplayAsset, savings: number): number {
  let discount = 0;
  for (const tier of asset.discountTiers) {
    if (savings >= tier.minSavings) discount = tier.discountPct;
  }
  return parseFloat((asset.baseFeeRate * (1 - discount / 100)).toFixed(2));
}

function formatPrice(price: number): string {
  if (price >= 10000) return `${(price / 10000).toFixed(2)}萬`;
  return price.toLocaleString();
}

// ── Main component ────────────────────────────────────────────────────────────
const AdventureInvest: React.FC = () => {
  const [activeType, setActiveType] = useState<AssetType | 'all'>('all');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');
  const [tradeQty, setTradeQty] = useState('1');
  const savings = DEMO_SAVINGS;

  const filtered = activeType === 'all' ? ASSETS : ASSETS.filter(a => a.type === activeType);
  const selected = ASSETS.find(a => a.id === selectedAsset);
  const priceData = selectedAsset ? DEMO_PRICES[selectedAsset] : null;

  // Portfolio value
  const portfolioValue = DEMO_HOLDINGS.reduce((sum, h) => {
    const p = DEMO_PRICES[h.assetId]?.price ?? 0;
    return sum + h.quantity * p;
  }, 0);
  const portfolioCost = DEMO_HOLDINGS.reduce((sum, h) => sum + h.quantity * h.avgCostGems, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
          <TrendingUp size={28} className="text-blue-400" />
        </div>
        <h4 className="text-xl font-black">投資部</h4>
        <p className="text-xs text-muted">用寶石模擬投資，學習理財觀念！</p>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-2 items-start bg-amber-500/10 border border-amber-400/20 rounded-xl px-3 py-2.5">
        <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-300 leading-relaxed">
          此為<strong>虛擬模擬投資</strong>，使用寶石而非真實金錢，價格參考真實市場。投資有風險，目的是學習而非獲利。
        </p>
      </div>

      {/* Portfolio summary */}
      <div className="glass-card bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-400/20">
        <div className="text-xs font-bold text-muted mb-3">我的投資組合</div>
        <div className="flex gap-4 flex-wrap">
          <div>
            <div className="text-[10px] text-muted">持倉市值</div>
            <div className="text-lg font-black flex items-center gap-1">
              <Gem size={14} className="text-amber-400" />
              {formatPrice(portfolioValue)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted">投入成本</div>
            <div className="text-base font-black text-muted">{portfolioCost}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted">盈虧</div>
            <div className={`text-base font-black ${portfolioValue > portfolioCost ? 'text-green-400' : 'text-red-400'}`}>
              {portfolioValue > portfolioCost ? '+' : ''}{portfolioValue - portfolioCost}
            </div>
          </div>
        </div>
        {DEMO_HOLDINGS.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {DEMO_HOLDINGS.map(h => {
              const asset = ASSETS.find(a => a.id === h.assetId);
              const p = DEMO_PRICES[h.assetId];
              const currentVal = h.quantity * (p?.price ?? 0);
              const costVal = h.quantity * h.avgCostGems;
              const gain = currentVal - costVal;
              return (
                <div key={h.assetId} className="flex items-center gap-2 text-xs bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                  <span className="text-base">{asset?.emoji}</span>
                  <span className="font-bold flex-1">{asset?.symbol} × {h.quantity}</span>
                  <span className={`font-bold ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {gain >= 0 ? '+' : ''}{gain}
                  </span>
                  {p && (
                    <span className={`text-[10px] flex items-center gap-0.5 ${p.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {p.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {p.change > 0 ? '+' : ''}{p.change}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fee discount */}
      <div className="glass-card bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-400/20">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={12} className="text-green-400" />
          <span className="text-xs font-black text-green-400">儲蓄折扣 → 手續費減免</span>
        </div>
        <div className="text-[10px] text-muted">儲蓄信封餘額越高，交易手續費越低！</div>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'stock', 'forex', 'crypto'] as const).map(t => (
          <button key={t} onClick={() => setActiveType(t)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
              ${activeType === t ? 'border-blue-400/50 bg-blue-400/10 text-blue-300' : 'border-white/10 text-muted hover:border-white/30'}`}>
            {t === 'all' ? '全部' : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Asset list */}
      <div className="flex flex-col gap-2">
        {filtered.map(asset => {
          const p = DEMO_PRICES[asset.id];
          const fee = calcFee(asset, savings);
          const isSelected = selectedAsset === asset.id;
          return (
            <div key={asset.id}>
              <button onClick={() => setSelectedAsset(isSelected ? null : asset.id)}
                className={`w-full flex items-center gap-3 glass-card border transition-all text-left
                  ${isSelected ? 'border-blue-400/40 bg-blue-400/5' : 'border-white/10 hover:border-white/30'}`}>
                <span className="text-2xl shrink-0">{asset.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{asset.name}</div>
                  <div className="text-[10px] text-muted">{asset.symbol} · 手續費 {fee}%{savings >= (asset.discountTiers[0]?.minSavings ?? Infinity) ? ' (已折扣)' : ''}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-sm flex items-center gap-1">
                    <Gem size={11} className="text-amber-400" />
                    {formatPrice(p.price)}
                  </div>
                  <div className={`text-[10px] font-bold flex items-center gap-0.5 justify-end ${p.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {p.change > 0 ? '+' : ''}{p.change}%
                  </div>
                </div>
              </button>

              {/* Trade panel (expanded) */}
              {isSelected && selected && (
                <div className="mt-1 glass-card border border-blue-400/20 bg-blue-400/5 flex flex-col gap-3">
                  <div className="flex gap-2">
                    {(['buy', 'sell'] as const).map(action => (
                      <button key={action} onClick={() => setTradeAction(action)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all
                          ${tradeAction === action
                            ? action === 'buy' ? 'border-green-400/50 bg-green-400/10 text-green-300' : 'border-red-400/50 bg-red-400/10 text-red-300'
                            : 'border-white/10 text-muted'}`}>
                        {action === 'buy' ? '📈 買入' : '📉 賣出'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted shrink-0">數量</label>
                    <input type="number" min="1" value={tradeQty} onChange={e => setTradeQty(e.target.value)}
                      className="input-field flex-1 text-sm py-1.5" />
                  </div>
                  <div className="text-xs text-muted flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span>單價</span><span className="font-bold">{formatPrice(priceData?.price ?? 0)} 寶石</span>
                    </div>
                    <div className="flex justify-between">
                      <span>手續費 {fee}%</span>
                      <span className="font-bold">{Math.ceil((priceData?.price ?? 0) * parseInt(tradeQty || '0') * fee / 100)} 寶石</span>
                    </div>
                    <div className="flex justify-between font-black text-white border-t border-white/10 pt-1">
                      <span>總計</span>
                      <span>{Math.ceil((priceData?.price ?? 0) * parseInt(tradeQty || '0') * (1 + fee / 100))} 寶石</span>
                    </div>
                  </div>
                  <button className={`w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                    ${tradeAction === 'buy' ? 'bg-green-500/20 border border-green-400/30 text-green-300 hover:bg-green-500/30' : 'bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/30'}`}>
                    {tradeAction === 'buy' ? '確認買入' : '確認賣出'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 justify-center text-xs text-muted">
        <RefreshCw size={11} />
        <span>價格每日更新，參考真實市場</span>
      </div>
    </div>
  );
};

export default AdventureInvest;
