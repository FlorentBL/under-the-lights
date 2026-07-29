CREATE TABLE `banned_users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`banned_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `banned_users_created_at_idx` ON `banned_users` (`created_at`);
