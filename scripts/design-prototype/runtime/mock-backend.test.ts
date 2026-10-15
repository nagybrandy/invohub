// @ts-nocheck — exercises the plain-JS prototype runtime, which has no type declarations.
// scripts/design-prototype/runtime/mock-backend.test.js
// The prototype's mock API is what makes every screen clickable for a designer
// without a server — these tests pin the flows the demo depends on.
const { createBackend, PASSWORD } = require("./mock-backend");

const FIXED_NOW = new Date("2026-10-15T10:00:00.000Z");

function make() {
  const backend = createBackend({ now: () => FIXED_NOW });
  const call = (method, path, body) => {
    const res = backend.handle(method, path, body ? JSON.stringify(body) : null);
    return res;
  };
  return { backend, call };
}

function signIn(call, email = "anna@demo.invohub.hu") {
  return call("POST", "/api/auth/sign-in/email", { email, password: PASSWORD });
}

describe("mock backend — auth", () => {
  it("rejects API calls without a session", () => {
    const { call } = make();
    expect(call("GET", "/api/invoices").status).toBe(401);
    expect(call("GET", "/api/auth/get-session").body).toBeNull();
  });

  it("signs a demo user in and out", () => {
    const { call } = make();
    expect(call("POST", "/api/auth/sign-in/email", { email: "anna@demo.invohub.hu", password: "nope" }).status).toBe(401);
    const ok = signIn(call);
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe("anna@demo.invohub.hu");
    expect(call("GET", "/api/auth/get-session").body.user.name).toBe("Kovács Anna");
    call("POST", "/api/auth/sign-out");
    expect(call("GET", "/api/auth/get-session").body).toBeNull();
  });

  it("registers a new user with an empty account (no company yet)", () => {
    const { call } = make();
    const res = call("POST", "/api/auth/sign-up/email", { name: "Új Felhasználó", email: "uj@pelda.hu", password: "titok1234", signupRole: "entrepreneur" });
    expect(res.status).toBe(200);
    expect(call("GET", "/api/companies").body.company).toBeNull();
    expect(call("GET", "/api/invoices").body.total).toBe(0);
    expect(call("POST", "/api/auth/sign-up/email", { name: "X", email: "uj@pelda.hu", password: "titok1234" }).status).toBe(422);
  });
});

describe("mock backend — invoices", () => {
  it("lists a rich account with stats, filters and search", () => {
    const { call } = make();
    signIn(call);
    const all = call("GET", "/api/invoices?limit=100").body;
    expect(all.total).toBeGreaterThan(15);
    expect(all.stats.count).toBe(all.total);
    const overdue = call("GET", "/api/invoices?status=overdue").body;
    expect(overdue.invoices.every((i) => i.status === "overdue")).toBe(true);
    expect(call("GET", "/api/invoices?navFailed=1").body.total).toBe(1);
    expect(call("GET", "/api/invoices?search=zöld").body.invoices.every((i) => /zöld/i.test(i.clientName))).toBe(true);
  });

  it("numbers a new invoice on finalize and submits it to the (fake) NAV", () => {
    const { call } = make();
    signIn(call);
    const draft = call("POST", "/api/invoices", {
      documentType: "invoice", status: "draft", clientName: "Teszt Kft.", issueDate: "2026-10-15", dueDate: "2026-10-23", currency: "HUF",
      lineItems: [{ description: "Munka", quantity: 1, unitPrice: 10000, vatRate: 27 }],
    }).body.invoice;
    expect(draft.invoiceNumber).toBe("");
    const issued = call("PATCH", `/api/invoices/${draft.id}`, { ...draft, status: "unpaid" });
    expect(issued.body.invoice.invoiceNumber).toMatch(/^INV-2026-\d{5}$/);
    expect(issued.body.nav.submitted).toBe(true);
    expect(call("PATCH", `/api/invoices/${draft.id}`, { clientName: "X" }).status).toBe(409);
  });

  it("marks paid (partial then full), storno cancels the original, convert refuses a second time", () => {
    const { call } = make();
    signIn(call);
    const unpaid = call("GET", "/api/invoices/inv-demo-15").body.invoice; // HUF, 254 000 gross
    const partial = call("POST", `/api/invoices/${unpaid.id}/mark-paid`, { paidAmount: 1000 });
    expect(partial.body.invoice.status).toBe("partially_paid");
    const full = call("POST", `/api/invoices/${unpaid.id}/mark-paid`, { paidAmount: 1000000 });
    expect(full.body.invoice.status).toBe("paid");

    const storno = call("POST", `/api/invoices/${unpaid.id}/storno`);
    expect(storno.body.invoice.documentType).toBe("storno");
    expect(storno.body.invoice.lineItems[0].quantity).toBeLessThan(0);
    expect(call("GET", `/api/invoices/${unpaid.id}`).body.invoice.status).toBe("cancelled");
    expect(call("GET", `/api/invoices/${unpaid.id}/links`).body.stornoDocuments).toHaveLength(1);

    const proforma = call("GET", "/api/invoices?status=proforma").body.invoices.find((i) => i.documentType === "proforma" && i.id === "inv-demo-18");
    const converted = call("POST", `/api/invoices/${proforma.id}/convert`);
    expect(converted.body.invoice.status).toBe("draft");
    expect(converted.body.invoice.convertedFromInvoiceId).toBe(proforma.id);
    const again = call("POST", `/api/invoices/${proforma.id}/convert`);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("alreadyConverted");
  });

  it("serves a PDF for an invoice", () => {
    const { call } = make();
    signIn(call);
    const res = call("GET", "/api/invoices/inv-demo-01/pdf");
    expect(res.pdf.startsWith("%PDF-1.4")).toBe(true);
  });
});

describe("mock backend — the rest of the app", () => {
  it("dashboard summary matches the invoices", () => {
    const { call } = make();
    signIn(call);
    const s = call("GET", "/api/dashboard/summary").body.summary;
    expect(s.overdueCount).toBe(2);
    expect(s.navFailedCount).toBe(1);
    expect(s.recentInvoices).toHaveLength(5);
    expect(s.paidTotal).toBeGreaterThan(0);
  });

  it("CRUDs partners and products, creates receipts and marks notifications read", () => {
    const { call } = make();
    signIn(call);
    const before = call("GET", "/api/clients").body.clients.length;
    const created = call("POST", "/api/clients", { name: "Új Partner Kft." }).body.client;
    expect(call("GET", "/api/clients").body.clients).toHaveLength(before + 1);
    expect(call("PATCH", `/api/clients/${created.id}`, { city: "Eger" }).body.client.city).toBe("Eger");
    call("DELETE", `/api/clients/${created.id}`);
    expect(call("GET", "/api/clients").body.clients).toHaveLength(before);

    const rc = call("POST", "/api/receipts", { paymentMethod: "cash", lineItems: [{ description: "Kávé", quantity: 2, unitPrice: 500, vatRate: 27 }] }).body.receipt;
    expect(rc.totalAmount).toBe(1270);
    expect(rc.receiptNumber).toMatch(/^NYG-2026-/);

    const notes = call("GET", "/api/notifications?sync=1").body;
    expect(notes.unreadCount).toBeGreaterThan(0);
    call("POST", "/api/notifications/read-all");
    expect(call("GET", "/api/notifications").body.unreadCount).toBe(0);
  });

  it("only an admin can open the admin panel", () => {
    const { call } = make();
    signIn(call);
    expect(call("GET", "/api/admin/users").status).toBe(403);
    signIn(call, "admin@demo.invohub.hu");
    const admin = call("GET", "/api/admin/users");
    expect(admin.status).toBe(200);
    expect(admin.body.users.length).toBeGreaterThanOrEqual(4);
  });

  it("persists to storage and survives a reload", () => {
    const store = {};
    const storage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
    const a = createBackend({ now: () => FIXED_NOW, storage });
    a.handle("POST", "/api/auth/sign-in/email", JSON.stringify({ email: "anna@demo.invohub.hu", password: PASSWORD }));
    a.handle("POST", "/api/clients", JSON.stringify({ name: "Megmaradó Kft." }));
    const b = createBackend({ now: () => FIXED_NOW, storage });
    expect(b.handle("GET", "/api/auth/get-session").body.user.email).toBe("anna@demo.invohub.hu");
    expect(b.handle("GET", "/api/clients").body.clients.some((c) => c.name === "Megmaradó Kft.")).toBe(true);
  });
});
