CREATE TABLE `board_task_counters` (
	`board_id` varchar(191) NOT NULL,
	`last_task_id` int NOT NULL DEFAULT 0,
	CONSTRAINT `board_task_counters_board_id` PRIMARY KEY(`board_id`)
);
--> statement-breakpoint
-- Keep the oldest task's existing board ID; move only duplicate IDs above the board's current maximum.
WITH ranked_duplicates AS (
	SELECT `id`, `board_id`, `board_task_id`,
		ROW_NUMBER() OVER (PARTITION BY `board_id`, `board_task_id` ORDER BY `created_at`, `id`) AS `duplicate_rank`
	FROM `tasks`
	WHERE (`board_id`, `board_task_id`) IN (
		SELECT `board_id`, `board_task_id`
		FROM (SELECT `board_id`, `board_task_id` FROM `tasks` GROUP BY `board_id`, `board_task_id` HAVING COUNT(*) > 1) AS `duplicate_keys`
	)
), duplicate_rows AS (
	SELECT `id`, `board_id`,
		ROW_NUMBER() OVER (PARTITION BY `board_id` ORDER BY `board_task_id`, `created_at`, `id`) AS `new_id_offset`
	FROM ranked_duplicates
	WHERE `duplicate_rank` > 1
), board_maxima AS (
	SELECT `board_id`, MAX(`board_task_id`) AS `max_board_task_id`
	FROM `tasks`
	GROUP BY `board_id`
)
UPDATE `tasks` AS task
JOIN duplicate_rows AS duplicate ON duplicate.`id` = task.`id`
JOIN board_maxima AS maxima ON maxima.`board_id` = task.`board_id`
SET task.`board_task_id` = maxima.`max_board_task_id` + duplicate.`new_id_offset`;
--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_board_id_board_task_id_unique` UNIQUE(`board_id`,`board_task_id`);--> statement-breakpoint
INSERT INTO `board_task_counters` (`board_id`, `last_task_id`)
SELECT `board_id`, MAX(`board_task_id`) FROM `tasks` GROUP BY `board_id`;--> statement-breakpoint
ALTER TABLE `board_task_counters` ADD CONSTRAINT `board_task_counters_board_id_boards_id_fk` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE cascade ON UPDATE no action;