// lib/nav/client.ts
// NAV Online Számla API client — sandbox stub.
export type NavCredentials = {
  technicalUser: string;
  xmlSignKey: string;
  taxNumber: string;
};

export type NavIncomingInvoiceStub = {
  navInvoiceId: string;
  supplierName: string;
  supplierTaxNumber: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  currency: string;
};

export async function fetchIncomingInvoices(
  _credentials: NavCredentials
): Promise<NavIncomingInvoiceStub[]> {
  // Sandbox mock data until NAV credentials are configured
  return [
    {
      navInvoiceId: "NAV-2026-001",
      supplierName: "Office Supplies Kft.",
      supplierTaxNumber: "11111111-1-11",
      invoiceNumber: "SUP-2026-042",
      issueDate: "2026-06-15",
      dueDate: "2026-07-15",
      totalAmount: 45000,
      currency: "HUF",
    },
    {
      navInvoiceId: "NAV-2026-002",
      supplierName: "Cloud Hosting Zrt.",
      supplierTaxNumber: "22222222-2-22",
      invoiceNumber: "CLD-8891",
      issueDate: "2026-06-20",
      dueDate: "2026-07-20",
      totalAmount: 12990,
      currency: "HUF",
    },
  ];
}

export async function submitInvoiceToNav(
  credentials: NavCredentials,
  invoiceXml: string
): Promise<{ transactionId: string; status: string }> {
  // MVP: forwards XML to NAV sandbox stub. Replace with real NAV Online Számla HTTP call.
  void credentials;
  void invoiceXml;

  return {
    transactionId: `NAV-TXN-${Date.now()}`,
    status: "accepted",
  };
}
