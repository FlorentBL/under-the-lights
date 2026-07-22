CREATE TABLE `radar_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `week_key` text NOT NULL,
  `window_start` integer NOT NULL,
  `window_end` integer NOT NULL,
  `status` text NOT NULL,
  `fixtures_scanned` integer DEFAULT 0 NOT NULL,
  `countries_scanned` integer DEFAULT 0 NOT NULL,
  `created_by` text NOT NULL,
  `error` text,
  `created_at` integer NOT NULL,
  `completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `radar_runs_week_idx` ON `radar_runs` (`week_key`);
--> statement-breakpoint
CREATE TABLE `spotlight_candidates` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `rank` integer NOT NULL,
  `score` integer NOT NULL,
  `fixture_id` integer NOT NULL,
  `competition_id` integer NOT NULL,
  `season_id` integer NOT NULL,
  `kickoff` integer NOT NULL,
  `country_code` text NOT NULL,
  `competition_name` text NOT NULL,
  `division_level` integer NOT NULL,
  `home_club_id` integer NOT NULL,
  `away_club_id` integer NOT NULL,
  `home_name` text NOT NULL,
  `away_name` text NOT NULL,
  `home_position` integer,
  `away_position` integer,
  `home_points` integer,
  `away_points` integer,
  `home_record` text,
  `away_record` text,
  `home_manager` text,
  `away_manager` text,
  `home_strength` integer,
  `away_strength` integer,
  `reasons` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `radar_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `spotlight_candidates_run_idx` ON `spotlight_candidates` (`run_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `spotlight_candidates_run_fixture_idx` ON `spotlight_candidates` (`run_id`,`fixture_id`);
--> statement-breakpoint
CREATE TABLE `spotlights` (
  `id` text PRIMARY KEY NOT NULL,
  `week_key` text NOT NULL,
  `candidate_id` text NOT NULL,
  `status` text DEFAULT 'published' NOT NULL,
  `editorial_title` text,
  `editorial_summary` text,
  `published_by` text NOT NULL,
  `published_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`candidate_id`) REFERENCES `spotlight_candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spotlights_week_key_unique` ON `spotlights` (`week_key`);
--> statement-breakpoint
CREATE INDEX `spotlights_status_idx` ON `spotlights` (`status`);
