import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) return NextResponse.json({ok:false,error:"Supabase public configuration is missing"},{status:503});
  const headers={apikey:key};
  try {
    const [statsResponse,forecastsResponse]=await Promise.all([
      fetch(url+"/rest/v1/btc_10m_forecast_stats?select=*&order=period.asc",{headers,cache:"no-store"}),
      fetch(url+"/rest/v1/btc_10m_forecasts?select=id,generated_at,expires_at,entry_price,direction,score,data_quality,outcome_price,outcome_return_pct,outcome,evaluated_at&order=generated_at.desc&limit=20",{headers,cache:"no-store"})
    ]);
    if(!statsResponse.ok) throw new Error("Stats query failed ("+statsResponse.status+")");
    if(!forecastsResponse.ok) throw new Error("History query failed ("+forecastsResponse.status+")");
    const [stats,forecasts]=await Promise.all([statsResponse.json(),forecastsResponse.json()]);
    return NextResponse.json({ok:true,stats,forecasts},{headers:{"Cache-Control":"no-store"}});
  } catch(e) {
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Forecast history unavailable"},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
