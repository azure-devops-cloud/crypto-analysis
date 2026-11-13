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
