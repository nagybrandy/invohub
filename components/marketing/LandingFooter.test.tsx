import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { LandingFooter } from "@/components/marketing/LandingSections";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#212325", muted: "#5b5d61", primary: "#000" }),
}));
jest.mock("@/components/marketing/BrandLogo", () => ({ BrandLogo: () => null }));

describe("LandingFooter", () => {
  it("links to the developer docs from the resources column", () => {
    const onNavigateRoute = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LandingFooter
          onNavigateRoute={onNavigateRoute}
          onLogin={jest.fn()}
          onOpenBlog={jest.fn()}
          onOpenCookiePreferences={jest.fn()}
        />,
      );
    });
    const link = tree.root.findByProps({ testID: "landing-footer-developers" });
    act(() => {
      link.props.onPress();
    });
    expect(onNavigateRoute).toHaveBeenCalledWith("/developers");
  });
});
