// __tests__/screens/settings/pdf.test.tsx
// Számla testreszabása: the controls of Dóri's screen are wired to the real
// invoice_pdf_template fields, a legacy user keeps the legacy layout until they
// pick another one, and what is sent to PATCH is a full valid template.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { DEFAULT_PDF_TEMPLATE, LEGACY_PDF_TEMPLATE } from "@/lib/invoices/pdf-template/defaults";
import type { InvoicePdfTemplate } from "@/lib/invoices/pdf-template/types";
import { validatePdfTemplateInput } from "@/lib/invoices/pdf-template/validate";

const mockSave = jest.fn(async (input: unknown) => input);
const mockPreview = jest.fn(async () => new Blob());
let mockTemplate: InvoicePdfTemplate | null = null;
let mockPanelProps: { draft: InvoicePdfTemplate } | null = null;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, string>) => (opts?.hex ? `${key}:${opts.hex}` : key) }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/hooks/usePdfTemplate", () => ({
  usePdfTemplate: () => ({ template: mockTemplate, loading: false, save: mockSave, previewSample: mockPreview }),
}));
jest.mock("@/components/settings/PdfPreviewPanel", () => ({
  PdfPreviewPanel: (props: { draft: InvoicePdfTemplate }) => {
    mockPanelProps = props;
    const { View } = require("react-native");
    return <View testID="pdf-preview-panel" />;
  },
}));
jest.mock("@/lib/ui/use-measured-width", () => ({
  useMeasuredWidth: () => ({ width: 1000, measured: true, onLayout: () => undefined }),
}));
for (const m of ["box", "button", "heading", "pressable", "text"]) {
  jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
}
jest.mock("@/components/ui/input", () => {
  const { TextInput, View } = require("react-native");
  return { Input: View, InputField: (props: Record<string, unknown>) => <TextInput {...props} /> };
});
jest.mock("@/components/ui/textarea", () => {
  const { TextInput, View } = require("react-native");
  return { Textarea: View, TextareaInput: (props: Record<string, unknown>) => <TextInput {...props} /> };
});

import PdfSettingsScreen from "@/app/(app)/settings/pdf";

function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<PdfSettingsScreen />);
  });
  const all = (id: string) => tree.root.findAll((n) => n.props?.testID === id);
  const byId = (id: string) => all(id)[0];
  const radio = (id: string) => all(id).find((n) => n.props.accessibilityRole === "radio")!;
  const press = (node: { props: Record<string, any> }) => act(() => node.props.onPress());
  const type = (id: string, text: string) =>
    act(() => {
      all(id).find((n) => typeof n.props.onChangeText === "function")!.props.onChangeText(text);
    });
  const saved = () => mockSave.mock.calls[mockSave.mock.calls.length - 1][0] as InvoicePdfTemplate;
  return { tree, all, byId, radio, press, type, saved };
}

describe("PdfSettingsScreen", () => {
  beforeEach(() => {
    mockSave.mockClear();
    mockPanelProps = null;
    mockTemplate = { ...DEFAULT_PDF_TEMPLATE };
  });

  it("shows the current stored values as selected", () => {
    mockTemplate = { ...DEFAULT_PDF_TEMPLATE, layout: "band", fontStyle: "classic", logoMode: "none" };
    const { radio } = render();
    expect(radio("pdf-layout-band").props.accessibilityState.checked).toBe(true);
    expect(radio("pdf-layout-frame").props.accessibilityState.checked).toBe(false);
    expect(radio("pdf-font-style-classic").props.accessibilityState.checked).toBe(true);
    expect(radio("pdf-logo-mode-none").props.accessibilityState.checked).toBe(true);
  });

  it("offers InvoHub, Klasszikus and Kerek only, and three new layouts", () => {
    const { all } = render();
    expect(all("pdf-font-style-custom")).toHaveLength(0);
    expect(all("pdf-layout-legacy")).toHaveLength(0);
    for (const id of ["pdf-layout-clean", "pdf-layout-band", "pdf-layout-frame", "pdf-font-style-invohub", "pdf-font-style-classic", "pdf-font-style-round"]) {
      expect(all(id).length).toBeGreaterThan(0);
    }
  });

  it("disables Saját logó and says why", () => {
    const { radio, byId, press, tree } = render();
    const own = radio("pdf-logo-mode-own");
    expect(own.props.accessibilityState.disabled).toBe(true);
    press(own);
    expect(radio("pdf-logo-mode-monogram").props.accessibilityState.checked).toBe(true);
    expect(byId("pdf-logo-own-hint")).toBeDefined();
    expect(JSON.stringify(tree.toJSON())).toContain("settings.pdfScreen.logoOwnHint");
  });

  it("hides logo size and position when the logo is off", () => {
    const { all, press, radio } = render();
    expect(all("pdf-logo-size").length).toBeGreaterThan(0);
    expect(all("pdf-logo-position").length).toBeGreaterThan(0);
    press(radio("pdf-logo-mode-none"));
    expect(all("pdf-logo-size")).toHaveLength(0);
    expect(all("pdf-logo-position")).toHaveLength(0);
  });

  it("saves a full template that passes the API validation", async () => {
    const { radio, press, type, byId, saved } = render();
    press(radio("pdf-layout-clean"));
    press(radio("pdf-font-style-round"));
    press(radio("pdf-logo-mode-none"));
    type("pdf-accent-hex", "#16803c");
    type("pdf-notes-label", "Megjegyzés");
    await act(async () => {
      byId("pdf-save").props.onPress();
    });
    const sent = saved();
    expect(sent).toMatchObject({ layout: "clean", fontStyle: "round", logoMode: "none", accentColor: "#16803c" });
    expect(validatePdfTemplateInput(sent).ok).toBe(true);
  });

  it("logo size and position are written", async () => {
    const { radio, press, byId, saved } = render();
    press(radio("pdf-logo-size-L"));
    press(radio("pdf-logo-position-right"));
    await act(async () => {
      byId("pdf-save").props.onPress();
    });
    expect(saved()).toMatchObject({ logoSize: "L", logoPosition: "right" });
  });

  it("locks the buyer tax number toggle on the new layouts (always printed)", () => {
    const { byId, tree } = render();
    const toggle = byId("pdf-show-client-tax");
    expect(toggle.props.disabled).toBe(true);
    expect(toggle.props.value).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("settings.pdfScreen.clientTaxLocked");
    // the other two stay editable
    expect(byId("pdf-show-company").props.disabled).toBeFalsy();
    expect(byId("pdf-show-bank").props.disabled).toBeFalsy();
  });

  describe("legacy user", () => {
    beforeEach(() => {
      mockTemplate = { ...LEGACY_PDF_TEMPLATE, accentColor: "#112233", showClientTaxNumber: false };
    });

    it("shows the legacy layout as current, with no pending change", () => {
      const { radio, all } = render();
      expect(radio("pdf-layout-legacy").props.accessibilityState.checked).toBe(true);
      // the save button (and its bar) only exist while there is an unsaved change
      expect(all("pdf-save")).toHaveLength(0);
      expect(mockPanelProps!.draft.layout).toBe("legacy");
    });

    it("keeps the buyer tax toggle editable and the font size control on legacy", () => {
      const { byId, all } = render();
      expect(byId("pdf-show-client-tax").props.disabled).toBeFalsy();
      expect(byId("pdf-show-client-tax").props.value).toBe(false);
      expect(all("pdf-font-scale").length).toBeGreaterThan(0);
      expect(all("pdf-font-style")).toHaveLength(0);
    });

    it("does not migrate the layout when other things are saved", async () => {
      const { type, byId, saved } = render();
      type("pdf-title", "DÍJBEKÉRŐ");
      await act(async () => {
        byId("pdf-save").props.onPress();
      });
      expect(saved().layout).toBe("legacy");
    });

    it("moves to a new layout only on an explicit choice, adopting Dóri's untouched defaults", async () => {
      mockTemplate = { ...LEGACY_PDF_TEMPLATE };
      const { radio, press, byId, saved } = render();
      press(radio("pdf-layout-band"));
      await act(async () => {
        byId("pdf-save").props.onPress();
      });
      expect(saved()).toMatchObject({
        layout: "band",
        accentColor: DEFAULT_PDF_TEMPLATE.accentColor,
        footerText: DEFAULT_PDF_TEMPLATE.footerText,
      });
    });

    it("keeps a customised colour when moving to a new layout", async () => {
      const { radio, press, byId, saved } = render();
      press(radio("pdf-layout-frame"));
      await act(async () => {
        byId("pdf-save").props.onPress();
      });
      expect(saved().accentColor).toBe("#112233");
    });
  });

  it("an invalid custom colour blocks saving and keeps the preview on the last valid colour", async () => {
    const { type, byId, tree } = render();
    type("pdf-accent-hex", "#12");
    expect(byId("pdf-save").props.disabled).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("settings.pdfScreen.colorInvalid");
    expect(mockPanelProps!.draft.accentColor).toBe(DEFAULT_PDF_TEMPLATE.accentColor);
    await act(async () => {
      byId("pdf-save").props.onPress();
    });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("explains the darker header shade for a light colour on the new layouts", () => {
    const { type, tree } = render();
    type("pdf-accent-hex", "#ffee00");
    expect(JSON.stringify(tree.toJSON())).toContain("settings.pdfScreen.shadeNote");
  });

  it("Alapértelmezés visszaállítása restores Dóri's defaults as an unsaved change", async () => {
    mockTemplate = { ...DEFAULT_PDF_TEMPLATE, layout: "clean", accentColor: "#e8590c", footerText: "x" };
    const { byId, press, all } = render();
    press(byId("pdf-reset"));
    expect(mockPanelProps!.draft).toEqual(DEFAULT_PDF_TEMPLATE);
    expect(all("pdf-save").length).toBeGreaterThan(0);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("previews the unsaved draft through the real renderer", () => {
    const { radio, press } = render();
    press(radio("pdf-layout-band"));
    expect(mockPanelProps!.draft.layout).toBe("band");
  });
});
