CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE INDEX `app_settings_updated_at_idx` ON `app_settings` (`updated_at`);
