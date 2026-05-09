CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text,
	`target_type` text,
	`metadata` text,
	`created_at` integer NOT NULL
);
