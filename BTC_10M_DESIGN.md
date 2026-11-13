# BTC 10-minute baseline forecast

This branch adds a BTC-only experimental dashboard at `/btc-10m`, a live market API at `/api/btc-10m`, and a forecast-history API at `/api/btc-10m/history`.

## Live model
- Public Binance USD-M Futures market endpoints only; no Binance API key and no order endpoints.
- 1-minute and 5-minute candle trend, RSI, EMA, short-term momentum, top-of-book depth imbalance, funding, open interest, volume ratio and 24-hour regime.
- The result is UP, DOWN or NO_CLEAR_SIGNAL. The score is explicitly not a calibrated probability.
- Dashboard refreshes every 60 seconds and shows a 10-minute forecast expiry timer.
- No automatic execution, no account credentials, and no paid AI model.

## Forecast history and evaluation
- A separate Supabase Edge Function captures one snapshot per minute using the same baseline-v1 scoring rules.
- A dedicated Supabase Cron job runs every minute. It is separate from the existing `crypto-analysis-runner-5m` job.
- Each snapshot is evaluated against the first completed 1-minute BTC candle at or after its 10-minute expiry.
- Moves within ±0.02% are marked NEUTRAL. NO_CLEAR_SIGNAL forecasts are also recorded as NEUTRAL and excluded from directional accuracy.
- Accuracy is calculated as CORRECT / (CORRECT + INCORRECT); the dashboard shows 24h, 7d, 30d and all-time summaries.
- Forecast table has RLS enabled, public read-only access, and server-side writes only. The worker's shared secret is held in Supabase Vault; no service-role key is stored in source control or browser code.

## Limitations
- The model score is not a calibrated probability and must not be treated as one.
- A meaningful performance assessment needs a larger sample and a paper-observation period; overlapping minute-by-minute forecasts are not independent observations.
- Backtest and calibrate against out-of-sample observations before presenting probability estimates.
- Binance rate limits and regional availability may affect data refresh.
- The preview remains experimental; no production promotion or PR merge is included.

## Local validation
```bash
npm install
npm run build
```
