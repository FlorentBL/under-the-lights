CREATE TABLE `comment_mutes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`muted_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comment_mutes_user_active_idx` ON `comment_mutes` (`user_id`,`revoked_at`);
