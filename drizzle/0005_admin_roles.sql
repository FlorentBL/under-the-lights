CREATE TABLE `admin_users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`granted_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `admin_users_created_at_idx` ON `admin_users` (`created_at`);
