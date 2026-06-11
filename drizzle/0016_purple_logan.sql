CREATE TABLE `plan_tasks` (
	`id` varchar(191) NOT NULL,
	`plan_id` varchar(191) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`order` int NOT NULL DEFAULT 0,
	`difficulty` int,
	`is_human_only` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `plan_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` varchar(191) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`is_public` boolean NOT NULL DEFAULT false,
	`creator_id` varchar(191),
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `plan_tasks` ADD CONSTRAINT `plan_tasks_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plans` ADD CONSTRAINT `plans_creator_id_users_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;