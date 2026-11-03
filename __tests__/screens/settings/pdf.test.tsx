// __tests__/screens/settings/pdf.test.tsx
// PDF megjelenés: tells the owner that a template change never restyles an
// invoice already issued (lib/invoices/build-pdf-context.ts renders those
// from their issue-time snapshot).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/usePdfTemplate", () => ({
  usePdfTemplate: () => ({ template: null, loading: false, save: jest.fn(), previewSample: jest.fn() }),
}));
jest.mock("@/components/invoices/PdfPreviewEmbed", () => ({ PdfPreviewEmbed: () => null }));
jest.mock("@/lib/theme/icon-colors", () => ({ useIconColors: () => ({}) }));
jest.mock("lucide-react-native", () => ({ FileText: () => null }));
jest.mock("@/components/layout/ScreenLayout", () => ({
  ScreenLayout: ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) => {
    const { View } = require("react-native");
    return (
      <View>
        {header}
        {children}
      </View>
    );
  },
}));
for (const m of ["button", "card", "heading", "pressable", "text", "vstack", "hstack", "form-control"]) {
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

describe("PdfSettingsScreen", () => {
  it("says that already-issued invoices keep the look they were issued with", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<PdfSettingsScreen />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain("settings.pdfScreen.issuedKeepLook");
  });
});
