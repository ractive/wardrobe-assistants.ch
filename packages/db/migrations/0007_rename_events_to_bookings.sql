-- iter-24: rename event → booking (identity-preserving, no data change)
ALTER TABLE `events` RENAME TO `bookings`;
--> statement-breakpoint
ALTER TABLE `event_assignments` RENAME TO `booking_assignments`;
--> statement-breakpoint
ALTER TABLE `booking_assignments` RENAME COLUMN `event_id` TO `booking_id`;
--> statement-breakpoint
UPDATE `audit_log` SET `target_type` = 'booking' WHERE `target_type` = 'event';
--> statement-breakpoint
UPDATE `audit_log` SET `target_type` = 'booking_assignment' WHERE `target_type` = 'event_assignment';
--> statement-breakpoint
UPDATE `audit_log` SET `action` = REPLACE(`action`, 'event.', 'booking.') WHERE `action` LIKE 'event.%';
