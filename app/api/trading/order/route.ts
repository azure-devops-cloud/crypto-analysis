import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";

export const runtime = "nodejs";

type OrderRequest = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity?: number;
  quoteOrderQty?: number;
  mode?: "PAPER" | "LIVE";
};

function sign(query: string, secret: string) {
  return createHmac("sha256", secret).update(query).digest("hex");
}

export async function POST(request: Request) {
  const body = (await request.json()) as OrderRequest;
  const symbol = String(body.symbol || "").toUpperCase();
  const side = body.side;
  const mode = body.mode || "PAPER";

  if (!/^[A-Z0-9]{5,20}$/.test(symbol) || !["BUY","SELL"].includes(side)) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }

  if (mode === "PAPER") {
    const quote = await fetch(
      `${new URL(request.url).origin}/api/trading/quote?symbol=${symbol}`,
      { cache: "no-store" }
    );
    if (!quote.ok) return NextResponse.json({ error: "Quote unavailable" }, { status: 502 });
    const q = await quote.json();
    const price = Number(q.price);
    const quantity = Number(body.quantity || 0);
    const quoteOrderQty = Number(body.quoteOrderQty || 0);
    const filledQty = quantity > 0 ? quantity : quoteOrderQty > 0 ? quoteOrderQty / price : 0;

    if (!(filledQty > 0)) {
      return NextResponse.json({ error: "quantity or quoteOrderQty is required" }, { status: 400 });
    }

    return NextResponse.json({
      mode: "PAPER",
      status: "FILLED",
      symbol,
      side,
      price,
      executedQty: filledQty,
      quoteQty: filledQty * price,
      timestamp: Date.now(),
    });
  }

  if (process.env.TRADING_LIVE_ENABLED !== "true") {
    return NextResponse.json(
      { error: "LIVE trading is locked. Set TRADING_LIVE_ENABLED=true only after completing paper-trading validation." },
      { status: 403 }
    );
  }

  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "Binance server credentials are not configured" }, { status: 500 });
  }

  const params = new URLSearchParams({
    symbol,
    side,
    type: "MARKET",
    timestamp: String(Date.now()),
    recvWindow: "5000",
  });

  if (side === "BUY") {
    if (!(Number(body.quoteOrderQty) > 0)) {
      return NextResponse.json({ error: "BUY requires quoteOrderQty" }, { status: 400 });
    }
    params.set("quoteOrderQty", String(body.quoteOrderQty));
  } else {
    if (!(Number(body.quantity) > 0)) {
      return NextResponse.json({ error: "SELL requires quantity" }, { status: 400 });
    }
    params.set("quantity", String(body.quantity));
  }

  const query = params.toString();
  const response = await fetch("https://api.binance.com/api/v3/order?" + query + "&signature=" + sign(query, apiSecret), {
    method: "POST",
    headers: { "X-MBX-APIKEY": apiKey },
    cache: "no-store",
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
