CREATE TABLE "recurring_invoice_run" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"user_id" text NOT NULL,
	"period_key" text NOT NULL,
	"invoice_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoice_template" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"source_invoice_id" text,
	"client_id" text,
	"client_name" text NOT NULL,
	"client_tax_number" text,
	"client_zip_code" text,
	"client_city" text,
	"client_address" text,
	"client_country" text,
	"client_eu_vat_number" text,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"language" text,
	"payment_method" text,
	"payment_term_days" integer DEFAULT 8 NOT NULL,
	"notes" text,
	"line_items" jsonb NOT NULL,
	"frequency" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"max_occurrences" integer,
	"next_index" integer DEFAULT 0 NOT NULL,
	"next_run_date" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_invoice_run" ADD CONSTRAINT "recurring_invoice_run_template_id_recurring_invoice_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_invoice_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_run" ADD CONSTRAINT "recurring_invoice_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_run" ADD CONSTRAINT "recurring_invoice_run_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_template" ADD CONSTRAINT "recurring_invoice_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_template" ADD CONSTRAINT "recurring_invoice_template_source_invoice_id_invoice_id_fk" FOREIGN KEY ("source_invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_template" ADD CONSTRAINT "recurring_invoice_template_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_invoice_run_period_unique_idx" ON "recurring_invoice_run" USING btree ("template_id","period_key");--> statement-breakpoint
CREATE INDEX "recurring_invoice_run_user_idx" ON "recurring_invoice_run" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_invoice_template_user_idx" ON "recurring_invoice_template" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_invoice_template_due_idx" ON "recurring_invoice_template" USING btree ("status","next_run_date");