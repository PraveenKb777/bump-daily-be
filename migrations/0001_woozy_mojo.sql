CREATE TABLE `temp_files` (
	`id` text PRIMARY KEY NOT NULL,
	`is_used` integer DEFAULT false,
	`created_at` text NOT NULL
);
