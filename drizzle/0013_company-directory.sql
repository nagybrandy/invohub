CREATE TABLE "company_directory" (
	"tax_number_base" text PRIMARY KEY NOT NULL,
	"tax_number" text NOT NULL,
	"name" text NOT NULL,
	"zip_code" text,
	"city" text,
	"address" text,
	"country" text DEFAULT 'HU' NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
