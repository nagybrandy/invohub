CREATE TABLE "exchange_rate" (
	"id" text PRIMARY KEY NOT NULL,
	"currency" text NOT NULL,
	"rate_date" text NOT NULL,
	"rate" numeric(14, 6) NOT NULL,
	"source" text DEFAULT 'MNB' NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rate_currency_date_unique_idx" ON "exchange_rate" USING btree ("currency","rate_date");