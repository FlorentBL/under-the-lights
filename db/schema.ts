import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const predictions = sqliteTable("predictions", {
  id: text("id").primaryKey(),
  participantId: text("participant_id").notNull().references(() => participants.id),
  matchId: text("match_id").notNull(),
  homeScore: integer("home_score").notNull(),
  awayScore: integer("away_score").notNull(),
  firstScorer: text("first_scorer").notNull(),
  goalWindow: text("goal_window").notNull(),
  firstTeam: text("first_team").notNull(),
  submittedAt: integer("submitted_at").notNull(),
}, (table) => [
  uniqueIndex("prediction_participant_match_idx").on(table.participantId, table.matchId),
]);
