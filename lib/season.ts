import type { GoalWindow, ScoreBreakdown, ScorablePrediction } from "./scoring.ts";

export const BADGE_DEFINITIONS = [
  { key: "bullseye", name: "Bullseye", description: "Predict an exact score", target: 1 },
  { key: "perfect-timing", name: "Perfect Timing", description: "Find the first scorer and the right time window", target: 1 },
  { key: "on-fire", name: "On Fire", description: "Predict five results in a row", target: 5 },
  { key: "globe-trotter", name: "Globe-trotter", description: "Play spotlights across five countries", target: 5 },
  { key: "the-wall", name: "The Wall", description: "Correctly predict a 0-0 draw", target: 1 },
  { key: "against-the-odds", name: "Against the Odds", description: "Correctly back the lower-ranked team to win", target: 1 },
] as const;

export type BadgeKey = typeof BADGE_DEFINITIONS[number]["key"];

export type SeasonHistoryItem = {
  matchId: string;
  weekKey: string;
  kickoff: number;
  countryCode: string;
  competitionName: string;
  homeName: string;
  awayName: string;
  homePosition: number | null;
  awayPosition: number | null;
  prediction: ScorablePrediction;
  result: null | {
    homeScore: number;
    awayScore: number;
    firstScorer: string;
    firstGoalMinute: number | null;
    goalWindow: GoalWindow;
    firstTeam: string;
    settledAt: number;
  };
  score: null | ScoreBreakdown & { scoredAt: number };
};

export type BadgeProgress = typeof BADGE_DEFINITIONS[number] & {
  progress: number;
  unlocked: boolean;
  earnedAt: number | null;
};

export type LeaderboardEntry = {
  rank: number;
  displayName: string;
  points: number;
  exactScores: number;
  correctOutcomes: number;
  played: number;
  predictions: number;
  badges: number;
  isViewer: boolean;
};

export type SeasonViewer = {
  rank: number | null;
  stats: {
    points: number;
    exactScores: number;
    correctOutcomes: number;
    played: number;
    predictions: number;
    accuracy: number;
    countries: number;
  };
  history: SeasonHistoryItem[];
  badges: BadgeProgress[];
};

export type SeasonPayload = {
  leaderboard: LeaderboardEntry[];
  viewer: SeasonViewer | null;
};

function matchOutcome(homeScore: number, awayScore: number) {
  return Math.sign(homeScore - awayScore);
}

function longestCorrectOutcomeStreak(history: SeasonHistoryItem[]) {
  let longest = 0;
  let current = 0;
  for (const item of [...history].filter((entry) => entry.score).sort((a, b) => a.kickoff - b.kickoff)) {
    current = item.score!.outcomePoints > 0 ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function backedWinningOutsider(item: SeasonHistoryItem) {
  if (!item.result || !item.score || item.score.outcomePoints === 0) return false;
  const actualOutcome = matchOutcome(item.result.homeScore, item.result.awayScore);
  if (!actualOutcome || item.homePosition === null || item.awayPosition === null) return false;
  return actualOutcome > 0
    ? item.homePosition > item.awayPosition
    : item.awayPosition > item.homePosition;
}

export function calculateBadgeProgress(history: SeasonHistoryItem[], earnedAt: Partial<Record<BadgeKey, number>> = {}): BadgeProgress[] {
  const progressByKey: Record<BadgeKey, number> = {
    bullseye: history.filter((item) => (item.score?.exactScorePoints || 0) > 0).length,
    "perfect-timing": history.filter((item) => (item.score?.firstScorerPoints || 0) > 0 && (item.score?.goalWindowPoints || 0) > 0).length,
    "on-fire": longestCorrectOutcomeStreak(history),
    "globe-trotter": new Set(history.map((item) => item.countryCode).filter(Boolean)).size,
    "the-wall": history.filter((item) => item.result
      && item.prediction.homeScore === 0 && item.prediction.awayScore === 0
      && item.result.homeScore === 0 && item.result.awayScore === 0).length,
    "against-the-odds": history.filter(backedWinningOutsider).length,
  };

  return BADGE_DEFINITIONS.map((definition) => ({
    ...definition,
    progress: Math.min(progressByKey[definition.key], definition.target),
    unlocked: progressByKey[definition.key] >= definition.target,
    earnedAt: earnedAt[definition.key] || null,
  }));
}
