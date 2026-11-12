# BTC 10-minute baseline forecast

This branch adds a BTC-only experimental dashboard at `/btc-10m` and a read-only API at `/api/btc-10m`.

## Design
- Public Binance USD-M Futures market endpoints only; no API key and no order endpoints.
- 1-minute and 5-minute candle trend, RSI, EMA, short-term momentum, top-of-book depth imbalance, funding, open interest, volume ratio and 24-hour regime.
- The result is UP, DOWN or NO_CLEAR_SIGNAL. Score is explicitly not a calibrated probability.
- Dashboard refreshes every 60 seconds and shows a 10-minute forecast expiry timer.
- No automatic execution, no account credentials, no paid AI model.

## Limitations / next stage
- This first slice is stateless: it does not yet persist forecast snapshots or evaluate outcomes.
- Add the Supabase forecast/outcome migration and a separately authenticated scheduled evaluator only after choosing a secure server-to-server invocation secret. Never use a publishable key as an internal secret.
- Backtest and calibrate against out-of-sample observations before presenting probability estimates.
- Binance rate limits and regional availability may affect data refresh.

## Local validation
```bash
npm install
npm run build
```
