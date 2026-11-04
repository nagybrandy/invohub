ALTER TABLE "invoice_pdf_template" ADD COLUMN "layout" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_pdf_template" ADD COLUMN "font_style" text DEFAULT 'invohub' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_pdf_template" ADD COLUMN "logo_mode" text DEFAULT 'monogram' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_pdf_template" ADD COLUMN "logo_size" text DEFAULT 'M' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_pdf_template" ADD COLUMN "logo_position" text DEFAULT 'left' NOT NULL;