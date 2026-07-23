CREATE TABLE `settlement_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`result_found` integer DEFAULT false NOT NULL,
	`predictions_total` integer DEFAULT 0 NOT NULL,
	`predictions_scored` integer DEFAULT 0 NOT NULL,
	`error` text,
	`checked_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `settlement_checks_match_checked_idx` ON `settlement_checks` (`match_id`,`checked_at`);
--> statement-breakpoint
CREATE INDEX `settlement_checks_status_idx` ON `settlement_checks` (`status`);
