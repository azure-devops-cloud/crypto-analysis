# Trading Engine

## Current architecture

- Real-time Binance public market data through a server-side Next.js route.
- Risk-aware trade-plan calculation in `lib/trading-engine.ts`.
- Paper execution console at `/trading`.
- Server-side signed Binance Spot order endpoint at `/api/trading/order`.
- Live execution is hard-locked unless `TRADING_LIVE_ENABLED=true`.

## Required server environment variables for live execution

- `BINANCE_API_KEY`
- `BINANCE_API_SECRET`
- `TRADING_LIVE_ENABLED=true`

Never expose the API key or secret to client-side JavaScript. Use a Binance API key with trading permission only; do not enable withdrawal permission.

## Rollout

1. Validate quotes and paper fills.
2. Add persistent trade journal and account-state reconciliation.
3. Add exchange symbol filters, min-notional and quantity/price step validation.
4. Add kill switch, daily loss limit, max concurrent positions and idempotency.
5. Backtest the strategy and calibrate the confidence score.
6. Only then explicitly enable live execution.

The current score/confidence is heuristic, not a guaranteed probability.
