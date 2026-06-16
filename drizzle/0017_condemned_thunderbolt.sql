CREATE TABLE `board_tokens` (
	`id` varchar(191) NOT NULL,
	`board_id` varchar(191) NOT NULL,
	`user_id` varchar(191) NOT NULL,
	`token` text NOT NULL,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `board_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `board_tokens` ADD CONSTRAINT `board_tokens_board_id_boards_id_fk` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `board_tokens` ADD CONSTRAINT `board_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;