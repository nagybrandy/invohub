// __tests__/screens/invoice-detail.test.tsx
// Focused coverage for the invoice detail screen's new mark-paid/correction/links behavior.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert, Linking } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
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

jest.mock("@/components/invoices/InvoicePdfPreview", () => ({
  InvoicePdfPreview: () => null,
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

    // Linked-document rows are 44px tap targets with link semantics (AC6),
    // not a 20px text sliver.
    const stornoOfRow = findPressableWithText(
      tree.root,
      'invoices.links.stornoOf:{"number":"INV-2026-000"}'
    );
    expect(stornoOfRow).toBeTruthy();
    expect(String(stornoOfRow!.props.className)).toContain("min-h-11");
    expect(stornoOfRow!.props.accessibilityRole).toBe("link");

    await act(async () => {
      stornoOfRow?.props.onPress?.();
    });
    expect(mockPush).toHaveBeenCalledWith("/invoices/inv-0");
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

  it("every mark-paid method choice is a 44px radio, and selecting one carries through to the mark-paid POST body", async () => {
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

    // ChoicePill renders its own <Pressable> (mocked to mockUi.Pressable)
    // with className/accessibilityRole computed internally — unlike a
    // top-level Button, the composite ChoicePill node itself also carries an
    // onPress prop, so findPressableWithText's generic "first onPress match"
    // would grab the wrong (outer) node. Match the actual rendered
    // mockUi.Pressable composite instead, which is the one that carries the
    // computed className/accessibilityRole.
    function findChoicePillWithText(text: string) {
      return tree.root
        .findAll((node) => node.type === mockUi.Pressable)
        .find((node) => node.findAll((child) => child.props?.children === text).length > 0);
    }

    const methodKeys = [
      "invoices.paymentMethods.transfer",
      "invoices.paymentMethods.cash",
      "invoices.paymentMethods.card",
      "invoices.paymentMethods.other",
    ];
    const methodPills = methodKeys.map((key) => {
      const pill = findChoicePillWithText(key);
      expect(pill).toBeTruthy();
      return pill!;
    });
    methodPills.forEach((pill) => {
      expect(String(pill.props.className)).toContain("min-h-11");
      expect(pill.props.accessibilityRole).toBe("radio");
    });

    const cashPill = findChoicePillWithText("invoices.paymentMethods.cash")!;
    await act(async () => {
      cashPill.props.onPress?.();
    });

    const selectedPill = findChoicePillWithText("invoices.paymentMethods.cash")!;
    expect(String(selectedPill.props.className)).toContain("border-primary bg-primary/10");
    ["invoices.paymentMethods.transfer", "invoices.paymentMethods.card", "invoices.paymentMethods.other"].forEach(
      (key) => {
        const unselectedPill = findChoicePillWithText(key)!;
        expect(String(unselectedPill.props.className)).toContain("border-border bg-background");
      }
    );

    const confirmButton = findPressableWithText(tree.root, "invoices.markPaid.confirm");
    await act(async () => {
      confirmButton?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    const markPaidCall = mockApiFetch.mock.calls.find(([path]) => (path as string).includes("/mark-paid"));
    expect(markPaidCall).toBeTruthy();
    const body = JSON.parse((markPaidCall![1] as RequestInit).body as string);
    expect(body.paymentMethod).toBe("cash");
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

  it("themes the mark-paid button's icon instead of leaving it at the library default color", async () => {
    // Every other icon-in-a-Button in the app (dashboard's Inbox icon,
    // M2mDemoCard's RefreshCw, the composer's ChevronUp/Down) passes an
    // explicit theme color — this one was the sole outlier, rendering
    // whatever lucide-react-native's own default is instead of matching
    // the button's text color.
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
    const icon = tree.root.findByType(CheckCircle2);
    expect(icon.props.color).toBeTruthy();
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

  it("the overflow menu's PDF item opens the PDF endpoint instead of navigating to the same detail page", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "sent" }) };
    });
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);

    const tree = await renderScreen();
    const overflowTrigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    await act(async () => {
      overflowTrigger.props.onPress?.({});
    });
    const pdfButton = findPressableWithText(tree.root, "invoices.list.pdfAction");

    await act(async () => {
      pdfButton?.props.onPress?.();
      await Promise.resolve();
    });

    expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining("/api/invoices/inv-1/pdf"));
    // The bug this replaces: it used to just re-navigate to the same page.
    expect(mockPush).not.toHaveBeenCalledWith("/invoices/inv-1");
    openURLSpy.mockRestore();
  });

  it("has exactly one solid (non-outline) button, and a finalized invoice's danger zone offers only Sztornó — never Törlés (AC10, finalized-invoice-lock)", async () => {
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
    // A finalized document keeps its number forever — the API refuses to
    // delete it (409 invoiceFinalized), so the button must never appear.
    expect(text).not.toContain("invoices.detail.deleteAction");
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

  it("on a 'noRecipient' failure from /send, shows the translated invoices.errors.noRecipient copy instead of the raw English API error", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      if (path.includes("/send")) {
        throw new ApiError("No invoice email recipient configured.", 422, "noRecipient");
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "sent" }) };
    });

    const tree = await renderScreen();
    const primaryButton = findPressableWithText(tree.root, "invoices.detail.emailReminder");
    expect(primaryButton).toBeTruthy();

    await act(async () => {
      primaryButton?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    const messages = textUnder(tree.root);
    expect(messages).toContain("invoices.errors.noRecipient");
    expect(messages).not.toContain("No invoice email recipient configured.");
  });

  it("on an 'emailSendFailed' failure from /send, never shows the raw SMTP error text", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      if (path.includes("/send")) {
        throw new ApiError("535 Authentication failed for smtp-user@example.com", 502, "emailSendFailed");
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "sent" }) };
    });

    const tree = await renderScreen();
    const primaryButton = findPressableWithText(tree.root, "invoices.detail.emailReminder");

    await act(async () => {
      primaryButton?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    const messages = textUnder(tree.root);
    expect(messages).toContain("invoices.errors.emailSendFailed");
    expect(messages).not.toContain("535 Authentication failed");
  });

  it("on a finalized díjbekérő, the Helyesbítő entry is disabled and there is no danger zone at all (not stornoable, not deletable)", async () => {
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

    // Storno explicitly refuses proforma documents, and the API only ever
    // deletes a draft — a finalized díjbekérő is neither, so no
    // DangerZone (Sztornó/Törlés) renders at all.
    expect(tree.root.findAllByProps({ testID: "danger-zone-toggle" })).toHaveLength(0);
  });

  it("a draft invoice's danger zone offers only Törlés (no number to protect yet)", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "draft", invoiceNumber: "" }) };
    });

    const tree = await renderScreen();

    const dangerZoneToggle = tree.root.findByProps({ testID: "danger-zone-toggle" });
    act(() => {
      dangerZoneToggle.props.onPress?.();
    });
    const dangerZoneContent = tree.root.findByProps({ testID: "danger-zone-content" });
    const text = textUnder(dangerZoneContent);
    expect(text).not.toContain("invoices.storno");
    expect(text).toContain("invoices.detail.deleteAction");
  });

  it("renders convertedFromInvoice as a pressable row that navigates to the source díjbekérő (AC9)", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return {
          originalInvoice: null,
          modifiesInvoice: null,
          stornoDocuments: [],
          correctionDocuments: [],
          convertedFromInvoice: makeInvoice({
            id: "proforma-source",
            documentType: "proforma",
            invoiceNumber: "DBK-2026-00001",
          }),
          convertedToInvoices: [],
        };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", documentType: "invoice", status: "draft" }) };
    });

    const tree = await renderScreen();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.links.convertedFrom");
    expect(json).toContain("DBK-2026-00001");

    const row = findPressableWithText(
      tree.root,
      'invoices.links.convertedFrom:{"number":"DBK-2026-00001"}'
    );
    expect(row).toBeTruthy();
    await act(async () => {
      row?.props.onPress?.();
    });
    expect(mockPush).toHaveBeenCalledWith("/invoices/proforma-source");
  });

  it("distinguishes a live vs a cancelled conversion in the links card with different i18n keys (AC7, AC10)", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return {
          originalInvoice: null,
          modifiesInvoice: null,
          stornoDocuments: [],
          correctionDocuments: [],
          convertedFromInvoice: null,
          convertedToInvoices: [
            makeInvoice({
              id: "draft-inv",
              documentType: "invoice",
              status: "draft",
              invoiceNumber: "",
            }),
            makeInvoice({
              id: "cancelled-inv",
              documentType: "invoice",
              status: "cancelled",
              invoiceNumber: "INV-2026-050",
            }),
          ],
        };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", documentType: "proforma", status: "proforma" }) };
    });

    const tree = await renderScreen();
    const json = JSON.stringify(tree.toJSON());

    // Both rows render, with the two different i18n keys (AC7).
    expect(json).toContain("invoices.links.convertedTo");
    expect(json).toContain("invoices.links.convertedToCancelled");
    expect(json).toContain("INV-2026-050");

    // The primary action is "open existing" (only the live conversion counts).
    const primaryButton = findPressableWithText(tree.root, "invoices.convert.openExisting");
    expect(primaryButton).toBeTruthy();

    // Pressing the live row navigates to it.
    const liveRow = findPressableWithText(
      tree.root,
      'invoices.links.convertedTo:{"number":"invoices.status.draft"}'
    );
    await act(async () => {
      liveRow?.props.onPress?.();
    });
    expect(mockPush).toHaveBeenCalledWith("/invoices/draft-inv");
  });

  it("the primary convert button calls () => void handleConvert() directly — runAction('convert', ...) appears exactly once, inside handleConvert (AC8)", () => {
    // A structural check, not a behavioral one: F3 was that the button
    // wrapped handleConvert in its own runAction("convert", ...) on top of
    // handleConvert's own internal runAction("convert", ...) call — double
    // setBusy/try-catch. Source inspection is the only way to prove the
    // outer wrapper is gone without reimplementing runAction's internals.
    const fs = require("fs");
    const path = require("path");
    const source: string = fs.readFileSync(
      path.join(__dirname, "../../app/(app)/invoices/[id]/index.tsx"),
      "utf8"
    );

    const runActionConvertMatches = source.match(/runAction\(\s*["']convert["']/g) ?? [];
    expect(runActionConvertMatches).toHaveLength(1);

    expect(source).toMatch(/primaryOnPress\s*=\s*\(\)\s*=>\s*void\s+handleConvert\(\)/);
  });

  it("posts to /convert exactly once per primary-button press", async () => {
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

    await act(async () => {
      primaryButton?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    const convertCalls = mockApiFetch.mock.calls.filter(([path]) => (path as string).includes("/convert"));
    expect(convertCalls).toHaveLength(1);
    expect(mockPush).toHaveBeenCalledWith("/invoices/converted-1/edit");
  });

  it("renders the exchange-rate warning card for a EUR invoice with no rate, and its button routes to the composer with focus=exchangeRate (AC5.1, AC5.3)", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return {
        invoice: makeInvoice({ id: "inv-1", currency: "EUR", exchangeRate: undefined }),
      };
    });

    const tree = await renderScreen();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.exchangeRateFix.detailTitle");
    expect(json).toContain('invoices.exchangeRateFix.detailBody:{\\"currency\\":\\"EUR\\"}');

    const addRateButton = findPressableWithText(tree.root, "invoices.exchangeRateFix.addRate");
    expect(addRateButton).toBeTruthy();

    await act(async () => {
      addRateButton?.props.onPress?.();
    });
    expect(mockPush).toHaveBeenCalledWith("/invoices/inv-1/edit?focus=exchangeRate");
  });

  it("the exchange-rate warning card's action clears the 44px floor", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return {
        invoice: makeInvoice({ id: "inv-1", currency: "EUR", exchangeRate: undefined }),
      };
    });

    const tree = await renderScreen();
    const addRateButton = findPressableWithText(tree.root, "invoices.exchangeRateFix.addRate");
    expect(addRateButton).toBeTruthy();
    expect(String(addRateButton!.props.className)).toContain("min-h-11");
    expect(String(addRateButton!.props.className)).toContain("self-start");
    expect(String(addRateButton!.props.className)).toContain("border-destructive/40");
    expect(addRateButton!.props.size).toBeUndefined();
  });

  it("renders no warning card for a HUF invoice (AC5.2)", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", currency: "HUF" }) };
    });

    const tree = await renderScreen();
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("invoices.exchangeRateFix.detailTitle");
  });

  it("renders no warning card for a EUR invoice that already has a rate (AC5.2)", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/api/nav/status")) {
        return { submissions: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", currency: "EUR", exchangeRate: 390.5 }) };
    });

    const tree = await renderScreen();
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("invoices.exchangeRateFix.detailTitle");
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

  describe("NAV status card", () => {
    function mockApi(invoice: ReturnType<typeof makeInvoice>, submissions: unknown[] = []) {
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path.includes("/links")) {
          return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
        }
        if (path.includes("/api/nav/status")) return { submissions };
        return { invoice };
      });
    }

    it("is shown for a finalized invoice, with a 'Beküldés' button when nothing was submitted", async () => {
      mockApi(makeInvoice({ id: "inv-1", status: "unpaid" }));
      const tree = await renderScreen();
      expect(tree.root.findAllByProps({ testID: "nav-status-submit" }).length).toBeGreaterThan(0);
    });

    it("is shown for a storno document, offering retry after a failed submission", async () => {
      mockApi(makeInvoice({ id: "inv-1", documentType: "storno", status: "sent", originalInvoiceId: "inv-0" }), [
        { id: "s1", status: "error", mode: "test", transactionId: null, messages: null, errorMessage: "boom", createdAt: "" },
      ]);
      const tree = await renderScreen();
      expect(tree.root.findAllByProps({ testID: "nav-status-retry" }).length).toBeGreaterThan(0);
    });

    it("is not shown for a draft", async () => {
      mockApi(makeInvoice({ id: "inv-1", status: "draft", invoiceNumber: "" }));
      const tree = await renderScreen();
      expect(tree.root.findAllByProps({ testID: "nav-status-submit" })).toHaveLength(0);
    });

    it("is not shown for a díjbekérő (not an invoice for NAV)", async () => {
      mockApi(makeInvoice({ id: "inv-1", documentType: "proforma", status: "proforma", invoiceNumber: "DBK-2026-001" }));
      const tree = await renderScreen();
      expect(tree.root.findAllByProps({ testID: "nav-status-submit" })).toHaveLength(0);
    });
  });
});
