// scripts/design-prototype/runtime/mock-backend.js
// In-memory stand-in for InvoHub's /api/* (incl. Better Auth), used by the
// single-file design prototype. Plain ES5-ish JS with no imports so it can be
// inlined into the HTML as-is AND required from Jest (see mock-backend.test.js).
//
// Everything here is FAKE: users, companies, tax numbers, invoices. Nothing
// leaves the page; state lives in memory (+ optional storage for reloads).
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.InvoHubMock = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var PASSWORD = "demo1234";
  var STORAGE_KEY = "invohub-design-prototype-v1";

  // ---------------------------------------------------------------- helpers
  var idCounter = 0;
  function uid(prefix) {
    idCounter += 1;
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + idCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = "0" + s;
    return s;
  }
  function isoDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
  }
  function addDays(base, n) {
    var d = new Date(base.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }
  function clone(o) {
    return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  }
  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  function lineGross(li) {
    return li.quantity * li.unitPrice * (1 + (li.vatCategory && li.vatCategory !== "normal" ? 0 : li.vatRate) / 100);
  }
  function invoiceGross(inv) {
    return round2(inv.lineItems.reduce(function (s, li) { return s + lineGross(li); }, 0));
  }
  function invoiceVat(inv) {
    return round2(inv.lineItems.reduce(function (s, li) {
      var rate = li.vatCategory && li.vatCategory !== "normal" ? 0 : li.vatRate;
      return s + li.quantity * li.unitPrice * (rate / 100);
    }, 0));
  }

  // ------------------------------------------------------------- seed data
  function line(description, quantity, unitPrice, vatRate, unit) {
    return { id: uid("li"), description: description, quantity: quantity, unitPrice: unitPrice, vatRate: vatRate, vatCategory: "normal", unit: unit || "db" };
  }

  function buildCompany(userId, kind, now) {
    var base = {
      id: uid("co"),
      userId: userId,
      country: "HU",
      vatExempt: false,
      navTechnicalPasswordSet: true,
      navXmlSignKeySet: true,
      navXmlChangeKeySet: false,
      navTechnicalPasswordMasked: "••••••••",
      navXmlSignKeyMasked: "••••••••",
      navXmlChangeKeyMasked: null,
      navCredentialsConfigured: true,
      navEnvironment: "demo",
      defaultCurrency: "HUF",
      defaultPaymentMethod: "transfer",
      defaultPaymentTermDays: 8,
      createdAt: addDays(now, -120).toISOString(),
      updatedAt: addDays(now, -3).toISOString(),
    };
    if (kind === "accountant") {
      return Object.assign(base, {
        name: "Szabó & Társa Könyvelő Iroda Kft.",
        taxNumber: "24681357-2-43",
        euVatNumber: "HU24681357",
        address: "Andrássy út 58.",
        city: "Budapest",
        zipCode: "1062",
        bankAccount: "10918001-00000123-45670018",
        navTechnicalUser: "szabotars01",
      });
    }
    if (kind === "admin") {
      return Object.assign(base, {
        name: "InvoHub Demó Kft.",
        taxNumber: "13579246-2-41",
        euVatNumber: "HU13579246",
        address: "Váci út 10.",
        city: "Budapest",
        zipCode: "1132",
        bankAccount: "11773322-12345678-00000000",
        navTechnicalUser: "invohubdemo",
      });
    }
    return Object.assign(base, {
      name: "Kovács Anna e.v.",
      taxNumber: "66123456-1-33",
      euVatNumber: "HU66123456",
      address: "Bartók Béla út 21. 2/4.",
      city: "Budapest",
      zipCode: "1114",
      bankAccount: "10700024-12345678-51100005",
      navTechnicalUser: "kovacsanna01",
    });
  }

  var CLIENT_SEED = [
    ["Tech Solutions Kft.", "szamlazas@techsolutions.hu", "12345678-2-41", "Váci út 1.", "Budapest", "1134"],
    ["Zöld Energia Zrt.", "penzugy@zoldenergia.hu", "23456789-2-13", "Fő utca 22.", "Szeged", "6720"],
    ["Budapest Bistro Kft.", "info@budapestbistro.hu", "34567890-2-05", "Király utca 14.", "Budapest", "1061"],
    ["Nordic Trade Bt.", "billing@nordictrade.eu", "45678901-2-17", "Kossuth tér 3.", "Győr", "9021"],
    ["Pixel Műhely Kft.", "hello@pixelmuhely.hu", "56789012-2-29", "Petőfi Sándor utca 8.", "Debrecen", "4025"],
    ["LogiTrans Zrt.", "finance@logitrans.hu", "67890123-2-31", "Logisztikai park 5.", "Székesfehérvár", "8000"],
    ["Friss Piac Kft.", "szamla@frisspiac.hu", "78901234-2-43", "Piac tér 2.", "Pécs", "7621"],
    ["CloudNine SaaS Kft.", "ar@cloudnine.io", "89012345-2-55", "Infopark sétány 1.", "Budapest", "1117"],
  ];

  var PRODUCT_SEED = [
    ["Webfejlesztés (óradíj)", 15000, 27, "óra"],
    ["Tanácsadás", 25000, 27, "óra"],
    ["Logótervezés", 120000, 27, "db"],
    ["Havi karbantartás", 45000, 27, "hó"],
    ["Hosting (éves)", 36000, 27, "db"],
    ["SEO audit", 90000, 27, "db"],
    ["Oktatás (napi)", 150000, 27, "nap"],
    ["Szoftver licenc", 12000, 27, "hó"],
  ];

  function buildRichData(userId, kind, now) {
    var data = emptyData();
    data.company = buildCompany(userId, kind, now);
    var stamp = function (n) { return addDays(now, n).toISOString(); };

    CLIENT_SEED.forEach(function (c, i) {
      data.clients.push({
        id: "cl-" + (i + 1),
        userId: userId,
        name: c[0], email: c[1], taxNumber: c[2], address: c[3], city: c[5] ? c[4] : c[4], zipCode: c[5], country: "HU",
        createdAt: stamp(-110 + i), updatedAt: stamp(-110 + i),
      });
    });
    PRODUCT_SEED.forEach(function (p, i) {
      data.products.push({
        id: "pr-" + (i + 1),
        userId: userId,
        name: p[0], description: p[0], unitPrice: p[1], vatRate: p[2], currency: "HUF", unit: p[3],
        createdAt: stamp(-100 + i), updatedAt: stamp(-100 + i),
      });
    });

    var seq = 0;
    function mk(spec) {
      var c = data.clients[spec.client];
      var issue = addDays(now, spec.issueOffset);
      var due = addDays(issue, spec.termDays == null ? 8 : spec.termDays);
      var inv = {
        id: spec.id,
        invoiceNumber: spec.number || "",
        documentType: spec.documentType || "invoice",
        clientName: c.name,
        clientTaxNumber: c.taxNumber,
        clientZipCode: c.zipCode,
        clientCity: c.city,
        clientAddress: c.address,
        clientCountry: "HU",
        clientId: c.id,
        issueDate: isoDate(issue),
        dueDate: isoDate(due),
        fulfillmentDate: isoDate(issue),
        status: spec.status,
        currency: spec.currency || "HUF",
        lineItems: spec.lines,
        paymentMethod: "transfer",
        createdAt: issue.toISOString(),
        updatedAt: issue.toISOString(),
      };
      if (spec.exchangeRate) inv.exchangeRate = spec.exchangeRate;
      if (spec.notes) inv.notes = spec.notes;
      if (spec.paidOffset != null) {
        inv.paidAt = addDays(now, spec.paidOffset).toISOString();
        inv.paidAmount = spec.paidAmount != null ? spec.paidAmount : invoiceGross(inv);
      }
      if (spec.extra) Object.assign(inv, spec.extra);
      seq += 1;
      data.invoices.push(inv);
      return inv;
    }

    // Paid history (older first).
    mk({ id: "inv-demo-01", number: "INV-2026-00001", client: 0, issueOffset: -95, status: "paid", paidOffset: -88, lines: [line("Webfejlesztés – 1. szakasz", 40, 15000, 27, "óra")] });
    mk({ id: "inv-demo-02", number: "INV-2026-00002", client: 7, issueOffset: -82, status: "paid", paidOffset: -75, lines: [line("Szoftver licenc – havi", 1, 12000, 27, "hó"), line("Támogatás", 2, 25000, 27, "óra")] });
    mk({ id: "inv-demo-03", number: "INV-2026-00003", client: 2, issueOffset: -70, status: "paid", paidOffset: -66, lines: [line("Arculattervezés", 1, 120000, 27)] });
    mk({ id: "inv-demo-04", number: "INV-2026-00004", client: 5, issueOffset: -60, status: "paid", paidOffset: -49, lines: [line("Havi karbantartás", 1, 45000, 27, "hó")] });
    mk({ id: "inv-demo-05", number: "INV-2026-00005", client: 1, issueOffset: -48, status: "paid", paidOffset: -41, lines: [line("Oktatás", 2, 150000, 27, "nap")] });
    mk({ id: "inv-demo-06", number: "INV-2026-00006", client: 4, issueOffset: -39, status: "paid", paidOffset: -33, lines: [line("Honlap karbantartás", 1, 60000, 27, "hó"), line("Hosting", 1, 36000, 27)] });
    mk({ id: "inv-demo-07", number: "INV-2026-00007", client: 7, issueOffset: -33, status: "paid", paidOffset: -2, lines: [line("Szoftver licenc – havi", 1, 12000, 27, "hó")] });
    // EUR invoice with a stored rate.
    mk({ id: "inv-demo-08", number: "INV-2026-00008", client: 3, issueOffset: -27, status: "paid", paidOffset: -20, currency: "EUR", exchangeRate: 392.4, lines: [line("Consulting day", 3, 350, 27, "nap")] });
    // Cancelled + its storno document.
    mk({ id: "inv-demo-09", number: "INV-2026-00009", client: 6, issueOffset: -24, status: "cancelled", lines: [line("Reklámanyag tervezése", 1, 80000, 27)] });
    mk({
      id: "inv-demo-09s", number: "INV-2026-00010", client: 6, issueOffset: -23, status: "sent", documentType: "storno",
      lines: [line("Reklámanyag tervezése", -1, 80000, 27)], extra: { originalInvoiceId: "inv-demo-09", notes: "Sztornó: INV-2026-00009" },
    });
    // Open invoices.
    mk({ id: "inv-demo-11", number: "INV-2026-00011", client: 2, issueOffset: -34, status: "overdue", lines: [line("Havi karbantartás", 2, 45000, 27, "hó")] });
    mk({ id: "inv-demo-12", number: "INV-2026-00012", client: 5, issueOffset: -21, status: "overdue", lines: [line("SEO audit", 1, 90000, 27)] });
    mk({ id: "inv-demo-13", number: "INV-2026-00013", client: 0, issueOffset: -14, status: "partially_paid", paidOffset: -6, paidAmount: 150000, lines: [line("Webfejlesztés – 2. szakasz", 30, 15000, 27, "óra"), line("Tárhely beállítás", 1, 25000, 27)] });
    mk({ id: "inv-demo-14", number: "INV-2026-00014", client: 7, issueOffset: -9, status: "sent", lines: [line("Szoftver licenc – havi", 1, 12000, 27, "hó"), line("Egyedi fejlesztés", 6, 25000, 27, "óra")] });
    mk({ id: "inv-demo-15", number: "INV-2026-00015", client: 1, issueOffset: -6, status: "unpaid", lines: [line("Energiahatékonysági tanácsadás", 8, 25000, 27, "óra")] });
    mk({ id: "inv-demo-16", number: "INV-2026-00016", client: 4, issueOffset: -3, status: "sent", lines: [line("Weboldal frissítés", 1, 85000, 27)] });
    // NAV-failed one (shows the red chip + retry).
    mk({ id: "inv-demo-17", number: "INV-2026-00017", client: 3, issueOffset: -2, status: "unpaid", currency: "EUR", exchangeRate: 393.1, lines: [line("Training workshop", 1, 650, 27)] });
    // Proforma + a converted pair.
    mk({ id: "inv-demo-18", number: "DBK-2026-00001", client: 5, issueOffset: -5, status: "proforma", documentType: "proforma", lines: [line("Logisztikai riport – előleg", 1, 200000, 27)] });
    mk({ id: "inv-demo-19", number: "DBK-2026-00002", client: 0, issueOffset: -12, status: "proforma", documentType: "proforma", lines: [line("Fejlesztési keretszerződés", 1, 500000, 27)] });
    mk({
      id: "inv-demo-20", number: "ELO-2026-00001", client: 0, issueOffset: -10, status: "sent", documentType: "advance",
      lines: [line("Fejlesztési keretszerződés – előleg", 1, 500000, 27)], extra: { convertedFromInvoiceId: "inv-demo-19" },
    });
    // Drafts.
    mk({ id: "inv-demo-21", client: 1, issueOffset: 0, status: "draft", lines: [line("Oktatás", 1, 150000, 27, "nap")], notes: "Piszkozat – egyeztetés alatt." });
    mk({ id: "inv-demo-22", client: 6, issueOffset: 0, status: "draft", lines: [line("Csomagolási terv", 1, 70000, 27)] });

    // NAV submissions for issued docs (done) – except the failed one.
    data.invoices.forEach(function (inv) {
      if (!isIssued(inv)) return;
      if (inv.id === "inv-demo-17") {
        data.navSubmissions[inv.id] = [navSubmission(inv, "ERROR", null, "A számla adatai nem felelnek meg a NAV séma szerinti ellenőrzésnek (demó hibaüzenet).", now)];
      } else {
        data.navSubmissions[inv.id] = [navSubmission(inv, "DONE", "DEMOTX" + inv.id.slice(-6).toUpperCase(), null, now)];
      }
    });

    // Receipts
    var receiptSpecs = [
      ["NYG-2026-00001", "Készpénzes vásárló", "cash", -40, [["Espresso", 1, 690], ["Croissant", 1, 850], ["Ásványvíz 0,5 l", 1, 560]]],
      ["NYG-2026-00002", null, "card", -33, [["Weboldal-csomag (alap)", 1, 59000]]],
      ["NYG-2026-00003", "Kiss Gergő", "card", -26, [["Konzultáció", 1, 15000], ["Jegyzet", 2, 1800]]],
      ["NYG-2026-00004", null, "cash", -19, [["Nyomtatás", 24, 25], ["Spirálozás", 1, 600]]],
      ["NYG-2026-00005", "Tóth Eszter", "transfer", -12, [["Fotózás – 1 óra", 1, 22000]]],
      ["NYG-2026-00006", null, "card", -7, [["Kávé", 2, 590], ["Sütemény", 2, 790]]],
      ["NYG-2026-00007", "Vendég", "cash", -3, [["Poszter A2", 1, 4200]]],
      ["NYG-2026-00008", null, "card", -1, [["Konzultáció", 2, 15000]]],
    ];
    receiptSpecs.forEach(function (r, i) {
      var id = "rc-demo-" + (i + 1);
      var items = r[4].map(function (it, idx) {
        return { id: uid("rli"), receiptId: id, description: it[0], quantity: it[1], unitPrice: it[2], vatRate: 27, unit: "db", sortOrder: idx };
      });
      var total = items.reduce(function (s, it) { return s + it.quantity * it.unitPrice * 1.27; }, 0);
      var issued = addDays(now, r[3]).toISOString();
      data.receipts.push({
        id: id, userId: userId, receiptNumber: r[0], clientName: r[1], totalAmount: round2(total), currency: "HUF",
        paymentMethod: r[2], qrToken: "demo-token-" + (i + 1), qrUrl: "/receipts/view?token=demo-token-" + (i + 1),
        navSubmitted: i < 6, lineItems: items, issuedAt: issued, createdAt: issued, updatedAt: issued,
      });
    });

    // Reminders
    data.reminders.push({ id: uid("rm"), userId: userId, invoiceId: "inv-demo-11", intervalDays: 7, maxReminders: 3, remindersSent: 1, lastSentAt: stamp(-8), enabled: true, createdAt: stamp(-20), updatedAt: stamp(-8) });
    data.reminders.push({ id: uid("rm"), userId: userId, invoiceId: null, intervalDays: 7, maxReminders: 3, remindersSent: 0, lastSentAt: null, enabled: true, createdAt: stamp(-90), updatedAt: stamp(-90) });

    // Notifications (stored read-flags; content is derived below)
    data.notificationState = {};
    return data;
  }

  function emptyData() {
    return {
      company: null,
      clients: [],
      products: [],
      invoices: [],
      receipts: [],
      reminders: [],
      apiKeys: [],
      navSubmissions: {},
      notificationState: {},
      templates: defaultTemplates(),
      pdfTemplate: {
        titleText: "SZÁMLA", accentColor: "#6495ed", showCompanyBlock: true, showBankDetails: true,
        showClientTaxNumber: true, footerText: "Köszönjük a bizalmát!", notesLabel: "Megjegyzés", fontScale: "medium",
      },
      counters: {},
    };
  }

  function defaultTemplates() {
    var t = function (type, subject, html, text) {
      return { id: uid("tpl"), type: type, subject: subject, bodyHtml: html, bodyText: text, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    };
    return [
      t("invoice_notification", "Számla {{invoiceNumber}} – {{companyName}}",
        "<p>Tisztelt {{clientName}}!</p><p>Mellékelten küldjük a(z) <strong>{{invoiceNumber}}</strong> számú számlát, összege: {{total}}.</p><p>Fizetési határidő: {{dueDate}}</p><p><a href=\"{{paymentLink}}\">Fizetés online</a></p><p>Köszönjük!</p>",
        "Tisztelt {{clientName}}!\n\nMellékelten küldjük a(z) {{invoiceNumber}} számú számlát, összege: {{total}}.\nFizetési határidő: {{dueDate}}\n"),
      t("payment_reminder", "Fizetési emlékeztető: {{invoiceNumber}}",
        "<p>Tisztelt {{clientName}}!</p><p>Emlékeztetjük, hogy a(z) <strong>{{invoiceNumber}}</strong> számú számla ({{total}}) fizetési határideje {{dueDate}} volt.</p>",
        "Tisztelt {{clientName}}!\n\nEmlékeztetjük, hogy a(z) {{invoiceNumber}} számú számla ({{total}}) fizetési határideje {{dueDate}} volt."),
      t("invoice_reminder", "Számla emlékeztető: {{invoiceNumber}}",
        "<p>Tisztelt {{clientName}}!</p><p>Kedves emlékeztető a(z) {{invoiceNumber}} számú, {{total}} összegű számláról.</p>",
        "Tisztelt {{clientName}}!\n\nKedves emlékeztető a(z) {{invoiceNumber}} számú, {{total}} összegű számláról."),
      t("receipt_notification", "Nyugta – {{companyName}}",
        "<p>Tisztelt {{clientName}}!</p><p>Köszönjük a vásárlást, a fizetett összeg: {{total}}.</p>",
        "Tisztelt {{clientName}}!\n\nKöszönjük a vásárlást, a fizetett összeg: {{total}}."),
      t("proforma_notification", "Díjbekérő {{invoiceNumber}} – {{companyName}}",
        "<p>Tisztelt {{clientName}}!</p><p>Mellékelten küldjük a(z) <strong>{{invoiceNumber}}</strong> számú díjbekérőt ({{total}}).</p>",
        "Tisztelt {{clientName}}!\n\nMellékelten küldjük a(z) {{invoiceNumber}} számú díjbekérőt ({{total}})."),
      t("proforma_reminder", "Díjbekérő emlékeztető: {{invoiceNumber}}",
        "<p>Tisztelt {{clientName}}!</p><p>Emlékeztetjük a(z) {{invoiceNumber}} számú díjbekérő ({{total}}) rendezésére.</p>",
        "Tisztelt {{clientName}}!\n\nEmlékeztetjük a(z) {{invoiceNumber}} számú díjbekérő ({{total}}) rendezésére."),
    ];
  }

  function navSubmission(inv, status, transactionId, errorMessage, now) {
    return {
      id: uid("nav"),
      invoiceId: inv.id,
      userId: null,
      operation: inv.documentType === "storno" ? "STORNO" : "CREATE",
      status: status,
      transactionId: transactionId,
      mode: "demo",
      errorMessage: errorMessage,
      submittedAt: (now || new Date()).toISOString(),
      createdAt: (now || new Date()).toISOString(),
      updatedAt: (now || new Date()).toISOString(),
    };
  }

  function isIssued(inv) {
    return inv.status !== "draft" && inv.status !== "proforma" && inv.documentType !== "proforma";
  }

  function navListStatus(data, inv) {
    if (!isIssued(inv)) return "none";
    var subs = data.navSubmissions[inv.id] || [];
    if (!subs.length) return "notSubmitted";
    var s = String(subs[0].status).toLowerCase();
    if (s === "done") return "done";
    if (s === "error" || s === "aborted") return "failed";
    return "inProgress";
  }

  // ----------------------------------------------------------------- store
  function seedUsers(now) {
    var mkUser = function (id, name, email, role) {
      return { id: id, name: name, email: email, emailVerified: true, image: null, role: role, signupRole: role === "admin" ? "entrepreneur" : role, password: PASSWORD, createdAt: addDays(now, -130).toISOString(), updatedAt: addDays(now, -130).toISOString() };
    };
    return [
      mkUser("u-anna", "Kovács Anna", "anna@demo.invohub.hu", "entrepreneur"),
      mkUser("u-peter", "Nagy Péter", "peter@demo.invohub.hu", "entrepreneur"),
      mkUser("u-eszter", "Szabó Eszter", "konyvelo@demo.invohub.hu", "accountant"),
      mkUser("u-admin", "Admin Ádám", "admin@demo.invohub.hu", "admin"),
    ];
  }

  function seedAll(now) {
    var users = seedUsers(now);
    var data = {};
    data["u-anna"] = buildRichData("u-anna", "entrepreneur", now);
    data["u-peter"] = emptyData(); // brand-new account: onboarding + empty states
    data["u-eszter"] = buildRichData("u-eszter", "accountant", now);
    data["u-admin"] = buildRichData("u-admin", "admin", now);
    return { users: users, data: data, sessionUserId: null };
  }

  function createBackend(options) {
    options = options || {};
    var nowFn = options.now || function () { return new Date(); };
    var storage = options.storage || null;
    var state = null;

    function save() {
      if (!storage) return;
      try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* quota / disabled */ }
    }
    function load() {
      if (storage) {
        try {
          var raw = storage.getItem(STORAGE_KEY);
          if (raw) { state = JSON.parse(raw); return; }
        } catch (e) { /* fall through to a fresh seed */ }
      }
      state = seedAll(nowFn());
    }
    load();

    function publicUser(u) {
      return { id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, image: u.image, role: u.role, signupRole: u.signupRole, createdAt: u.createdAt, updatedAt: u.updatedAt };
    }
    function sessionFor(u) {
      var created = nowFn();
      return { id: "sess-" + u.id, token: "demo-token-" + u.id, userId: u.id, expiresAt: addDays(created, 7).toISOString(), createdAt: created.toISOString(), updatedAt: created.toISOString(), ipAddress: "127.0.0.1", userAgent: "design-prototype" };
    }
    function currentUser() {
      if (!state.sessionUserId) return null;
      return state.users.filter(function (u) { return u.id === state.sessionUserId; })[0] || null;
    }
    function dataFor(user) {
      if (!state.data[user.id]) state.data[user.id] = emptyData();
      return state.data[user.id];
    }

    // -------- response helpers
    function ok(body, status) { return { status: status || 200, body: body === undefined ? {} : body }; }
    function err(status, message, code, extra) {
      var body = { error: message };
      if (code) body.code = code;
      if (extra) Object.keys(extra).forEach(function (k) { body[k] = extra[k]; });
      return { status: status, body: body };
    }

    // -------- invoices
    function findInvoice(data, id) {
      return data.invoices.filter(function (i) { return i.id === id; })[0];
    }
    function nextNumber(data, prefix) {
      var year = nowFn().getFullYear();
      var key = prefix + "-" + year;
      var max = 0;
      data.invoices.forEach(function (i) {
        if (i.invoiceNumber && i.invoiceNumber.indexOf(key + "-") === 0) {
          var n = parseInt(i.invoiceNumber.slice(key.length + 1), 10);
          if (n > max) max = n;
        }
      });
      return key + "-" + pad(max + 1, 5);
    }
    function prefixFor(type) {
      return { proforma: "DBK", advance: "ELO" }[type] || "INV";
    }
    function withNav(data, inv) {
      var out = clone(inv);
      out.navStatus = navListStatus(data, inv);
      return out;
    }
    function normalizeInvoice(data, input, existing) {
      var now = nowFn().toISOString();
      var inv = Object.assign({}, existing || {}, input);
      inv.id = existing ? existing.id : (input.id || uid("inv"));
      inv.lineItems = (input.lineItems || (existing && existing.lineItems) || []).map(function (li) {
        return Object.assign({ vatCategory: "normal", vatRate: 27, unit: "db" }, li, { id: li.id || uid("li") });
      });
      inv.invoiceNumber = inv.invoiceNumber || "";
      inv.createdAt = existing ? existing.createdAt : (input.createdAt || now);
      inv.updatedAt = now;
      if (inv.documentType === "proforma" && inv.status === "draft") inv.status = "draft";
      var needsNumber = !inv.invoiceNumber && inv.status !== "draft";
      if (needsNumber) inv.invoiceNumber = nextNumber(data, prefixFor(inv.documentType));
      return inv;
    }
    function autoSubmitNav(data, inv, wasIssued) {
      if (wasIssued || !isIssued(inv)) return null;
      var sub = navSubmission(inv, "DONE", "DEMOTX" + Math.random().toString(36).slice(2, 10).toUpperCase(), null, nowFn());
      data.navSubmissions[inv.id] = [sub].concat(data.navSubmissions[inv.id] || []);
      return { submitted: true, status: "DONE", transactionId: sub.transactionId };
    }
    function listInvoices(data, params) {
      var status = params.get("status");
      var search = (params.get("search") || "").toLowerCase().trim();
      var month = params.get("month");
      var navFailed = params.get("navFailed") === "1" || params.get("navFailed") === "true";
      var needsRate = params.get("needsExchangeRate") === "1" || params.get("needsExchangeRate") === "true";
      var limit = parseInt(params.get("limit") || "30", 10);
      var offset = parseInt(params.get("offset") || "0", 10);
      var list = data.invoices.filter(function (inv) {
        if (status && inv.status !== status) return false;
        if (month && inv.issueDate.indexOf(month) !== 0) return false;
        if (navFailed && navListStatus(data, inv) !== "failed") return false;
        if (needsRate && !(isIssued(inv) && inv.currency !== "HUF" && !inv.exchangeRate)) return false;
        if (search) {
          var hay = (inv.clientName + " " + inv.invoiceNumber + " " + (inv.clientTaxNumber || "")).toLowerCase();
          if (hay.indexOf(search) === -1) return false;
        }
        return true;
      });
      list.sort(function (a, b) {
        return a.issueDate === b.issueDate ? b.createdAt.localeCompare(a.createdAt) : b.issueDate.localeCompare(a.issueDate);
      });
      var now = nowFn();
      var monthKey = isoDate(now).slice(0, 7);
      var monthIssued = data.invoices.filter(function (i) { return isIssued(i) && i.issueDate.indexOf(monthKey) === 0; });
      var converted = {};
      data.invoices.forEach(function (i) {
        if (i.convertedFromInvoiceId && i.status !== "cancelled") converted[i.convertedFromInvoiceId] = i.id;
      });
      return ok({
        invoices: list.slice(offset, offset + limit).map(function (i) { return withNav(data, i); }),
        total: list.length,
        limit: limit,
        offset: offset,
        stats: {
          count: data.invoices.length,
          thisMonthCount: monthIssued.length,
          monthlyTotal: round2(monthIssued.reduce(function (s, i) { return s + invoiceGross(i); }, 0)),
        },
        convertedProformaIds: converted,
      });
    }
    function dashboardSummary(data) {
      var now = nowFn();
      var invs = data.invoices;
      var sameMonth = function (iso) { var d = new Date(iso); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); };
      var sameQuarter = function (iso) { var d = new Date(iso); return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3); };
      var sum = function (arr, f) { return round2(arr.reduce(function (s, i) { return s + f(i); }, 0)); };
      var paid = invs.filter(function (i) { return i.status === "paid"; });
      var paidMonth = paid.filter(function (i) { return i.paidAt && sameMonth(i.paidAt); });
      var overdue = invs.filter(function (i) { return i.status === "overdue"; });
      var outstanding = invs.filter(function (i) { return ["sent", "overdue", "partially_paid", "unpaid"].indexOf(i.status) >= 0; });
      var issued = invs.filter(function (i) { return i.status === "draft" || i.status === "proforma"; });
      var vatQuarter = invs.filter(function (i) { return isIssued(i) && sameQuarter(i.issueDate); });
      var oldest = 0;
      overdue.forEach(function (i) {
        var d = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
        if (d > oldest) oldest = d;
      });
      var recent = invs.slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).slice(0, 5).map(function (i) { return withNav(data, i); });
      return {
        revenue: sum(paidMonth, invoiceGross),
        revenuePaidCount: paidMonth.length,
        navFailedCount: invs.filter(function (i) { return navListStatus(data, i) === "failed"; }).length,
        paidTotal: sum(paid, invoiceGross),
        outstanding: sum(outstanding, invoiceGross),
        overdueTotal: sum(overdue, invoiceGross),
        issuedTotal: sum(issued, invoiceGross),
        estimatedVat: sum(vatQuarter, invoiceVat),
        overdueCount: overdue.length,
        oldestOverdueDays: oldest,
        recentInvoices: recent,
      };
    }
    function invoiceLinks(data, inv) {
      var byId = function (id) { return id ? findInvoice(data, id) || null : null; };
      return {
        originalInvoice: byId(inv.originalInvoiceId),
        modifiesInvoice: byId(inv.modifiesInvoiceId),
        stornoDocuments: data.invoices.filter(function (i) { return i.originalInvoiceId === inv.id; }),
        correctionDocuments: data.invoices.filter(function (i) { return i.modifiesInvoiceId === inv.id; }),
        convertedFromInvoice: byId(inv.convertedFromInvoiceId),
        convertedToInvoices: data.invoices.filter(function (i) { return i.convertedFromInvoiceId === inv.id; }),
      };
    }

    // -------- notifications (derived from data, read flags kept in state)
    function buildNotifications(data) {
      var out = [];
      var push = function (type, key, title, body, href, createdAt) {
        out.push({
          id: "n-" + key, userId: null, type: type, title: title, body: body, href: href, referenceKey: key,
          read: !!data.notificationState[key], createdAt: createdAt, updatedAt: createdAt,
        });
      };
      data.invoices.forEach(function (inv) {
        if (inv.status === "overdue") {
          push("overdue_invoice", "overdue:" + inv.id, "notifications.content.overdueInvoiceTitle " + JSON.stringify({ number: inv.invoiceNumber }),
            "notifications.content.overdueInvoiceBody " + JSON.stringify({ clientName: inv.clientName }), "/invoices/" + inv.id, inv.dueDate + "T08:00:00.000Z");
        }
        if (inv.status === "sent" && inv.documentType !== "storno") {
          push("invoice_sent", "sent:" + inv.id, "notifications.content.invoiceSentTitle " + JSON.stringify({ number: inv.invoiceNumber }),
            "notifications.content.invoiceSentBody " + JSON.stringify({ clientName: inv.clientName }), "/invoices/" + inv.id, inv.updatedAt);
        }
        if (navListStatus(data, inv) === "failed") {
          push("nav_pending", "nav-pending:" + inv.id, "notifications.content.navPendingTitle",
            "notifications.content.navPendingBody " + JSON.stringify({ number: inv.invoiceNumber }), "/invoices/" + inv.id, inv.updatedAt);
        }
      });
      if (data.company) {
        push("system", "welcome", "notifications.content.welcomeTitle", "notifications.content.welcomeBody", "/settings", addDays(nowFn(), -100).toISOString());
      }
      out.sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
      return out;
    }

    // -------- minimal PDF (valid, one page, ASCII text)
    function tinyPdf(lines) {
      var esc = function (s) { return String(s).replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1"); };
      var content = "BT /F1 18 Tf 56 780 Td " + lines.map(function (l, i) { return (i ? "0 -26 Td " : "") + "(" + esc(l) + ") Tj "; }).join("") + "ET";
      var objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      ];
      var out = "%PDF-1.4\n";
      var offsets = [];
      objs.forEach(function (o, i) { offsets.push(out.length); out += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
      var xref = out.length;
      out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offsets.map(function (o) { return pad(o, 10) + " 00000 n \n"; }).join("");
      out += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
      return out;
    }

    // ---------------------------------------------------------------- router
    var routes = [];
    function route(method, pattern, handler) {
      routes.push({ method: method, re: new RegExp("^" + pattern.replace(/:[a-z]+/gi, "([^/]+)") + "$"), handler: handler });
    }

    // ---- auth (Better Auth)
    route("GET", "/api/auth/get-session", function (ctx) {
      var u = currentUser();
      return ok(u ? { session: sessionFor(u), user: publicUser(u) } : null);
    });
    route("POST", "/api/auth/sign-in/email", function (ctx) {
      var email = String((ctx.body && ctx.body.email) || "").trim().toLowerCase();
      var u = state.users.filter(function (x) { return x.email.toLowerCase() === email; })[0];
      if (!u || u.password !== (ctx.body && ctx.body.password)) {
        return { status: 401, body: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Hibás e-mail cím vagy jelszó. (Demó jelszó: " + PASSWORD + ")" } };
      }
      state.sessionUserId = u.id;
      save();
      return ok({ redirect: false, token: sessionFor(u).token, user: publicUser(u) });
    });
    route("POST", "/api/auth/sign-up/email", function (ctx) {
      var b = ctx.body || {};
      var email = String(b.email || "").trim().toLowerCase();
      if (!email || !b.password) return { status: 400, body: { code: "INVALID_REQUEST", message: "E-mail és jelszó megadása kötelező." } };
      if (String(b.password).length < 8) return { status: 400, body: { code: "PASSWORD_TOO_SHORT", message: "A jelszó legalább 8 karakter legyen." } };
      if (state.users.some(function (x) { return x.email.toLowerCase() === email; })) {
        return { status: 422, body: { code: "USER_ALREADY_EXISTS", message: "Ezzel az e-mail címmel már van fiók. (Demó: próbáld a bejelentkezést.)" } };
      }
      var role = b.signupRole === "accountant" ? "accountant" : "entrepreneur";
      var u = { id: uid("u"), name: b.name || email, email: email, emailVerified: false, image: null, role: role, signupRole: role, password: b.password, createdAt: nowFn().toISOString(), updatedAt: nowFn().toISOString() };
      state.users.push(u);
      state.data[u.id] = emptyData();
      state.sessionUserId = u.id;
      save();
      return ok({ token: sessionFor(u).token, user: publicUser(u) });
    });
    route("POST", "/api/auth/sign-out", function () {
      state.sessionUserId = null;
      save();
      return ok({ success: true });
    });
    route("POST", "/api/auth/request-password-reset", function () { return ok({ status: true, message: "Demó: a visszaállító e-mail nem megy ki." }); });
    route("POST", "/api/auth/forget-password", function () { return ok({ status: true }); });
    route("POST", "/api/auth/reset-password", function () { return ok({ status: true }); });
    route("POST", "/api/auth/update-user", function (ctx) {
      var u = currentUser();
      if (u && ctx.body && ctx.body.name) { u.name = ctx.body.name; save(); }
      return ok({ status: true });
    });

    // ---- companies
    route("GET", "/api/companies", function (ctx) { return ok({ company: clone(ctx.data.company) }); });
    route("POST", "/api/companies", function (ctx) {
      var now = nowFn().toISOString();
      var prev = ctx.data.company || buildCompany(ctx.user.id, "entrepreneur", nowFn());
      var b = ctx.body || {};
      var next = Object.assign({}, prev, b, { id: prev.id, userId: ctx.user.id, updatedAt: now });
      ["navTechnicalPassword", "navXmlSignKey", "navXmlChangeKey"].forEach(function (k) { delete next[k]; });
      next.navTechnicalPasswordSet = !!(b.navTechnicalPassword || prev.navTechnicalPasswordSet);
      next.navXmlSignKeySet = !!(b.navXmlSignKey || prev.navXmlSignKeySet);
      next.navCredentialsConfigured = next.navTechnicalPasswordSet && next.navXmlSignKeySet && !!next.navTechnicalUser;
      ctx.data.company = next;
      save();
      return ok({ company: clone(next) });
    });
    route("GET", "/api/company/lookup", function (ctx) {
      var tax = ctx.params.get("taxNumber") || "";
      var hit = CLIENT_SEED.filter(function (c) { return c[2].replace(/\D/g, "").slice(0, 8) === tax.replace(/\D/g, "").slice(0, 8); })[0];
      if (!hit) return ok({ company: null });
      return ok({ company: { name: hit[0], taxNumber: hit[2], address: hit[3], city: hit[4], zipCode: hit[5], country: "HU" } });
    });
    route("GET", "/api/company/search", function (ctx) {
      var q = (ctx.params.get("q") || "").toLowerCase();
      var digits = q.replace(/\D/g, "");
      var hits = CLIENT_SEED.filter(function (c) {
        return (q.length >= 3 && c[0].toLowerCase().indexOf(q) >= 0) || (digits.length >= 8 && c[2].replace(/\D/g, "").indexOf(digits.slice(0, 8)) === 0);
      }).map(function (c) {
        return { source: "nav", name: c[0], taxNumber: c[2], address: c[3], city: c[4], zipCode: c[5], country: "HU" };
      });
      return ok({ results: hits, provider: "nav-only" });
    });
    route("GET", "/api/nav/config", function () { return ok({ sharedTestAvailable: true, productionEnabled: false, encryptionConfigured: true }); });
    route("POST", "/api/nav/check", function () { return ok({ ok: true, source: "own", code: "ok", message: "Demó: a kapcsolat rendben." }); });
    route("GET", "/api/nav/status", function (ctx) {
      var id = ctx.params.get("invoiceId");
      var inv = findInvoice(ctx.data, id);
      if (!inv) return err(404, "Invoice not found.");
      return ok({ submissions: clone(ctx.data.navSubmissions[id] || []), exchangeRateReport: { kind: "none" } });
    });
    route("POST", "/api/nav/status", function (ctx) {
      var id = ctx.body && ctx.body.invoiceId;
      var subs = ctx.data.navSubmissions[id] || [];
      if (!subs.length) return err(404, "This invoice has no NAV submission.", "noSubmission");
      subs[0].status = "DONE";
      subs[0].updatedAt = nowFn().toISOString();
      save();
      return ok({ status: "DONE", submissions: clone(subs) });
    });
    route("POST", "/api/nav/submit", function (ctx) {
      var inv = findInvoice(ctx.data, ctx.body && ctx.body.invoiceId);
      if (!inv) return err(404, "Invoice not found.");
      var sub = navSubmission(inv, "DONE", "DEMOTX" + Math.random().toString(36).slice(2, 10).toUpperCase(), null, nowFn());
      ctx.data.navSubmissions[inv.id] = [sub].concat(ctx.data.navSubmissions[inv.id] || []);
      save();
      return ok({ ok: true, status: "DONE", transactionId: sub.transactionId, submission: sub });
    });
    route("GET", "/api/exchange-rates", function (ctx) {
      var cur = ctx.params.get("currency") || "EUR";
      var rate = { EUR: 392.7, USD: 361.4, GBP: 458.2, CHF: 411.9 }[cur] || 392.7;
      return ok({ rate: rate, rateDate: ctx.params.get("date") || isoDate(nowFn()), source: "MNB (demó)" });
    });
    route("GET", "/api/m2m/demo", function () {
      return ok({ configured: false, mode: "demo", snapshot: {
        taxpayer: { id: "12380880", label: "Demó Adózó Kft.", hint: "Tételes főkönyv" }, environment: "demo",
        checks: [{ name: "Token + aláíró kulcs", ok: true, resultCode: "OK", message: "Demó munkamenet létrehozva" }, { name: "Összesített adószámla", ok: true, resultCode: "SIKERES", message: null }],
        taxSummary: { totalBalance: 125000, taxDebt: 0, overpayment: 125000 },
        missingDeclarations: [{ title: "Havi ÁFA bevallás (demó)", type: "'65", period: "2026/06", dueDate: "2026-07-20" }],
        publicDebt: { outstanding: 0, assessed: 0, items: [] },
        detailedTaxpayer: { name: "Demó Adózó Kft.", taxNumber: "12380880", address: "Demó utca 1., Budapest", period: "2026" },
        allEndpointsReachable: true,
      } });
    });

    // ---- dashboard / notifications
    route("GET", "/api/dashboard/summary", function (ctx) { return ok({ summary: dashboardSummary(ctx.data) }); });
    route("GET", "/api/notifications", function (ctx) {
      var list = buildNotifications(ctx.data);
      return ok({ notifications: list, unreadCount: list.filter(function (n) { return !n.read; }).length });
    });
    route("POST", "/api/notifications/read-all", function (ctx) {
      buildNotifications(ctx.data).forEach(function (n) { ctx.data.notificationState[n.referenceKey] = true; });
      save();
      return ok({ ok: true });
    });
    route("PATCH", "/api/notifications/:id", function (ctx, id) {
      buildNotifications(ctx.data).forEach(function (n) { if (n.id === id) ctx.data.notificationState[n.referenceKey] = true; });
      save();
      return ok({ ok: true });
    });

    // ---- invoices
    route("GET", "/api/invoices", function (ctx) { return listInvoices(ctx.data, ctx.params); });
    route("POST", "/api/invoices", function (ctx) {
      var b = ctx.body || {};
      if (b.status && b.status !== "draft" && b.documentType !== "proforma" && !(ctx.data.company && ctx.data.company.taxNumber)) {
        return err(422, "Company profile is incomplete.", "companyProfileIncomplete", { missingFields: ["name", "taxNumber", "zipCode", "city", "address"] });
      }
      var inv = normalizeInvoice(ctx.data, b, null);
      ctx.data.invoices.push(inv);
      var nav = autoSubmitNav(ctx.data, inv, false);
      save();
      return ok({ invoice: clone(inv), nav: nav }, 201);
    });
    route("GET", "/api/invoices/:id", function (ctx, id) {
      var inv = findInvoice(ctx.data, id);
      return inv ? ok({ invoice: clone(inv) }) : err(404, "Not found");
    });
    route("PATCH", "/api/invoices/:id", function (ctx, id) {
      var existing = findInvoice(ctx.data, id);
      if (!existing) return err(404, "Not found");
      if (existing.status !== "draft") return err(409, "This invoice is already finalized and can no longer be edited.", "invoiceFinalized");
      var next = normalizeInvoice(ctx.data, ctx.body || {}, existing);
      var idx = ctx.data.invoices.indexOf(existing);
      ctx.data.invoices[idx] = next;
      var nav = autoSubmitNav(ctx.data, next, isIssued(existing));
      save();
      return ok({ invoice: clone(next), nav: nav });
    });
    route("DELETE", "/api/invoices/:id", function (ctx, id) {
      var inv = findInvoice(ctx.data, id);
      if (!inv) return err(404, "Not found");
      if (inv.status !== "draft") return err(409, "Only drafts can be deleted.", "invoiceFinalized");
      ctx.data.invoices.splice(ctx.data.invoices.indexOf(inv), 1);
      save();
      return ok({ ok: true });
    });
    route("GET", "/api/invoices/:id/links", function (ctx, id) {
      var inv = findInvoice(ctx.data, id);
      return inv ? ok(clone(invoiceLinks(ctx.data, inv))) : err(404, "Not found");
    });
    route("POST", "/api/invoices/:id/mark-paid", function (ctx, id) {
      var inv = findInvoice(ctx.data, id);
      if (!inv) return err(404, "Not found");
      var b = ctx.body || {};
      var gross = invoiceGross(inv);
      var amount = b.paidAmount != null ? Number(b.paidAmount) : gross;
      var already = inv.paidAmount || 0;
      var total = already + amount;
      inv.paidAmount = round2(total);
      inv.paidAt = b.paidAt ? new Date(b.paidAt).toISOString() : nowFn().toISOString();
      if (b.paymentMethod) inv.paymentMethod = b.paymentMethod;
      inv.status = total + 0.5 >= gross ? "paid" : "partially_paid";
      inv.updatedAt = nowFn().toISOString();
      save();
      return ok({ invoice: clone(inv) });
    });
    route("POST", "/api/invoices/:id/send", function (ctx, id) {
      var inv = findInvoice(ctx.data, id);
      if (!inv) return err(404, "Not found");
      if (inv.status === "draft") return err(409, "Draft invoices cannot be sent.", "invoiceNotFinalized");
      save();
      return ok({ ok: true, sentTo: (ctx.body && ctx.body.to) || "ugyfel@pelda.hu" });
    });
    route("POST", "/api/invoices/:id/storno", function (ctx, id) {
      var inv = findInvoice(ctx.data, id);
      if (!inv) return err(404, "Not found");
      if (inv.documentType === "proforma" || inv.status === "proforma") return err(400, "A díjbekérő nem sztornózható.", "proformaNotStornoable");
      if (inv.status === "draft") return err(400, "Draft invoices cannot be cancelled.", "invoiceNotFinalized");
      if (inv.status === "cancelled") return err(409, "Already cancelled.", "alreadyCancelled");
      var st = normalizeInvoice(ctx.data, {
        documentType: "storno", status: "sent", clientName: inv.clientName, clientTaxNumber: inv.clientTaxNumber, clientZipCode: inv.clientZipCode,
        clientCity: inv.clientCity, clientAddress: inv.clientAddress, clientCountry: inv.clientCountry, clientId: inv.clientId,
        issueDate: isoDate(nowFn()), dueDate: isoDate(nowFn()), currency: inv.currency, exchangeRate: inv.exchangeRate, paymentMethod: inv.paymentMethod,
        originalInvoiceId: inv.id, notes: "Sztornó: " + inv.invoiceNumber,
        lineItems: inv.lineItems.map(function (li) { return Object.assign({}, li, { id: uid("li"), quantity: -li.quantity }); }),
      }, null);
      ctx.data.invoices.push(st);
      inv.status = "cancelled";
      inv.updatedAt = nowFn().toISOString();
      autoSubmitNav(ctx.data, st, false);
      save();
      return ok({ invoice: clone(st), original: clone(inv) });
    });
    route("POST", "/api/invoices/:id/duplicate", function (ctx, id) {
      var inv = findInvoice(ctx.data, id);
      if (!inv) return err(404, "Not found");
      var today = nowFn();
      var span = Math.max(0, Math.round((new Date(inv.dueDate) - new Date(inv.issueDate)) / 86400000));
      var copy = normalizeInvoice(ctx.data, {
        documentType: inv.documentType === "storno" || inv.documentType === "modify" ? "invoice" : inv.documentType, status: "draft", invoiceNumber: "",
        clientName: inv.clientName, clientTaxNumber: inv.clientTaxNumber, clientZipCode: inv.clientZipCode, clientCity: inv.clientCity,
        clientAddress: inv.clientAddress, clientCountry: inv.clientCountry, clientId: inv.clientId, currency: inv.currency, exchangeRate: inv.exchangeRate,
        paymentMethod: inv.paymentMethod, notes: inv.notes, issueDate: isoDate(today), dueDate: isoDate(addDays(today, span)),
        lineItems: inv.lineItems.map(function (li) { return Object.assign({}, li, { id: uid("li") }); }),
      }, null);
      ctx.data.invoices.push(copy);
      save();
      return ok({ invoice: clone(copy) }, 201);
    });
    route("POST", "/api/invoices/:id/modify", function (ctx, id) {
      var inv = findInvoice(ctx.data, id);
      if (!inv) return err(404, "Not found");
      if (inv.status === "draft" || inv.status === "cancelled" || inv.documentType === "proforma") return err(400, "Not correctable.", "notCorrectable");
      var idx = ctx.data.invoices.filter(function (i) { return i.modifiesInvoiceId === inv.id; }).length + 1;
      var today = nowFn();
      var mod = normalizeInvoice(ctx.data, {
        documentType: "modify", status: "draft", invoiceNumber: "", modifiesInvoiceId: inv.id, modificationIndex: idx,
        clientName: inv.clientName, clientTaxNumber: inv.clientTaxNumber, clientZipCode: inv.clientZipCode, clientCity: inv.clientCity,
        clientAddress: inv.clientAddress, clientCountry: inv.clientCountry, clientId: inv.clientId, currency: inv.currency, exchangeRate: inv.exchangeRate,
        paymentMethod: inv.paymentMethod, issueDate: isoDate(today), dueDate: isoDate(addDays(today, 8)), notes: "Helyesbítő: " + inv.invoiceNumber,
        lineItems: inv.lineItems.map(function (li) { return Object.assign({}, li, { id: uid("li") }); }),
      }, null);
      ctx.data.invoices.push(mod);
      save();
      return ok({ invoice: clone(mod) }, 201);
    });
    route("POST", "/api/invoices/:id/convert", function (ctx, id) {
      var inv = findInvoice(ctx.data, id);
      if (!inv) return err(404, "Not found");
      if (inv.documentType !== "proforma" && inv.status !== "proforma") return err(400, "Only a proforma can be converted.", "notProforma");
      var live = ctx.data.invoices.filter(function (i) { return i.convertedFromInvoiceId === inv.id && i.status !== "cancelled"; })[0];
      if (live) return err(409, "Already converted.", "alreadyConverted", { invoice: clone(live) });
      var today = nowFn();
      var span = Math.max(0, Math.round((new Date(inv.dueDate) - new Date(inv.issueDate)) / 86400000));
      var draft = normalizeInvoice(ctx.data, {
        documentType: "invoice", status: "draft", invoiceNumber: "", convertedFromInvoiceId: inv.id,
        clientName: inv.clientName, clientTaxNumber: inv.clientTaxNumber, clientZipCode: inv.clientZipCode, clientCity: inv.clientCity,
        clientAddress: inv.clientAddress, clientCountry: inv.clientCountry, clientId: inv.clientId, currency: inv.currency, exchangeRate: inv.exchangeRate,
        paymentMethod: inv.paymentMethod, issueDate: isoDate(today), dueDate: isoDate(addDays(today, span)), notes: "Díjbekérő alapján: " + inv.invoiceNumber,
        lineItems: inv.lineItems.map(function (li) { return Object.assign({}, li, { id: uid("li") }); }),
      }, null);
      ctx.data.invoices.push(draft);
      save();
      return ok({ invoice: clone(draft) }, 201);
    });
    route("GET", "/api/invoices/:id/pdf", function (ctx, id) {
      var inv = findInvoice(ctx.data, id);
      if (!inv) return err(404, "Not found");
      return { status: 200, pdf: tinyPdf(["Mintaszamla (design prototipus)", "Szam: " + (inv.invoiceNumber || "piszkozat"), "Vevo: " + inv.clientName, "Osszeg: " + invoiceGross(inv) + " " + inv.currency]) };
    });
    route("POST", "/api/invoices/preview/pdf", function (ctx) {
      var b = ctx.body || {};
      var lines = (b.lineItems || []).slice(0, 8).map(function (li) { return "- " + (li.description || "tetel") + "  " + li.quantity + " x " + li.unitPrice; });
      return { status: 200, pdf: tinyPdf(["Szamla elonezet (design prototipus)", "Vevo: " + (b.clientName || "-"), "Kelt: " + (b.issueDate || "-")].concat(lines)) };
    });
    route("POST", "/api/payments", function () { return ok({ payment: { url: "https://example.com/demo-fizetes" } }); });
    route("POST", "/api/import/invoices", function () { return ok({ count: 12 }); });

    // ---- clients / products (generic CRUD)
    function crud(collection, singular, plural) {
      route("GET", "/api/" + plural, function (ctx) { var o = {}; o[plural] = clone(ctx.data[collection]); return ok(o); });
      route("POST", "/api/" + plural, function (ctx) {
        var now = nowFn().toISOString();
        var item = Object.assign({}, ctx.body || {}, { id: uid(singular.slice(0, 2)), userId: ctx.user.id, createdAt: now, updatedAt: now });
        ctx.data[collection].push(item);
        save();
        var o = {}; o[singular] = clone(item); return ok(o, 201);
      });
      route("GET", "/api/" + plural + "/:id", function (ctx, id) {
        var item = ctx.data[collection].filter(function (x) { return x.id === id; })[0];
        if (!item) return err(404, "Not found");
        var o = {}; o[singular] = clone(item); return ok(o);
      });
      route("PATCH", "/api/" + plural + "/:id", function (ctx, id) {
        var item = ctx.data[collection].filter(function (x) { return x.id === id; })[0];
        if (!item) return err(404, "Not found");
        Object.assign(item, ctx.body || {}, { id: item.id, userId: item.userId, updatedAt: nowFn().toISOString() });
        save();
        var o = {}; o[singular] = clone(item); return ok(o);
      });
      route("DELETE", "/api/" + plural + "/:id", function (ctx, id) {
        var item = ctx.data[collection].filter(function (x) { return x.id === id; })[0];
        if (!item) return err(404, "Not found");
        ctx.data[collection].splice(ctx.data[collection].indexOf(item), 1);
        save();
        return ok({ ok: true });
      });
    }
    crud("clients", "client", "clients");
    crud("products", "product", "products");

    // ---- receipts
    route("GET", "/api/receipts", function (ctx) {
      return ok({ receipts: clone(ctx.data.receipts.slice().sort(function (a, b) { return b.issuedAt.localeCompare(a.issuedAt); })) });
    });
    route("POST", "/api/receipts", function (ctx) {
      var b = ctx.body || {};
      var now = nowFn().toISOString();
      var id = uid("rc");
      var items = (b.lineItems || []).map(function (li, i) { return Object.assign({ unit: "db", vatRate: 27 }, li, { id: li.id || uid("rli"), receiptId: id, sortOrder: i }); });
      var total = b.totalAmount != null ? b.totalAmount : round2(items.reduce(function (s, it) { return s + it.quantity * it.unitPrice * (1 + it.vatRate / 100); }, 0));
      var token = uid("tok");
      var rc = Object.assign({}, b, {
        id: id, userId: ctx.user.id, totalAmount: total, currency: b.currency || "HUF", qrToken: token, qrUrl: "/receipts/view?token=" + token,
        navSubmitted: false, lineItems: items, issuedAt: now, createdAt: now, updatedAt: now,
      });
      if (!rc.receiptNumber) rc.receiptNumber = "NYG-" + nowFn().getFullYear() + "-" + pad(ctx.data.receipts.length + 1, 5);
      ctx.data.receipts.push(rc);
      save();
      return ok({ receipt: clone(rc) }, 201);
    });
    route("GET", "/api/receipts/verify", function (ctx) {
      var token = ctx.params.get("token");
      var rc = null;
      Object.keys(state.data).forEach(function (uid2) {
        state.data[uid2].receipts.forEach(function (r) { if (r.qrToken === token) rc = { r: r, d: state.data[uid2] }; });
      });
      if (!rc) return err(404, "Not found");
      return ok({ verified: true, receiptNumber: rc.r.receiptNumber, clientName: rc.r.clientName, totalAmount: rc.r.totalAmount, currency: rc.r.currency, issuedAt: rc.r.issuedAt, issuerName: rc.d.company ? rc.d.company.name : "Demó Kft." });
    });
    route("GET", "/api/receipts/:id", function (ctx, id) {
      var rc = ctx.data.receipts.filter(function (x) { return x.id === id; })[0];
      if (!rc) return err(404, "Not found");
      return ok({ receipt: clone(rc), navMode: (ctx.data.company && ctx.data.company.navEnvironment) || "demo", navReportId: rc.navSubmitted ? "DEMO-RPT-" + rc.receiptNumber : null, navError: null });
    });
    route("POST", "/api/receipts/:id/submit-nav", function (ctx, id) {
      var rc = ctx.data.receipts.filter(function (x) { return x.id === id; })[0];
      if (!rc) return err(404, "Not found");
      rc.navSubmitted = true;
      save();
      return ok({ ok: true, mode: "demo", receiptCount: 1, transactionId: "RECEIPT-DEMO-" + Date.now() });
    });

    // ---- settings-ish
    route("GET", "/api/reminders", function (ctx) { return ok({ schedules: clone(ctx.data.reminders) }); });
    route("POST", "/api/reminders", function (ctx) {
      var b = ctx.body || {};
      var now = nowFn().toISOString();
      var s = ctx.data.reminders.filter(function (r) { return r.id === b.id; })[0];
      if (!s) {
        s = { id: uid("rm"), userId: ctx.user.id, invoiceId: null, remindersSent: 0, lastSentAt: null, createdAt: now };
        ctx.data.reminders.push(s);
      }
      Object.assign(s, { intervalDays: b.intervalDays, maxReminders: b.maxReminders, enabled: b.enabled !== false, updatedAt: now });
      save();
      return ok({ schedule: clone(s) });
    });
    route("POST", "/api/reminders/run", function (ctx) {
      var overdue = ctx.data.invoices.filter(function (i) { return i.status === "overdue"; }).length;
      return ok({ processed: overdue, sent: overdue, errors: [] });
    });
    route("GET", "/api/email-templates", function (ctx) { return ok({ templates: clone(ctx.data.templates) }); });
    route("PUT", "/api/email-templates/:id", function (ctx, id) {
      var t = ctx.data.templates.filter(function (x) { return x.id === id; })[0];
      if (!t) return err(404, "Not found");
      Object.assign(t, ctx.body || {}, { id: t.id, updatedAt: nowFn().toISOString() });
      save();
      return ok({ template: clone(t) });
    });
    route("PATCH", "/api/email-templates/:id", function (ctx, id) {
      var t = ctx.data.templates.filter(function (x) { return x.id === id; })[0];
      if (!t) return err(404, "Not found");
      Object.assign(t, ctx.body || {}, { id: t.id, updatedAt: nowFn().toISOString() });
      save();
      return ok({ template: clone(t) });
    });
    route("GET", "/api/pdf-template", function (ctx) { return ok({ template: clone(ctx.data.pdfTemplate) }); });
    route("PUT", "/api/pdf-template", function (ctx) { Object.assign(ctx.data.pdfTemplate, ctx.body || {}); save(); return ok({ template: clone(ctx.data.pdfTemplate) }); });
    route("PATCH", "/api/pdf-template", function (ctx) { Object.assign(ctx.data.pdfTemplate, ctx.body || {}); save(); return ok({ template: clone(ctx.data.pdfTemplate) }); });
    route("POST", "/api/pdf-template", function (ctx) {
      // "preview sample" — the prototype answers with a tiny PDF.
      return { status: 200, pdf: tinyPdf(["PDF sablon elonezet (design prototipus)", String((ctx.body && ctx.body.titleText) || "SZAMLA")]) };
    });
    route("GET", "/api/api-keys", function (ctx) { return ok({ keys: clone(ctx.data.apiKeys) }); });
    route("POST", "/api/api-keys", function (ctx) {
      var now = nowFn().toISOString();
      var key = { id: uid("key"), userId: ctx.user.id, name: (ctx.body && ctx.body.name) || "Új kulcs", publicKey: "pk_demo_" + Math.random().toString(36).slice(2, 12), enabled: true, lastUsedAt: null, createdAt: now, updatedAt: now };
      ctx.data.apiKeys.push(key);
      save();
      return ok({ key: Object.assign({ secretKey: "sk_demo_" + Math.random().toString(36).slice(2, 22) }, key) }, 201);
    });
    route("DELETE", "/api/api-keys/:id", function (ctx, id) {
      ctx.data.apiKeys = ctx.data.apiKeys.filter(function (k) { return k.id !== id; });
      save();
      return ok({ ok: true });
    });

    // ---- admin
    route("GET", "/api/admin/users", function (ctx) {
      if (ctx.user.role !== "admin") return err(403, "Forbidden");
      var sum = function (f) { return state.users.reduce(function (s, u) { return s + f(dataFor(u)); }, 0); };
      return ok({
        users: state.users.map(function (u) {
          var d = dataFor(u);
          return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt, companyName: d.company ? d.company.name : null };
        }),
        stats: { users: state.users.length, companies: sum(function (d) { return d.company ? 1 : 0; }), invoices: sum(function (d) { return d.invoices.length; }), clients: sum(function (d) { return d.clients.length; }), products: sum(function (d) { return d.products.length; }) },
      });
    });
    route("PATCH", "/api/admin/users/:id", function (ctx, id) {
      if (ctx.user.role !== "admin") return err(403, "Forbidden");
      var u = state.users.filter(function (x) { return x.id === id; })[0];
      if (!u) return err(404, "Not found");
      if (ctx.body && ctx.body.role) u.role = ctx.body.role;
      save();
      return ok({ user: publicUser(u) });
    });
    route("GET", "/api/admin/api-docs", function () { return ok({ openapi: "3.0.0", info: { title: "InvoHub API (demó)", version: "1.0" }, paths: {} }); });

    // ---------------------------------------------------------------- entry
    var PUBLIC = [/^\/api\/auth\//, /^\/api\/receipts\/verify$/, /^\/api\/exchange-rates$/];

    function handle(method, pathAndQuery, bodyText) {
      var url = new URL(pathAndQuery, "https://x.invalid");
      var path = url.pathname;
      method = String(method || "GET").toUpperCase();
      var body = null;
      if (bodyText) { try { body = JSON.parse(bodyText); } catch (e) { body = null; } }
      var user = currentUser();
      var isPublic = PUBLIC.some(function (re) { return re.test(path); });
      if (!user && !isPublic) return err(401, "Unauthorized");
      for (var i = 0; i < routes.length; i++) {
        var r = routes[i];
        if (r.method !== method) continue;
        var m = r.re.exec(path);
        if (!m) continue;
        var ctx = { params: url.searchParams, body: body, user: user, data: user ? dataFor(user) : null };
        return r.handler.apply(null, [ctx].concat(m.slice(1).map(decodeURIComponent)));
      }
      if (typeof console !== "undefined") console.warn("[prototype] unmocked API call: " + method + " " + path);
      return method === "GET" ? ok({}) : ok({ ok: true });
    }

    return {
      handle: handle,
      state: function () { return state; },
      signInAs: function (userId) {
        if (!state.users.some(function (u) { return u.id === userId; })) return false;
        state.sessionUserId = userId;
        save();
        return true;
      },
      signOut: function () { state.sessionUserId = null; save(); },
      reset: function () {
        var keep = state.sessionUserId;
        state = seedAll(nowFn());
        state.sessionUserId = keep;
        save();
      },
      users: function () { return state.users.map(publicUser); },
      invoiceIds: function (userId) { return (state.data[userId] || emptyData()).invoices.map(function (i) { return { id: i.id, number: i.invoiceNumber, status: i.status, documentType: i.documentType, client: i.clientName }; }); },
      firstIds: function (userId) {
        var d = state.data[userId] || emptyData();
        return { client: d.clients[0] && d.clients[0].id, product: d.products[0] && d.products[0].id, receipt: d.receipts[0] && d.receipts[0].id };
      },
    };
  }

  return { createBackend: createBackend, PASSWORD: PASSWORD, STORAGE_KEY: STORAGE_KEY };
});
