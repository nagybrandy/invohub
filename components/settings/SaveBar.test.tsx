// components/settings/SaveBar.test.tsx
// The sticky save bar only exists while there are unsaved changes.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SaveBar } from "@/components/settings/SaveBar";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
for (const m of ["box", "text"]) {
  jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
}
jest.mock("@/components/ui/button", () => {
  const ui = require("@/__tests__/mocks/gluestack-ui");
  return { Button: ui.Pressable, ButtonText: ui.Text, ButtonSpinner: ui.View };
});

function render(props: Partial<React.ComponentProps<typeof SaveBar>> = {}) {
  const onSave = jest.fn();
  const onDiscard = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<SaveBar visible onSave={onSave} onDiscard={onDiscard} {...props} />);
  });
  const all = (id: string) => tree.root.findAll((n) => n.props?.testID === id);
  return { tree, all, onSave, onDiscard };
}

describe("SaveBar", () => {
  it("renders nothing when there are no unsaved changes", () => {
    const { tree } = render({ visible: false });
    expect(tree.toJSON()).toBeNull();
  });

  it("shows the unsaved label with Elvetés and Mentés", () => {
    const { tree, all } = render();
    expect(JSON.stringify(tree.toJSON())).toContain("settingsPages.unsaved");
    expect(all("settings-discard").length).toBeGreaterThan(0);
    expect(all("settings-save").length).toBeGreaterThan(0);
  });

  it("Mentés and Elvetés call their handlers", () => {
    const { all, onSave, onDiscard } = render();
    act(() => all("settings-save")[0].props.onPress());
    act(() => all("settings-discard")[0].props.onPress());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("can block saving (invalid input) without hiding the bar", () => {
    const { all } = render({ saveDisabled: true });
    expect(all("settings-save")[0].props.disabled).toBe(true);
  });

  it("is locked while saving", () => {
    const { all } = render({ saving: true });
    expect(all("settings-save")[0].props.disabled).toBe(true);
    expect(all("settings-discard")[0].props.disabled).toBe(true);
  });

  it("omits Elvetés when there is no discard handler", () => {
    const { all } = render({ onDiscard: undefined });
    expect(all("settings-discard")).toHaveLength(0);
  });
});
