CREATE TABLE `match_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `match_comments_match_created_idx` ON `match_comments` (`match_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `match_comments_user_created_idx` ON `match_comments` (`user_id`,`created_at`);
