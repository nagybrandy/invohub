CREATE TABLE "cron_run" (
	"id" text PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp NOT NULL,
	"status" text NOT NULL,
	"counts" jsonb,
	"error_summary" text,
	"alert_sent_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "cron_run_job_started_idx" ON "cron_run" USING btree ("job","started_at" DESC NULLS LAST);