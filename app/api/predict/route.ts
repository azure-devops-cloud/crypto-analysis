import { NextResponse } from "next/server";
import { analyzeCandles, Candle } from "../../../lib/market-engine";

const allowed = new Set(["BTCUSDT","ETHUSDT","SOLUSDT"]);
const intervals = new Set(["1m","5m","15m","1h","4h","1d"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") || "BTCUSDT";
  const interval = url.searchParams.get("interval") || "15m";
  const market = url.searchParams.get("market") || "futures";
  if (!allowed.has(symbol) || !intervals.has(interval) || !new Set(["spot","futures"]).has(market)) {
    return NextResponse.json({ error: "Unsupported symbol or interval" }, { status: 400 });
  }
  const endpoint = market === "futures"
    ? `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=250`
    : `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=250`;
  const r = await fetch(endpoint, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: "Market data unavailable" }, { status: 502 });
  const raw = await r.json();
  const candles: Candle[] = raw.map((x: any[]) => ({
    time: Number(x[0]), open: Number(x[1]), high: Number(x[2]),
    low: Number(x[3]), close: Number(x[4]), volume: Number(x[5])
  }));
  const prediction = analyzeCandles(candles);
  const horizonMinutes = interval === "1m" ? 15 : interval === "5m" ? 15 : interval === "15m" ? 15 : interval === "1h" ? 60 : interval === "4h" ? 240 : 1440;
  return NextResponse.json({
    symbol, interval, market, horizon: `NEXT_${horizonMinutes}_MINUTES`, generatedAt: Date.now(),
    prediction,
    disclaimer: "Confidence is a model score, not a guaranteed probability. Futures forecasts are short-horizon model scores, not guaranteed probabilities or profit forecasts. Validate with out-of-sample backtests before trading."
  });
}
