-- iter-37 §F: reconcile venueName/venueCity columns.
-- 1. Back-fill `venue` from `venue_name` where `venue` is blank.
-- 2. Drop `venue_name`.
-- 3. Rename `venue_city` → `city`.
UPDATE `bookings` SET `venue` = COALESCE(NULLIF(`venue`, ''), `venue_name`) WHERE `venue` IS NULL OR `venue` = '';--> statement-breakpoint
ALTER TABLE `bookings` DROP COLUMN `venue_name`;--> statement-breakpoint
ALTER TABLE `bookings` RENAME COLUMN `venue_city` TO `city`;