// db/schema.ts
// Drizzle schema: Better Auth tables + InvoHub business domain.
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("entrepreneur"),
  // What the user picked at signup ("entrepreneur" | "accountant"), clamped
  // server-side (lib/auth-signup-role.ts) before it ever reaches `role`.
  // Informational only — never itself an authorization check.
  signupRole: text("signup_role").notNull().default("entrepreneur"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const company = pgTable(
  "company",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    taxNumber: text("tax_number"),
    euVatNumber: text("eu_vat_number"),
    address: text("address"),
    city: text("city"),
    zipCode: text("zip_code"),
    country: text("country").default("HU"),
    bankAccount: text("bank_account"),
    logoUrl: text("logo_url"),
    invoiceEmailTo: text("invoice_email_to"),
    invoiceEmailCc: text("invoice_email_cc"),
    navTechnicalUser: text("nav_technical_user"),
    // navTechnicalPassword, navXmlSignKey, navXmlChangeKey are stored
    // AES-256-GCM encrypted (see lib/nav/credentials.ts) when
    // NAV_CREDENTIALS_KEY is configured; legacy plaintext rows are still
    // read transparently.
    navTechnicalPassword: text("nav_technical_password"),
    navXmlSignKey: text("nav_xml_sign_key"),
    navXmlChangeKey: text("nav_xml_change_key"),
    navEnvironment: text("nav_environment").default("demo"),
    navReceiptSoftwareId: text("nav_receipt_software_id"),
    /** Alanyi adómentes (VAT-exempt sole trader) — new invoices default every line to AAM/0% VAT. */
    vatExempt: boolean("vat_exempt").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("company_user_id_idx").on(table.userId)]
);

export const client = pgTable(
  "client",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    taxNumber: text("tax_number"),
    euVatNumber: text("eu_vat_number"),
    address: text("address"),
    city: text("city"),
    zipCode: text("zip_code"),
    country: text("country"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("client_user_id_idx").on(table.userId),
    index("client_tax_number_idx").on(table.taxNumber),
  ]
);

export const product = pgTable(
  "product",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    vatRate: integer("vat_rate").notNull().default(27),
    currency: text("currency").notNull().default("EUR"),
    unit: text("unit"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("product_user_id_idx").on(table.userId)]
);

export const invoice = pgTable(
  "invoice",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => company.id, {
      onDelete: "set null",
    }),
    clientId: text("client_id").references(() => client.id, {
      onDelete: "set null",
    }),
    /**
     * Empty string until the document is finalized (any status other than
     * "draft"): numbers are assigned atomically from document_sequence so a
     * duplicated or still-editing draft never reserves/burns a number.
     */
    invoiceNumber: text("invoice_number").notNull().default(""),
    /** Drives the numbering prefix (INV-/DBK-/ELO-) and NAV document kind. */
    documentType: text("document_type").notNull().default("invoice"),
    clientName: text("client_name").notNull(),
    clientTaxNumber: text("client_tax_number"),
    /**
     * Buyer address SNAPSHOT as of issuance (Áfa tv. 169. § e) requires the
     * buyer's name AND address on the document itself) — captured from the
     * composer/v1 payload at save time, never re-derived from the linked
     * client, which may move afterwards. Nullable/additive: older invoices
     * saved before this column existed have none, so PDF/preview generation
     * falls back to the linked client row for those (see
     * lib/invoices/build-pdf-context.ts).
     */
    clientZipCode: text("client_zip_code"),
    clientCity: text("client_city"),
    clientAddress: text("client_address"),
    clientCountry: text("client_country"),
    clientEuVatNumber: text("client_eu_vat_number"),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date").notNull(),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull().default("HUF"),
    /** Manual HUF exchange rate for non-HUF invoices (MNB rate fetch is a follow-up). */
    exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }),
    notes: text("notes"),
    paymentLink: text("payment_link"),
    /** transfer | cash | card | other — real column; older rows kept it inside notes. */
    paymentMethod: text("payment_method"),
    paidAt: timestamp("paid_at"),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }),
    /** Set on a storno document; the ORIGINAL invoice also flips to status "cancelled". */
    originalInvoiceId: text("original_invoice_id").references(
      (): AnyPgColumn => invoice.id,
      { onDelete: "set null" }
    ),
    /** Set on a helyesbítő (correction) document pointing back at what it modifies. */
    modifiesInvoiceId: text("modifies_invoice_id").references(
      (): AnyPgColumn => invoice.id,
      { onDelete: "set null" }
    ),
    /** 1-based count of corrections issued against the same original invoice. */
    modificationIndex: integer("modification_index"),
    /** Set on a számla created from a díjbekérő; points back at the proforma. */
    convertedFromInvoiceId: text("converted_from_invoice_id").references(
      (): AnyPgColumn => invoice.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("invoice_user_id_idx").on(table.userId),
    index("invoice_status_idx").on(table.status),
    index("invoice_issue_date_idx").on(table.issueDate),
    index("invoice_original_invoice_id_idx").on(table.originalInvoiceId),
    index("invoice_modifies_invoice_id_idx").on(table.modifiesInvoiceId),
    index("invoice_converted_from_invoice_id_idx").on(table.convertedFromInvoiceId),
    // Partial unique index: blank invoiceNumber (unfinalized drafts) never collides.
    uniqueIndex("invoice_user_number_unique_idx")
      .on(table.userId, table.invoiceNumber)
      .where(sql`${table.invoiceNumber} <> ''`),
    // Partial unique index: at most one *live* (non-cancelled) invoice may
    // point at a given díjbekérő as its conversion source. A cancelled
    // conversion (stornó'd) doesn't count, so a re-convert after storno is
    // allowed — this is the DB-level backstop for the check-then-act race
    // in app/api/invoices/[id]/convert+api.ts (F1).
    uniqueIndex("invoice_converted_from_live_unique_idx")
      .on(table.userId, table.convertedFromInvoiceId)
      .where(
        sql`${table.convertedFromInvoiceId} IS NOT NULL AND ${table.status} <> 'cancelled'`
      ),
  ]
);

export const invoiceLineItem = pgTable(
  "invoice_line_item",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 })
      .notNull()
      .default("1"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    /** Unit of measure (db/óra/nap/…) — nullable/additive, shown next to quantity on PDF/HTML. */
    unit: text("unit"),
    vatRate: integer("vat_rate").notNull().default(27),
    /** normal | AAM | TAM | KBAET | AHK | FAD | ATK — NAV VAT exemption/reverse-charge case. */
    vatCategory: text("vat_category").notNull().default("normal"),
    /** Human-readable exemption/reverse-charge reason shown on the PDF; auto-filled from vatCategory when unset. */
    vatExemptionReason: text("vat_exemption_reason"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("invoice_line_item_invoice_id_idx").on(table.invoiceId)]
);

export const documentSequence = pgTable(
  "document_sequence",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** invoice | proforma | advance — storno/modify documents share the "invoice" bucket. */
    docType: text("doc_type").notNull(),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.docType, table.year] }),
  ]
);

export const navSubmission = pgTable(
  "nav_submission",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    // NAV mode used at submission time: "demo" | "test" | "production".
    mode: text("mode").notNull().default("demo"),
    transactionId: text("transaction_id"),
    errorMessage: text("error_message"),
    // JSON-stringified string[] of the latest technical/business validation
    // messages from queryTransactionStatus (status timeline).
    messages: text("messages"),
    checkedAt: timestamp("checked_at"),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("nav_submission_invoice_id_idx").on(table.invoiceId)]
);

export const invoicePdfTemplate = pgTable(
  "invoice_pdf_template",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    titleText: text("title_text").notNull().default("INVOICE"),
    accentColor: text("accent_color").notNull().default("#4f46e5"),
    showCompanyBlock: boolean("show_company_block").notNull().default(true),
    showBankDetails: boolean("show_bank_details").notNull().default(true),
    showClientTaxNumber: boolean("show_client_tax_number").notNull().default(true),
    footerText: text("footer_text").default("Thank you for your business."),
    notesLabel: text("notes_label").notNull().default("Notes"),
    fontScale: text("font_scale").notNull().default("medium"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("invoice_pdf_template_user_id_idx").on(table.userId)]
);

export const emailTemplate = pgTable(
  "email_template",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    bodyText: text("body_text"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("email_template_user_id_idx").on(table.userId),
    index("email_template_type_idx").on(table.type),
  ]
);

export const paymentReminderSchedule = pgTable(
  "payment_reminder_schedule",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").references(() => invoice.id, {
      onDelete: "cascade",
    }),
    intervalDays: integer("interval_days").notNull().default(7),
    maxReminders: integer("max_reminders").notNull().default(3),
    remindersSent: integer("reminders_sent").notNull().default(0),
    lastSentAt: timestamp("last_sent_at"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("payment_reminder_user_id_idx").on(table.userId),
    index("payment_reminder_invoice_id_idx").on(table.invoiceId),
  ]
);

export const incomingInvoice = pgTable(
  "incoming_invoice",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    navInvoiceId: text("nav_invoice_id"),
    supplierName: text("supplier_name").notNull(),
    supplierTaxNumber: text("supplier_tax_number"),
    invoiceNumber: text("invoice_number").notNull(),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    currency: text("currency").notNull().default("HUF"),
    status: text("status").notNull().default("received"),
    rawPayload: text("raw_payload"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("incoming_invoice_user_id_idx").on(table.userId),
    index("incoming_invoice_issue_date_idx").on(table.issueDate),
  ]
);

export const receipt = pgTable(
  "receipt",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => company.id, {
      onDelete: "set null",
    }),
    receiptNumber: text("receipt_number").notNull(),
    clientName: text("client_name"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    currency: text("currency").notNull().default("HUF"),
    paymentMethod: text("payment_method").default("cash"),
    qrToken: text("qr_token").notNull().unique(),
    navSubmitted: boolean("nav_submitted").notNull().default(false),
    issuedAt: timestamp("issued_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("receipt_user_id_idx").on(table.userId),
    index("receipt_issued_at_idx").on(table.issuedAt),
  ]
);

export const receiptLineItem = pgTable(
  "receipt_line_item",
  {
    id: text("id").primaryKey(),
    receiptId: text("receipt_id")
      .notNull()
      .references(() => receipt.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 })
      .notNull()
      .default("1"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    vatRate: integer("vat_rate").notNull().default(27),
    unit: text("unit").default("db"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("receipt_line_item_receipt_id_idx").on(table.receiptId)]
);

export const navReceiptSubmission = pgTable(
  "nav_receipt_submission",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => company.id, {
      onDelete: "set null",
    }),
    reportDate: text("report_date").notNull(),
    status: text("status").notNull().default("pending"),
    // Number of submission attempts made for this row (retry-in-place
    // increments it instead of inserting a new row for the same
    // companyId/reportDate — see lib/nav-receipt/daily-report-run.ts).
    // Existing rows default to 0, which reads correctly as "never
    // retried by the new code path".
    attemptCount: integer("attempt_count").notNull().default(0),
    transactionId: text("transaction_id"),
    receiptCount: integer("receipt_count").notNull().default(0),
    cancelledCount: integer("cancelled_count").notNull().default(0),
    startReceiptNumber: text("start_receipt_number"),
    endReceiptNumber: text("end_receipt_number"),
    vatBreakdown: text("vat_breakdown"),
    errorMessage: text("error_message"),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("nav_receipt_sub_user_id_idx").on(table.userId),
    index("nav_receipt_sub_date_idx").on(table.reportDate),
    index("nav_receipt_sub_status_idx").on(table.status),
    // Not a UNIQUE constraint — the manual submit route and (on the
    // unmerged slice/e-nyugta-nav-receipt-api) blocked non-HUF
    // currency-group rows legitimately write more than one row per
    // (company, date). The idempotency guarantee is enforced in
    // lib/nav-receipt/daily-report-run.ts and proven by its tests; this
    // index just keeps that lookup cheap.
    index("nav_receipt_sub_company_date_idx").on(table.companyId, table.reportDate),
  ]
);

export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    referenceKey: text("reference_key"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("notification_user_id_idx").on(table.userId),
    index("notification_read_idx").on(table.read),
    index("notification_reference_key_idx").on(table.referenceKey),
  ]
);

export const apiKey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    publicKey: text("public_key").notNull().unique(),
    secretHash: text("secret_hash").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("api_key_user_id_idx").on(table.userId),
    index("api_key_public_key_idx").on(table.publicKey),
  ]
);

/**
 * Idempotency-Key replay store for the state-creating v1 endpoints (create,
 * finalize, storno, modify, convert, send — see lib/api/idempotency.ts). A
 * row is scoped to (userId, key); the same pair with a matching
 * requestHash replays responseStatus/responseBody, a mismatching hash is a
 * 422, and a row older than 24h is treated as expired (lib/api/idempotency.ts
 * deletes it before recording a fresh attempt).
 */
export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    // Both null while the first request holding this key is still running
    // (claimed, not yet completed) — see lib/api/idempotency.ts.
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idempotency_key_user_key_unique_idx").on(table.userId, table.key),
    index("idempotency_key_created_at_idx").on(table.createdAt),
  ]
);

/**
 * Cached MNB (Magyar Nemzeti Bank) official HUF exchange rates — see
 * lib/exchange-rates/mnb.ts (SOAP fetch/parse) and lib/exchange-rates/
 * service.ts (cache-first lookup with the "latest published on or before
 * date" rule). Not user-scoped: the same official rate applies to every
 * user, so there's exactly one row per (currency, rate_date). A past date's
 * rate never changes once published, so a row is cached forever; a missing
 * row is never a cached "not found" — it just means we haven't fetched (or
 * MNB hasn't published) that day yet, so the next lookup tries again.
 */
export const exchangeRate = pgTable(
  "exchange_rate",
  {
    id: text("id").primaryKey(),
    /** ISO 4217 code, e.g. "EUR" — HUF itself is never stored (always rate 1). */
    currency: text("currency").notNull(),
    /** The MNB-published day this rate is for (YYYY-MM-DD), not necessarily the requested date. */
    rateDate: text("rate_date").notNull(),
    /** HUF per 1 unit of `currency` — already normalized by the MNB `unit` attribute (e.g. JPY/100). */
    rate: numeric("rate", { precision: 14, scale: 6 }).notNull(),
    source: text("source").notNull().default("MNB"),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("exchange_rate_currency_date_unique_idx").on(table.currency, table.rateDate),
  ]
);

export const schema = {
  user,
  session,
  account,
  verification,
  company,
  client,
  product,
  invoice,
  invoiceLineItem,
  documentSequence,
  navSubmission,
  invoicePdfTemplate,
  emailTemplate,
  paymentReminderSchedule,
  incomingInvoice,
  receipt,
  receiptLineItem,
  navReceiptSubmission,
  notification,
  apiKey,
  idempotencyKey,
  exchangeRate,
};
