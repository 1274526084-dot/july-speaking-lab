CREATE TABLE `speaking_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_name` text NOT NULL,
	`student_id` text NOT NULL,
	`class_name` text NOT NULL,
	`scene_id` text NOT NULL,
	`scene_title` text NOT NULL,
	`transcript` text NOT NULL,
	`coverage` integer NOT NULL,
	`confidence` integer,
	`duration_seconds` integer NOT NULL,
	`attempts` integer NOT NULL,
	`submitted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_submitted_at` ON `speaking_attempts` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_attempts_scene_id` ON `speaking_attempts` (`scene_id`);--> statement-breakpoint
CREATE INDEX `idx_attempts_student_id` ON `speaking_attempts` (`student_id`);--> statement-breakpoint
PRAGMA optimize;
