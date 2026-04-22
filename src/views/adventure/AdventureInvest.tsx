import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Gem, AlertCircle, RefreshCw } from 'lucide-react';
import { useStore } from '../../store/index';
import type { AssetType, ManagedAsset } from '../../types/adventure';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DisplayAsset {
  id: string;
  name: string;
  type: AssetType;
  symbol: string;
  emoji: string;
  baseFeeRate: number;
  discountTiers: { minSavings: number; discountPct: number }[];
}

const TYPE_LABELS: Record<string, string> = {
  stock:     '📈 美股',
  stock_tw:  '🇹🇼 台股（上市）',
  stock_otc: '🇹🇼 台股（上櫃）',
  forex:     '💱 外匯',
  crypto:    '🪙 加密貨幣',
};

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  primary:  { label: '主要來源', color: 'text-green-400 bg-green-400/10' },
  fallback: { label: '備援來源', color: 'text-amber-400 bg-amber-400/10' },
};

function calcFee(asset: DisplayAsset, savings: number): number {
  let discount = 0;
  for (const tier of asset.discountTiers) {
    if (savings >= tier.minSavings) discount = tier.discountPct;
  }
  return parseFloat((asset.baseFeeRate * (1 - discount / 100)).toFixed(2));
}

function formatGems(gems: number): string {
  if (gems >= 10000) return `${(gems / 10000).toFixed(1)}萬`;
  return gems.toLocaleString();
}

// ── Main component ────────────────────────────────────────────────────────────
const AdventureInvest: React.FC = () => {
  const {
    adventurePrices, priceErrors, isFetchingPrices, priceFetchedAt,
    fetchAssetPrices, forceRefreshPrices, getAdventureConfigDoc,
    envelopes, currentUser, gemRates, systemAdminRole,
  } = useStore();

  const [activeType, setActiveType] = useState<AssetType | 'all'>('all');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');
  const [tradeQty, setTradeQty] = useState('1');
  const [assets, setAssets] = useState<DisplayAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  // Savings balance (investing envelopes)
  const savings = currentUser
    ? envelopes.filter(e => e.ownerId === currentUser.id && e.type === 'investing')
        .reduce((s, e) => s + e.balance, 0)
    : 0;

  // Load asset catalogue from Firestore
  useEffect(() => {
    setLoadingAssets(true);
    getAdventureConfigDoc('assets').then(docData => {
      if (docData?.items) {
        const managedAssets = docData.items as ManagedAsset[];
        setAssets(managedAssets as unknown as DisplayAsset[]);

        // Auto-invalidate stale cache if errors reference APIs we no longer use as primary.
        // This lets existing deployments pick up the new code without manual "force refresh".
        const STALE_PRIMARIES = new Set([
          'Yahoo Finance',     // used to be US stock primary
          'CoinGecko',         // used to be crypto primary
          'open.er-api',       // used to be forex primary
          'TWSE_Deprecated',   // placeholder for future deprecations
        ]);
        const hasStale = priceErrors.some(e => STALE_PRIMARIES.has(e.failedSource));
        if (hasStale && ((currentUser?.role === 'primary_admin' || currentUser?.role === 'co_admin') || systemAdminRole)) {
          forceRefreshPrices();
        } else {
          fetchAssetPrices(managedAssets);
        }
      }
      setLoadingAssets(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when cache is cleared (forceRefreshPrices sets priceFetchedAt to null)
  useEffect(() => {
    if (priceFetchedAt !== null || assets.length === 0) return;
    fetchAssetPrices(assets as unknown as ManagedAsset[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceFetchedAt]);

  const allTypes = [...new Set(assets.map(a => a.type))] as AssetType[];
  const filtered = activeType === 'all' ? assets : assets.filter(a => a.type === activeType);

  const priceFetchedDate = priceFetchedAt ? new Date(priceFetchedAt).toLocaleString('zh-TW') : null;

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

      {/* Price source info */}
      <div className="flex items-center justify-between text-[10px] text-muted bg-white/5 rounded-xl px-3 py-2">
        <span>{priceFetchedDate ? `📅 價格更新：${priceFetchedDate}` : '📅 尚未取得報價'}</span>
        <div className="flex items-center gap-2">
          {priceErrors.filter(e => e.errorMessage !== 'FMP_KEY_MISSING').length > 0 && (
            <span className="text-amber-400 font-bold">⚠️ {priceErrors.filter(e => e.errorMessage !== 'FMP_KEY_MISSING').length} 項使用備援</span>
          )}
          {priceErrors.some(e => e.errorMessage === 'FMP_KEY_MISSING') && (
            <span className="text-red-400 font-bold">🔑 美股需設定 Key</span>
          )}
          {isFetchingPrices
            ? <span className="flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> 更新中...</span>
            : ((currentUser?.role === 'primary_admin' || currentUser?.role === 'co_admin') || systemAdminRole) && (
              <button
                onClick={async () => { await forceRefreshPrices(); }}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold"
                title="清除快取，強制重新取得報價"
              >
                <RefreshCw size={10} /> 強制刷新
              </button>
            )
          }
        </div>
      </div>

      {/* Fallback warnings & missing API key notice */}
      {priceErrors.length > 0 && (
        <div className="flex flex-col gap-1">
          {priceErrors.map((err, i) => {
            const isMissingKey = err.errorMessage === 'FMP_KEY_MISSING';
            return (
              <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] ${isMissingKey ? 'bg-red-500/10 border border-red-400/20 text-red-300' : 'bg-amber-500/10 border border-amber-400/20 text-amber-300'}`}>
                <span>{isMissingKey ? '🔑' : '⚠️'}</span>
                {isMissingKey ? (
                  <span><strong>{TYPE_LABELS[err.assetType] ?? err.assetType}</strong>：尚未設定 FMP API Key，請至超級管理員面板新增（免費申請：financialmodelingprep.com）</span>
                ) : (
                  <span><strong>{TYPE_LABELS[err.assetType] ?? err.assetType}</strong>：{err.failedSource} 失效，改用 {err.fallbackSource}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* GemRates info */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: '台股', rate: gemRates.stockTw, unit: 'TWD' },
          { label: '美股', rate: gemRates.stockUs, unit: 'USD' },
          { label: '加密幣', rate: gemRates.crypto, unit: 'TWD' },
        ].map(r => (
          <div key={r.label} className="bg-white/5 rounded-xl p-2">
            <div className="text-[10px] text-muted">{r.label}</div>
            <div className="text-xs font-black text-amber-400 flex items-center justify-center gap-0.5">
              <Gem size={10} />1 = {r.rate} {r.unit}
            </div>
          </div>
        ))}
      </div>

      {/* Asset type filter */}
      {allTypes.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setActiveType('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activeType === 'all' ? 'bg-primary text-white' : 'bg-white/5 text-muted'}`}>
            全部
          </button>
          {allTypes.map(t => (
            <button key={t} onClick={() => setActiveType(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activeType === t ? 'bg-primary text-white' : 'bg-white/5 text-muted'}`}>
              {TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      )}

      {/* Asset list */}
      {loadingAssets ? (
        <div className="text-center py-8 text-muted text-sm">載入資產中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted text-sm">尚無資產，請家長在管理員面板新增</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(asset => {
            const p = adventurePrices[asset.symbol];
            const isSelected = selectedAsset === asset.symbol;
            const fee = calcFee(asset, savings);
            const srcBadge = p ? (SOURCE_BADGE[p.source] ?? SOURCE_BADGE.primary) : null;

            return (
              <div key={asset.id}
                onClick={() => setSelectedAsset(isSelected ? null : asset.id)}
                className={`rounded-2xl border p-4 cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{asset.emoji}</span>
                    <div>
                      <div className="font-black text-sm">{asset.name}</div>
                      <div className="text-[10px] text-muted">{asset.symbol} · {TYPE_LABELS[asset.type] ?? asset.type}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {p ? (
                      <>
                        <div className="font-black text-sm flex items-center gap-1 justify-end">
                          <Gem size={12} className="text-amber-400" />
                          {formatGems(p.priceGems)} 寶石
                        </div>
                        <div className={`text-xs font-bold flex items-center gap-0.5 justify-end ${p.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {p.change >= 0 ? '+' : ''}{p.change.toFixed(2)}%
                        </div>
                        {srcBadge && (
                          <div className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold mt-0.5 ${srcBadge.color}`}>{srcBadge.label}</div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-muted">
                        {isFetchingPrices ? '載入中...' : asset.type === 'stock' ? '需設定 API Key' : '價格不可用'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded trade panel */}
                {isSelected && p && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-3">
                    <div className="text-xs text-muted">
                      真實市價：NT${p.price.toLocaleString()} · 手續費：{fee}%
                    </div>
                    <div className="flex gap-2">
                      {(['buy','sell'] as const).map(act => (
                        <button key={act} onClick={e => { e.stopPropagation(); setTradeAction(act); }}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tradeAction === act ? (act === 'buy' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-white/5 text-muted'}`}>
                          {act === 'buy' ? '買入' : '賣出'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min="1" value={tradeQty} onChange={e => setTradeQty(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="input-field w-20 text-center text-sm py-2" />
                      <span className="text-xs text-muted">單位</span>
                      <div className="ml-auto text-right">
                        <div className="text-sm font-black">
                          共 {formatGems(Math.round(p.priceGems * Number(tradeQty || 1)))} 寶石
                        </div>
                        <div className="text-[10px] text-muted">
                          手續費 {formatGems(Math.round(p.priceGems * Number(tradeQty || 1) * fee / 100))} 寶石
                        </div>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); alert('投資交易功能開發中！'); }}
                      className={`w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 ${tradeAction === 'buy' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                      {tradeAction === 'buy' ? '確認買入' : '確認賣出'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdventureInvest;
