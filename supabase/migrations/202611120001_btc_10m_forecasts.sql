create table if not exists public.btc_10m_forecasts (
 id uuid primary key default gen_random_uuid(),
 symbol text not null default 'BTCUSDT' check (symbol='BTCUSDT'),
 generated_at timestamptz not null unique,
 expires_at timestamptz not null,
 entry_price numeric not null check(entry_price>0),
 direction text not null check(direction in ('UP','DOWN','NO_CLEAR_SIGNAL')),
 score integer not null check(score between -100 and 100),
 confidence_band text not null check(confidence_band in ('LOW','MEDIUM','HIGH')),
 model_version text not null default 'baseline-v1',
 features jsonb not null default '{}'::jsonb,
 data_quality text not null default 'OK' check(data_quality in ('OK','STALE','INCOMPLETE')),
 outcome_price numeric,
 outcome_return_pct numeric,
 outcome text check(outcome in ('CORRECT','INCORRECT','NEUTRAL')),
 evaluated_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists btc_10m_forecasts_generated_idx on public.btc_10m_forecasts(generated_at desc);
create index if not exists btc_10m_forecasts_expiry_idx on public.btc_10m_forecasts(expires_at) where evaluated_at is null;
alter table public.btc_10m_forecasts enable row level security;
drop policy if exists "Public can read BTC 10m forecasts" on public.btc_10m_forecasts;
create policy "Public can read BTC 10m forecasts" on public.btc_10m_forecasts for select to anon, authenticated using(true);
revoke insert,update,delete on public.btc_10m_forecasts from anon,authenticated;
grant select on public.btc_10m_forecasts to anon,authenticated;
grant all on public.btc_10m_forecasts to service_role;
create or replace view public.btc_10m_forecast_stats with (security_invoker=true) as
with periods(period,since_at,sort_order) as (
 values ('24h'::text,now()-interval '24 hours',1),('7d'::text,now()-interval '7 days',2),('30d'::text,now()-interval '30 days',3),('all'::text,null::timestamptz,4)
)
select p.period,
 count(f.id)::bigint total_forecasts,
 count(f.id) filter(where f.evaluated_at is not null)::bigint evaluated_forecasts,
 count(f.id) filter(where f.direction in ('UP','DOWN'))::bigint directional_forecasts,
 count(f.id) filter(where f.evaluated_at is not null and f.direction in ('UP','DOWN'))::bigint evaluated_directional,
 count(f.id) filter(where f.direction='NO_CLEAR_SIGNAL')::bigint no_clear_signal,
 count(f.id) filter(where f.outcome='CORRECT')::bigint correct,
 count(f.id) filter(where f.outcome='INCORRECT')::bigint incorrect,
 count(f.id) filter(where f.outcome='NEUTRAL' and f.direction in ('UP','DOWN'))::bigint neutral,
 round(100.0*count(f.id) filter(where f.outcome='CORRECT')/nullif(count(f.id) filter(where f.outcome in ('CORRECT','INCORRECT')),0),2) accuracy_pct
from periods p left join public.btc_10m_forecasts f on p.since_at is null or f.generated_at>=p.since_at
group by p.period,p.sort_order order by p.sort_order;
grant select on public.btc_10m_forecast_stats to anon,authenticated,service_role;
grant usage on schema vault to service_role;
grant select on vault.decrypted_secrets to service_role;
create or replace function public.verify_btc_10m_worker_secret(candidate text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select candidate is not null and exists (
    select 1 from vault.decrypted_secrets
    where name = 'btc_10m_worker_secret' and decrypted_secret = candidate
  );
$$;
revoke all on function public.verify_btc_10m_worker_secret(text) from public, anon, authenticated;
grant execute on function public.verify_btc_10m_worker_secret(text) to service_role;

select vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'btc_10m_worker_secret',
  'Private shared secret for the isolated BTC 10-minute forecast worker');
select vault.create_secret('sb_publishable_qKwe2p1TD7MbsipVM17_2w_Nbn6ZgwD', 'btc_10m_publishable_key',
  'Public Supabase key used only as the Edge Function gateway apikey');
select vault.create_secret('https://xngzpvzhmtuxplslvtud.supabase.co', 'btc_10m_project_url',
  'Supabase project URL for the BTC 10-minute worker');

select cron.schedule('btc-10m-forecast-worker', '* * * * *', $btc10m$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'btc_10m_project_url') || '/functions/v1/btc-10m-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'btc_10m_publishable_key'),
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'btc_10m_worker_secret')
    ),
    body := jsonb_build_object('source', 'supabase-cron', 'time', now()),
    timeout_milliseconds := 15000
  );
$btc10m$);

grant usage on schema vault to service_role;
grant select on vault.decrypted_secrets to service_role;
create or replace function public.verify_btc_10m_worker_secret(candidate text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select candidate is not null and exists (
    select 1 from vault.decrypted_secrets
    where name = 'btc_10m_worker_secret' and decrypted_secret = candidate
  );
$$;
revoke all on function public.verify_btc_10m_worker_secret(text) from public, anon, authenticated;
grant execute on function public.verify_btc_10m_worker_secret(text) to service_role;

select vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'btc_10m_worker_secret',
  'Private shared secret for the isolated BTC 10-minute forecast worker');
select vault.create_secret('https://xngzpvzhmtuxplslvtud.supabase.co', 'btc_10m_project_url',
  'Supabase project URL for the BTC 10-minute worker');

select cron.schedule('btc-10m-forecast-worker', '* * * * *', $btc10m$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'btc_10m_project_url') || '/functions/v1/btc-10m-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'btc_10m_worker_secret')
    ),
    body := jsonb_build_object('source', 'supabase-cron', 'time', now()),
    timeout_milliseconds := 15000
  );
$btc10m$);
