// components/navigation/MoreSheet.test.tsx
// Phone "Továbbiak" sheet and the "Új" sheet: both on the shared Sheet.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 375, height: 800, scale: 1, fontScale: 1 }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666", destructive: "#c00" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: (_t, name) => (props: object) => <View testID={`icon-${String(name)}`} {...props} /> });
});
for (const m of ["box", "pressable", "text", "heading"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));

import { MoreSheet } from "@/components/navigation/MoreSheet";
import { NewSheet } from "@/components/navigation/NewSheet";
import { routes } from "@/lib/navigation";

const press = (tree: TestRenderer.ReactTestRenderer, testID: string) =>
  act(() => tree.root.findAll((n) => n.props?.testID === testID && typeof n.props.onPress === "function")[0].props.onPress());

describe("MoreSheet", () => {
  function render(role = "entrepreneur", open = true) {
    const handlers = { onClose: jest.fn(), onNavigate: jest.fn(), onSignOut: jest.fn() };
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<MoreSheet open={open} role={role} {...handlers} />);
    });
    return { tree, ...handlers };
  }

  it("is titled Továbbiak and lists the real secondary navigation", () => {
    const { tree } = render();
    const json = JSON.stringify(tree.toJSON());
    for (const key of ["shell.tabs.moreSheetTitle", "nav.receipts", "nav.products", "nav.emailEditor", "nav.dataExport", "nav.bulkUpload", "nav.settings"]) {
      expect(json).toContain(key);
    }
  });

  it("Kijelentkezés is the LAST row and opens the confirm instead of signing out", () => {
    const { tree, onSignOut, onClose } = render();
    const rows = tree.root
      .findAll((n) => typeof n.props?.testID === "string" && n.props.testID.startsWith("more-sheet-") && typeof n.props.onPress === "function")
      .map((n) => n.props.testID as string);
    const unique = Array.from(new Set(rows));
    expect(unique[unique.length - 1]).toBe("more-sheet-sign-out");
    press(tree, "more-sheet-sign-out");
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates and closes when a row is pressed", () => {
    const { tree, onNavigate, onClose } = render();
    press(tree, "more-sheet-settings");
    expect(onNavigate).toHaveBeenCalledWith(routes.settings);
    expect(onClose).toHaveBeenCalled();
  });

  it("adds the admin panel for admins only", () => {
    expect(JSON.stringify(render("entrepreneur").tree.toJSON())).not.toContain("nav.admin");
    expect(JSON.stringify(render("admin").tree.toJSON())).toContain("nav.admin");
  });

  it("shows nothing while closed", () => {
    expect(JSON.stringify(render("entrepreneur", false).tree.toJSON())).not.toContain("nav.receipts");
  });

  it("rows are 52px with a 22px icon", () => {
    const { tree } = render();
    const row = tree.root.findAll((n) => n.props?.testID === "more-sheet-receipts" && typeof n.props.className === "string")[0];
    expect(row.props.className).toContain("min-h-[52px]");
    expect(tree.root.findAllByProps({ size: 22 }).length).toBeGreaterThan(0);
  });
});

describe("NewSheet", () => {
  function render() {
    const handlers = { onClose: jest.fn(), onNewInvoice: jest.fn(), onNewReceipt: jest.fn() };
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<NewSheet open {...handlers} />);
    });
    return { tree, ...handlers };
  }

  it("offers exactly Új számla and Új nyugta", () => {
    const { tree } = render();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("nav.newInvoice");
    expect(json).toContain("nav.newReceipt");
    expect(json).not.toContain("nav.newPartner");
  });

  it("closes and runs the chosen action", () => {
    const first = render();
    press(first.tree, "new-sheet-invoice");
    expect(first.onNewInvoice).toHaveBeenCalledTimes(1);
    expect(first.onClose).toHaveBeenCalled();
    const second = render();
    press(second.tree, "new-sheet-receipt");
    expect(second.onNewReceipt).toHaveBeenCalledTimes(1);
  });
});
