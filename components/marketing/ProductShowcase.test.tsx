// components/marketing/ProductShowcase.test.tsx
// The redrawn miniature of the app: labelled as sample data, one accessible
// label for the whole illustration, a sidebar strip only in the wide form.
import TestRenderer, { act } from "react-test-renderer";
import { ProductShowcase } from "@/components/marketing/ProductShowcase";
import { SAMPLE_INVOICES } from "@/components/marketing/sample-data";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ primary: "#3f6bc4", muted: "#5b5d61", onNavy: "#c9d3f0", onNavyActive: "#fff", ok: "#1b7a4f" }),
}));

function render(compact: boolean) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ProductShowcase compact={compact} />);
  });
  return tree;
}

const json = (tree: TestRenderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

describe("ProductShowcase", () => {
  it("is clearly labelled as sample data and exposes one label for the whole illustration", () => {
    const tree = render(false);
    const root = tree.root.findAll((n) => n.props?.testID === "landing-product-showcase")[0];
    expect(root.props.accessibilityLabel).toContain("landing.product.sampleData");
    expect(root.props.accessibilityRole).toBe("image");
    expect(json(tree)).toContain("landing.product.sampleData");
  });

  it("draws the KPI strip and the sample invoices with status pills", () => {
    const tree = render(false);
    const text = json(tree);
    expect(text).toContain("landing.product.currentPeriod");
    for (const invoice of SAMPLE_INVOICES) {
      expect(text).toContain(invoice.id);
      expect(text).toContain(invoice.client);
      expect(text).toContain(`showcase-pill-${invoice.status}`);
    }
    expect(text).toContain("landing.product.deliveryTitle");
  });

  it("keeps the navy sidebar strip in the wide form only", () => {
    expect(json(render(false))).toContain("showcase-sidebar");
    expect(json(render(true))).not.toContain("showcase-sidebar");
  });

  it("hides the decorative parts from assistive technology", () => {
    const tree = render(false);
    const hidden = tree.root.findAll(
      (n) => n.props?.testID === "showcase-content" && n.props?.["aria-hidden"] === true,
    );
    expect(hidden.length).toBeGreaterThan(0);
  });
});
