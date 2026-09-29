ALTER TABLE "nav_submission" ADD COLUMN "reported_currency" text;--> statement-breakpoint
ALTER TABLE "nav_submission" ADD COLUMN "reported_exchange_rate" numeric(12, 6);--> statement-breakpoint
ALTER TABLE "nav_submission" ADD COLUMN "reported_vat_huf" numeric(14, 2);