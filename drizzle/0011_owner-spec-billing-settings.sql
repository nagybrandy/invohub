ALTER TABLE "company" ADD COLUMN "tax_mode" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "vat_regime" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "hipa_mode" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "invoice_prefix" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "default_payment_method" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "default_payment_term_days" integer;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "default_currency" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "default_language" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "default_vat_rate" integer;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "default_note" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "invoice_line_item" ADD COLUMN "comment" text;--> statement-breakpoint
ALTER TABLE "receipt" ADD COLUMN "language" text;