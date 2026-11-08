CREATE TABLE "api_rate_limit_bucket" (
	"bucket_key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_rate_limit_bucket_bucket_key_window_start_pk" PRIMARY KEY("bucket_key","window_start")
);
--> statement-breakpoint
CREATE INDEX "api_rate_limit_bucket_window_idx" ON "api_rate_limit_bucket" USING btree ("window_start");