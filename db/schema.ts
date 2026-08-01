import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("session_user_id_idx").on(table.userId)]);

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("account_user_id_idx").on(table.userId),
  uniqueIndex("account_provider_account_idx").on(table.providerId, table.accountId),
]);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const adminUsers = sqliteTable("admin_users", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  grantedBy: text("granted_by").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("admin_users_created_at_idx").on(table.createdAt)]);

export const bannedUsers = sqliteTable("banned_users", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  bannedBy: text("banned_by").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("banned_users_created_at_idx").on(table.createdAt)]);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("app_settings_updated_at_idx").on(table.updatedAt)]);

export const userProfiles = sqliteTable("user_profiles", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  soccerverseUsername: text("soccerverse_username").notNull(),
  avatarDataUrl: text("avatar_data_url"),
  datapackMode: text("datapack_mode").default("community").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("user_profiles_soccerverse_username_idx").on(table.soccerverseUsername)]);

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

export const radarRuns = sqliteTable("radar_runs", {
  id: text("id").primaryKey(),
  weekKey: text("week_key").notNull(),
  windowStart: integer("window_start").notNull(),
  windowEnd: integer("window_end").notNull(),
  status: text("status").notNull(),
  fixturesScanned: integer("fixtures_scanned").default(0).notNull(),
  countriesScanned: integer("countries_scanned").default(0).notNull(),
  createdBy: text("created_by").notNull(),
  error: text("error"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
}, (table) => [index("radar_runs_week_idx").on(table.weekKey)]);

export const spotlightCandidates = sqliteTable("spotlight_candidates", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => radarRuns.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull(),
  score: integer("score").notNull(),
  fixtureId: integer("fixture_id").notNull(),
  competitionId: integer("competition_id").notNull(),
  seasonId: integer("season_id").notNull(),
  kickoff: integer("kickoff").notNull(),
  countryCode: text("country_code").notNull(),
  competitionName: text("competition_name").notNull(),
  divisionLevel: integer("division_level").notNull(),
  homeClubId: integer("home_club_id").notNull(),
  awayClubId: integer("away_club_id").notNull(),
  homeName: text("home_name").notNull(),
  awayName: text("away_name").notNull(),
  homeLogoUrl: text("home_logo_url"),
  awayLogoUrl: text("away_logo_url"),
  homeColor: text("home_color"),
  awayColor: text("away_color"),
  homePosition: integer("home_position"),
  awayPosition: integer("away_position"),
  homePoints: integer("home_points"),
  awayPoints: integer("away_points"),
  homeRecord: text("home_record"),
  awayRecord: text("away_record"),
  homeManager: text("home_manager"),
  awayManager: text("away_manager"),
  homeStrength: integer("home_strength"),
  awayStrength: integer("away_strength"),
  reasons: text("reasons").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("spotlight_candidates_run_idx").on(table.runId),
  uniqueIndex("spotlight_candidates_run_fixture_idx").on(table.runId, table.fixtureId),
]);

export const spotlights = sqliteTable("spotlights", {
  id: text("id").primaryKey(),
  weekKey: text("week_key").notNull().unique(),
  candidateId: text("candidate_id").notNull().references(() => spotlightCandidates.id),
  status: text("status").default("published").notNull(),
  editorialTitle: text("editorial_title"),
  editorialSummary: text("editorial_summary"),
  publishedBy: text("published_by").notNull(),
  publishedAt: integer("published_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("spotlights_status_idx").on(table.status)]);

export const spotlightPlayers = sqliteTable("spotlight_players", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  playerId: integer("player_id").notNull(),
  clubId: integer("club_id").notNull(),
  playerName: text("player_name").notNull(),
  position: integer("position"),
  rating: integer("rating"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("spotlight_players_match_idx").on(table.matchId),
  uniqueIndex("spotlight_players_match_player_idx").on(table.matchId, table.playerId),
]);

export const matchResults = sqliteTable("match_results", {
  matchId: text("match_id").primaryKey(),
  fixtureId: integer("fixture_id").notNull().unique(),
  homeScore: integer("home_score").notNull(),
  awayScore: integer("away_score").notNull(),
  firstScorer: text("first_scorer").notNull(),
  firstGoalMinute: integer("first_goal_minute"),
  goalWindow: text("goal_window").notNull(),
  firstTeam: text("first_team").notNull(),
  sourceUpdatedAt: integer("source_updated_at").notNull(),
  settledAt: integer("settled_at").notNull(),
});

export const settlementChecks = sqliteTable("settlement_checks", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  source: text("source").notNull(),
  status: text("status").notNull(),
  resultFound: integer("result_found", { mode: "boolean" }).default(false).notNull(),
  predictionsTotal: integer("predictions_total").default(0).notNull(),
  predictionsScored: integer("predictions_scored").default(0).notNull(),
  error: text("error"),
  checkedAt: integer("checked_at").notNull(),
  completedAt: integer("completed_at"),
}, (table) => [
  index("settlement_checks_match_checked_idx").on(table.matchId, table.checkedAt),
  index("settlement_checks_status_idx").on(table.status),
]);

export const predictionScores = sqliteTable("prediction_scores", {
  predictionId: text("prediction_id").primaryKey().references(() => predictions.id, { onDelete: "cascade" }),
  outcomePoints: integer("outcome_points").notNull(),
  exactScorePoints: integer("exact_score_points").notNull(),
  firstScorerPoints: integer("first_scorer_points").notNull(),
  goalWindowPoints: integer("goal_window_points").notNull(),
  firstTeamPoints: integer("first_team_points").notNull(),
  totalPoints: integer("total_points").notNull(),
  scoredAt: integer("scored_at").notNull(),
}, (table) => [index("prediction_scores_total_idx").on(table.totalPoints)]);

export const participantBadges = sqliteTable("participant_badges", {
  id: text("id").primaryKey(),
  participantId: text("participant_id").notNull().references(() => participants.id, { onDelete: "cascade" }),
  badgeKey: text("badge_key").notNull(),
  earnedAt: integer("earned_at").notNull(),
}, (table) => [
  uniqueIndex("participant_badges_participant_key_idx").on(table.participantId, table.badgeKey),
  index("participant_badges_earned_idx").on(table.earnedAt),
]);

export const matchComments = sqliteTable("match_comments", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("match_comments_match_created_idx").on(table.matchId, table.createdAt),
  index("match_comments_user_created_idx").on(table.userId, table.createdAt),
]);
