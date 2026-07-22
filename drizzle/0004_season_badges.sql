CREATE TABLE `participant_badges` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`badge_key` text NOT NULL,
	`earned_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_badges_participant_key_idx` ON `participant_badges` (`participant_id`,`badge_key`);
--> statement-breakpoint
CREATE INDEX `participant_badges_earned_idx` ON `participant_badges` (`earned_at`);
