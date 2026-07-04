// db/schema.ts
// Drizzle schema: Better Auth tables + InvoHub business domain.
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("entrepreneur"),
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
    navTechnicalPassword: text("nav_technical_password"),
    navXmlSignKey: text("nav_xml_sign_key"),
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
    invoiceNumber: text("invoice_number").notNull(),
    clientName: text("client_name").notNull(),
    clientTaxNumber: text("client_tax_number"),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date").notNull(),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull().default("EUR"),
    notes: text("notes"),
    paymentLink: text("payment_link"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("invoice_user_id_idx").on(table.userId),
    index("invoice_status_idx").on(table.status),
    index("invoice_issue_date_idx").on(table.issueDate),
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
    vatRate: integer("vat_rate").notNull().default(27),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("invoice_line_item_invoice_id_idx").on(table.invoiceId)]
);

export const navSubmission = pgTable(
  "nav_submission",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    transactionId: text("transaction_id"),
    errorMessage: text("error_message"),
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
    receiptNumber: text("receipt_number").notNull(),
    clientName: text("client_name"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    currency: text("currency").notNull().default("HUF"),
    qrToken: text("qr_token").notNull().unique(),
    issuedAt: timestamp("issued_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("receipt_user_id_idx").on(table.userId)]
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
  navSubmission,
  invoicePdfTemplate,
  emailTemplate,
  paymentReminderSchedule,
  incomingInvoice,
  receipt,
  notification,
  apiKey,
};
