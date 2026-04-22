/**
 * Price Service — calls the /api/prices Vercel serverless function.
 * All external API fetching happens server-side to bypass browser CORS restrictions
 * and Yahoo Finance rate-limiting.
 */

import type { AssetType, PriceFetchError } from '../types/adventure';

export type PriceMap = Record<string, { price: number; change: number }>;

export interface PriceFetchResult {
  prices: PriceMap;
  errors: PriceFetchError[];
}

export interface AssetGroup {
  type: AssetType;
  symbols: string[];
}

/**
 * Fetch prices for all asset groups via the Vercel serverless proxy (/api/prices).
 * The proxy handles CORS, User-Agent spoofing, and primary→fallback switching.
 */
export async function fetchAllPrices(
  groups: AssetGroup[],
  fmpApiKey = '',
): Promise<PriceFetchResult> {
  const res = await fetch('/api/prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groups, fmpApiKey }),
    signal: AbortSignal.timeout(30000), // 30s total (all fetches run in parallel server-side)
  });

  if (!res.ok) {
    throw new Error(`/api/prices returned ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<PriceFetchResult>;
}

/** Returns true if prices are stale (older than 24h or missing) */
export function isPriceStale(lastUpdated: string | null | undefined): boolean {
  if (!lastUpdated) return true;
  return Date.now() - new Date(lastUpdated).getTime() > 24 * 60 * 60 * 1000;
}
