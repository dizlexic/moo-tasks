CREATE INDEX `board_logs_board_created_idx` ON `board_logs` (`board_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `board_logs_created_idx` ON `board_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `comments_task_created_id_idx` ON `comments` (`task_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `tasks_board_status_order_task_id_idx` ON `tasks` (`board_id`,`status`,`order`,`board_task_id`);