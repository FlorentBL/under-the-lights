ALTER TABLE `match_comments` ADD `updated_at` integer;
--> statement-breakpoint
ALTER TABLE `match_comments` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `match_comments` ADD `deleted_by` text;
