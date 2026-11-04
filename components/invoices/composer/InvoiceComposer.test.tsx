// components/invoices/composer/InvoiceComposer.test.tsx
// Covers the two behaviours this slice adds to the composer:
//  - the finalized-invoice read-only branch now offers Sztornó/Helyesbítő
//    (not just an explanation) — hidden for a proforma, which storno
//    explicitly refuses (lib/invoices/storno-handler.ts).
//  - a NEW document's finalize buttons are blocked, with a Hungarian
//    notice + link to company settings, when the seller's company profile
//    is missing required fields (lib/companies/completeness.ts).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});

const mockUseIsDesktop = jest.fn(() => false);
jest.mock("@/lib/useIsDesktop", () => ({
  useIsDesktop: () => mockUseIsDesktop(),
}));

// The live/saved PDF preview (InvoicePdfPreview, ComposerPreviewButton's
// drawer) renders the real PDF over the network — irrelevant here.
jest.mock("@/components/invoices/InvoicePdfPreview", () => ({
  InvoicePdfPreview: () => null,
}));

const mockConfirmAsync = jest.fn();
jest.mock("@/lib/ui/confirm", () => ({
  confirmAsync: (...args: unknown[]) => mockConfirmAsync(...args),
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  ApiError: jest.requireActual("@/lib/api/client").ApiError,
}));

const COMPLETE_COMPANY = {
  id: "c1",
  userId: "u1",
  name: "Acme Kft.",
  taxNumber: "12345678-1-23",
  zipCode: "1011",
  city: "Budapest",
  address: "Fő utca 1.",
  createdAt: "",
  updatedAt: "",
};
let mockCompany: Record<string, unknown> | null = COMPLETE_COMPANY;
jest.mock("@/hooks/useCompany", () => ({
  useCompany: () => ({
    company: mockCompany,
    loading: false,
    save: jest.fn(),
    lookup: jest.fn(),
  }),
}));

jest.mock("@/hooks/useClients", () => ({
  useClients: () => ({ clients: [] }),
}));

jest.mock("@/hooks/useProducts", () => ({
  useProducts: () => ({ products: [] }),
}));

const mockAddOrUpdate = jest.fn();
let mockInvoices: unknown[] = [];
jest.mock("@/hooks/useInvoices", () => ({
  useInvoices: () => ({ addOrUpdate: mockAddOrUpdate, invoices: mockInvoices }),
}));

const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/vstack", () => mockUi);
jest.mock("@/components/ui/hstack", () => mockUi);
jest.mock("@/components/ui/card", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/ui/pressable", () => mockUi);
jest.mock("@/components/ui/badge", () => mockUi);
jest.mock("@/components/ui/button", () => ({
  Button: mockUi.Pressable,
  ButtonText: mockUi.Text,
  ButtonSpinner: mockUi.View,
}));
jest.mock("@/components/ui/input", () => ({ Input: mockUi.View, InputField: mockUi.Text }));
jest.mock("@/components/ui/textarea", () => ({ Textarea: mockUi.View, TextareaInput: mockUi.Text }));
jest.mock("@/components/ui/form-control", () => ({
  FormControl: mockUi.View,
  FormControlLabel: mockUi.View,
  FormControlLabelText: mockUi.Text,
}));
jest.mock("@/components/ui/heading", () => ({ Heading: mockUi.Text }));
jest.mock("@/components/ui/spinner", () => ({ Spinner: mockUi.View }));
jest.mock("@/components/ui/divider", () => ({ Divider: mockUi.View }));
jest.mock("@/components/ui/drawer", () => ({
  Drawer: mockUi.View,
  DrawerBackdrop: mockUi.View,
  DrawerContent: mockUi.View,
  DrawerHeader: mockUi.View,
  DrawerBody: mockUi.View,
  DrawerFooter: mockUi.View,
  DrawerCloseButton: mockUi.Pressable,
}));

// require (not a top-level `import`), on purpose: Babel hoists ES `import`
// statements above plain `const x = require(...)` lines regardless of
// source order, which would pull in InvoiceComposer.tsx — and the
// "@/components/ui/button" mock factory that reads `mockUi` — before
// `mockUi` above is assigned. Every other full-screen-render test in this
// repo (app-pages.smoke.test.tsx, invoice-detail.test.tsx) uses the same
// require-after-mockUi pattern for exactly this reason.
const { InvoiceComposer } = require("@/components/invoices/composer/InvoiceComposer");
import type { UseInvoiceComposerOptions } from "@/components/invoices/composer/useInvoiceComposer";

// A testID prop is set on a Gluestack primitive (e.g. Box) AND flows down
// through to the underlying RN host element via {...props} — both fiber
// nodes match the same testID, so this always returns >=1 entries (2 when
// present, 0 when not); every present-check below uses `.length > 0` and
// every absent-check uses `.length === 0` for exactly that reason.
function findByTestID(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAllByProps({ testID });
}

async function renderComposer(props: UseInvoiceComposerOptions) {
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<InvoiceComposer {...props} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree!;
}

describe("InvoiceComposer — finalized invoice read-only branch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompany = COMPLETE_COMPANY;
  });

  it("offers Sztornó and Helyesbítő for a finalized (non-proforma) invoice", async () => {
    const invoice = makeInvoice({ id: "inv-1", documentType: "invoice", status: "sent" });
    const tree = await renderComposer({ mode: "edit", invoice });

    expect(findByTestID(tree, "composer-readonly-storno").length).toBeGreaterThan(0);
    expect(findByTestID(tree, "composer-readonly-correction").length).toBeGreaterThan(0);
    expect(findByTestID(tree, "composer-readonly-back").length).toBeGreaterThan(0);
  });

  it("hides Sztornó and Helyesbítő for a finalized proforma — storno refuses proforma documents", async () => {
    const invoice = makeInvoice({ id: "inv-1", documentType: "proforma", status: "proforma" });
    const tree = await renderComposer({ mode: "edit", invoice });

    expect(findByTestID(tree, "composer-readonly-storno")).toHaveLength(0);
    expect(findByTestID(tree, "composer-readonly-correction")).toHaveLength(0);
    expect(findByTestID(tree, "composer-readonly-back").length).toBeGreaterThan(0);
  });

  it("renders the normal editable form (no read-only banner) for a draft invoice", async () => {
    const invoice = makeInvoice({ id: "inv-1", status: "draft", invoiceNumber: "" });
    const tree = await renderComposer({ mode: "edit", invoice });

    expect(findByTestID(tree, "composer-readonly-back")).toHaveLength(0);
  });

  it("Sztornó confirms, posts to /storno, and navigates to the new storno document", async () => {
    const invoice = makeInvoice({ id: "inv-1", documentType: "invoice", status: "sent" });
    mockConfirmAsync.mockResolvedValue(true);
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/invoices/inv-1/storno") {
        return { invoice: makeInvoice({ id: "storno-1", documentType: "storno" }) };
      }
      throw new Error(`unexpected path ${path}`);
    });

    const tree = await renderComposer({ mode: "edit", invoice });
    const [stornoButton] = findByTestID(tree, "composer-readonly-storno");

    await act(async () => {
      stornoButton.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/invoices/inv-1/storno", { method: "POST" });
    expect(mockReplace).toHaveBeenCalledWith("/invoices/storno-1");
  });

  it("Sztornó does nothing when the confirmation is declined", async () => {
    const invoice = makeInvoice({ id: "inv-1", documentType: "invoice", status: "sent" });
    mockConfirmAsync.mockResolvedValue(false);

    const tree = await renderComposer({ mode: "edit", invoice });
    const [stornoButton] = findByTestID(tree, "composer-readonly-storno");

    await act(async () => {
      stornoButton.props.onPress?.();
      await Promise.resolve();
    });

    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("Helyesbítő confirms, posts to /modify, and navigates to the new correction draft's edit screen", async () => {
    const invoice = makeInvoice({ id: "inv-1", documentType: "invoice", status: "sent" });
    mockConfirmAsync.mockResolvedValue(true);
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/invoices/inv-1/modify") {
        return { invoice: makeInvoice({ id: "corr-1", documentType: "modify", status: "draft" }) };
      }
      throw new Error(`unexpected path ${path}`);
    });

    const tree = await renderComposer({ mode: "edit", invoice });
    const [correctionButton] = findByTestID(tree, "composer-readonly-correction");

    await act(async () => {
      correctionButton.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/invoices/inv-1/modify", { method: "POST" });
    expect(mockPush).toHaveBeenCalledWith("/invoices/corr-1/edit");
  });

  it("the back button navigates to the invoice detail page", async () => {
    const invoice = makeInvoice({ id: "inv-1", documentType: "invoice", status: "sent" });
    const tree = await renderComposer({ mode: "edit", invoice });
    const [backButton] = findByTestID(tree, "composer-readonly-back");

    await act(async () => {
      backButton.props.onPress?.();
    });

    expect(mockPush).toHaveBeenCalledWith("/invoices/inv-1");
  });
});

describe("InvoiceComposer — company profile gate on finalize (new document)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompany = COMPLETE_COMPANY;
    mockUseIsDesktop.mockReturnValue(true);
  });

  it("shows the incomplete-profile notice and disables the finalize trigger when the company profile is missing fields", async () => {
    mockCompany = { id: "c1", userId: "u1", name: "Acme Kft.", createdAt: "", updatedAt: "" }; // no taxNumber/address/city/zipCode

    const tree = await renderComposer({ mode: "create" });

    expect(findByTestID(tree, "composer-company-profile-incomplete-notice").length).toBeGreaterThan(0);
    const [finalizeTrigger] = findByTestID(tree, "composer-finalize-menu-trigger");
    expect(finalizeTrigger.props.disabled).toBe(true);

    // Save draft must still work — a draft never needs a real number.
    const [saveDraft] = findByTestID(tree, "composer-save-draft");
    expect(saveDraft.props.disabled).toBeFalsy();
  });

  it("does not show the notice, and finalize stays enabled, once the profile is complete", async () => {
    const tree = await renderComposer({ mode: "create" });

    expect(findByTestID(tree, "composer-company-profile-incomplete-notice")).toHaveLength(0);
    const [finalizeTrigger] = findByTestID(tree, "composer-finalize-menu-trigger");
    expect(finalizeTrigger.props.disabled).toBeFalsy();
  });

  it("the notice's link navigates to company settings", async () => {
    mockCompany = null;
    const tree = await renderComposer({ mode: "create" });

    const [link] = findByTestID(tree, "composer-company-profile-incomplete-link");
    await act(async () => {
      link.props.onPress?.();
    });

    expect(mockPush).toHaveBeenCalledWith("/settings/company");
  });
});


describe("InvoiceComposer — one scrolling page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompany = COMPLETE_COMPANY;
    mockInvoices = [];
  });

  function texts(tree: TestRenderer.ReactTestRenderer) {
    return tree.root
      .findAll((n) => typeof n.props?.children === "string")
      .map((n) => n.props.children as string);
  }

  it.each([true, false])("renders every section on one page, with no stepper (desktop=%s)", async (desktop) => {
    mockUseIsDesktop.mockReturnValue(desktop);
    const tree = await renderComposer({ mode: "create" });

    for (const id of [
      "composer-type-switch",
      "composer-section-partner",
      "composer-section-dates",
      "composer-section-items",
      "composer-section-dispatch",
      "composer-more-settings",
      "composer-bottom-bar",
    ]) {
      expect(findByTestID(tree, id).length).toBeGreaterThan(0);
    }
    expect(findByTestID(tree, "composer-stepper")).toHaveLength(0);
    expect(findByTestID(tree, "composer-desktop-next")).toHaveLength(0);
    expect(findByTestID(tree, "composer-mobile-primary-action")).toHaveLength(0);
  });

  it("puts the sections in reading order", async () => {
    const tree = await renderComposer({ mode: "create" });
    const order = [
      "composer-action-bar",
      "composer-type-switch",
      "composer-section-partner",
      "composer-section-dates",
      "composer-section-items",
      "composer-section-dispatch",
      "composer-more-settings",
      "composer-bottom-bar",
    ];
    const json = JSON.stringify(tree.toJSON());
    const positions = order.map((id) => json.indexOf(`"testID":"${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("titles a new document 'Új bizonylat kiállítása' and a draft edit 'Piszkozat szerkesztése'", async () => {
    const created = await renderComposer({ mode: "create" });
    expect(texts(created)).toContain("invoices.newDocument");
    const edited = await renderComposer({
      mode: "edit",
      invoice: makeInvoice({ id: "d1", status: "draft", invoiceNumber: "" }),
    });
    expect(texts(edited)).toContain("composer.editTitle");
  });

  it("opens with the preview closed and the type switch showing the three existing types", async () => {
    const tree = await renderComposer({ mode: "create" });
    expect(findByTestID(tree, "composer-live-preview")).toHaveLength(0);
    expect(findByTestID(tree, "composer-side-preview")).toHaveLength(0);
    expect(findByTestID(tree, "composer-open-preview").length).toBeGreaterThan(0);
    for (const type of ["invoice", "proforma", "advance"]) {
      expect(findByTestID(tree, `composer-type-${type}`).length).toBeGreaterThan(0);
    }
  });

  it("keeps 'További beállítások' closed by default and shows only language and notes when opened", async () => {
    const tree = await renderComposer({ mode: "create" });
    expect(findByTestID(tree, "composer-notes")).toHaveLength(0);
    const [toggle] = findByTestID(tree, "composer-more-settings-toggle");
    expect(toggle.props["aria-expanded"]).toBe(false);

    await act(async () => {
      toggle.props.onPress?.();
    });
    expect(findByTestID(tree, "composer-notes").length).toBeGreaterThan(0);
    expect(findByTestID(tree, "composer-language").length).toBeGreaterThan(0);
    // fields the schema does not have must not appear
    const all = JSON.stringify(tree.toJSON()).toLowerCase();
    for (const forbidden of ["megrendel", "kedvezm", "ismétlődő", "recurring", "discount", "purchaseorder"]) {
      expect(all).not.toContain(forbidden);
    }
  });

  it("keeps the dates card closed by default and opens it with aria-expanded", async () => {
    const tree = await renderComposer({ mode: "create" });
    expect(findByTestID(tree, "composer-terms-edit")).toHaveLength(0);
    const [toggle] = findByTestID(tree, "composer-terms-toggle");
    expect(toggle.props["aria-expanded"]).toBe(false);
    await act(async () => {
      toggle.props.onPress?.();
    });
    expect(findByTestID(tree, "composer-terms-edit").length).toBeGreaterThan(0);
    expect(findByTestID(tree, "composer-fulfillment-chips").length).toBeGreaterThan(0);
    expect(findByTestID(tree, "composer-deadline-chips").length).toBeGreaterThan(0);
  });

  it("offers the copy-from-invoice link when creating, not when editing a draft", async () => {
    const created = await renderComposer({ mode: "create" });
    expect(findByTestID(created, "composer-copy-from").length).toBeGreaterThan(0);
    const edited = await renderComposer({
      mode: "edit",
      invoice: makeInvoice({ id: "d1", status: "draft", invoiceNumber: "" }),
    });
    expect(findByTestID(edited, "composer-copy-from")).toHaveLength(0);
  });

  it("shows the NAV note unchanged for a számla and not for a díjbekérő", async () => {
    const tree = await renderComposer({ mode: "create" });
    expect(texts(tree)).toContain("invoices.fields.navSubmitHint");
    const [proforma] = findByTestID(tree, "composer-type-proforma");
    await act(async () => {
      proforma.props.onPress?.();
    });
    expect(texts(tree)).not.toContain("invoices.fields.navSubmitHint");
  });
});

describe("InvoiceComposer — type switch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompany = COMPLETE_COMPANY;
    mockInvoices = [];
  });

  it("lets a draft's type change", async () => {
    const tree = await renderComposer({
      mode: "edit",
      invoice: makeInvoice({ id: "inv-d", status: "draft", invoiceNumber: "", documentType: "invoice" }),
    });
    const radios = tree.root.findAll((n) => n.props.accessibilityRole === "radio" || n.props.role === "radio");
    expect(radios.length).toBeGreaterThan(0);
    expect(radios.every((radio) => !radio.props.disabled)).toBe(true);
  });

  it("is not rendered on the read-only (finalized) branch, where the type cannot change", async () => {
    const tree = await renderComposer({
      mode: "edit",
      invoice: makeInvoice({ id: "inv-1", status: "sent", documentType: "invoice" }),
    });
    expect(findByTestID(tree, "composer-type-switch")).toHaveLength(0);
  });
});

describe("InvoiceComposer — finalize is one click, sending is the secondary option", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompany = COMPLETE_COMPANY;
    mockInvoices = [];
    mockApiFetch.mockImplementation(async () => ({}));
  });

  it("offers Piszkozat mentése and the finalize split button in the bottom bar", async () => {
    const tree = await renderComposer({ mode: "create" });
    expect(findByTestID(tree, "composer-save-draft").length).toBeGreaterThan(0);
    expect(findByTestID(tree, "composer-action-finalize").length).toBeGreaterThan(0);
    expect(findByTestID(tree, "composer-finalize-menu-trigger").length).toBeGreaterThan(0);
  });

  it("opens the 'finalize and send' menu from the chevron only", async () => {
    const tree = await renderComposer({ mode: "create" });
    expect(findByTestID(tree, "composer-action-finalize-send")).toHaveLength(0);
    const [trigger] = findByTestID(tree, "composer-finalize-menu-trigger");
    await act(async () => {
      trigger.props.onPress?.();
    });
    expect(findByTestID(tree, "composer-action-finalize-send").length).toBeGreaterThan(0);
  });

  it("reports a missing partner in the bottom bar when finalize is pressed", async () => {
    const tree = await renderComposer({ mode: "create" });
    const [finalize] = findByTestID(tree, "composer-action-finalize");
    await act(async () => {
      finalize.props.onPress?.();
      await Promise.resolve();
    });
    expect(findByTestID(tree, "composer-bottom-error").length).toBeGreaterThan(0);
    // Nothing is saved. A debounced company lookup left over from an earlier
    // test can still land here on a slow runner, so only it is tolerated.
    const nonSearchCalls = mockApiFetch.mock.calls.filter(
      ([url]) => !String(url).startsWith("/api/company/search")
    );
    expect(nonSearchCalls).toHaveLength(0);
  });

  it("offers the finalize button when editing a draft", async () => {
    const tree = await renderComposer({
      mode: "edit",
      invoice: makeInvoice({ id: "inv-d", status: "draft", invoiceNumber: "", documentType: "invoice" }),
    });
    expect(findByTestID(tree, "composer-action-finalize").length).toBeGreaterThan(0);
  });

  it("disables the primary finalize button too when the company profile is incomplete", async () => {
    mockCompany = { id: "c1", userId: "u1", name: "Acme Kft.", createdAt: "", updatedAt: "" };
    const tree = await renderComposer({ mode: "create" });
    const [finalize] = findByTestID(tree, "composer-action-finalize");
    expect(finalize.props.disabled).toBe(true);
  });
});

describe("InvoiceComposer — saving a draft sends the same request body as before the redesign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompany = COMPLETE_COMPANY;
    mockInvoices = [];
  });

  it("passes the invoice payload built from the form to addOrUpdate, as status 'draft'", async () => {
    const invoice = makeInvoice({
      id: "inv-d",
      status: "draft",
      invoiceNumber: "",
      documentType: "invoice",
      clientName: "Zöld Energia Zrt.",
      clientTaxNumber: "23456789-2-13",
      clientZipCode: "6720",
      clientCity: "Szeged",
      clientAddress: "Fő utca 22.",
      clientCountry: "Magyarország",
      issueDate: "2026-11-03",
      fulfillmentDate: "2026-11-03",
      dueDate: "2026-11-11",
      paymentMethod: "transfer",
      language: "hu",
      notes: "Köszönjük",
      lineItems: [
        { id: "l1", description: "Oktatás", quantity: 1, unitPrice: 150000, vatRate: 27, vatCategory: "normal", unit: "nap" },
      ],
    });
    mockAddOrUpdate.mockResolvedValue(invoice);
    const tree = await renderComposer({ mode: "edit", invoice });

    const [saveDraft] = findByTestID(tree, "composer-save-draft");
    await act(async () => {
      saveDraft.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockAddOrUpdate).toHaveBeenCalledTimes(1);
    const payload = mockAddOrUpdate.mock.calls[0][0];
    expect(payload).toMatchObject({
      id: "inv-d",
      invoiceNumber: "",
      documentType: "invoice",
      clientName: "Zöld Energia Zrt.",
      clientTaxNumber: "23456789-2-13",
      clientZipCode: "6720",
      clientCity: "Szeged",
      clientAddress: "Fő utca 22.",
      clientCountry: "Magyarország",
      issueDate: "2026-11-03",
      fulfillmentDate: "2026-11-03",
      dueDate: "2026-11-11",
      status: "draft",
      currency: "HUF",
      notes: "Köszönjük",
      paymentMethod: "transfer",
      language: "hu",
    });
    expect(payload.lineItems).toEqual(invoice.lineItems);
    // nothing about sending or NAV is called for a draft
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
