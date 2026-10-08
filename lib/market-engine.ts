export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type TechnicalSnapshot = {
  price: number;
  ema20: number;
  ema50: number;
  rsi: number;
  atr: number;
  support: number;
  resistance: number;
  volume: number;
  averageVolume: number;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  structure: "BULLISH" | "BEARISH" | "RANGE";
  bos: "BULLISH" | "BEARISH" | "NONE";
  divergence: "BULLISH" | "BEARISH" | "NONE";
  score: number;
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
  return ema(tr.slice(-period * 2), period);
}

function pivots(candles: Candle[], left = 2, right = 2) {
  const highs: Candle[] = [], lows: Candle[] = [];
  for (let i = left; i < candles.length - right; i++) {
    const c = candles[i];
    let high = true, low = true;
    for (let j = i-left; j <= i+right; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) high = false;
      if (candles[j].low <= c.low) low = false;
    }
    if (high) highs.push(c);
    if (low) lows.push(c);
  }
  return { highs, lows };
}

export function analyzeCandles(candles: Candle[]): TechnicalSnapshot {
  const closes = candles.map(c => c.close);
  const price = closes.at(-1) || 0;
  const ema20 = ema(closes.slice(-100), 20);
  const ema50 = ema(closes.slice(-120), 50);
  const r = rsi(closes);
  const a = atr(candles);
  const recent = candles.slice(-48);
  const support = Math.min(...recent.map(c => c.low));
  const resistance = Math.max(...recent.map(c => c.high));
  const volume = candles.at(-1)?.volume || 0;
  const averageVolume = candles.slice(-21,-1).reduce((s,c)=>s+c.volume,0) / Math.max(1,candles.slice(-21,-1).length);
  const p = pivots(candles);
  const lastHighs = p.highs.slice(-3);
  const lastLows = p.lows.slice(-3);

  const higherHigh = lastHighs.length >= 2 && lastHighs.at(-1)!.high > lastHighs.at(-2)!.high;
  const higherLow = lastLows.length >= 2 && lastLows.at(-1)!.low > lastLows.at(-2)!.low;
  const lowerHigh = lastHighs.length >= 2 && lastHighs.at(-1)!.high < lastHighs.at(-2)!.high;
  const lowerLow = lastLows.length >= 2 && lastLows.at(-1)!.low < lastLows.at(-2)!.low;

  const structure = higherHigh && higherLow ? "BULLISH" : lowerHigh && lowerLow ? "BEARISH" : "RANGE";
  const bos = price > (lastHighs.at(-1)?.high || Infinity) ? "BULLISH" :
    price < (lastLows.at(-1)?.low || -Infinity) ? "BEARISH" : "NONE";

  let divergence: TechnicalSnapshot["divergence"] = "NONE";
  if (lastLows.length >= 2) {
    const aLow = lastLows.at(-2)!.low, bLow = lastLows.at(-1)!.low;
    const aIdx = candles.indexOf(lastLows.at(-2)!), bIdx = candles.indexOf(lastLows.at(-1)!);
    const rsiA = rsi(closes.slice(0, aIdx + 1)), rsiB = rsi(closes.slice(0, bIdx + 1));
    if (bLow < aLow && rsiB > rsiA + 2) divergence = "BULLISH";
  }
  if (lastHighs.length >= 2) {
    const aHigh = lastHighs.at(-2)!.high, bHigh = lastHighs.at(-1)!.high;
    const aIdx = candles.indexOf(lastHighs.at(-2)!), bIdx = candles.indexOf(lastHighs.at(-1)!);
    const rsiA = rsi(closes.slice(0, aIdx + 1)), rsiB = rsi(closes.slice(0, bIdx + 1));
    if (bHigh > aHigh && rsiB < rsiA - 2) divergence = "BEARISH";
  }

  let score = 50;
  score += ema20 > ema50 ? 12 : -12;
  score += price > ema20 ? 8 : -8;
  score += structure === "BULLISH" ? 10 : structure === "BEARISH" ? -10 : 0;
  score += bos === "BULLISH" ? 8 : bos === "BEARISH" ? -8 : 0;
  score += r > 55 && r < 70 ? 8 : r < 45 && r > 30 ? -8 : 0;
  score += volume > averageVolume * 1.2 ? (price >= candles.at(-1)!.open ? 6 : -6) : 0;
  score += divergence === "BULLISH" ? 7 : divergence === "BEARISH" ? -7 : 0;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    price, ema20, ema50, rsi: r, atr: a, support, resistance,
    volume, averageVolume,
    trend: score >= 65 ? "BULLISH" : score <= 35 ? "BEARISH" : "NEUTRAL",
    structure, bos, divergence, score
  };
}
