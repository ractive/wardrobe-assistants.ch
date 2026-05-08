CREATE TABLE `user_profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`nickname` text,
	`mobile_number` text,
	`role` text NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`invited_at` integer NOT NULL,
	`verified_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
