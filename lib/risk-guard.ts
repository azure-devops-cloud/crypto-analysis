export type RiskState = {
  killSwitch: boolean;
  dailyLoss: number;
  maxDailyLoss: number;
  openPositions: number;
  maxOpenPositions: number;
  requestedRisk: number;
  maxPositionRisk: number;
};

export function checkRisk(state: RiskState) {
  const reasons: string[] = [];
  if (state.killSwitch) reasons.push("kill switch is active");
  if (state.dailyLoss <= -Math.abs(state.maxDailyLoss)) reasons.push("daily loss limit reached");
  if (state.openPositions >= state.maxOpenPositions) reasons.push("maximum open positions reached");
  if (state.requestedRisk > state.maxPositionRisk) reasons.push("position risk exceeds limit");
  return { allowed: reasons.length === 0, reasons };
}
