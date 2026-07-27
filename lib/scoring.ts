export const NO_GOAL = "no-goal";

export const SCORING_RULES = {
  outcome: 3,
  exactScore: 5,
  firstScorer: 4,
  goalWindow: 2,
  firstTeam: 1,
} as const;

export const MAX_PREDICTION_POINTS = Object.values(SCORING_RULES).reduce((total, value) => total + value, 0);

export const GOAL_WINDOWS = ["1-15", "16-30", "31-45+", "46-60", "61-75", "76-90+", NO_GOAL] as const;
export type GoalWindow = typeof GOAL_WINDOWS[number];

export type ScorablePrediction = {
  homeScore: number;
  awayScore: number;
  firstScorer: string;
  goalWindow: GoalWindow;
  firstTeam: string;
};

export type MatchResult = {
  homeScore: number;
  awayScore: number;
  firstScorer: string;
  goalWindow: GoalWindow;
  firstTeam: string;
};

export type ScoreBreakdown = {
  outcomePoints: number;
  exactScorePoints: number;
  firstScorerPoints: number;
  goalWindowPoints: number;
  firstTeamPoints: number;
  totalPoints: number;
};

export type PredictionConsistencyContext = {
  homeClubId: string;
  awayClubId: string;
  firstScorerClubId?: string | null;
};

export function allowedFirstTeams(
  homeScore: number,
  awayScore: number,
  homeClubId: string,
  awayClubId: string,
) {
  if (homeScore + awayScore === 0) return [NO_GOAL];
  return [
    ...(homeScore > 0 ? [homeClubId] : []),
    ...(awayScore > 0 ? [awayClubId] : []),
  ];
}

function outcome(homeScore: number, awayScore: number) {
  return Math.sign(homeScore - awayScore);
}

export function goalWindowForMinute(minute: number): GoalWindow {
  if (!Number.isFinite(minute) || minute < 1) throw new Error("Goal minute must be a positive number");
  if (minute <= 15) return "1-15";
  if (minute <= 30) return "16-30";
  if (minute <= 45) return "31-45+";
  if (minute <= 60) return "46-60";
  if (minute <= 75) return "61-75";
  return "76-90+";
}

export function scorePrediction(prediction: ScorablePrediction, result: MatchResult): ScoreBreakdown {
  const outcomePoints = outcome(prediction.homeScore, prediction.awayScore) === outcome(result.homeScore, result.awayScore)
    ? SCORING_RULES.outcome
    : 0;
  const exactScorePoints = prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore
    ? SCORING_RULES.exactScore
    : 0;
  const firstScorerPoints = prediction.firstScorer === result.firstScorer ? SCORING_RULES.firstScorer : 0;
  const goalWindowPoints = prediction.goalWindow === result.goalWindow ? SCORING_RULES.goalWindow : 0;
  const firstTeamPoints = prediction.firstTeam === result.firstTeam ? SCORING_RULES.firstTeam : 0;

  return {
    outcomePoints,
    exactScorePoints,
    firstScorerPoints,
    goalWindowPoints,
    firstTeamPoints,
    totalPoints: outcomePoints + exactScorePoints + firstScorerPoints + goalWindowPoints + firstTeamPoints,
  };
}

export function validatePredictionConsistency(
  prediction: ScorablePrediction,
  context?: PredictionConsistencyContext,
) {
  const predictsGoals = prediction.homeScore + prediction.awayScore > 0;
  const noGoalDetails = prediction.firstScorer === NO_GOAL
    && prediction.goalWindow === NO_GOAL
    && prediction.firstTeam === NO_GOAL;

  if (!predictsGoals && !noGoalDetails) return "A 0-0 prediction must use the no-goal option for every goal detail";
  if (predictsGoals && (
    prediction.firstScorer === NO_GOAL
    || prediction.goalWindow === NO_GOAL
    || prediction.firstTeam === NO_GOAL
  )) return "A prediction with goals must include a scorer, a goal window and the first team to score";
  if (predictsGoals && context) {
    const allowedTeams = allowedFirstTeams(
      prediction.homeScore,
      prediction.awayScore,
      context.homeClubId,
      context.awayClubId,
    );
    if (!allowedTeams.includes(prediction.firstTeam)) {
      return "The first team to score must have at least one predicted goal";
    }
    if (context.firstScorerClubId && context.firstScorerClubId !== prediction.firstTeam) {
      return "The first goalscorer must play for the selected first team";
    }
  }
  return null;
}
