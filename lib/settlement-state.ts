export type SettlementState = "open" | "waiting" | "result_received" | "scored";

type SettlementStateInput = {
  kickoff: number;
  now: number;
  resultFound: boolean;
  predictions: number;
  scores: number;
  lastCheckStatus?: string | null;
  lastCheckError?: string | null;
};

export function deriveSettlementState(input: SettlementStateInput) {
  const complete = input.resultFound && input.scores >= input.predictions;
  const status: SettlementState = complete
    ? "scored"
    : input.resultFound
      ? "result_received"
      : input.now < input.kickoff * 1000
        ? "open"
        : "waiting";

  let alert: string | null = null;
  if (input.lastCheckStatus === "failed") {
    alert = input.lastCheckError || "The latest Soccerverse result check failed.";
  } else if (!input.resultFound && input.now > (input.kickoff + 7 * 60) * 1000) {
    alert = "No Soccerverse result after the expected five-minute window.";
  } else if (input.resultFound && input.scores < input.predictions) {
    alert = `${input.predictions - input.scores} prediction${input.predictions - input.scores === 1 ? "" : "s"} still need scoring.`;
  }

  const nextCheckAt = status === "open"
    ? input.kickoff * 1000
    : status === "waiting" || status === "result_received"
      ? (Math.floor(input.now / 60_000) + 1) * 60_000
      : null;

  return { status, alert, nextCheckAt };
}
