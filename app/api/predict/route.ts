import { NextResponse } from "next/server";
import { analyzeCandles, Candle } from "@/lib/market-engine";

const allowed = new Set(["BTCUSDT","ETHUSDT","SOLUSDT"]);
const intervals = new Set(["15m","1h","4h","1d"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") || "BTCUSDT";
  const interval = url.searchParams.get("interval") || "1h";
  if (!allowed.has(symbol) || !intervals.has(interval)) {
    return NextResponse.json({ error: "Unsupported symbol or interval" }, { status: 400 });
  }
  const r = await fetch(
    `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=250`,
    { next: { revalidate: 30 } }
  );
  if (!r.ok) return NextResponse.json({ error: "Market data unavailable" }, { status: 502 });
  const raw = await r.json();
  const candles: Candle[] = raw.map((x: any[]) => ({
    time: Number(x[0]), open: Number(x[1]), high: Number(x[2]),
    low: Number(x[3]), close: Number(x[4]), volume: Number(x[5])
  }));
  const prediction = analyzeCandles(candles);
  return NextResponse.json({
    symbol, interval, generatedAt: Date.now(),
    prediction,
    disclaimer: "Confidence is a model score, not a guaranteed probability. Validate with historical out-of-sample backtests before trading."
  });
}
