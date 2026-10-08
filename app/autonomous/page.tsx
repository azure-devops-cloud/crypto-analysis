"use client";

import { useEffect, useState } from "react";

type Signal = {
  symbol:string; timeframe:string; side:string; score:number; confidence:number; created_at:string;
  reason?: {news_score?:number; technical_score?:number; critical_news?:boolean; headline_count?:number; news?:Array<{title:string;source:string;sentiment:string;impact:string;score:number}>};
};
type News = {id:string;source:string;url:string;title:string;description?:string;published_at:string;category:string;assets:string[];sentiment:string;impact:string;score:number;confidence:number};

export default function AutonomousPage(){
  const [data,setData]=useState<{signals:Signal[];news:News[]}>({signals:[],news:[]});
  const [error,setError]=useState("");
  const load=async()=>{
    try{
      const r=await fetch("/api/autonomous",{cache:"no-store"});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error||"Feed unavailable");
      setData(j); setError("");
    }catch(e){setError(e instanceof Error?e.message:"Feed unavailable");}
  };
  useEffect(()=>{load(); const id=setInterval(load,30000); return()=>clearInterval(id)},[]);
  const latest=(symbol:string)=>data.signals.find(x=>x.symbol===symbol);
  return <main style={{maxWidth:1200,margin:"0 auto",padding:24}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <div><h1>Autonomous Crypto Intelligence</h1><p style={{opacity:.75}}>News + macro + technical engine • automatic refresh every 30s</p></div>
      <button onClick={load}>Refresh</button>
    </div>
    {error&&<p style={{color:"crimson"}}>{error}</p>}
    <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginTop:20}}>
      {["BTCUSDT","ETHUSDT","SOLUSDT"].map(symbol=>{
        const s=latest(symbol);
        const r=s?.reason||{};
        return <article key={symbol} style={{border:"1px solid #ddd",borderRadius:12,padding:18}}>
          <h2>{symbol.replace("USDT","")}</h2>
          <div style={{fontSize:28,fontWeight:700}}>{s?.side||"—"}</div>
          <p>Confidence: <b>{s?.confidence??"—"}</b>/100</p>
          <p>Overall score: <b>{s?.score??"—"}</b></p>
          <p>News: <b>{r.news_score??"—"}</b> · Technical: <b>{r.technical_score??"—"}</b></p>
          <p>Headlines: {r.headline_count??0} {r.critical_news?"⚠️ critical news":" "}</p>
          <small>{s?new Date(s.created_at).toLocaleString():"Waiting for first automated run"}</small>
        </article>
      })}
    </section>
    <section style={{marginTop:28}}>
      <h2>Latest high-impact news</h2>
      <div style={{display:"grid",gap:10}}>
        {data.news.filter(n=>n.impact==="CRITICAL"||n.impact==="HIGH").slice(0,10).map(n=><article key={n.id} style={{border:"1px solid #ddd",borderRadius:10,padding:14}}>
          <div><b>{n.impact}</b> · {n.category} · {n.assets.join(", ")}</div>
          <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
          <div style={{opacity:.7,fontSize:13}}>{n.source} · {new Date(n.published_at).toLocaleString()} · {n.sentiment} · score {n.score}</div>
        </article>)}
        {!data.news.length&&<p>No automated news has been stored yet.</p>}
      </div>
    </section>
    <p style={{marginTop:28,opacity:.7,fontSize:13}}>This system produces model scores, not guaranteed probabilities or financial advice. Live exchange execution remains disabled.</p>
  </main>;
}
