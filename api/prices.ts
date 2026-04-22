/**
 * Vercel Serverless Function — /api/prices
 * Proxies all external price API calls server-side to bypass browser CORS restrictions.
 *
 * Confirmed-working APIs (tested 2026-04):
 *   - TWSE / TPEX: 200 OK, government open data
 *   - exchangerate-api.com: 200 OK, CORS:*, no auth
 *   - Binance public API: 200 OK, CORS:*
 *   - FMP: requires free API key (250 req/day), used for US stocks
 *   Yahoo Finance blocks Vercel DC IPs with 429 → not used as primary
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Shared types ──────────────────────────────────────────────────────────────

type AssetType = 'stock' | 'stock_tw' | 'stock_otc' | 'forex' | 'crypto';

interface AssetGroup {
  type: AssetType;
  symbols: string[];
}

type PriceMap = Record<string, { price: number; change: number }>;

interface PriceFetchError {
  assetType: AssetType | string;
  failedSource: string;
  fallbackSource: string;
  errorMessage: string;
  timestamp: string;
}

interface PriceFetchResult {
  prices: PriceMap;
  errors: PriceFetchError[];
}

// ── Helper ────────────────────────────────────────────────────────────────────

function timeout(ms: number): AbortController {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c;
}

async function withFallback(
  assetType: AssetType | string,
  primaryName: string,
  primary: () => Promise<PriceMap>,
  fallbackName: string,
  fallback: () => Promise<PriceMap>,
  errors: PriceFetchError[],
): Promise<PriceMap> {
  try {
    return await primary();
  } catch (e) {
    errors.push({
      assetType,
      failedSource: primaryName,
      fallbackSource: fallbackName,
      errorMessage: (e as Error).message,
      timestamp: new Date().toISOString(),
    });
    return await fallback();
  }
}

// ── Taiwan listed stocks (TWSE → Yahoo .TW fallback) ─────────────────────────

async function fetchTwListed(symbols: string[]): Promise<PriceMap> {
  const c = timeout(8000);
  const res = await fetch(
    'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
    { signal: c.signal },
  );
  if (!res.ok) throw new Error(`TWSE ${res.status}`);
  const data = await res.json() as Array<{
    Code: string; ClosingPrice: string; Change: string;
  }>;
  const result: PriceMap = {};
  for (const sym of symbols) {
    const row = data.find(d => d.Code === sym);
    if (row) {
      const price = parseFloat(row.ClosingPrice.replace(/,/g, '')) || 0;
      const chg   = parseFloat(row.Change.replace(/[+,\s]/g, '')) || 0;
      const prev  = price - chg;
      result[sym] = { price, change: prev > 0 ? (chg / prev) * 100 : 0 };
    }
  }
  if (Object.keys(result).length === 0) throw new Error('TWSE: no matching symbols');
  return result;
}

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://finance.yahoo.com/',
};

async function fetchYahooTw(symbols: string[]): Promise<PriceMap> {
  const syms = symbols.map(s => `${s}.TW`).join(',');
  const c = timeout(8000);
  const res = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms}`,
    { signal: c.signal, headers: YAHOO_HEADERS },
  );
  if (!res.ok) throw new Error(`Yahoo TW ${res.status}`);
  const data = await res.json();
  const result: PriceMap = {};
  for (const q of (data.quoteResponse?.result ?? [])) {
    const sym = (q.symbol as string).replace('.TW', '');
    result[sym] = {
      price: q.regularMarketPreviousClose ?? q.regularMarketPrice ?? 0,
      change: q.regularMarketChangePercent ?? 0,
    };
  }
  return result;
}

// ── Taiwan OTC stocks (TPEX → Yahoo .TWO fallback) ───────────────────────────

async function fetchTwOtc(symbols: string[]): Promise<PriceMap> {
  const c = timeout(8000);
  const res = await fetch(
    'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes',
    { signal: c.signal },
  );
  if (!res.ok) throw new Error(`TPEX ${res.status}`);
  const data = await res.json() as Array<{
    SecuritiesCompanyCode: string; Close: string; PriceChange: string;
  }>;
  const result: PriceMap = {};
  for (const sym of symbols) {
    const row = data.find(d => d.SecuritiesCompanyCode === sym);
    if (row && typeof row.Close === 'string' && typeof row.PriceChange === 'string') {
      const price = parseFloat(row.Close.replace(/,/g, '')) || 0;
      const chg   = parseFloat(row.PriceChange.replace(/[+,\s]/g, '')) || 0;
      const prev  = price - chg;
      result[sym] = { price, change: prev > 0 ? (chg / prev) * 100 : 0 };
    }
  }
  if (Object.keys(result).length === 0) throw new Error('TPEX: no matching symbols');
  return result;
}

async function fetchYahooTwOtc(symbols: string[]): Promise<PriceMap> {
  const syms = symbols.map(s => `${s}.TWO`).join(',');
  const c = timeout(8000);
  const res = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms}`,
    { signal: c.signal, headers: YAHOO_HEADERS },
  );
  if (!res.ok) throw new Error(`Yahoo TWO ${res.status}`);
  const data = await res.json();
  const result: PriceMap = {};
  for (const q of (data.quoteResponse?.result ?? [])) {
    const sym = (q.symbol as string).replace('.TWO', '');
    result[sym] = {
      price: q.regularMarketPreviousClose ?? q.regularMarketPrice ?? 0,
      change: q.regularMarketChangePercent ?? 0,
    };
  }
  return result;
}

// ── US stocks (FMP free key — 250 req/day, no fallback) ──────────────────────
// Yahoo Finance consistently returns 429 from cloud datacenter IPs.
// FMP free tier: register at financialmodelingprep.com (no credit card needed).

async function fetchUsFmp(symbols: string[], apiKey: string): Promise<PriceMap> {
  if (!apiKey) throw new Error('FMP_KEY_MISSING');
  const c = timeout(10000);
  const res = await fetch(
    `https://financialmodelingprep.com/api/v3/quote/${symbols.join(',')}?apikey=${apiKey}`,
    { signal: c.signal },
  );
  if (!res.ok) throw new Error(`FMP ${res.status}`);
  const data = await res.json() as Array<{
    symbol: string; previousClose: number; changesPercentage: number; price: number;
  }>;
  if (!Array.isArray(data) || data.length === 0) throw new Error('FMP: empty response');
  const result: PriceMap = {};
  for (const q of data) {
    result[q.symbol] = {
      price: q.previousClose ?? q.price,   // prefer yesterday's close
      change: q.changesPercentage,
    };
  }
  return result;
}

// ── Forex (exchangerate-api.com → open.er-api fallback) ──────────────────────
// symbols may be:
//   "USD"       → simple currency code: price = 1 USD in TWD
//   "USD/JPY"   → currency pair: price = 1 USD in TWD (base currency)
//   "EUR/USD"   → currency pair: price = 1 EUR in TWD (base currency)
// The "base currency" (left side) determines the TWD price.
// For gem calculation the price is always in TWD.

function parseForexBase(sym: string): string {
  return sym.includes('/') ? sym.split('/')[0] : sym;
}

async function fetchForexPrimary(currencies: string[]): Promise<PriceMap> {
  const c = timeout(8000);
  const res = await fetch('https://api.exchangerate-api.com/v4/latest/TWD', { signal: c.signal });
  if (!res.ok) throw new Error(`exchangerate-api ${res.status}`);
  const data = await res.json() as { rates: Record<string, number> };
  // rates[X] = how many X per 1 TWD  →  invert = TWD per 1 X
  const result: PriceMap = {};
  for (const sym of currencies) {
    const base = parseForexBase(sym);
    const rate = data.rates[base];
    if (rate && rate > 0) result[sym] = { price: 1 / rate, change: 0 };
  }
  if (Object.keys(result).length === 0) throw new Error('exchangerate-api: no matching currencies');
  return result;
}

async function fetchForexFallback(currencies: string[]): Promise<PriceMap> {
  const c = timeout(8000);
  const res = await fetch('https://open.er-api.com/v6/latest/TWD', { signal: c.signal });
  if (!res.ok) throw new Error(`ER-API ${res.status}`);
  const data = await res.json() as { rates: Record<string, number> };
  const result: PriceMap = {};
  for (const sym of currencies) {
    const base = parseForexBase(sym);
    const rate = data.rates[base];
    if (rate && rate > 0) result[sym] = { price: 1 / rate, change: 0 };
  }
  return result;
}

// ── Crypto (Binance → CoinGecko fallback) ────────────────────────────────────
// Binance public API: CORS:*, no auth needed.
// Symbols may be:
//   "BTC", "ETH"       → common ticker, directly appended with "USDT" → "BTCUSDT"
//   "bitcoin","ethereum" → CoinGecko ID format, mapped via COINGECKO_TO_TICKER

const COINGECKO_TO_TICKER: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', binancecoin: 'BNB',
  solana: 'SOL', ripple: 'XRP', cardano: 'ADA',
  dogecoin: 'DOGE', polkadot: 'DOT', 'shiba-inu': 'SHIB',
  'usd-coin': 'USDC', tether: 'USDT', avalanche: 'AVAX',
  chainlink: 'LINK', stellar: 'XLM', litecoin: 'LTC',
};

function toBinancePair(symbol: string): string | null {
  // Convert CoinGecko ID to ticker if needed
  const ticker = COINGECKO_TO_TICKER[symbol] ?? symbol.toUpperCase();
  // Skip stable coins that don't have USDT pairs
  if (ticker === 'USDT') return null;
  return `${ticker}USDT`;
}

async function fetchCryptoBinance(coinIds: string[]): Promise<PriceMap> {
  // Get USD→TWD rate first
  const fxc = timeout(5000);
  const fxRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: fxc.signal });
  if (!fxRes.ok) throw new Error(`FX for crypto: ${fxRes.status}`);
  const fxData = await fxRes.json() as { rates: Record<string, number> };
  const usdToTwd = fxData.rates['TWD'] ?? 30;

  const result: PriceMap = {};
  for (const id of coinIds) {
    const pair = toBinancePair(id);
    if (!pair) continue;
    try {
      const bc = timeout(5000);
      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`,
        { signal: bc.signal },
      );
      if (!res.ok) continue;
      const d = await res.json() as { lastPrice: string; priceChangePercent: string };
      result[id] = {                        // key = original symbol (e.g. "BTC" or "bitcoin")
        price: parseFloat(d.lastPrice) * usdToTwd,
        change: parseFloat(d.priceChangePercent),
      };
    } catch { /* skip individual symbol failures */ }
  }
  if (Object.keys(result).length === 0) throw new Error('Binance: could not fetch any symbols');
  return result;
}

async function fetchCryptoCoinGecko(coinIds: string[]): Promise<PriceMap> {
  // CoinGecko requires IDs in its own format; map tickers back to CoinGecko IDs if needed
  const TICKER_TO_COINGECKO: Record<string, string> = Object.fromEntries(
    Object.entries(COINGECKO_TO_TICKER).map(([cg, tk]) => [tk, cg])
  );
  const cgIds = coinIds.map(id => TICKER_TO_COINGECKO[id.toUpperCase()] ?? id);
  const c = timeout(8000);
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(',')}&vs_currencies=twd&include_24hr_change=true`,
    { signal: c.signal },
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json() as Record<string, { twd: number; twd_24h_change?: number }>;
  const result: PriceMap = {};
  // Map results back to original symbol keys
  for (let i = 0; i < coinIds.length; i++) {
    const v = data[cgIds[i]];
    if (v) result[coinIds[i]] = { price: v.twd, change: v.twd_24h_change ?? 0 };
  }
  if (Object.keys(result).length === 0) throw new Error('CoinGecko: empty response');
  return result;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body: { groups?: AssetGroup[]; fmpApiKey?: string };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { groups = [], fmpApiKey = '' } = body;
  const errors: PriceFetchError[] = [];
  const allPrices: PriceMap = {};

  const twListed  = groups.find(g => g.type === 'stock_tw')?.symbols  ?? [];
  const twOtc     = groups.find(g => g.type === 'stock_otc')?.symbols ?? [];
  const usStocks  = groups.find(g => g.type === 'stock')?.symbols     ?? [];
  const forexSyms = groups.find(g => g.type === 'forex')?.symbols     ?? [];
  const cryptoIds = groups.find(g => g.type === 'crypto')?.symbols    ?? [];

  const tasks: Promise<PriceMap>[] = [];

  if (twListed.length > 0)
    tasks.push(withFallback('stock_tw',  'TWSE OpenAPI',        () => fetchTwListed(twListed),      'Yahoo Finance .TW',  () => fetchYahooTw(twListed),     errors));
  if (twOtc.length > 0)
    tasks.push(withFallback('stock_otc', 'TPEX OpenAPI',        () => fetchTwOtc(twOtc),            'Yahoo Finance .TWO', () => fetchYahooTwOtc(twOtc),     errors));
  if (usStocks.length > 0) {
    // US stocks: FMP only (Yahoo blocks Vercel DC IPs with 429)
    // If no API key → skip gracefully so other types still succeed
    if (fmpApiKey) {
      tasks.push(fetchUsFmp(usStocks, fmpApiKey).catch(e => {
        errors.push({ assetType: 'stock', failedSource: 'FMP', fallbackSource: '—', errorMessage: (e as Error).message, timestamp: new Date().toISOString() });
        return {};
      }));
    } else {
      errors.push({ assetType: 'stock', failedSource: '—', fallbackSource: '—', errorMessage: 'FMP_KEY_MISSING', timestamp: new Date().toISOString() });
    }
  }
  if (forexSyms.length > 0)
    tasks.push(withFallback('forex',   'exchangerate-api.com', () => fetchForexPrimary(forexSyms), 'open.er-api',        () => fetchForexFallback(forexSyms), errors));
  if (cryptoIds.length > 0)
    tasks.push(withFallback('crypto',  'Binance',              () => fetchCryptoBinance(cryptoIds), 'CoinGecko',          () => fetchCryptoCoinGecko(cryptoIds), errors));

  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === 'fulfilled') Object.assign(allPrices, r.value);
  }

  return res.status(200).json({ prices: allPrices, errors } as PriceFetchResult);
}
