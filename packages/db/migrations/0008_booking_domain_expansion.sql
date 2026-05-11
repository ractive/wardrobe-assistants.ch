CREATE TABLE `booking_service_item` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`offer_version` integer NOT NULL,
	`service_id` text,
	`name` text NOT NULL,
	`description` text,
	`price_type` text NOT NULL,
	`unit_price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`hours_in_minutes` integer,
	`total` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `booking_service_item_booking_version_position_idx` ON `booking_service_item` (`booking_id`,`offer_version`,`position`);
--> statement-breakpoint
CREATE TABLE `booking_service_selection` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`service_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `booking_service_selection_booking_position_idx` ON `booking_service_selection` (`booking_id`,`position`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_type` text NOT NULL,
	`price` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_services`("id", "name", "description", "price_type", "price", "archived", "created_at", "updated_at") SELECT "id", "name", "description", "price_type", "price", "archived", "created_at", "updated_at" FROM `services`;--> statement-breakpoint
DROP TABLE `services`;--> statement-breakpoint
ALTER TABLE `__new_services` RENAME TO `services`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`date` integer NOT NULL,
	`venue` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'created' NOT NULL,
	`created_by` text,
	`offer_token` text NOT NULL,
	`offer_version` integer DEFAULT 0 NOT NULL,
	`last_offer_sent_at` integer,
	`accepted_at` integer,
	`invoiced_at` integer,
	`customer_name` text,
	`customer_email` text,
	`customer_phone` text,
	`start_time` text,
	`duration_hours` integer,
	`venue_name` text,
	`venue_city` text,
	`comment` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
-- Backfill from old bookings:
--   status:  draft -> created, published -> accepted, done -> accepted, cancelled -> cancelled
--   accepted_at: for published+done legacy rows, best-effort = bookings.date
--   invoiced_at: for legacy done rows, best-effort = bookings.date (iter-22 refines)
--   offer_token: synthesised v4-shaped UUID per row via randomblob/hex
--   offer_version: 0 for all legacy rows
INSERT INTO `__new_bookings` (
	"id", "name", "date", "venue", "notes", "status", "created_by",
	"offer_token", "offer_version", "last_offer_sent_at", "accepted_at", "invoiced_at",
	"customer_name", "customer_email", "customer_phone",
	"start_time", "duration_hours", "venue_name", "venue_city", "comment",
	"created_at", "updated_at"
)
SELECT
	"id",
	"name",
	"date",
	"venue",
	"notes",
	CASE "status"
		WHEN 'draft' THEN 'created'
		WHEN 'published' THEN 'accepted'
		WHEN 'done' THEN 'accepted'
		WHEN 'cancelled' THEN 'cancelled'
		ELSE 'created'
	END AS "status",
	"created_by",
	lower(hex(randomblob(4))) || '-' ||
		lower(hex(randomblob(2))) || '-4' ||
		substr(lower(hex(randomblob(2))), 2) || '-' ||
		substr('89ab', 1 + (abs(random()) % 4), 1) ||
		substr(lower(hex(randomblob(2))), 2) || '-' ||
		lower(hex(randomblob(6))) AS "offer_token",
	0 AS "offer_version",
	NULL AS "last_offer_sent_at",
	CASE WHEN "status" IN ('published', 'done') THEN "date" ELSE NULL END AS "accepted_at",
	CASE WHEN "status" = 'done' THEN "date" ELSE NULL END AS "invoiced_at",
	NULL AS "customer_name",
	NULL AS "customer_email",
	NULL AS "customer_phone",
	NULL AS "start_time",
	NULL AS "duration_hours",
	NULL AS "venue_name",
	NULL AS "venue_city",
	NULL AS "comment",
	"created_at",
	"updated_at"
FROM `bookings`;--> statement-breakpoint
DROP TABLE `bookings`;--> statement-breakpoint
ALTER TABLE `__new_bookings` RENAME TO `bookings`;--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_offer_token_unique` ON `bookings` (`offer_token`);
