// lib/seed/demo-data.ts
// Populates a user account with rich demo data for beta feature testing.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  client,
  company,
  incomingInvoice,
  invoice,
  navReceiptSubmission,
  navSubmission,
  notification,
  paymentReminderSchedule,
  product,
  receipt,
  receiptLineItem,
} from "@/db/schema";
import { seedDefaultTemplates } from "@/lib/email/templates/service";
import { createId } from "@/lib/id";
import { seedDemoNotifications, syncNotificationsFromDomain } from "@/lib/notifications/service";
import type { Invoice } from "@/lib/invoices/types";
import { upsertInvoice } from "@/lib/invoices/service";

const DEMO_CLIENTS = [
  {
    name: "Tech Solutions Kft.",
    email: "szamlazas@techsolutions.hu",
    taxNumber: "12345678-2-41",
    address: "Váci út 1.",
    city: "Budapest",
    zipCode: "1134",
    country: "HU",
  },
  {
    name: "Green Energy Zrt.",
    email: "penzugy@greenenergy.hu",
    taxNumber: "23456789-2-13",
    address: "Fő utca 22.",
    city: "Szeged",
    zipCode: "6720",
    country: "HU",
  },
  {
    name: "Budapest Bistro Kft.",
    email: "info@budapesterbistro.hu",
    taxNumber: "34567890-2-05",
    address: "Andrássy út 45.",
    city: "Budapest",
    zipCode: "1061",
    country: "HU",
  },
  {
    name: "Nordic Trade Bt.",
    email: "billing@nordictrade.eu",
    taxNumber: "45678901-2-17",
    euVatNumber: "HU45678901",
    address: "Kossuth tér 3.",
    city: "Debrecen",
    zipCode: "4024",
    country: "HU",
  },
  {
    name: "Studio Pixel Kft.",
    email: "hello@studiopixel.hu",
    taxNumber: "56789012-2-29",
    address: "Rákóczi út 12.",
    city: "Győr",
    zipCode: "9021",
    country: "HU",
  },
  {
    name: "LogiTrans Zrt.",
    email: "finance@logitrans.hu",
    taxNumber: "67890123-2-31",
    address: "Ipari park 5.",
    city: "Miskolc",
    zipCode: "3525",
    country: "HU",
  },
  {
    name: "Fresh Market Kft.",
    email: "szamla@freshmarket.hu",
    taxNumber: "78901234-2-43",
    address: "Piac tér 1.",
    city: "Pécs",
    zipCode: "7621",
    country: "HU",
  },
  {
    name: "CloudNine SaaS Kft.",
    email: "ar@cloudnine.io",
    taxNumber: "89012345-2-55",
    address: "Infopark 2.",
    city: "Budapest",
    zipCode: "1117",
    country: "HU",
  },
];

const DEMO_PRODUCTS = [
  { name: "Web development (hourly)", unitPrice: 45, vatRate: 27, unit: "hour" },
  { name: "UI/UX design package", unitPrice: 1200, vatRate: 27, unit: "package" },
  { name: "Monthly bookkeeping", unitPrice: 85000, vatRate: 27, unit: "month", currency: "HUF" },
  { name: "Tax advisory session", unitPrice: 25000, vatRate: 27, unit: "session", currency: "HUF" },
  { name: "Server hosting", unitPrice: 29, vatRate: 27, unit: "month" },
  { name: "Consulting day", unitPrice: 350, vatRate: 27, unit: "day" },
  { name: "Logo design", unitPrice: 480, vatRate: 27, unit: "project" },
  { name: "Annual audit prep", unitPrice: 180000, vatRate: 27, unit: "project", currency: "HUF" },
  { name: "API integration", unitPrice: 2200, vatRate: 27, unit: "project" },
  { name: "Training workshop", unitPrice: 650, vatRate: 27, unit: "day" },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function buildInvoice(
  num: string,
  clientName: string,
  clientTax: string | undefined,
  status: Invoice["status"],
  issueOffset: number,
  dueOffset: number,
  currency: "EUR" | "HUF",
  lines: { desc: string; qty: number; price: number; vat: 0 | 5 | 27 }[]
): Invoice {
  const now = new Date().toISOString();
  return {
    id: createId(),
    invoiceNumber: num,
    clientName,
    clientTaxNumber: clientTax,
    issueDate: daysAgo(issueOffset),
    dueDate: daysAgo(dueOffset),
    status,
    currency,
    notes: status === "cancelled" ? "Storno reference invoice" : undefined,
    lineItems: lines.map((l) => ({
      id: createId(),
      description: l.desc,
      quantity: l.qty,
      unitPrice: l.price,
      vatRate: l.vat,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

export type SeedResult = {
  clients: number;
  products: number;
  invoices: number;
  receipts: number;
  incoming: number;
  receiptLineItems: number;
  navReceiptSubmissions: number;
};

export async function seedDemoData(userId: string): Promise<SeedResult> {
  const now = new Date();

  const existingInvoices = await db
    .select({ id: invoice.id })
    .from(invoice)
    .where(eq(invoice.userId, userId));

  for (const row of existingInvoices) {
    await db.delete(navSubmission).where(eq(navSubmission.invoiceId, row.id));
  }

  await db.delete(invoice).where(eq(invoice.userId, userId));
  await db.delete(client).where(eq(client.userId, userId));
  await db.delete(product).where(eq(product.userId, userId));
  await db.delete(navReceiptSubmission).where(eq(navReceiptSubmission.userId, userId));
  await db.delete(receipt).where(eq(receipt.userId, userId));
  await db.delete(incomingInvoice).where(eq(incomingInvoice.userId, userId));
  await db.delete(paymentReminderSchedule).where(eq(paymentReminderSchedule.userId, userId));
  await db.delete(notification).where(eq(notification.userId, userId));
  await db.delete(company).where(eq(company.userId, userId));

  const companyId = createId();
  await db.insert(company).values({
    id: companyId,
    userId,
    name: "InvoHub Demo Könyvelő Iroda Kft.",
    taxNumber: "12345678-2-41",
    euVatNumber: "HU12345678",
    address: "Váci út 10.",
    city: "Budapest",
    zipCode: "1132",
    country: "HU",
    bankAccount: "11773322-12345678-00000000",
    navTechnicalUser: "DEMO_TECH_USER",
    navTechnicalPassword: "demo-password-placeholder",
    navXmlSignKey: "demo-sign-key-placeholder",
    navEnvironment: "test",
    createdAt: now,
    updatedAt: now,
  });

  const clientIds: string[] = [];
  for (const c of DEMO_CLIENTS) {
    const id = createId();
    clientIds.push(id);
    await db.insert(client).values({
      id,
      userId,
      name: c.name,
      email: c.email,
      taxNumber: c.taxNumber,
      euVatNumber: c.euVatNumber ?? null,
      address: c.address,
      city: c.city,
      zipCode: c.zipCode,
      country: c.country,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const p of DEMO_PRODUCTS) {
    await db.insert(product).values({
      id: createId(),
      userId,
      name: p.name,
      description: `Demo product: ${p.name}`,
      unitPrice: String(p.unitPrice),
      vatRate: p.vatRate,
      currency: p.currency ?? "EUR",
      unit: p.unit,
      createdAt: now,
      updatedAt: now,
    });
  }

  const invoiceDefs: Invoice[] = [
    buildInvoice("INV-2026-001", DEMO_CLIENTS[0].name, DEMO_CLIENTS[0].taxNumber, "paid", 45, 15, "EUR", [
      { desc: "Web development (40h)", qty: 40, price: 45, vat: 27 },
    ]),
    buildInvoice("INV-2026-002", DEMO_CLIENTS[1].name, DEMO_CLIENTS[1].taxNumber, "sent", 20, -5, "EUR", [
      { desc: "UI/UX design package", qty: 1, price: 1200, vat: 27 },
    ]),
    buildInvoice("INV-2026-003", DEMO_CLIENTS[2].name, DEMO_CLIENTS[2].taxNumber, "overdue", 35, -10, "HUF", [
      { desc: "Monthly bookkeeping", qty: 1, price: 85000, vat: 27 },
    ]),
    buildInvoice("INV-2026-004", DEMO_CLIENTS[3].name, DEMO_CLIENTS[3].taxNumber, "draft", 3, 27, "EUR", [
      { desc: "Consulting day", qty: 2, price: 350, vat: 27 },
    ]),
    buildInvoice("INV-2026-005", DEMO_CLIENTS[4].name, DEMO_CLIENTS[4].taxNumber, "proforma", 7, 23, "EUR", [
      { desc: "Logo design", qty: 1, price: 480, vat: 27 },
    ]),
    buildInvoice("INV-2026-006", DEMO_CLIENTS[5].name, DEMO_CLIENTS[5].taxNumber, "sent", 12, 18, "EUR", [
      { desc: "API integration", qty: 1, price: 2200, vat: 27 },
    ]),
    buildInvoice("INV-2026-007", DEMO_CLIENTS[6].name, DEMO_CLIENTS[6].taxNumber, "paid", 60, 30, "HUF", [
      { desc: "Annual audit prep", qty: 1, price: 180000, vat: 27 },
    ]),
    buildInvoice("INV-2026-008", DEMO_CLIENTS[7].name, DEMO_CLIENTS[7].taxNumber, "draft", 1, 29, "EUR", [
      { desc: "Server hosting", qty: 12, price: 29, vat: 27 },
    ]),
    buildInvoice("INV-2026-009", DEMO_CLIENTS[0].name, DEMO_CLIENTS[0].taxNumber, "cancelled", 50, 20, "EUR", [
      { desc: "Web development (40h)", qty: -40, price: 45, vat: 27 },
    ]),
    buildInvoice("INV-2026-010", DEMO_CLIENTS[1].name, DEMO_CLIENTS[1].taxNumber, "sent", 8, 22, "EUR", [
      { desc: "Training workshop", qty: 1, price: 650, vat: 27 },
    ]),
    buildInvoice("INV-2026-011", DEMO_CLIENTS[2].name, DEMO_CLIENTS[2].taxNumber, "overdue", 40, -15, "HUF", [
      { desc: "Tax advisory session", qty: 2, price: 25000, vat: 27 },
    ]),
    buildInvoice("INV-2026-012", DEMO_CLIENTS[3].name, DEMO_CLIENTS[3].taxNumber, "paid", 25, 5, "EUR", [
      { desc: "Consulting day", qty: 3, price: 350, vat: 27 },
    ]),
  ];

  const savedIds: string[] = [];
  for (const inv of invoiceDefs) {
    const saved = await upsertInvoice(userId, inv);
    savedIds.push(saved.id);
  }

  await db.insert(navSubmission).values({
    id: createId(),
    invoiceId: savedIds[0],
    status: "accepted",
    transactionId: "NAV-DEMO-001",
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(navSubmission).values({
    id: createId(),
    invoiceId: savedIds[1],
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(paymentReminderSchedule).values({
    id: createId(),
    userId,
    invoiceId: savedIds[2],
    intervalDays: 7,
    maxReminders: 3,
    remindersSent: 1,
    lastSentAt: now,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(paymentReminderSchedule).values({
    id: createId(),
    userId,
    invoiceId: null,
    intervalDays: 14,
    maxReminders: 2,
    remindersSent: 0,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });

  const incomingRows = [
    {
      supplierName: "Office Supplies Kft.",
      supplierTaxNumber: "11111111-2-11",
      invoiceNumber: "BESZ-2026-0042",
      issueDate: daysAgo(10),
      dueDate: daysAgo(-5),
      totalAmount: "45200",
      currency: "HUF",
      status: "received",
    },
    {
      supplierName: "Telekom Magyarország Zrt.",
      supplierTaxNumber: "22222222-2-22",
      invoiceNumber: "TEL-2026-1188",
      issueDate: daysAgo(5),
      dueDate: daysAgo(25),
      totalAmount: "18990",
      currency: "HUF",
      status: "received",
    },
    {
      supplierName: "AWS EMEA SARL",
      supplierTaxNumber: "33333333-2-33",
      invoiceNumber: "AWS-2026-03",
      issueDate: daysAgo(2),
      totalAmount: "156.40",
      currency: "EUR",
      status: "received",
    },
    {
      supplierName: "Budapest Ingatlan Kft.",
      supplierTaxNumber: "44444444-2-44",
      invoiceNumber: "BER-2026-01",
      issueDate: daysAgo(30),
      dueDate: daysAgo(0),
      totalAmount: "285000",
      currency: "HUF",
      status: "paid",
    },
  ];

  for (const row of incomingRows) {
    await db.insert(incomingInvoice).values({
      id: createId(),
      userId,
      navInvoiceId: `NAV-IN-${createId().slice(0, 8)}`,
      supplierName: row.supplierName,
      supplierTaxNumber: row.supplierTaxNumber,
      invoiceNumber: row.invoiceNumber,
      issueDate: row.issueDate,
      dueDate: row.dueDate ?? null,
      totalAmount: row.totalAmount,
      currency: row.currency,
      status: row.status,
      createdAt: now,
      updatedAt: now,
    });
  }

  type ReceiptLineItemSeed = {
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    unit?: string;
  };

  const receiptRows: {
    receiptNumber: string;
    clientName: string | undefined;
    totalAmount: string;
    currency: string;
    paymentMethod: string;
    navSubmitted: boolean;
    issuedDaysAgo: number;
    lineItems: ReceiptLineItemSeed[];
  }[] = [
    {
      receiptNumber: "NYG-2026-001",
      clientName: "Walk-in customer",
      totalAmount: "12500",
      currency: "HUF",
      paymentMethod: "cash",
      navSubmitted: true,
      issuedDaysAgo: 5,
      lineItems: [
        { description: "Kávé", quantity: 2, unitPrice: 890, vatRate: 27, unit: "db" },
        { description: "Sütemény", quantity: 3, unitPrice: 1200, vatRate: 27, unit: "db" },
        { description: "Szendvics", quantity: 2, unitPrice: 2950, vatRate: 27, unit: "db" },
      ],
    },
    {
      receiptNumber: "NYG-2026-002",
      clientName: "Tech Solutions Kft.",
      totalAmount: "8900",
      currency: "HUF",
      paymentMethod: "card",
      navSubmitted: true,
      issuedDaysAgo: 4,
      lineItems: [
        { description: "IT support (1 óra)", quantity: 1, unitPrice: 8900, vatRate: 27, unit: "óra" },
      ],
    },
    {
      receiptNumber: "NYG-2026-003",
      clientName: "Conference attendee",
      totalAmount: "45000",
      currency: "HUF",
      paymentMethod: "transfer",
      navSubmitted: true,
      issuedDaysAgo: 3,
      lineItems: [
        { description: "Konferencia részvételi díj", quantity: 1, unitPrice: 35433, vatRate: 27, unit: "db" },
        { description: "Catering csomag", quantity: 1, unitPrice: 9567, vatRate: 27, unit: "db" },
      ],
    },
    {
      receiptNumber: "NYG-2026-004",
      clientName: "Green Energy Zrt.",
      totalAmount: "3200",
      currency: "EUR",
      paymentMethod: "card",
      navSubmitted: false,
      issuedDaysAgo: 1,
      lineItems: [
        { description: "Consulting session", quantity: 2, unitPrice: 1260, vatRate: 27, unit: "hour" },
        { description: "Travel expenses", quantity: 1, unitPrice: 680, vatRate: 27, unit: "db" },
      ],
    },
    {
      receiptNumber: "NYG-2026-005",
      clientName: undefined,
      totalAmount: "5600",
      currency: "HUF",
      paymentMethod: "cash",
      navSubmitted: false,
      issuedDaysAgo: 0,
      lineItems: [
        { description: "Vegyes kiskereskedelmi tétel", quantity: 1, unitPrice: 4409, vatRate: 27, unit: "db" },
        { description: "Műanyag tasak (5% ÁFA)", quantity: 2, unitPrice: 100, vatRate: 5, unit: "db" },
      ],
    },
    {
      receiptNumber: "NYG-2026-006",
      clientName: "Budapest Bistro Kft.",
      totalAmount: "28750",
      currency: "HUF",
      paymentMethod: "cash",
      navSubmitted: true,
      issuedDaysAgo: 7,
      lineItems: [
        { description: "Catering rendelés (50 fő)", quantity: 50, unitPrice: 453, vatRate: 27, unit: "adag" },
        { description: "Szállítási díj", quantity: 1, unitPrice: 6100, vatRate: 27, unit: "db" },
      ],
    },
    {
      receiptNumber: "NYG-2026-007",
      clientName: "Studio Pixel Kft.",
      totalAmount: "15900",
      currency: "HUF",
      paymentMethod: "card",
      navSubmitted: true,
      issuedDaysAgo: 10,
      lineItems: [
        { description: "Fotónyomtatás A3", quantity: 10, unitPrice: 1250, vatRate: 27, unit: "db" },
        { description: "Keretezés", quantity: 2, unitPrice: 1700, vatRate: 27, unit: "db" },
      ],
    },
    {
      receiptNumber: "NYG-2026-008",
      clientName: "Walk-in customer",
      totalAmount: "2100",
      currency: "HUF",
      paymentMethod: "cash",
      navSubmitted: false,
      issuedDaysAgo: 0,
      lineItems: [
        { description: "Espresso", quantity: 1, unitPrice: 690, vatRate: 27, unit: "db" },
        { description: "Croissant", quantity: 1, unitPrice: 850, vatRate: 27, unit: "db" },
        { description: "Ásványvíz 0.5l", quantity: 1, unitPrice: 560, vatRate: 27, unit: "db" },
      ],
    },
  ];

  const receiptIds: string[] = [];
  for (const row of receiptRows) {
    const receiptId = createId();
    receiptIds.push(receiptId);
    const issuedAt = new Date(now);
    issuedAt.setDate(issuedAt.getDate() - row.issuedDaysAgo);

    await db.insert(receipt).values({
      id: receiptId,
      userId,
      companyId,
      receiptNumber: row.receiptNumber,
      clientName: row.clientName ?? null,
      totalAmount: row.totalAmount,
      currency: row.currency,
      paymentMethod: row.paymentMethod,
      navSubmitted: row.navSubmitted,
      qrToken: createId(),
      issuedAt,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 0; i < row.lineItems.length; i++) {
      const li = row.lineItems[i];
      await db.insert(receiptLineItem).values({
        id: createId(),
        receiptId,
        description: li.description,
        quantity: String(li.quantity),
        unitPrice: String(li.unitPrice),
        vatRate: li.vatRate,
        unit: li.unit ?? "db",
        sortOrder: i,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  await db.insert(navReceiptSubmission).values({
    id: createId(),
    userId,
    companyId,
    reportDate: yesterdayStr,
    status: "accepted",
    transactionId: "NAV-REC-DEMO-001",
    receiptCount: 3,
    cancelledCount: 0,
    startReceiptNumber: "NYG-2026-001",
    endReceiptNumber: "NYG-2026-003",
    submittedAt: yesterdayDate,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(navReceiptSubmission).values({
    id: createId(),
    userId,
    companyId,
    reportDate: todayStr,
    status: "pending",
    receiptCount: 2,
    cancelledCount: 0,
    startReceiptNumber: "NYG-2026-004",
    endReceiptNumber: "NYG-2026-005",
    createdAt: now,
    updatedAt: now,
  });

  await seedDefaultTemplates(userId);
  await seedDemoNotifications(userId);
  await syncNotificationsFromDomain(userId);

  return {
    clients: DEMO_CLIENTS.length,
    products: DEMO_PRODUCTS.length,
    invoices: invoiceDefs.length,
    receipts: receiptRows.length,
    incoming: incomingRows.length,
    receiptLineItems: receiptRows.reduce((sum, r) => sum + r.lineItems.length, 0),
    navReceiptSubmissions: 2,
  };
}
