// __tests__/screens/invoice-detail.test.tsx
// Focused coverage for the invoice detail screen's new mark-paid/correction/links behavior.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert } from "react-native";
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import { ApiError } from "@/lib/api/client";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));

jest.mock("@/lib/routing/route-param", () => ({
  useRouteParam: () => "inv-1",
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => {
  const actual = jest.requireActual("@/lib/api/client");
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

jest.mock("@/components/invoices/InvoiceDocumentPreview", () => ({
  InvoiceDocumentPreview: () => null,
}));

jest.mock("@/components/layout/PageHeader", () => {
  const mockUi = require("@/__tests__/mocks/gluestack-ui");
  return { PageHeader: mockUi.View };
});
jest.mock("@/components/layout/ScreenLayout", () => ({
  ScreenLayout: ({ children }: { children?: React.ReactNode }) => children ?? null,
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
}));
jest.mock("@/components/ui/input", () => {
  const { TextInput } = require("react-native");
  return {
    Input: ({ children }: { children?: React.ReactNode }) => children ?? null,
    InputField: (props: Record<string, unknown>) => <TextInput {...props} />,
  };
});
jest.mock("@/components/ui/form-control", () => ({
  FormControl: mockUi.View,
  FormControlLabel: mockUi.View,
  FormControlLabelText: mockUi.Text,
}));

async function renderScreen() {
  const InvoiceDetailScreen = require("@/app/(app)/invoices/[id]/index").default;
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<InvoiceDetailScreen />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree!;
}

function textUnder(node: TestRenderer.ReactTestInstance): string {
  const parts = node
    .findAll((n) => {
      const c = n.props?.children;
      return typeof c === "string" || (Array.isArray(c) && c.some((x) => typeof x === "string"));
    })
    .map((n) => {
      const c = n.props.children;
      return Array.isArray(c) ? c.filter((x) => typeof x === "string").join("") : (c as string);
    });
  return parts.join(" | ");
}

function findPressableWithText(root: TestRenderer.ReactTestInstance, text: string) {
  return root
    .findAll((node) => typeof node.props?.onPress === "function")
    .find((node) => node.findAll((child) => child.props?.children === text).length > 0);
}

describe("InvoiceDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Generous timeout (jest.config.js's 10s default plus, for just this
  // test): this is the only test in the file whose invoice has a linked
  // originalInvoice, so it's the only one that mounts the real (unmocked)
  // linked-document row/InvoiceTimeline/InvoiceMoneyHeader subtree — real,
  // bounded work, not a hang, but consistently >10s on a coverage-
  // instrumented CI runner even though it's <1s locally (2026-09-15).
  it("shows related documents when the invoice has a storno original", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return {
          originalInvoice: { id: "inv-0", invoiceNumber: "INV-2026-000" },
          modifiesInvoice: null,
          stornoDocuments: [],
          correctionDocuments: [],
        };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", originalInvoiceId: "inv-0" }) };
    });

    const tree = await renderScreen();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.links.title");
    expect(json).toContain("INV-2026-000");
  }, 30000);

  it("mark-paid panel toggles and posts payment on confirm", async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      if (path.includes("/mark-paid")) {
        expect(init?.method).toBe("POST");
        return { invoice: makeInvoice({ id: "inv-1", status: "paid" }) };
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "sent" }) };
    });

    const tree = await renderScreen();

    const toggleButton = findPressableWithText(tree.root, "invoices.markPaid.action");
    await act(async () => {
      toggleButton?.props.onPress?.();
    });

    const confirmButton = findPressableWithText(tree.root, "invoices.markPaid.confirm");
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      confirmButton?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    const markPaidCall = mockApiFetch.mock.calls.find(([path]) => path.includes("/mark-paid"));
    expect(markPaidCall).toBeTruthy();
  });

  it("the mark-paid button is disabled for a draft invoice", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "draft" }) };
    });

    const tree = await renderScreen();
    const toggleButton = findPressableWithText(tree.root, "invoices.markPaid.action");
    expect(toggleButton?.props.disabled).toBe(true);
  });

  it("correction action (in the Továbbiak menu) confirms via Alert then navigates to the new draft's edit screen", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      if (path.includes("/modify")) {
        return { invoice: makeInvoice({ id: "modify-1", documentType: "modify" }) };
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "sent" }) };
    });

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find((b) => b.text === "invoices.correction.confirm");
      confirm?.onPress?.();
    });

    const tree = await renderScreen();

    // Correction now lives in the row's "Továbbiak" (⋯) menu (D1) — open it first.
    const overflowTrigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    await act(async () => {
      overflowTrigger.props.onPress?.({});
    });
    const correctionButton = findPressableWithText(tree.root, "invoices.correction.action");

    await act(async () => {
      correctionButton?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledWith("/invoices/modify-1/edit");
    alertSpy.mockRestore();
  });

  it("has exactly one solid (non-outline) button, and Sztornó/Törlés live in a danger zone (AC10)", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "sent" }) };
    });

    const tree = await renderScreen();

    const buttons = tree.root.findAll(
      (node) => node.type === mockUi.Pressable && "variant" in (node.props ?? {})
    );
    const solidButtons = buttons.filter((b) => (b.props.variant ?? "default") === "default");
    expect(solidButtons).toHaveLength(1);

    const dangerZoneToggle = tree.root.findByProps({ testID: "danger-zone-toggle" });
    act(() => {
      dangerZoneToggle.props.onPress?.();
    });
    const dangerZoneContent = tree.root.findByProps({ testID: "danger-zone-content" });
    const text = textUnder(dangerZoneContent);
    expect(text).toContain("invoices.storno");
    expect(text).toContain("invoices.detail.deleteAction");
  });

  it("on a díjbekérő with no conversion, the primary action converts and navigates to the new draft's edit screen", async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("/links")) {
        return {
          originalInvoice: null,
          modifiesInvoice: null,
          stornoDocuments: [],
          correctionDocuments: [],
          convertedFromInvoice: null,
          convertedToInvoices: [],
        };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      if (path.includes("/convert")) {
        expect(init?.method).toBe("POST");
        return { invoice: makeInvoice({ id: "converted-1", documentType: "invoice", status: "draft" }) };
      }
      return { invoice: makeInvoice({ id: "inv-1", documentType: "proforma", status: "proforma" }) };
    });

    const tree = await renderScreen();
    const primaryButton = findPressableWithText(tree.root, "invoices.convert.action");
    expect(primaryButton).toBeTruthy();

    await act(async () => {
      primaryButton?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledWith("/invoices/converted-1/edit");
  });

  it("on a díjbekérő with a live conversion, the primary action opens it without posting", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return {
          originalInvoice: null,
          modifiesInvoice: null,
          stornoDocuments: [],
          correctionDocuments: [],
          convertedFromInvoice: null,
          convertedToInvoices: [
            makeInvoice({ id: "existing-inv", documentType: "invoice", status: "draft" }),
          ],
        };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", documentType: "proforma", status: "proforma" }) };
    });

    const tree = await renderScreen();
    const primaryButton = findPressableWithText(tree.root, "invoices.convert.openExisting");
    expect(primaryButton).toBeTruthy();

    await act(async () => {
      primaryButton?.props.onPress?.();
    });

    expect(mockPush).toHaveBeenCalledWith("/invoices/existing-inv");
    const convertCall = mockApiFetch.mock.calls.find(([path]) => (path as string).includes("/convert"));
    expect(convertCall).toBeFalsy();
  });

  it("on a 409 from /convert (a live conversion was created concurrently), navigates to the existing invoice instead of showing an error", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return {
          originalInvoice: null,
          modifiesInvoice: null,
          stornoDocuments: [],
          correctionDocuments: [],
          convertedFromInvoice: null,
          convertedToInvoices: [],
        };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      if (path.includes("/convert")) {
        throw new ApiError("Conflict", 409, "alreadyConverted", {
          code: "alreadyConverted",
          invoice: makeInvoice({ id: "race-existing", documentType: "invoice", status: "draft" }),
        });
      }
      return { invoice: makeInvoice({ id: "inv-1", documentType: "proforma", status: "proforma" }) };
    });

    const tree = await renderScreen();
    const primaryButton = findPressableWithText(tree.root, "invoices.convert.action");

    await act(async () => {
      primaryButton?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledWith("/invoices/race-existing");
    const messages = textUnder(tree.root);
    expect(messages).not.toContain("invoices.detail.actionFailed");
  });

  it("on a 400 'notProforma' from /convert, shows the translated invoices.convert.notProforma copy instead of a raw/blank message", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return {
          originalInvoice: null,
          modifiesInvoice: null,
          stornoDocuments: [],
          correctionDocuments: [],
          convertedFromInvoice: null,
          convertedToInvoices: [],
        };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      if (path.includes("/convert")) {
        throw new ApiError("Bad Request", 400, "notProforma", { code: "notProforma" });
      }
      return { invoice: makeInvoice({ id: "inv-1", documentType: "proforma", status: "proforma" }) };
    });

    const tree = await renderScreen();
    const primaryButton = findPressableWithText(tree.root, "invoices.convert.action");

    await act(async () => {
      primaryButton?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(textUnder(tree.root)).toContain("invoices.convert.notProforma");
  });

  it("on a díjbekérő, the Helyesbítő entry is disabled and the danger zone shows only Törlés", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return {
          originalInvoice: null,
          modifiesInvoice: null,
          stornoDocuments: [],
          correctionDocuments: [],
          convertedFromInvoice: null,
          convertedToInvoices: [],
        };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", documentType: "proforma", status: "proforma" }) };
    });

    const tree = await renderScreen();

    const overflowTrigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    await act(async () => {
      overflowTrigger.props.onPress?.({});
    });
    const correctionButton = findPressableWithText(tree.root, "invoices.correction.action");
    expect(correctionButton?.props.disabled).toBe(true);

    const dangerZoneToggle = tree.root.findByProps({ testID: "danger-zone-toggle" });
    act(() => {
      dangerZoneToggle.props.onPress?.();
    });
    const dangerZoneContent = tree.root.findByProps({ testID: "danger-zone-content" });
    const text = textUnder(dangerZoneContent);
    expect(text).not.toContain("invoices.storno");
    expect(text).toContain("invoices.detail.deleteAction");
  });

  it("shows a status timeline above the document preview (D6/AC11)", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [{ status: "done", transactionId: "TX-1" }] };
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "sent" }) };
    });

    const tree = await renderScreen();
    const timeline = tree.root.findByProps({ testID: "invoice-timeline" });
    expect(timeline).toBeTruthy();
    const text = textUnder(timeline);
    expect(text).toContain("invoices.timeline.issued");
    expect(text).toContain("TX-1");
  });
});
