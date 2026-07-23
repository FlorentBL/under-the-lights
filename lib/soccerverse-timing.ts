export function resultMayBeAvailable(kickoff: number, now = Date.now()) {
  return now >= kickoff * 1000;
}
