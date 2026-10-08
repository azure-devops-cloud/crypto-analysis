import { NextResponse } from "next/server";
import { analyzeCandles, Candle } from "../../../lib/market-engine";

const allowed = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
const intervals = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);

type Kline = any[];

function candles(raw: Kline[]): Candle[] {
  return raw.map((x) => ({
    time: Number(x[0]), open: Number(x[1]), high: Number(x[2]),
    low: Number(x[3]), close: Number(x[4]), volume: Number(x[5])
  }));
}

async function getJson(endpoint: string) {
  const r = await fetch(endpoint, { cache: "no-store", headers: { "User-Agent": "crypto-analysis/1.0" } });
  if (!r.ok) throw new Error(`Binance market data returned ${r.status}`);
  return r.json();
}

function clamp(n: number, min = -100, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") || "BTCUSDT";
  const interval = url.searchParams.get("interval") || "15m";
  const market = url.searchParams.get("market") || "futures";

  if (!allowed.has(symbol) || !intervals.has(interval) || !new Set(["spot", "futures"]).has(market)) {
    return NextResponse.json({ error: "Unsupported symbol, interval, or market" }, { status: 400 });
  }

  try {
    const base = market === "futures"
      ? "https://fapi.binance.com/fapi/v1/klines"
      : "https://data-api.binance.vision/api/v3/klines";

    if (market === "futures" && interval === "15m") {
      const [oneRaw, fiveRaw, fifteenRaw, premium, oi, depth, ticker] = await Promise.all([
        getJson(`${base}?symbol=${symbol}&interval=1m&limit=250`),
        getJson(`${base}?symbol=${symbol}&interval=5m&limit=250`),
        getJson(`${base}?symbol=${symbol}&interval=15m&limit=250`),
        getJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`),
        getJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`),
        getJson(`https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=50`),
        getJson(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`)
      ]);

      const one = analyzeCandles(candles(oneRaw));
      const five = analyzeCandles(candles(fiveRaw));
      const fifteen = analyzeCandles(candles(fifteenRaw));

      const bids = depth.bids.slice(0, 25).reduce((s: number, x: any[]) => s + Number(x[1]), 0);
      const asks = depth.asks.slice(0, 25).reduce((s: number, x: any[]) => s + Number(x[1]), 0);
      const imbalance = bids + asks ? (bids - asks) / (bids + asks) : 0;
      const fundingRate = Number(premium.lastFundingRate || 0);
      const markPrice = Number(premium.markPrice || ticker.lastPrice);
      const priceChange24h = Number(ticker.priceChangePercent || 0);

      const micro = clamp(
        (one.direction === "BULLISH" ? 30 : one.direction === "BEARISH" ? -30 : 0) +
        clamp(imbalance * 60) +
        (one.momentum - 50) * 0.55 +
        (one.volumeConfirmation - 50) * 0.25
      );
      const mtf = clamp(
        (five.direction === "BULLISH" ? 35 : five.direction === "BEARISH" ? -35 : 0) +
        (fifteen.direction === "BULLISH" ? 35 : fifteen.direction === "BEARISH" ? -35 : 0) +
        (five.momentum - 50) * 0.3
      );
      const funding = clamp(-fundingRate * 250000);
      const regime = clamp(priceChange24h * 3);
      const score = Math.round(clamp(micro * 0.50 + mtf * 0.35 + funding * 0.05 + regime * 0.10));
      const conflict =
        (one.direction === "BULLISH" && fifteen.direction === "BEARISH") ||
        (one.direction === "BEARISH" && fifteen.direction === "BULLISH");
      const signal = conflict && Math.abs(score) < 55 ? "WAIT" :
        score >= 65 ? "STRONG_LONG" : score >= 25 ? "LONG" :
        score <= -65 ? "STRONG_SHORT" : score <= -25 ? "SHORT" : "WAIT";
      const direction = score >= 25 ? "BULLISH" : score <= -25 ? "BEARISH" : "RANGE";
      const confidence = Math.round(Math.min(94, 50 + Math.abs(score) * 0.45));
      const volatilityPct = one.price ? one.atr / one.price * 100 : 0;
      const expectedMovePct = Math.max(0.03, Math.min(2.5, volatilityPct * Math.sqrt(15) * (0.65 + Math.abs(score) / 200)));

      return NextResponse.json({
        ok: true, market: "BINANCE_USDT_FUTURES", symbol, interval, horizon: "NEXT_15_MINUTES",
        generatedAt: Date.now(), markPrice, lastPrice: Number(ticker.lastPrice),
        priceChange24h, fundingRate, openInterest: Number(oi.openInterest || 0),
        orderBookImbalance: Number(imbalance.toFixed(4)), direction, signal, confidence, score,
        expectedMovePct: Number(expectedMovePct.toFixed(3)), conflict,
        timeframes: { "1m": one, "5m": five, "15m": fifteen },
        model: {
          type: "real-time futures ensemble",
          weights: { microstructure_1m: 50, trend_5m_15m: 35, funding: 5, regime_24h: 10 },
          inputs: ["1m/5m/15m OHLCV", "order-book imbalance", "funding rate", "open interest", "24h regime"]
        },
        disclaimer: "Confidence is a model score, not a guaranteed probability or profit forecast. Futures are high risk. Validate with out-of-sample backtests before using real money."
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const raw = await getJson(`${base}?symbol=${symbol}&interval=${interval}&limit=250`);
    const prediction = analyzeCandles(candles(raw));
    const horizonMinutes = interval === "1m" ? 15 : interval === "5m" ? 15 : interval === "15m" ? 15 : interval === "1h" ? 60 : interval === "4h" ? 240 : 1440;

    return NextResponse.json({
      symbol, interval, market, horizon: `NEXT_${horizonMinutes}_MINUTES`, generatedAt: Date.now(),
      prediction,
      disclaimer: "Confidence is a model score, not a guaranteed probability. Validate with historical out-of-sample backtests before trading."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Market data unavailable" }, { status: 502 });
  }
}
