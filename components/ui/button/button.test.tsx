// components/ui/button/button.test.tsx
// Variants, old-name aliases, disabled state and press handling.
import TestRenderer, { act } from "react-test-renderer";
import {
  Button,
  ButtonText,
  buttonStyle,
  resolveButtonVariant,
  VARIANT_ALIAS,
} from "@/components/ui/button";

describe("Button variants (tokens.md §6.2)", () => {
  it("primary is the primary fill with the pressed shade on hover", () => {
    const cls = buttonStyle({ variant: "primary" });
    expect(cls).toContain("bg-primary");
    expect(cls).toContain("data-[hover=true]:bg-primary-press");
    expect(cls).toContain("rounded-control");
  });

  it("secondary is a surface button with a line-strong outline", () => {
    const cls = buttonStyle({ variant: "secondary" });
    expect(cls).toContain("bg-surface");
    expect(cls).toContain("border-line-strong");
  });

  it("tertiary is transparent with a neutral hover wash", () => {
    const cls = buttonStyle({ variant: "tertiary" });
    expect(cls).toContain("bg-transparent");
    expect(cls).toContain("data-[hover=true]:bg-neutral-wash");
  });

  it("danger is an outline in the err colours, dangerSolid a solid err fill", () => {
    expect(buttonStyle({ variant: "danger" })).toContain("border-err-line");
    expect(buttonStyle({ variant: "danger" })).toContain("data-[hover=true]:bg-err-wash");
    expect(buttonStyle({ variant: "dangerSolid" })).toContain("bg-err");
  });

  it("maps the old variant names so existing call sites keep working", () => {
    expect(VARIANT_ALIAS.outline).toBe("secondary");
    expect(VARIANT_ALIAS.link).toBe("tertiary");
    expect(VARIANT_ALIAS.ghost).toBe("tertiary");
    expect(VARIANT_ALIAS.default).toBe("primary");
    expect(VARIANT_ALIAS.destructive).toBe("dangerSolid");
    expect(resolveButtonVariant(undefined)).toBe("primary");
    expect(buttonStyle({ variant: "outline" })).toBe(buttonStyle({ variant: "secondary" }));
    expect(buttonStyle({ variant: "default" })).toBe(buttonStyle({ variant: "primary" }));
  });

  it("uses token classes only (no hard-coded hex)", () => {
    for (const variant of Object.keys(VARIANT_ALIAS)) {
      expect(buttonStyle({ variant: variant as never })).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });
});

describe("Button rendering", () => {
  it("fires onPress and renders its label", () => {
    const onPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Button variant="secondary" size="form" onPress={onPress} testID="b">
          <ButtonText>Mentés</ButtonText>
        </Button>,
      );
    });
    const node = tree.root.findByProps({ testID: "b" });
    act(() => node.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tree.toJSON())).toContain("Mentés");
  });

  it("renders disabled to assistive tech when isDisabled", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Button isDisabled onPress={jest.fn()} testID="b">
          <ButtonText>Mentés</ButtonText>
        </Button>,
      );
    });
    const host = tree.toJSON() as { props: { accessibilityState?: { disabled?: boolean } } };
    expect(host.props.accessibilityState?.disabled).toBe(true);
  });
});
