"use client";
import { useEffect, useState } from "react";

const coins = ["BTCUSDT","ETHUSDT","SOLUSDT"];
const intervals = ["15m","1h","4h","1d"];

type Row = { symbol:string; interval:string; prediction:any };

export default function Predictor() {
  const [interval,setInterval] = useState("1h");
  const [rows,setRows] = useState<Row[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await Promise.all(coins.map(async symbol => {
        const r = await fetch(`/api/predict?symbol=${symbol}&interval=${interval}`);
        if (!r.ok) throw new Error("Prediction API unavailable");
        return r.json();
      }));
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load predictions");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [interval]);

  return <main>
    <header>
      <div>
        <div className="eyebrow">MODEL-BASED TREND PREDICTION</div>
        <h1>BTC · ETH · SOL <span>Trend Engine</span></h1>
        <p>EMA regime + EMA200 + MACD + RSI + ADX + volume + market structure + BOS</p>
      </div>
      <div className="controls">
        {intervals.map(x => <button key={x} className={interval===x?"active":""} onClick={()=>setInterval(x)}>{x.toUpperCase()}</button>)}
        <button onClick={load}>↻ Refresh</button>
      </div>
    </header>

    {error && <div className="error">{error}</div>}
    {loading && !rows.length ? <div className="loading">Calculating trend model…</div> :
      <div className="cards">{rows.map(row => {
        const p = row.prediction;
        return <section className="card" key={row.symbol}>
          <div className="cardhead">
            <div><b>{row.symbol.replace("USDT","/USDT")}</b><span>{row.interval.toUpperCase()} · next 1–3 candles</span></div>
            <b className={p.direction.toLowerCase()}>{p.direction}</b>
          </div>
          <div className="signalrow">
            <strong>{p.signal.replace("_"," ")}</strong>
            <span>Confidence {p.confidence}%</span>
          </div>
          <div className="bar"><i style={{width:p.confidence+"%"}} /></div>
          <div className="grid">
            <div className="metric"><span>Trend strength</span><b>{p.trendStrength}/100</b></div>
            <div className="metric"><span>Momentum</span><b>{p.momentum}/100</b></div>
            <div className="metric"><span>ADX</span><b>{p.adx.toFixed(1)}</b></div>
            <div className="metric"><span>RSI</span><b>{p.rsi.toFixed(1)}</b></div>
            <div className="metric"><span>EMA 20 / 50</span><b>{p.ema20.toFixed(2)} / {p.ema50.toFixed(2)}</b></div>
            <div className="metric"><span>EMA 200</span><b>{p.ema200.toFixed(2)}</b></div>
            <div className="metric"><span>Structure</span><b>{p.structure}</b></div>
            <div className="metric"><span>BOS</span><b>{p.bos}</b></div>
            <div className="metric"><span>Volume ratio</span><b>{p.volumeRatio.toFixed(2)}×</b></div>
            <div className="metric"><span>Support</span><b>{p.support.toFixed(2)}</b></div>
            <div className="metric"><span>Resistance</span><b>{p.resistance.toFixed(2)}</b></div>
          </div>
          <div className="confluence"><b>Why:</b> {p.reasons.slice(0,5).join(" · ")}</div>
          <small>Model confidence is not a guaranteed win probability. Backtest before trading.</small>
        </section>;
      })}</div>}
    <footer>Trend engine · public Binance market data · analysis only · live execution disabled</footer>
  </main>;
}
