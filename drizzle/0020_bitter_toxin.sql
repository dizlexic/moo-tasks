ALTER TABLE `board_tokens` MODIFY COLUMN `token` text;--> statement-breakpoint
ALTER TABLE `board_tokens` ADD `token_digest` varchar(64);--> statement-breakpoint
ALTER TABLE `boards` ADD `mcp_token_digest` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `account_token_digest` varchar(64);--> statement-breakpoint
UPDATE `users` SET `account_token_digest` = SHA2(`account_token`, 256) WHERE `account_token` IS NOT NULL;--> statement-breakpoint
UPDATE `boards` SET `mcp_token_digest` = SHA2(`mcp_token`, 256) WHERE `mcp_token` IS NOT NULL;--> statement-breakpoint
UPDATE `board_tokens` SET `token_digest` = SHA2(`token`, 256) WHERE `token` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `board_tokens` ADD CONSTRAINT `board_tokens_token_digest_unique` UNIQUE(`token_digest`);--> statement-breakpoint
ALTER TABLE `boards` ADD CONSTRAINT `boards_mcp_token_digest_unique` UNIQUE(`mcp_token_digest`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_account_token_digest_unique` UNIQUE(`account_token_digest`);--> statement-breakpoint
UPDATE `users` SET `account_token` = NULL WHERE `account_token` IS NOT NULL;--> statement-breakpoint
UPDATE `boards` SET `mcp_token` = NULL WHERE `mcp_token` IS NOT NULL;--> statement-breakpoint
UPDATE `board_tokens` SET `token` = NULL WHERE `token` IS NOT NULL;