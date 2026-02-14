export interface RiskResult {
  score: number;
  label: string;
  color: string;
}

export function calculateRiskScore(counts: {
  func: number;
  perf: number;
  target: number;
  strict: number;
}): RiskResult {
  const raw =
    counts.target * 8 +
    counts.perf * 3 +
    counts.func * 1 -
    counts.strict * 0.5;

  const score = Math.min(100, Math.max(0, Math.floor(raw)));

  if (score <= 25) {
    return { score, label: "Low Risk", color: "#10B981" };
  } else if (score <= 50) {
    return { score, label: "Moderate", color: "#F59E0B" };
  } else if (score <= 75) {
    return { score, label: "Elevated", color: "#F97316" };
  } else {
    return { score, label: "High Risk", color: "#F43F5E" };
  }
}
