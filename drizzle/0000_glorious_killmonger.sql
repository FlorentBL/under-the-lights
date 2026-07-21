CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`match_id` text NOT NULL,
	`home_score` integer NOT NULL,
	`away_score` integer NOT NULL,
	`first_scorer` text NOT NULL,
	`goal_window` text NOT NULL,
	`first_team` text NOT NULL,
	`submitted_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prediction_participant_match_idx` ON `predictions` (`participant_id`,`match_id`);