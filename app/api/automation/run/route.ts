import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const base=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!base||!key) return NextResponse.json({error:"Supabase configuration is missing"},{status:500});
  const r=await fetch(`${base}/functions/v1/crypto-analysis-runner`,{
    method:"POST",
    headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({source:"vercel-cron",time:new Date().toISOString()}),
    cache:"no-store"
  });
  const body=await r.text();
  return new NextResponse(body,{status:r.status,headers:{"content-type":"application/json"}});
}
