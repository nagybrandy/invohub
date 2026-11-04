// components/navigation/ForeignAccountBanner.test.tsx
// (Moved here from AccountSwitcher.test.tsx when the switcher became part of
// the AccountMenu.)
import TestRenderer, { act } from "react-test-renderer";
import { ForeignAccountBanner } from "@/components/navigation/ForeignAccountBanner";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o ? `${k}:${JSON.stringify(o)}` : k) }),
}));
for (const m of ["pressable", "text", "hstack"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));

describe("ForeignAccountBanner", () => {
  it("says where you are working and offers the way back; read-only is spelled out", () => {
    const onBack = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<ForeignAccountBanner accountName="Ügyfél Kft." role="viewer" onBack={onBack} />);
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Ügyfél Kft.");
    expect(json).toContain("accounts.readOnly");
    act(() => tree.root.findByProps({ testID: "foreign-account-back" }).props.onPress());
    expect(onBack).toHaveBeenCalled();
  });

  it("does not mention read-only for a role that can write", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<ForeignAccountBanner accountName="Ügyfél Kft." role="accountant" onBack={jest.fn()} />);
    });
    expect(JSON.stringify(tree.toJSON())).not.toContain("accounts.readOnly");
  });
});
