create table if not exists public.btc_10m_forecasts (
  id uuid primary key default gen_random_uuid(),
  symbol text not null default 'BTCUSDT' check (symbol = 'BTCUSDT'),
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  entry_price numeric not null,
  direction text not null check (direction in ('UP','DOWN','NO_CLEAR_SIGNAL')),
  score integer not null check (score between -100 and 100),
  confidence_band text not null check (confidence_band in ('LOW','MEDIUM','HIGH')),
  model_version text not null default 'baseline-v1',
  features jsonb not null default '{}'::jsonb,
  data_quality text not null default 'OK' check (data_quality in ('OK','STALE','INCOMPLETE')),
  outcome_price numeric,
  outcome_return_pct numeric,
  outcome text check (outcome in ('CORRECT','INCORRECT','NEUTRAL')),
  evaluated_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists btc_10m_forecasts_generated_idx on public.btc_10m_forecasts (generated_at desc);
create index if not exists btc_10m_forecasts_expiry_idx on public.btc_10m_forecasts (expires_at) where evaluated_at is null;
alter table public.btc_10m_forecasts enable row level security;
drop policy if exists "Public can read BTC 10m forecasts" on public.btc_10m_forecasts;
create policy "Public can read BTC 10m forecasts" on public.btc_10m_forecasts for select to anon, authenticated using (true);
revoke insert, update, delete on public.btc_10m_forecasts from anon, authenticated;
grant select on public.btc_10m_forecasts to anon, authenticated;
grant all on public.btc_10m_forecasts to service_role;
