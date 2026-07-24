export const MINIMUM_TREND_SAMPLE_SIZE = 3;

export type TrendCount = {
  key: string;
  label: string;
  count: number;
};

export type PredictionTrendItem = TrendCount & {
  percentage: number;
};

export type PredictionTrends = {
  total: number;
  minimumSampleSize: number;
  available: boolean;
  outcomes: PredictionTrendItem[];
  topScores: PredictionTrendItem[];
  topScorers: PredictionTrendItem[];
};

function withPercentages(items: TrendCount[], total: number) {
  return items.map((item) => ({
    ...item,
    percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
  }));
}

export function buildPredictionTrends(
  total: number,
  outcomes: TrendCount[],
  topScores: TrendCount[],
  topScorers: TrendCount[],
): PredictionTrends {
  const safeTotal = Math.max(0, Math.trunc(total));
  const available = safeTotal >= MINIMUM_TREND_SAMPLE_SIZE;

  return {
    total: safeTotal,
    minimumSampleSize: MINIMUM_TREND_SAMPLE_SIZE,
    available,
    outcomes: available ? withPercentages(outcomes, safeTotal) : [],
    topScores: available ? withPercentages(topScores, safeTotal) : [],
    topScorers: available ? withPercentages(topScorers, safeTotal) : [],
  };
}
