export type SoccerverseSquadPlayer = {
  player_id: number;
  club_id: number;
  retired?: boolean;
  loaned_to_club?: number | null;
};

export const SPOTLIGHT_SQUAD_REFRESH_MS = 6 * 60 * 60 * 1000;

export function activePlayerClubId(player: SoccerverseSquadPlayer) {
  const loanClubId = Number(player.loaned_to_club || 0);
  return Number.isFinite(loanClubId) && loanClubId > 0 ? loanClubId : Number(player.club_id);
}

export function playersAvailableForClub<T extends SoccerverseSquadPlayer>(players: T[] | undefined, clubId: number) {
  return (players || []).filter((player) => !player.retired && activePlayerClubId(player) === clubId);
}

export function shouldRefreshSpotlightSquad(
  playerCount: number,
  lastSyncedAt: number | null,
  kickoff: number,
  now: number,
) {
  if (now >= kickoff * 1000) return playerCount === 0;
  return playerCount === 0 || lastSyncedAt === null || lastSyncedAt <= now - SPOTLIGHT_SQUAD_REFRESH_MS;
}
