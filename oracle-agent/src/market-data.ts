/**
 * Real market data snapshot from the public CoinGecko API (no key required).
 * This is the verifiable "world data" input the oracle's LLM reasons over.
 */

export interface MarketSnapshot {
  asset: string; // CoinGecko id, e.g. "casper-network"
  symbol: string;
  vsCurrency: string;
  price: number;
  change24hPct: number;
  change7dPct: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  timestampMs: number;
}

const COINGECKO = "https://api.coingecko.com/api/v3";

/** Fetch a current market snapshot for an asset. Throws on network/data error. */
export async function fetchMarketSnapshot(
  assetId: string,
  vsCurrency: string
): Promise<MarketSnapshot> {
  const url =
    `${COINGECKO}/coins/${encodeURIComponent(assetId)}` +
    `?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`CoinGecko ${res.status} for ${assetId}: ${await res.text()}`);
  }
  const j = (await res.json()) as any;
  const md = j.market_data;
  if (!md) throw new Error(`No market_data in CoinGecko response for ${assetId}`);

  const pick = (obj: any): number => Number(obj?.[vsCurrency] ?? 0);
  return {
    asset: assetId,
    symbol: String(j.symbol ?? assetId).toUpperCase(),
    vsCurrency,
    price: pick(md.current_price),
    change24hPct: Number(md.price_change_percentage_24h ?? 0),
    change7dPct: Number(md.price_change_percentage_7d ?? 0),
    volume24h: pick(md.total_volume),
    marketCap: pick(md.market_cap),
    high24h: pick(md.high_24h),
    low24h: pick(md.low_24h),
    timestampMs: Date.now(),
  };
}
