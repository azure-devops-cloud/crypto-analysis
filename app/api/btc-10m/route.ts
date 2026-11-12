import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";
// Keep this experimental market-data API in Mumbai; scoped to this route and branch.
export const preferredRegion = "bom1";
export const revalidate = 0;

type Candle = { t:number; o:number; h:number; l:number; c:number; v:number };

async function json(url:string) {
  const r = await fetch(url, { cache:"no-store", headers: { "User-Agent":"crypto-analysis-btc10m/1.0" } });
  if (!r.ok) throw new Error(`Binance returned HTTP ${r.status}`);
  return r.json();
}
function ema(values:number[], period:number) {
  const k=2/(period+1); let e=values[0] ?? 0;
  for(let i=1;i<values.length;i++) e=values[i]*k+e*(1-k);
  return e;
}
function rsi(values:number[], period=14) {
  if(values.length<=period) return 50;
  let g=0,l=0;
  for(let i=values.length-period;i<values.length;i++){const d=values[i]-values[i-1];if(d>0)g+=d;else l-=d;}
  if(l===0)return 100;
  return 100-100/(1+g/l);
}
function parse(raw:any[]):Candle[] {
  return raw.map(x=>({t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5]}));
}
function clamp(n:number,a=-100,b=100){return Math.max(a,Math.min(b,n));}

export async function GET() {
  try {
    const base="https://fapi.binance.com";
    const [raw1,raw5,depth,premium,oi,ticker]=await Promise.all([
      json(`${base}/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=120`),
      json(`${base}/fapi/v1/klines?symbol=BTCUSDT&interval=5m&limit=80`),
      json(`${base}/fapi/v1/depth?symbol=BTCUSDT&limit=50`),
      json(`${base}/fapi/v1/premiumIndex?symbol=BTCUSDT`),
      json(`${base}/fapi/v1/openInterest?symbol=BTCUSDT`),
      json(`${base}/fapi/v1/ticker/24hr?symbol=BTCUSDT`)
    ]);
    const one=parse(raw1), five=parse(raw5), c=one.map(x=>x.c), c5=five.map(x=>x.c);
    if(one.length<60||five.length<30) throw new Error("Insufficient candle history");
    const last=one.at(-1)!; const e9=ema(c.slice(-60),9), e21=ema(c.slice(-80),21);
    const e5fast=ema(c5.slice(-50),9), e5slow=ema(c5.slice(-60),21);
    const momentum=(last.c/c.at(-6)!-1)*100;
    const r=rsi(c);
    const bids=depth.bids.slice(0,20).reduce((s:number,x:any[])=>s+Number(x[1]),0);
    const asks=depth.asks.slice(0,20).reduce((s:number,x:any[])=>s+Number(x[1]),0);
    const imbalance=bids+asks?(bids-asks)/(bids+asks):0;
    const avgVol=one.slice(-21,-1).reduce((s,x)=>s+x.v,0)/20;
    const volumeRatio=avgVol?last.v/avgVol:1;
    const funding=Number(premium.lastFundingRate||0);
    const components={
      ema1m:e9>e21?1:-1, ema5m:e5fast>e5slow?1:-1,
      momentum:clamp(momentum*18,-20,20), rsi:r>55&&r<72?8:r<45?-8:0,
      orderBook:clamp(imbalance*35,-15,15), volume:volumeRatio>1.2?(last.c>=last.o?6:-6):0,
      funding:clamp(-funding*100000,-5,5)
    };
    const score=Math.round(clamp(components.ema1m*18+components.ema5m*22+components.momentum+components.rsi+components.orderBook+components.volume+components.funding));
    const stale=Date.now()-last.t>180000;
    const conflict=components.ema1m!==components.ema5m;
    const direction=stale?"NO_CLEAR_SIGNAL":score>=28&&!conflict?"UP":score<=-28&&!conflict?"DOWN":"NO_CLEAR_SIGNAL";
    const quality=stale?"STALE":"OK";
    const confidenceBand=direction==="NO_CLEAR_SIGNAL"?"LOW":Math.abs(score)>=65?"MEDIUM":"LOW";
    const highs=one.slice(-30).map(x=>x.h), lows=one.slice(-30).map(x=>x.l);
    return NextResponse.json({
      ok:true,symbol:"BTCUSDT",horizonMinutes:10,generatedAt:new Date().toISOString(),
      expiresAt:new Date(Date.now()+10*60*1000).toISOString(),price:last.c,direction,score,
      confidenceBand,probability:null,probabilityNote:"Not calibrated; score is not a win probability.",
      dataQuality:quality,conflict,components,
      indicators:{rsi14:Number(r.toFixed(2)),ema9:Number(e9.toFixed(2)),ema21:Number(e21.toFixed(2)),
        ema5mFast:Number(e5fast.toFixed(2)),ema5mSlow:Number(e5slow.toFixed(2)),
        orderBookImbalance:Number(imbalance.toFixed(4)),fundingRate:funding,
        openInterest:Number(oi.openInterest||0),volumeRatio:Number(volumeRatio.toFixed(2)),
        support:Math.min(...lows),resistance:Math.max(...highs),
        change24hPct:Number(ticker.priceChangePercent||0)},
      candles:one.slice(-60).map(x=>({time:x.t,open:x.o,high:x.h,low:x.l,close:x.c,volume:x.v})),
      disclaimer:"Experimental market analysis only. No validated probability, no trade execution, and no guarantee of direction."
    },{headers:{"Cache-Control":"no-store"}});
  } catch(e) {
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Market data unavailable"},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
