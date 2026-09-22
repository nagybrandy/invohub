ALTER TABLE "invoice" ADD COLUMN "client_zip_code" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "client_city" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "client_address" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "client_country" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "client_eu_vat_number" text;--> statement-breakpoint
ALTER TABLE "invoice_line_item" ADD COLUMN "unit" text;