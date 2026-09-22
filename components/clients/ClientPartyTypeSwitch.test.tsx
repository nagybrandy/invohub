// components/clients/ClientPartyTypeSwitch.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ClientPartyTypeSwitch } from "@/components/clients/ClientPartyTypeSwitch";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/switch", () => require("@/__tests__/mocks/gluestack-ui"));

function render(element: React.ReactElement) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree!;
}

function switchOf(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll(
    (node) => node.props?.testID === "client-private-person-switch" && typeof node.props?.onValueChange === "function"
  )[0];
}

describe("ClientPartyTypeSwitch", () => {
  it("is on for a private person and off otherwise, with the NAV explanation", () => {
    const on = render(<ClientPartyTypeSwitch value="private_person" onChange={jest.fn()} />);
    expect(switchOf(on).props.value).toBe(true);
    expect(JSON.stringify(on.toJSON())).toContain("clients.privatePersonHint");

    const off = render(<ClientPartyTypeSwitch value={undefined} onChange={jest.fn()} />);
    expect(switchOf(off).props.value).toBe(false);
  });

  it("maps the switch to private_person / company", () => {
    const onChange = jest.fn();
    const sw = switchOf(render(<ClientPartyTypeSwitch value={undefined} onChange={onChange} />));
    act(() => sw.props.onValueChange(true));
    act(() => sw.props.onValueChange(false));
    expect(onChange.mock.calls).toEqual([["private_person"], ["company"]]);
  });
});
