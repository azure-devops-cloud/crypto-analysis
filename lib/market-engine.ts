export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type TrendDirection = "BULLISH" | "BEARISH" | "RANGE";
export type TrendSignal = "STRONG_LONG" | "LONG" | "WAIT" | "SHORT" | "STRONG_SHORT";

export type TrendPrediction = {
  direction: TrendDirection;
  signal: TrendSignal;
  confidence: number;
  horizon: "NEXT_1_3_CANDLES";
  trendStrength: number;
  momentum: number;
  volumeConfirmation: number;
  structure: "BULLISH" | "BEARISH" | "RANGE";
  bos: "BULLISH" | "BEARISH" | "NONE";
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  adx: number;
  atr: number;
  support: number;
  resistance: number;
  volumeRatio: number;
  reasons: string[];
};

export type TechnicalSnapshot = TrendPrediction & {
  price: number;
  volume: number;
  averageVolume: number;
  divergence: "BULLISH" | "BEARISH" | "NONE";
  score: number;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
};

export function ema(values: number[], period: number) {
  if (!values.length) return 0;
  const k = 2 / (period + 1);
  let out = values[0];
  for (let i = 1; i < values.length; i++) out = values[i] * k + out * (1 - k);
  return out;
}

export function rsi(values: number[], period = 14) {
  if (values.length <= period) return 50;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

export function atr(candles: Candle[], period = 14) {
  if (candles.length < period + 1) return 0;
  const tr = candles.slice(1).map((c, i) => {
    const prev = candles[i].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });
  return ema(tr.slice(-Math.min(tr.length, period * 3)), period);
}

function pivots(candles: Candle[], left = 2, right = 2) {
  const highs: Candle[] = [], lows: Candle[] = [];
  for (let i = left; i < candles.length - right; i++) {
    const c = candles[i];
    let high = true, low = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) high = false;
      if (candles[j].low <= c.low) low = false;
    }
    if (high) highs.push(c);
    if (low) lows.push(c);
  }
  return { highs, lows };
}

function macd(values: number[]) {
  const line = ema(values, 12) - ema(values, 26);
  const series: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const fast = ema(values.slice(0, i + 1), 12);
    const slow = ema(values.slice(0, i + 1), 26);
    series.push(fast - slow);
  }
  return { line, signal: ema(series.slice(-60), 9), histogram: line - ema(series.slice(-60), 9) };
}

function adx(candles: Candle[], period = 14) {
  if (candles.length < period * 2 + 1) return 0;
  const trs: number[] = [], plus: number[] = [], minus: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    const up = c.high - p.high, down = p.low - c.low;
    plus.push(up > down && up > 0 ? up : 0);
    minus.push(down > up && down > 0 ? down : 0);
  }
  const tr = ema(trs.slice(-period * 3), period);
  const p = ema(plus.slice(-period * 3), period);
  const m = ema(minus.slice(-period * 3), period);
  if (!tr) return 0;
  const pdi = 100 * p / tr, mdi = 100 * m / tr;
  return 100 * Math.abs(pdi - mdi) / Math.max(1, pdi + mdi);
}

export function predictTrend(candles: Candle[]): TrendPrediction {
  if (candles.length < 60) {
    throw new Error("At least 60 candles are required for trend prediction");
  }

  const closes = candles.map(c => c.close);
  const price = closes.at(-1)!;
  const e20 = ema(closes, 20), e50 = ema(closes, 50), e200 = ema(closes, 200);
  const r = rsi(closes);
  const m = macd(closes);
  const a = atr(candles);
  const d = adx(candles);
  const recent = candles.slice(-48);
  const support = Math.min(...recent.map(c => c.low));
  const resistance = Math.max(...recent.map(c => c.high));
  const avgVolume = candles.slice(-21, -1).reduce((s, c) => s + c.volume, 0) / 20;
  const volumeRatio = avgVolume ? candles.at(-1)!.volume / avgVolume : 1;
  const p = pivots(candles);
  const highs = p.highs.slice(-3), lows = p.lows.slice(-3);
  const hh = highs.length >= 2 && highs.at(-1)!.high > highs.at(-2)!.high;
  const hl = lows.length >= 2 && lows.at(-1)!.low > lows.at(-2)!.low;
  const lh = highs.length >= 2 && highs.at(-1)!.high < highs.at(-2)!.high;
  const ll = lows.length >= 2 && lows.at(-1)!.low < lows.at(-2)!.low;
  const structure = hh && hl ? "BULLISH" : lh && ll ? "BEARISH" : "RANGE";
  const bos = price > (highs.at(-1)?.high ?? Infinity) ? "BULLISH" :
    price < (lows.at(-1)?.low ?? -Infinity) ? "BEARISH" : "NONE";

  let bull = 0, bear = 0;
  const reasons: string[] = [];
  const add = (b: number, reason: string) => { if (b > 0) { bull += b; reasons.push(reason); } else if (b < 0) { bear += -b; reasons.push(reason); } };

  add(e20 > e50 ? 18 : -18, e20 > e50 ? "EMA20 is above EMA50" : "EMA20 is below EMA50");
  add(price > e200 ? 14 : -14, price > e200 ? "Price is above EMA200" : "Price is below EMA200");
  add(m.histogram > 0 ? 12 : -12, m.histogram > 0 ? "MACD momentum is positive" : "MACD momentum is negative");
  add(r >= 52 && r <= 68 ? 10 : r <= 45 ? -10 : r >= 75 ? -6 : 0, r >= 52 && r <= 68 ? "RSI supports bullish momentum" : r <= 45 ? "RSI confirms bearish momentum" : r >= 75 ? "RSI is overbought" : "");
  add(structure === "BULLISH" ? 16 : structure === "BEARISH" ? -16 : 0, structure === "BULLISH" ? "Higher-high/higher-low structure" : structure === "BEARISH" ? "Lower-high/lower-low structure" : "");
  add(bos === "BULLISH" ? 10 : bos === "BEARISH" ? -10 : 0, bos === "BULLISH" ? "Bullish break of structure" : bos === "BEARISH" ? "Bearish break of structure" : "");
  add(d >= 25 ? (m.histogram >= 0 ? 8 : -8) : 0, d >= 25 ? "ADX confirms a directional regime" : "");
  add(volumeRatio >= 1.2 ? (candles.at(-1)!.close >= candles.at(-1)!.open ? 7 : -7) : 0, volumeRatio >= 1.2 ? "Volume confirms the current candle" : "");

  const total = bull + bear;
  const confidence = Math.round(50 + Math.min(45, Math.abs(bull - bear) * 45 / 95));
  const direction: TrendDirection = bull - bear >= 18 ? "BULLISH" : bear - bull >= 18 ? "BEARISH" : "RANGE";
  const signal: TrendSignal =
    direction === "BULLISH" ? confidence >= 80 ? "STRONG_LONG" : "LONG" :
    direction === "BEARISH" ? confidence >= 80 ? "STRONG_SHORT" : "SHORT" : "WAIT";

  if (d < 18) reasons.push("ADX is low: trend is weak/ranging");
  if (volumeRatio < 0.8) reasons.push("Volume is below average: breakout confirmation is weak");
  if (direction === "RANGE") reasons.push("Signals are mixed; wait for structure confirmation");

  const trendStrength = Math.min(100, Math.round(d * 1.5));
  const momentum = Math.max(0, Math.min(100, Math.round(50 + (m.histogram / Math.max(a, price * 0.001)) * 25)));
  const volumeConfirmation = Math.max(0, Math.min(100, Math.round(volumeRatio * 50)));

  return {
    direction, signal, confidence, horizon: "NEXT_1_3_CANDLES", trendStrength,
    momentum, volumeConfirmation, structure, bos, ema20: e20, ema50: e50, ema200: e200,
    rsi: r, macd: m.line, macdSignal: m.signal, adx: d, atr: a, support, resistance,
    volumeRatio, reasons
  };
}

export function analyzeCandles(candles: Candle[]): TechnicalSnapshot {
  const p = predictTrend(candles);
  const closes = candles.map(c => c.close);
  const price = closes.at(-1) || 0;
  const averageVolume = candles.slice(-21, -1).reduce((s, c) => s + c.volume, 0) / 20;
  const divergence: TechnicalSnapshot["divergence"] = "NONE";
  const score = p.direction === "BULLISH" ? p.confidence : p.direction === "BEARISH" ? 100 - p.confidence : 50;
  return {
    ...p, price, volume: candles.at(-1)?.volume || 0, averageVolume, divergence, score,
    trend: p.direction === "RANGE" ? "NEUTRAL" : p.direction
  };
}
