"use client";
import {useCallback,useEffect,useState} from "react";

type Stat={period:string;total_forecasts:number;evaluated_forecasts:number;directional_forecasts:number;evaluated_directional:number;no_clear_signal:number;correct:number;incorrect:number;neutral:number;accuracy_pct:number|null};
type ForecastRow={id:string;generated_at:string;entry_price:number;direction:"UP"|"DOWN"|"NO_CLEAR_SIGNAL";score:number;outcome:"CORRECT"|"INCORRECT"|"NEUTRAL"|null;outcome_price:number|null;evaluated_at:string|null};
type Payload={ok:boolean;stats:Stat[];forecasts:ForecastRow[]};
const n=(v:number|string|undefined)=>Number(v||0).toLocaleString();
const pct=(v:number|null|undefined)=>v===null||v===undefined?"—":Number(v).toFixed(1)+"%";
const price=(v:number)=>"$"+Number(v).toLocaleString("en-US",{maximumFractionDigits:2});

export default function HistoryPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  try{
   const r=await fetch("/api/btc-10m/history",{cache:"no-store"});
   const body=await r.json();
   if(!r.ok)throw new Error(body.error||"History unavailable");
   setData(body);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load forecast history");}
 },[]);
 useEffect(()=>{load();const id=setInterval(load,60000);return()=>clearInterval(id);},[load]);
 const day=data?.stats.find(x=>x.period==="24h");
 const all=data?.stats.find(x=>x.period==="all");
 return <section className="btc10history">
  <div className="btc10sectionhead"><div><h2>Forecast performance</h2><p>Outcomes measured against the BTC 1-minute candle at the 10-minute expiry</p></div><span>Auto-updated every 60s</span></div>
  {error&&<div className="btc10historyerror">{error}</div>}
  <div className="btc10stats">
   <div className="btc10stat"><span>24h directional accuracy</span><b>{pct(day?.accuracy_pct)}</b><small>{n(day?.correct)} correct · {n(day?.incorrect)} incorrect</small></div>
   <div className="btc10stat"><span>24h evaluated signals</span><b>{n(day?.evaluated_directional)}</b><small>{n(day?.neutral)} neutral moves excluded</small></div>
   <div className="btc10stat"><span>24h no-clear signals</span><b>{n(day?.no_clear_signal)}</b><small>Not counted as wins or losses</small></div>
   <div className="btc10stat"><span>All-time accuracy</span><b>{pct(all?.accuracy_pct)}</b><small>{n(all?.evaluated_directional)} evaluated directional signals</small></div>
  </div>
  <div className="btc10periods">
   {(["24h","7d","30d","all"] as const).map(period=>{const s=data?.stats.find(x=>x.period===period);return <div className="btc10period" key={period}><span>{period==="all"?"All time":period}</span><b>{pct(s?.accuracy_pct)}</b><small>{n(s?.evaluated_directional)} evaluated</small></div>;})}
  </div>
  <div className="btc10historytable">
   <div className="btc10historytitle"><b>Recent forecasts</b><span>Latest 20 snapshots</span></div>
   {data?.forecasts.length?data.forecasts.map(row=><div className="btc10historyrow" key={row.id}>
    <span className="btc10time">{new Date(row.generated_at).toLocaleString()}</span>
    <span>{price(Number(row.entry_price))}</span>
    <b className={row.direction==="UP"?"bull":row.direction==="DOWN"?"bear":"neutral"}>{row.direction==="NO_CLEAR_SIGNAL"?"NO CLEAR":row.direction}</b>
    <span>{row.score>0?"+":""}{row.score}</span>
    <span className={"btc10outcome "+(row.outcome==="CORRECT"?"bull":row.outcome==="INCORRECT"?"bear":"")}>{row.outcome||"PENDING"}</span>
   </div>):<div className="btc10empty">No saved forecasts yet. The separate worker will populate this history after its first successful run.</div>}
  </div>
  <small className="btc10disclaimer">Accuracy = correct ÷ (correct + incorrect). Neutral moves within ±0.02% and NO CLEAR SIGNAL forecasts are excluded from directional accuracy. Past results do not predict future performance.</small>
 </section>;
}
