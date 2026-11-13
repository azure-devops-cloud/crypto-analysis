import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL = Deno.env.get("SUPABASE_URL") || "";
const secretRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
const DB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || (secretRaw ? JSON.parse(secretRaw).default : "");
if (!URL || ! DB_KEY) throw new Error("Supabase server credentials unavailable");

const headers: Record<string,string> = { apikey: DB_KEY, "Content-Type": "application/json" };
if (DB_KEY.startsWith("eyJ")) headers.Authorization = "Bearer " + DB_KEY;

async function db(path:string, init:RequestInit = {}) {
  const r = await fetch(URL + "/rest/v1/" + path, {
    ...init, headers: { ...headers, ...((init.headers || {}) as Record<string,string>) }
  });
  if (!r.ok) throw new Error("Database HTTP " + r.status + ": " + (await r.text()).slice(0,250));
  if (r.status === 204) return null;
  const body = await r.text();
  return body ? JSON.parse(body) : null;
}
async function binance(path:string) {
  const r = await fetch("https://fapi.binance.com" + path, {headers:{"User-Agent":"crypto-analysis-btc10m-worker/1.0"}});
  if (!r.ok) throw new Error("Binance HTTP " + r.status + " at " + path.split("?")[0]);
  return await r.json();
}
function ema(a:number[],p:number){const k=2/(p+1);let e=a[0]||0;for(let i=1;i<a.length;i++)e=a[i]*k+e*(1-k);return e;}
function rsi(a:number[],p=14){if(a.length<=p)return 50;let g=0,l=0;for(let i=a.length-p;i<a.length;i++){const d=a[i]-a[i-1];if(d>0)g+=d;else l-=d;}return l===0?100:100-100/(1+g/l);}
function clamp(n:number,a=-100,b=100){return Math.max(a,Math.min(b,n));}

async function capture(){
 const base="/fapi/v1";
 const results=await Promise.all([
  binance(base+"/klines?symbol=BTCUSDT&interval=1m&limit=120"),
  binance(base+"/klines?symbol=BTCUSDT&interval=5m&limit=80"),
  binance(base+"/depth?symbol=BTCUSDT&limit=50"),
  binance(base+"/premiumIndex?symbol=BTCUSDT"),
  binance(base+"/openInterest?symbol=BTCUSDT"),
  binance(base+"/ticker/24hr?symbol=BTCUSDT")
 ]);
 const raw1=results[0] as any[],raw5=results[1] as any[],depth=results[2] as any,premium=results[3] as any,oi=results[4] as any,ticker=results[5] as any;
 if(raw1.length<60||raw5.length<30)throw new Error("Insufficient candle history");
 const one=raw1.map(x=>({t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5]}));
 const c=one.map(x=>x.c),c5=raw5.map(x=>+x[4]),last=one[one.length-1];
 const e9=ema(c.slice(-60),9),e21=ema(c.slice(-80),21),e5f=ema(c5.slice(-50),9),e5s=ema(c5.slice(-60),21);
 const momentum=(last.c/c[c.length-6]-1)*100,rv=rsi(c);
 const bids=depth.bids.slice(0,20).reduce((s:number,x:any[])=>s+Number(x[1]),0);
 const asks=depth.asks.slice(0,20).reduce((s:number,x:any[])=>s+Number(x[1]),0);
 const imbalance=bids+asks?(bids-asks)/(bids+asks):0;
 const avgVol=one.slice(-21,-1).reduce((s:number,x:any)=>s+x.v,0)/20,volumeRatio=avgVol?last.v/avgVol:1;
 const funding=Number(premium.lastFundingRate||0);
 const components={
  ema1m:e9>e21?1:-1,ema5m:e5f>e5s?1:-1,momentum:clamp(momentum*18,-20,20),
  rsi:rv>55&&rv<72?8:rv<45?-8:0,orderBook:clamp(imbalance*35,-15,15),
  volume:volumeRatio>1.2?(last.c>=last.o?6:-6):0,funding:clamp(-funding*100000,-5,5)
 };
 const score=Math.round(clamp(components.ema1m*18+components.ema5m*22+components.momentum+components.rsi+components.orderBook+components.volume+components.funding));
 const stale=Date.now()-last.t>180000,conflict=components.ema1m!==components.ema5m;
 const direction=stale?"NO_CLEAR_SIGNAL":score>=28&&!conflict?"UP":score<=-28&&!conflict?"DOWN":"NO_CLEAR_SIGNAL";
 const generated=new Date(Math.floor(Date.now()/60000)*60000),expiry=new Date(generated.getTime()+600000);
 const highs=one.slice(-30).map(x=>x.h),lows=one.slice(-30).map(x=>x.l);
 const features={components,conflict,indicators:{
  rsi14:Number(rv.toFixed(2)),ema9:Number(e9.toFixed(2)),ema21:Number(e21.toFixed(2)),
  ema5mFast:Number(e5f.toFixed(2)),ema5mSlow:Number(e5s.toFixed(2)),orderBookImbalance:Number(imbalance.toFixed(4)),
  fundingRate:funding,openInterest:Number(oi.openInterest||0),volumeRatio:Number(volumeRatio.toFixed(2)),
  support:Math.min(...lows),resistance:Math.max(...highs),change24hPct:Number(ticker.priceChangePercent||0)
 },probability:null};
 await db("btc_10m_forecasts?on_conflict=generated_at",{
  method:"POST",headers:{"Prefer":"resolution=ignore-duplicates,return=minimal"},
  body:JSON.stringify({symbol:"BTCUSDT",generated_at:generated.toISOString(),expires_at:expiry.toISOString(),
   entry_price:last.c,direction,score,confidence_band:direction==="NO_CLEAR_SIGNAL"?"LOW":Math.abs(score)>=65?"MEDIUM":"LOW",
   model_version:"baseline-v1",features,data_quality:stale?"STALE":"OK"})
 });
 return {generatedAt:generated.toISOString(),direction,score};
}

async function evaluate(){
 const now=new Date(),q=new URLSearchParams({
  select:"id,expires_at,entry_price,direction",evaluated_at:"is.null",
  expires_at:"lte."+now.toISOString(),order:"expires_at.asc",limit:"30"
 });
 const due=await db("btc_10m_forecasts?"+q.toString()) as any[];
 let done=0;
 for(const f of due){
  const expiry=Date.parse(f.expires_at);
  const candles=await binance("/fapi/v1/klines?symbol=BTCUSDT&interval=1m&startTime="+expiry+"&endTime="+(expiry+120000)+"&limit=3") as any[];
  const candle=candles.find(x=>Number(x[6])>=expiry&&Number(x[6])<=Date.now());
  if(!candle)continue;
  const price=Number(candle[4]),ret=(price/Number(f.entry_price)-1)*100;
  const outcome=f.direction==="NO_CLEAR_SIGNAL"||Math.abs(ret)<0.02?"NEUTRAL":
   ((f.direction==="UP"&&ret>0)||(f.direction==="DOWN"&&ret<0)?"CORRECT":"INCORRECT");
  const patch=new URLSearchParams({id:"eq."+f.id,evaluated_at:"is.null"});
  await db("btc_10m_forecasts?"+patch.toString(),{method:"PATCH",headers:{"Prefer":"return=minimal"},
   body:JSON.stringify({outcome_price:price,outcome_return_pct:Number(ret.toFixed(6)),outcome,evaluated_at:new Date().toISOString()})});
  done++;
 }
 return done;
}

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405});
 try{
  const candidate=req.headers.get("x-worker-secret")||"";
  const valid=await db("rpc/verify_btc_10m_worker_secret",{method:"POST",body:JSON.stringify({candidate})});
  if(valid!==true)return Response.json({error:"Unauthorized"},{status:401});
  let evaluated=0,captured:any=null,captureError:string|null=null;
  try{evaluated=await evaluate();}catch(e){console.error("evaluation failed",String(e));}
  try{captured=await capture();}catch(e){captureError=String(e);console.error("capture failed",captureError);}
  if(!captured&&evaluated===0)return Response.json({ok:false,error:captureError||"Worker failed"},{status:502});
  return Response.json({ok:true,captured,evaluated,captureError});
 }catch(e){console.error("worker error",String(e));return Response.json({ok:false,error:"Worker request failed"},{status:500});}
});
