CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"public_key" text NOT NULL,
	"secret_hash" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_public_key_unique" UNIQUE("public_key")
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"tax_number" text,
	"eu_vat_number" text,
	"address" text,
	"city" text,
	"zip_code" text,
	"country" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"tax_number" text,
	"eu_vat_number" text,
	"address" text,
	"city" text,
	"zip_code" text,
	"country" text DEFAULT 'HU',
	"bank_account" text,
	"logo_url" text,
	"invoice_email_to" text,
	"invoice_email_cc" text,
	"nav_technical_user" text,
	"nav_technical_password" text,
	"nav_xml_sign_key" text,
	"nav_xml_change_key" text,
	"nav_environment" text DEFAULT 'demo',
	"nav_receipt_software_id" text,
	"vat_exempt" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_sequence" (
	"user_id" text NOT NULL,
	"doc_type" text NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_sequence_user_id_doc_type_year_pk" PRIMARY KEY("user_id","doc_type","year")
);
--> statement-breakpoint
CREATE TABLE "email_template" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incoming_invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"nav_invoice_id" text,
	"supplier_name" text NOT NULL,
	"supplier_tax_number" text,
	"invoice_number" text NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"raw_payload" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_id" text,
	"client_id" text,
	"invoice_number" text DEFAULT '' NOT NULL,
	"document_type" text DEFAULT 'invoice' NOT NULL,
	"client_name" text NOT NULL,
	"client_tax_number" text,
	"issue_date" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"exchange_rate" numeric(12, 6),
	"notes" text,
	"payment_link" text,
	"payment_method" text,
	"paid_at" timestamp,
	"paid_amount" numeric(12, 2),
	"original_invoice_id" text,
	"modifies_invoice_id" text,
	"modification_index" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line_item" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"vat_rate" integer DEFAULT 27 NOT NULL,
	"vat_category" text DEFAULT 'normal' NOT NULL,
	"vat_exemption_reason" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_pdf_template" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title_text" text DEFAULT 'INVOICE' NOT NULL,
	"accent_color" text DEFAULT '#4f46e5' NOT NULL,
	"show_company_block" boolean DEFAULT true NOT NULL,
	"show_bank_details" boolean DEFAULT true NOT NULL,
	"show_client_tax_number" boolean DEFAULT true NOT NULL,
	"footer_text" text DEFAULT 'Thank you for your business.',
	"notes_label" text DEFAULT 'Notes' NOT NULL,
	"font_scale" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nav_receipt_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_id" text,
	"report_date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"transaction_id" text,
	"receipt_count" integer DEFAULT 0 NOT NULL,
	"cancelled_count" integer DEFAULT 0 NOT NULL,
	"start_receipt_number" text,
	"end_receipt_number" text,
	"vat_breakdown" text,
	"error_message" text,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nav_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"mode" text DEFAULT 'demo' NOT NULL,
	"transaction_id" text,
	"error_message" text,
	"messages" text,
	"checked_at" timestamp,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"reference_key" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_reminder_schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"invoice_id" text,
	"interval_days" integer DEFAULT 7 NOT NULL,
	"max_reminders" integer DEFAULT 3 NOT NULL,
	"reminders_sent" integer DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"vat_rate" integer DEFAULT 27 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"unit" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_id" text,
	"receipt_number" text NOT NULL,
	"client_name" text,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"payment_method" text DEFAULT 'cash',
	"qr_token" text NOT NULL,
	"nav_submitted" boolean DEFAULT false NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "receipt_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "receipt_line_item" (
	"id" text PRIMARY KEY NOT NULL,
	"receipt_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"vat_rate" integer DEFAULT 27 NOT NULL,
	"unit" text DEFAULT 'db',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'entrepreneur' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequence" ADD CONSTRAINT "document_sequence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template" ADD CONSTRAINT "email_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_invoice" ADD CONSTRAINT "incoming_invoice_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_original_invoice_id_invoice_id_fk" FOREIGN KEY ("original_invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_modifies_invoice_id_invoice_id_fk" FOREIGN KEY ("modifies_invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_item" ADD CONSTRAINT "invoice_line_item_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_pdf_template" ADD CONSTRAINT "invoice_pdf_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_receipt_submission" ADD CONSTRAINT "nav_receipt_submission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_receipt_submission" ADD CONSTRAINT "nav_receipt_submission_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_submission" ADD CONSTRAINT "nav_submission_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminder_schedule" ADD CONSTRAINT "payment_reminder_schedule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminder_schedule" ADD CONSTRAINT "payment_reminder_schedule_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_line_item" ADD CONSTRAINT "receipt_line_item_receipt_id_receipt_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_key_user_id_idx" ON "api_key" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_key_public_key_idx" ON "api_key" USING btree ("public_key");--> statement-breakpoint
CREATE INDEX "client_user_id_idx" ON "client" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "client_tax_number_idx" ON "client" USING btree ("tax_number");--> statement-breakpoint
CREATE INDEX "company_user_id_idx" ON "company" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_template_user_id_idx" ON "email_template" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_template_type_idx" ON "email_template" USING btree ("type");--> statement-breakpoint
CREATE INDEX "incoming_invoice_user_id_idx" ON "incoming_invoice" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "incoming_invoice_issue_date_idx" ON "incoming_invoice" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "invoice_user_id_idx" ON "invoice" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoice_status_idx" ON "invoice" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoice_issue_date_idx" ON "invoice" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "invoice_original_invoice_id_idx" ON "invoice" USING btree ("original_invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_modifies_invoice_id_idx" ON "invoice" USING btree ("modifies_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_user_number_unique_idx" ON "invoice" USING btree ("user_id","invoice_number") WHERE "invoice"."invoice_number" <> '';--> statement-breakpoint
CREATE INDEX "invoice_line_item_invoice_id_idx" ON "invoice_line_item" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_pdf_template_user_id_idx" ON "invoice_pdf_template" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nav_receipt_sub_user_id_idx" ON "nav_receipt_submission" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nav_receipt_sub_date_idx" ON "nav_receipt_submission" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX "nav_receipt_sub_status_idx" ON "nav_receipt_submission" USING btree ("status");--> statement-breakpoint
CREATE INDEX "nav_submission_invoice_id_idx" ON "nav_submission" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "notification_user_id_idx" ON "notification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_read_idx" ON "notification" USING btree ("read");--> statement-breakpoint
CREATE INDEX "notification_reference_key_idx" ON "notification" USING btree ("reference_key");--> statement-breakpoint
CREATE INDEX "payment_reminder_user_id_idx" ON "payment_reminder_schedule" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_reminder_invoice_id_idx" ON "payment_reminder_schedule" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "product_user_id_idx" ON "product" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "receipt_user_id_idx" ON "receipt" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "receipt_issued_at_idx" ON "receipt" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "receipt_line_item_receipt_id_idx" ON "receipt_line_item" USING btree ("receipt_id");