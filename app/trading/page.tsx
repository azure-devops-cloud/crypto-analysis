"use client";

import { useEffect, useState } from "react";

type Quote = { symbol: string; price: number; change24h: number; volume: number };
const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

export default function TradingPage() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [selected, setSelected] = useState("BTCUSDT");
  const [amount, setAmount] = useState("25");
  const [side, setSide] = useState<"BUY"|"SELL">("BUY");
  const [status, setStatus] = useState("Paper trading is active by default.");

  async function load() {
    const rows = await Promise.all(symbols.map(async symbol => {
      const r = await fetch(`/api/trading/quote?symbol=${symbol}`, { cache: "no-store" });
      return r.ok ? [symbol, await r.json()] as const : null;
    }));
    setQuotes(Object.fromEntries(rows.filter(Boolean) as [string, Quote][]));
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  async function execute() {
    setStatus("Submitting paper order...");
    const r = await fetch("/api/trading/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: selected, side, quoteOrderQty: Number(amount), mode: "PAPER" }),
    });
    const data = await r.json();
    setStatus(r.ok ? `PAPER FILLED: ${data.executedQty} ${selected.replace("USDT","")} @ ${Number(data.price).toFixed(2)}` : data.error || "Order failed");
  }

  const q = quotes[selected];

  return (
    <main className="container">
      <section className="hero">
        <div>
          <p className="eyebrow">REAL-TIME EXECUTION ENGINE</p>
          <h1>Trading Engine</h1>
          <p className="muted">Live Binance market data, risk-aware execution, and paper trading. Live orders remain explicitly locked.</p>
        </div>
        <a className="button" href="/">Dashboard</a>
      </section>

      <div className="grid">
        {symbols.map(symbol => {
          const item = quotes[symbol];
          return <article className="card" key={symbol}>
            <div className="cardHead"><strong>{symbol.replace("USDT","/USDT")}</strong><span>{item ? `${item.change24h.toFixed(2)}%` : "…"}</span></div>
            <div className="price">{item ? item.price.toLocaleString(undefined,{maximumFractionDigits:4}) : "Loading"}</div>
            <div className="muted">24h volume: {item ? item.volume.toLocaleString(undefined,{maximumFractionDigits:0}) : "…"}</div>
          </article>;
        })}
      </div>

      <section className="card" style={{marginTop:16}}>
        <h2>Execution Console</h2>
        <div className="controls">
          <select value={selected} onChange={e=>setSelected(e.target.value)}>{symbols.map(s=><option key={s}>{s}</option>)}</select>
          <select value={side} onChange={e=>setSide(e.target.value as "BUY"|"SELL")}><option>BUY</option><option>SELL</option></select>
          <input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="USDT amount" />
          <button className="button" onClick={execute}>Paper Execute</button>
        </div>
        <p className="muted">{status}</p>
        <div className="notice">
          <strong>Safety lock:</strong> the live Binance order path exists but cannot execute while <code>TRADING_LIVE_ENABLED</code> is not exactly <code>true</code>. Never put Binance secrets in browser code.
        </div>
      </section>
    </main>
  );
}
