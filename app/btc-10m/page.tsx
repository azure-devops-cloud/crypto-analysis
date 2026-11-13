"use client";
import {useCallback,useEffect,useState} from "react";
import HistoryPanel from "./HistoryPanel";

type Forecast={ok:boolean;symbol:string;horizonMinutes:number;generatedAt:string;expiresAt:string;price:number;direction:"UP"|"DOWN"|"NO_CLEAR_SIGNAL";score:number;confidenceBand:string;probability:number|null;probabilityNote:string;dataQuality:string;conflict:boolean;components:Record<string,number>;indicators:Record<string,number>;candles:{time:number;open:number;high:number;low:number;close:number;volume:number}[];error?:string;disclaimer:string};
const money=(n:number)=>n.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2});
export default function BtcTenMinute(){
 const [data,setData]=useState<Forecast|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[now,setNow]=useState(Date.now());
 const load=useCallback(async()=>{try{const r=await fetch("/api/btc-10m",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Market data unavailable");setData(d);setError("");}catch(e){setError(e instanceof Error?e.message:"Unable to load forecast");}finally{setLoading(false);}},[]);
 useEffect(()=>{load();const a=setInterval(load,60000),b=setInterval(()=>setNow(Date.now()),1000);return()=>{clearInterval(a);clearInterval(b)};},[load]);
 const remaining=data?Math.max(0,Math.ceil((new Date(data.expiresAt).getTime()-now)/1000)):0;
 const i=data?.indicators;
 return <main className="btc10">
 <header><div><div className="eyebrow">EXPERIMENTAL · BINANCE USDⓈ-M</div><h1>BTC <span>10-Minute Forecast</span></h1><p>Explainable baseline · live market inputs · no trade execution</p></div><button onClick={load}>↻ Refresh</button></header>
 {error&&<div className="error">{error}</div>}
 {loading&&!data?<div className="loading">Loading Binance market data…</div>:data&&<>
 <section className="btc10hero">
 <div><span>BTCUSDT mark / last price</span><div className="btc10price">{money(data.price)}</div><small>Updated {new Date(data.generatedAt).toLocaleTimeString()}</small></div>
 <div className={"btc10signal "+(data.direction==="UP"?"bull":data.direction==="DOWN"?"bear":"neutral")}><span>10-minute direction</span><strong>{data.direction==="NO_CLEAR_SIGNAL"?"NO CLEAR SIGNAL":data.direction}</strong><small>Score {data.score>0?"+":""}{data.score} / 100</small></div>
 </section>
 <section className="btc10grid">
 {Object.entries({RSI:i?.rsi14, "1m EMA 9":i?.ema9,"1m EMA 21":i?.ema21,"5m EMA fast":i?.ema5mFast,"5m EMA slow":i?.ema5mSlow,"Order book imbalance":i?.orderBookImbalance,"Funding rate":i?.fundingRate,"Open interest":i?.openInterest,"Volume ratio":i?.volumeRatio,"24h change %":i?.change24hPct,Support:i?.support,Resistance:i?.resistance}).map(([k,v])=><div className="btc10metric" key={k}><span>{k}</span><b>{typeof v==="number"?v.toLocaleString(undefined,{maximumFractionDigits:4}):"—"}</b></div>)}
 </section>
 <section className="btc10panel"><div className="btc10row"><b>Forecast status</b><span>{remaining?Math.floor(remaining/60)+"m "+remaining%60+"s remaining":"Forecast expired"}</span></div><div className="btc10row"><b>Data quality</b><span>{data.dataQuality}</span></div><div className="btc10row"><b>Signal agreement</b><span>{data.conflict?"Timeframes conflict":"Timeframes agree"}</span></div><div className="btc10row"><b>Confidence</b><span>{data.confidenceBand} · not a calibrated probability</span></div></section>
 <section className="btc10panel"><b>Signal components</b>{Object.entries(data.components).map(([k,v])=><div className="btc10row" key={k}><span>{k}</span><b>{v>0?"+":""}{v.toFixed(2)}</b></div>)}</section>
 <small className="btc10disclaimer">{data.disclaimer}</small>
 </>}
 <HistoryPanel />
 <footer>BTC 10m baseline · Binance public market data · refreshed every 60 seconds · analysis only</footer>
 </main>
}
