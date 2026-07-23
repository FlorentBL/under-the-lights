export const MANAGER_ACTIVE_WINDOW_SECONDS = 14 * 24 * 60 * 60;

export function isManagerActive(lastActive: number | null | undefined, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!Number.isFinite(lastActive) || !lastActive || lastActive <= 0) return false;
  return nowSeconds - lastActive < MANAGER_ACTIVE_WINDOW_SECONDS;
}

export function hasTwoActiveManagers(
  homeManager: string | null,
  awayManager: string | null,
  activityByManager: ReadonlyMap<string, number>,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!homeManager || !awayManager) return false;
  return isManagerActive(activityByManager.get(homeManager.toLowerCase()), nowSeconds)
    && isManagerActive(activityByManager.get(awayManager.toLowerCase()), nowSeconds);
}
