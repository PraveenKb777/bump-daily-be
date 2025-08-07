CREATE TABLE `comment_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`vote_type` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comment_votes_comment` ON `comment_votes` (`comment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comment_votes_comment_id_user_id_unique` ON `comment_votes` (`comment_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`parent_id` text,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	`upvotes` integer DEFAULT 0,
	`downvotes` integer DEFAULT 0,
	`score` integer DEFAULT 0,
	`reply_count` integer DEFAULT 0,
	`depth` integer DEFAULT 0,
	`is_deleted` integer DEFAULT false,
	`deleted_by` text,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comments_post_created` ON `comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_comments_parent` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_author` ON `comments` (`author_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_score` ON `comments` (`score`);--> statement-breakpoint
CREATE INDEX `idx_comments_post_parent` ON `comments` (`post_id`,`parent_id`);--> statement-breakpoint
CREATE TABLE `communities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`member_count` integer DEFAULT 0,
	`post_count` integer DEFAULT 0,
	`is_private` integer DEFAULT false,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `communities_name_unique` ON `communities` (`name`);--> statement-breakpoint
CREATE INDEX `idx_communities_name` ON `communities` (`name`);--> statement-breakpoint
CREATE TABLE `community_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`community_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` text NOT NULL,
	`role` text DEFAULT 'member',
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_community_memberships_user` ON `community_memberships` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `community_memberships_community_id_user_id_unique` ON `community_memberships` (`community_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `post_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`vote_type` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_post_votes_post` ON `post_votes` (`post_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `post_votes_post_id_user_id_unique` ON `post_votes` (`post_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`type` text NOT NULL,
	`url` text,
	`community_id` text NOT NULL,
	`author_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	`upvotes` integer DEFAULT 0,
	`downvotes` integer DEFAULT 0,
	`score` integer DEFAULT 0,
	`comment_count` integer DEFAULT 0,
	`is_deleted` integer DEFAULT false,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_posts_community_created` ON `posts` (`community_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_posts_score` ON `posts` (`score`);--> statement-breakpoint
CREATE INDEX `idx_posts_author` ON `posts` (`author_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`username` text,
	`avatar` text,
	`bio` text,
	`phone` text,
	`company` text,
	`position` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_unique` ON `profiles` (`username`);--> statement-breakpoint
CREATE TABLE `temp_files` (
	`id` text PRIMARY KEY NOT NULL,
	`is_used` integer DEFAULT false,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`assigned_at` text DEFAULT 'auto' NOT NULL,
	`assigned_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);