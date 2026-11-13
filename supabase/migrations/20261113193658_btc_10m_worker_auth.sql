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
