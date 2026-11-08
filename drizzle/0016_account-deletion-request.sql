CREATE TABLE "account_deletion_request" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"billing_account_id" text NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"reason" text,
	"cancelled_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account_deletion_request" ADD CONSTRAINT "account_deletion_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_deletion_request" ADD CONSTRAINT "account_deletion_request_billing_account_id_user_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_deletion_request_user_idx" ON "account_deletion_request" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_request_open_idx" ON "account_deletion_request" USING btree ("billing_account_id") WHERE "account_deletion_request"."status" = 'requested';