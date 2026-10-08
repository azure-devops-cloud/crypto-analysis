import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();

  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const response = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Market data unavailable" }, { status: 502 });
  }

  const data = await response.json();
  return NextResponse.json({
    symbol,
    price: Number(data.lastPrice),
    change24h: Number(data.priceChangePercent),
    volume: Number(data.volume),
    timestamp: Date.now(),
  });
}
