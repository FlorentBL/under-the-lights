export type MatchEvent = {
  match_event_id: number;
  event_type: string;
  player_id: number;
  club_id: number;
  time: number;
  goal_type: string | null;
};

export function validGoals(events: MatchEvent[]) {
  const goals: MatchEvent[] = [];
  for (const event of [...events].sort((a, b) => a.match_event_id - b.match_event_id)) {
    if (event.event_type === "GOAL") goals.push(event);
    if (event.event_type === "GOALCANCELLED") {
      const index = goals.findLastIndex((goal) => goal.player_id === event.player_id
        && goal.club_id === event.club_id
        && goal.time === event.time);
      if (index >= 0) goals.splice(index, 1);
    }
  }
  return goals.sort((a, b) => a.time - b.time || a.match_event_id - b.match_event_id);
}
