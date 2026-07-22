CREATE TABLE `spotlight_players` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`player_id` integer NOT NULL,
	`club_id` integer NOT NULL,
	`player_name` text NOT NULL,
	`position` integer,
	`rating` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `spotlight_players_match_idx` ON `spotlight_players` (`match_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `spotlight_players_match_player_idx` ON `spotlight_players` (`match_id`,`player_id`);
--> statement-breakpoint
CREATE TABLE `match_results` (
	`match_id` text PRIMARY KEY NOT NULL,
	`fixture_id` integer NOT NULL,
	`home_score` integer NOT NULL,
	`away_score` integer NOT NULL,
	`first_scorer` text NOT NULL,
	`first_goal_minute` integer,
	`goal_window` text NOT NULL,
	`first_team` text NOT NULL,
	`source_updated_at` integer NOT NULL,
	`settled_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_results_fixture_id_unique` ON `match_results` (`fixture_id`);
--> statement-breakpoint
CREATE TABLE `prediction_scores` (
	`prediction_id` text PRIMARY KEY NOT NULL,
	`outcome_points` integer NOT NULL,
	`exact_score_points` integer NOT NULL,
	`first_scorer_points` integer NOT NULL,
	`goal_window_points` integer NOT NULL,
	`first_team_points` integer NOT NULL,
	`total_points` integer NOT NULL,
	`scored_at` integer NOT NULL,
	FOREIGN KEY (`prediction_id`) REFERENCES `predictions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `prediction_scores_total_idx` ON `prediction_scores` (`total_points`);
