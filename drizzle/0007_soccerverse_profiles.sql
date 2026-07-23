CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`soccerverse_username` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_profiles_soccerverse_username_idx` ON `user_profiles` (`soccerverse_username`);
