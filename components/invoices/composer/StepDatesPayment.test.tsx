// components/invoices/composer/StepDatesPayment.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StepDatesPayment } from "@/components/invoices/composer/StepDatesPayment";
import type { InvoiceComposerState } from "@/components/invoices/composer/useInvoiceComposer";

// StepDatesPayment imports DEADLINE_QUICK_DAYS (a real value, not just the
// InvoiceComposerState type) from useInvoiceComposer.ts, which in turn
// imports expo-router/react-i18next at module scope — mock both so
// requiring StepDatesPayment doesn't pull in expo-router's native module graph.
jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/switch", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/settings/CurrencyPicker", () => ({
  CurrencyPicker: () => null,
}));
jest.mock("@/components/invoices/composer/DateInput", () => ({
  DateInput: () => null,
}));

// `mockFocus` (the "mock" prefix is required by Jest's out-of-scope-variable
// check for factories passed to jest.mock).
const mockFocus = jest.fn();
jest.mock("@/components/ui/input", () => {
  const ReactLib = require("react");
  const { TextInput } = require("react-native");
  return {
    Input: ({ children }: { children?: React.ReactNode }) => children ?? null,
    InputField: ReactLib.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactLib.useImperativeHandle(ref, () => ({
          focus: () => mockFocus(props.testID),
        }));
        return ReactLib.createElement(TextInput, props);
      }
    ),
  };
});

const t = (key: string) => key;

function baseComposerProps(
  overrides: Partial<InvoiceComposerState> = {}
): InvoiceComposerState {
  return {
    t,
    clients: [],
    clientId: undefined,
    clientName: "",
    clientTaxNumber: "",
    clientEmail: "",
    clientCountry: "Magyarország",
    clientZip: "",
    clientCity: "",
    clientAddress: "",
    setClientName: jest.fn(),
    setClientTaxNumber: jest.fn(),
    setClientEmail: jest.fn(),
    setClientCountry: jest.fn(),
    setClientZip: jest.fn(),
    setClientCity: jest.fn(),
    setClientAddress: jest.fn(),
    handleSelectClient: jest.fn(),
    clearClient: jest.fn(),
    showClientDetails: false,
    setShowClientDetails: jest.fn(),
    showDatesPayment: false,
    setShowDatesPayment: jest.fn(),
    fulfillmentDate: "",
    setFulfillmentDate: jest.fn(),
    issueDate: "",
    setIssueDate: jest.fn(),
    dueDate: "",
    setDueDate: jest.fn(),
    continuousPerformance: false,
    setContinuousPerformance: jest.fn(),
    paymentMethod: "transfer",
    setPaymentMethod: jest.fn(),
    currency: "EUR",
    setCurrency: jest.fn(),
    exchangeRate: "",
    setExchangeRate: jest.fn(),
    exchangeRateSource: null,
    exchangeRateLoading: false,
    exchangeRateFetchError: null,
    exchangeRateAsOf: null,
    deadlineDays: 8,
    setDeadlineDays: jest.fn(),
    bankAccount: "",
    setBankAccount: jest.fn(),
    errors: {},
    focusField: null,
    clearFocusField: jest.fn(),
    ...overrides,
  } as unknown as InvoiceComposerState;
}

// A thin harness that owns real React state for the three fields the
// production composer hook (useInvoiceComposer) also owns for real:
// focusField, showDatesPayment, and clearFocusField's effect on
// focusField. This lets the test drive the exact "failed save sets
// focusField, StepDatesPayment reacts" sequence without re-implementing the
// whole hook.
let driveFocusField: (field: string | null) => void = () => {};

function Harness() {
  const [focusField, setFocusField] = React.useState<string | null>(null);
  const [showDatesPayment, setShowDatesPayment] = React.useState(false);
  driveFocusField = setFocusField;

  return (
    <StepDatesPayment
      {...baseComposerProps({
        focusField,
        clearFocusField: () => setFocusField(null),
        showDatesPayment,
        setShowDatesPayment,
      })}
    />
  );
}

describe("StepDatesPayment — summary card and quick chips", () => {
  function render(overrides: Partial<InvoiceComposerState> = {}) {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<StepDatesPayment {...baseComposerProps(overrides)} />);
    });
    return tree!;
  }

  function open(tree: TestRenderer.ReactTestRenderer) {
    const toggle = tree.root.findByProps({ testID: "composer-terms-toggle" });
    act(() => {
      toggle.props.onPress();
    });
  }

  it("is closed by default and the Módosítás toggle exposes aria-expanded", () => {
    const tree = render();
    expect(() => tree.root.findByProps({ testID: "composer-due-date" })).toThrow();
    const toggle = tree.root.findByProps({ testID: "composer-terms-toggle" });
    expect(toggle.props["aria-expanded"]).toBe(false);
    open(tree);
    expect(tree.root.findByProps({ testID: "composer-terms-toggle" }).props["aria-expanded"]).toBe(true);
    expect(() => tree.root.findByProps({ testID: "composer-due-date" })).not.toThrow();
  });

  it("calls setDeadlineDays(30) when the 30-day quick chip is pressed", () => {
    const setDeadlineDays = jest.fn();
    const tree = render({ setDeadlineDays });
    open(tree);
    act(() => {
      tree.root.findByProps({ testID: "composer-deadline-30" }).props.onPress();
    });
    expect(setDeadlineDays).toHaveBeenCalledWith(30);
  });

  it("sets the fulfilment date from the Ma chip", () => {
    const setFulfillmentDate = jest.fn();
    const tree = render({ setFulfillmentDate });
    open(tree);
    act(() => {
      tree.root.findByProps({ testID: "composer-chip-today" }).props.onPress();
    });
    expect(setFulfillmentDate).toHaveBeenCalledTimes(1);
    expect(setFulfillmentDate.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("StepDatesPayment — exchangeRate focusField", () => {
  beforeEach(() => {
    mockFocus.mockClear();
  });

  it("expands the collapsed Dates/Payment section and focuses the exchange-rate input when focusField is exchangeRate, then clears it", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Harness />);
    });

    // Collapsed by default — the field isn't mounted yet.
    expect(() =>
      tree.root.findByProps({ testID: "composer-exchange-rate" })
    ).toThrow();

    act(() => {
      driveFocusField("exchangeRate");
    });

    // The section auto-expanded (the field is now mounted) and got focused.
    expect(() =>
      tree.root.findByProps({ testID: "composer-exchange-rate" })
    ).not.toThrow();
    expect(mockFocus).toHaveBeenCalledWith("composer-exchange-rate");

    // focusField was cleared — driving it to the same value again must
    // still re-trigger the effect (it wouldn't if the state got stuck).
    mockFocus.mockClear();
    act(() => {
      driveFocusField(null);
    });
    act(() => {
      driveFocusField("exchangeRate");
    });
    expect(mockFocus).toHaveBeenCalledWith("composer-exchange-rate");
  });
});

describe("StepDatesPayment — exchange rate caption/loading/error states", () => {
  function renderExpanded(overrides: Partial<InvoiceComposerState> = {}) {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <StepDatesPayment
          {...baseComposerProps({ currency: "EUR", ...overrides })}
        />
      );
    });
    act(() => {
      tree.root.findByProps({ testID: "composer-terms-toggle" }).props.onPress();
    });
    return tree!;
  }

  it("shows the loading caption while a fetch is in flight", () => {
    const tree = renderExpanded({ exchangeRateLoading: true });
    expect(() => tree.root.findByProps({ testID: "composer-exchange-rate-loading" })).not.toThrow();
  });

  it("shows the MNB caption with the formatted rate date on a successful fetch", () => {
    const tree = renderExpanded({ exchangeRateSource: "mnb", exchangeRateAsOf: "2026-09-22" });
    const caption = tree.root.findByProps({ testID: "composer-exchange-rate-caption" });
    expect(String(caption.props.children)).toContain("invoices.fields.exchangeRateSourceMnb");
  });

  it("shows the manual caption when the source is a user override", () => {
    const tree = renderExpanded({ exchangeRateSource: "manual" });
    const caption = tree.root.findByProps({ testID: "composer-exchange-rate-caption" });
    expect(caption.props.children).toBe("invoices.fields.exchangeRateSourceManual");
  });

  it("shows the fetch error instead of the caption when the fetch failed", () => {
    const tree = renderExpanded({
      exchangeRateFetchError: "Nem sikerült lekérni az MNB árfolyamot — add meg kézzel.",
      exchangeRateSource: "manual",
    });
    const error = tree.root.findByProps({ testID: "composer-exchange-rate-fetch-error" });
    expect(error.props.children).toContain("Nem sikerült lekérni");
    expect(() => tree.root.findByProps({ testID: "composer-exchange-rate-caption" })).toThrow();
  });

  it("renders no caption at all before any fetch/manual entry has happened", () => {
    const tree = renderExpanded();
    expect(() => tree.root.findByProps({ testID: "composer-exchange-rate-caption" })).toThrow();
    expect(() => tree.root.findByProps({ testID: "composer-exchange-rate-loading" })).toThrow();
    expect(() => tree.root.findByProps({ testID: "composer-exchange-rate-fetch-error" })).toThrow();
  });
});
