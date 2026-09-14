// lib/navigation.ts
// Typed route helpers until Expo Router regenerates route definitions.
import type { Href } from "expo-router";

export const routes = {
  home: "/" as Href,
  login: "/login" as Href,
  blog: "/blog" as Href,
  blogPost: (slug: string) => `/blog/${slug}` as Href,
  terms: "/aszf" as Href,
  privacy: "/adatkezeles" as Href,
  cookies: "/cookie-tajekoztato" as Href,
  imprint: "/impresszum" as Href,
  dashboard: "/dashboard" as Href,
  invoices: "/invoices" as Href,
  /** /invoices pre-filtered by status — dashboard KPI cards + next-actions link here (A4). */
  invoicesFiltered: (status: string) =>
    ({ pathname: "/invoices", params: { status } }) as Href,
  newInvoice: "/invoices/new" as Href,
  invoiceDetail: (id: string) => `/invoices/${id}` as Href,
  invoiceEdit: (id: string) => `/invoices/${id}/edit` as Href,
  clients: "/clients" as Href,
  newClient: "/clients/new" as Href,
  clientEdit: (id: string) => `/clients/${id}/edit` as Href,
  products: "/products" as Href,
  productEdit: (id: string) => `/products/${id}/edit` as Href,
  settings: "/settings" as Href,
  settingsCompany: "/settings/company" as Href,
  settingsTemplates: "/settings/templates" as Href,
  settingsPdf: "/settings/pdf" as Href,
  settingsReminders: "/settings/reminders" as Href,
  settingsApiKeys: "/settings/api-keys" as Href,
  import: "/import" as Href,
  receipts: "/receipts" as Href,
  newReceipt: "/receipts/new" as Href,
  receiptDetail: (id: string) => `/receipts/${id}` as Href,
  admin: "/admin" as Href,
  adminApiDocs: "/admin/api-docs" as Href,
  onboarding: "/onboarding" as Href,
} as const;

export type AppRoute = Href;
