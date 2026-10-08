export type TradingMode = "PAPER" | "LIVE";
export type OrderSide = "BUY" | "SELL";

export type TradePlan = {
  symbol: string;
  side: OrderSide;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskAmount: number;
  riskPerUnit: number;
  quantity: number;
  rewardRisk: number;
  confidence: number;
};

export type MarketSnapshot = {
  symbol: string;
  price: number;
  ema20: number;
  ema50: number;
  rsi: number;
  atr: number;
  support: number;
  resistance: number;
  volume: number;
  averageVolume: number;
};

export function buildTradePlan(m: MarketSnapshot, riskAmount = 10): TradePlan | null {
  if (![m.price,m.ema20,m.ema50,m.rsi,m.atr,m.support,m.resistance].every(Number.isFinite) || m.atr <= 0) {
    return null;
  }

  const bullish = m.ema20 > m.ema50 && m.price > m.ema20 && m.rsi >= 50 && m.rsi <= 70;
  const bearish = m.ema20 < m.ema50 && m.price < m.ema20 && m.rsi >= 30 && m.rsi <= 50;
  if (!bullish && !bearish) return null;

  const side: OrderSide = bullish ? "BUY" : "SELL";
  const entry = m.price;
  const stopDistance = Math.max(m.atr * 1.5, entry * 0.003);
  const stopLoss = side === "BUY" ? entry - stopDistance : entry + stopDistance;
  const riskPerUnit = Math.abs(entry - stopLoss);
  const quantity = riskAmount / riskPerUnit;

  const takeProfit1 = side === "BUY" ? entry + stopDistance * 1.5 : entry - stopDistance * 1.5;
  const takeProfit2 = side === "BUY" ? entry + stopDistance * 2.5 : entry - stopDistance * 2.5;

  const volumeBoost = m.volume > m.averageVolume * 1.2 ? 8 : 0;
  const trendStrength = Math.min(20, Math.abs(m.ema20 - m.ema50) / m.atr * 10);
  const rsiQuality = bullish ? Math.max(0, 20 - Math.abs(58 - m.rsi)) : Math.max(0, 20 - Math.abs(42 - m.rsi));
  const confidence = Math.round(Math.min(95, 50 + trendStrength + rsiQuality + volumeBoost));

  return {
    symbol: m.symbol,
    side,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskAmount,
    riskPerUnit,
    quantity,
    rewardRisk: 1.5,
    confidence,
  };
}

export function paperFill(plan: TradePlan, slippageBps = 5) {
  const slip = plan.entry * (slippageBps / 10_000);
  const fillPrice = plan.side === "BUY" ? plan.entry + slip : plan.entry - slip;
  return {
    mode: "PAPER" as const,
    symbol: plan.symbol,
    side: plan.side,
    quantity: plan.quantity,
    requestedPrice: plan.entry,
    fillPrice,
    stopLoss: plan.stopLoss,
    takeProfit1: plan.takeProfit1,
    takeProfit2: plan.takeProfit2,
    riskAmount: plan.riskAmount,
    status: "FILLED" as const,
    timestamp: Date.now(),
  };
}
