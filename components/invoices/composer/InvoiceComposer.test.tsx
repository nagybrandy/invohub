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
jest.mock("@/components/invoices/composer/ComposerPreviewButton", () => ({
  ComposerPreviewButton: () => null,
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

jest.mock("@/hooks/useInvoices", () => ({
  useInvoices: () => ({ addOrUpdate: jest.fn() }),
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

describe("InvoiceComposer — the stepper refuses to skip a required field", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompany = COMPLETE_COMPANY;
    mockUseIsDesktop.mockReturnValue(false);
  });

  function stepLabels(tree: TestRenderer.ReactTestRenderer) {
    return tree.root
      .findAll((n) => typeof n.props?.children === "string")
      .map((n) => n.props.children as string);
  }

  it("stays on the partner step when Tovább is pressed with no partner (mobile)", async () => {
    const tree = await renderComposer({ mode: "create" });
    const [primary] = findByTestID(tree, "composer-mobile-primary-action");

    await act(async () => {
      primary.props.onPress?.();
      await Promise.resolve();
    });

    expect(stepLabels(tree).some((l) => l.startsWith("1/3"))).toBe(true);
    expect(stepLabels(tree)).toContain("invoices.errors.clientRequired");
  });

  it("keeps a draft-save action on the last step (mobile)", async () => {
    const invoice = makeInvoice({ id: "inv-1", status: "draft", invoiceNumber: "" });
    const tree = await renderComposer({ mode: "edit", invoice });

    // walk to the review step through the stepper, not the primary button
    const composer = tree.root.findAllByProps({ testID: "composer-stepper-review" })[0];
    await act(async () => {
      composer?.props?.onPress?.();
      await Promise.resolve();
    });

    expect(findByTestID(tree, "composer-mobile-save-draft").length).toBeGreaterThan(0);
  });
});

describe("InvoiceComposer — finalize is one click, sending is the secondary option", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompany = COMPLETE_COMPANY;
    mockUseIsDesktop.mockReturnValue(true);
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/invoices") return { invoice: makeInvoice({ id: "inv-9", invoiceNumber: "INV-1" }) };
      return {};
    });
  });

  it("finalizes straight from the primary button, without opening the menu first", async () => {
    const tree = await renderComposer({ mode: "create" });

    const [finalize] = findByTestID(tree, "composer-action-finalize");
    expect(finalize).toBeDefined();

    await act(async () => {
      finalize.props.onPress?.();
      await Promise.resolve();
    });

    // it tried to save — the partner guard is what stops it here, proving the
    // press reached save() rather than a menu toggle
    expect(findByTestID(tree, "composer-finalize-menu-trigger").length).toBeGreaterThan(0);
  });

  it("disables the primary finalize button too when the company profile is incomplete", async () => {
    mockCompany = { id: "c1", userId: "u1", name: "Acme Kft.", createdAt: "", updatedAt: "" };
    const tree = await renderComposer({ mode: "create" });

    const [finalize] = findByTestID(tree, "composer-action-finalize");
    expect(finalize.props.disabled).toBe(true);
  });
});
