"use client";
import { useEffect, useState } from "react";

const coins = ["BTCUSDT","ETHUSDT","SOLUSDT"];

type Row = { symbol:string; data:any };

export default function Predictor() {
  const [rows,setRows] = useState<Row[]>([]);
  const [prices,setPrices] = useState<Record<string,number>>({});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [updated,setUpdated] = useState<number>(0);

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await Promise.all(coins.map(async symbol => {
        const r = await fetch(`/api/predict?symbol=${symbol}&interval=15m&market=futures&t=${Date.now()}`, { cache:"no-store" });
        if (!r.ok) throw new Error("Live Futures prediction API unavailable");
        return { symbol, data: await r.json() };
      }));
      setRows(data);
      setUpdated(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load live futures predictions");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const streams = coins.map(x => `${x.toLowerCase()}@markPrice@1s`).join("/");
    const ws = new WebSocket(`wss://fstream.binance.com/market/stream?streams=${streams}`);
    ws.onmessage = event => {
      try {
        const m = JSON.parse(event.data)?.data;
        if (m?.s && m?.p) setPrices(prev => ({...prev, [m.s]: Number(m.p)}));
      } catch {}
    };
    return () => ws.close();
  }, []);

  return <main>
    <header>
      <div>
        <div className="eyebrow">LIVE BINANCE USDⓈ-M FUTURES · 15-MINUTE FORECAST</div>
        <h1>BTC · ETH · SOL <span>Futures AI Engine</span></h1>
        <p>Live mark price + 1m microstructure + 5m/15m trend + order-book imbalance + funding + open interest</p>
      </div>
      <div className="controls"><button onClick={load}>↻ Refresh</button></div>
    </header>

    <div className="summary">
      <div><span>Market</span><b>USDⓈ-M Futures</b></div>
      <div><span>Forecast horizon</span><b>Next 15 minutes</b></div>
      <div><span>Prediction refresh</span><b>Every 30 seconds</b></div>
      <div><span>Live price stream</span><b className="good">WebSocket · 1s</b></div>
    </div>

    {error && <div className="error">{error}</div>}
    {loading && !rows.length ? <div className="loading">Loading live Futures market data and calculating the 15-minute ensemble…</div> :
      <div className="cards">{rows.map(({symbol,data}) => {
        const live = prices[symbol] ?? data.markPrice;
        const t = data.timeframes;
        return <section className="card" key={symbol}>
          <div className="cardhead">
            <div><b>{symbol.replace("USDT","/USDT")}</b><span>PERPETUAL · LIVE</span></div>
            <b className={data.direction.toLowerCase()}>{data.direction}</b>
          </div>
          <div className="price">{live.toLocaleString(undefined,{maximumFractionDigits:4})}</div>
          <div className="signalrow">
            <strong>{String(data.signal).replaceAll("_"," ")}</strong>
            <span>Model score {data.score} · confidence {data.confidence}%</span>
          </div>
          <div className="bar"><i style={{width:data.confidence+"%"}} /></div>
          <div className="grid">
            <div className="metric"><span>1m direction</span><b>{t["1m"].direction}</b></div>
            <div className="metric"><span>5m direction</span><b>{t["5m"].direction}</b></div>
            <div className="metric"><span>15m direction</span><b>{t["15m"].direction}</b></div>
            <div className="metric"><span>Order book imbalance</span><b>{data.orderBookImbalance}</b></div>
            <div className="metric"><span>Funding rate</span><b>{(data.fundingRate*100).toFixed(4)}%</b></div>
            <div className="metric"><span>Open interest</span><b>{Number(data.openInterest).toLocaleString()}</b></div>
            <div className="metric"><span>Expected move estimate</span><b>±{data.expectedMovePct}%</b></div>
            <div className="metric"><span>24h change</span><b>{data.priceChange24h.toFixed(2)}%</b></div>
            <div className="metric"><span>1m RSI</span><b>{t["1m"].rsi.toFixed(1)}</b></div>
            <div className="metric"><span>1m ADX</span><b>{t["1m"].adx.toFixed(1)}</b></div>
            <div className="metric"><span>1m volume ratio</span><b>{t["1m"].volumeRatio.toFixed(2)}×</b></div>
            <div className="metric"><span>Signal conflict</span><b>{data.conflict ? "YES · WAIT RISK" : "NO"}</b></div>
          </div>
          <div className="confluence"><b>Engine:</b> 50% 1m microstructure · 35% 5m/15m trend · 5% funding · 10% 24h regime.</div>
          <small>Updated {updated ? new Date(updated).toLocaleTimeString() : "—"} · Confidence is not a guaranteed win probability. Do not treat this as financial advice.</small>
        </section>;
      })}</div>}

    <footer>Live Futures data · analysis only · live execution remains disabled</footer>
  </main>;
}
