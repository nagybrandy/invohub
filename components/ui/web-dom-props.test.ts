// components/ui/web-dom-props.test.ts
import { webDomProps } from "@/components/ui/web-dom-props";

describe("webDomProps", () => {
  it("strips RN-only Text truncation props before they reach a DOM node", () => {
    const result = webDomProps({
      numberOfLines: 1,
      ellipsizeMode: "tail",
      allowFontScaling: false,
      className: "truncate",
      children: "Acme Kft.",
    });
    expect(result).not.toHaveProperty("numberOfLines");
    expect(result).not.toHaveProperty("ellipsizeMode");
    expect(result).not.toHaveProperty("allowFontScaling");
    expect(result).toEqual({ className: "truncate", children: "Acme Kft." });
  });

  it("keeps ordinary DOM-safe props untouched", () => {
    const result = webDomProps({ id: "x", className: "y", onClick: undefined });
    expect(result).toEqual({ id: "x", className: "y", onClick: undefined });
  });
});
