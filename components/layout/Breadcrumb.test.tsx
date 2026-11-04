// components/layout/Breadcrumb.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Breadcrumb, parentBreadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (href: unknown) => mockPush(href) } }));
const mockDims = { width: 1440 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockDims.width, height: 900, scale: 1, fontScale: 1 }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666", faint: "#999" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: (_t, name) => (props: object) => <View testID={`icon-${String(name)}`} {...props} /> });
});
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

const TRAIL: BreadcrumbItem[] = [
  { label: "Főoldal", href: "/dashboard" as never },
  { label: "Számlák", href: "/invoices" as never },
  { label: "INV-2026-0042" },
];

function render(items = TRAIL) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Breadcrumb items={items} />);
  });
  return tree;
}

beforeEach(() => {
  mockPush.mockClear();
  mockDims.width = 1440;
});

describe("BreadcrumbItem type", () => {
  it("supports label-only items and items with href", () => {
    const item: BreadcrumbItem = { label: "Current" };
    expect(item.href).toBeUndefined();
    const linked: BreadcrumbItem = { label: "Home", href: "/" as never };
    expect(linked.href).toBe("/");
  });
});

describe("parentBreadcrumb", () => {
  it("is the nearest ancestor with a link", () => {
    expect(parentBreadcrumb(TRAIL)?.label).toBe("Számlák");
    expect(parentBreadcrumb([{ label: "Főoldal", href: "/" as never }, { label: "x" }])?.label).toBe("Főoldal");
  });

  it("is undefined for a single item or a trail without links", () => {
    expect(parentBreadcrumb([{ label: "x" }])).toBeUndefined();
    expect(parentBreadcrumb([{ label: "a" }, { label: "b" }])).toBeUndefined();
  });
});

describe("Breadcrumb (>700px)", () => {
  it("renders the whole trail with chevrons, the current item in ink 500", () => {
    const tree = render();
    const json = JSON.stringify(tree.toJSON());
    for (const label of ["Főoldal", "Számlák", "INV-2026-0042"]) expect(json).toContain(label);
    expect(tree.root.findAllByProps({ testID: "icon-ChevronRight" }).length).toBeGreaterThanOrEqual(2);
    expect(json).toContain("font-medium text-ink");
    expect(json).toContain("text-muted-ink");
    expect(json).toContain('"aria-current":"page"');
  });

  it("links navigate", () => {
    const tree = render();
    const links = tree.root.findAll((n) => n.props.accessibilityRole === "link" && typeof n.props.onPress === "function");
    act(() => links[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });
});

describe("Breadcrumb (phone)", () => {
  beforeEach(() => {
    mockDims.width = 375;
  });

  it("collapses to a single back link to the parent", () => {
    const tree = render();
    const back = tree.root.findByProps({ testID: "breadcrumb-back" });
    expect(back.props.accessibilityLabel).toBe("Számlák");
    expect(JSON.stringify(tree.toJSON())).not.toContain("INV-2026-0042");
    act(() => back.props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/invoices");
  });

  it("renders nothing when there is no parent link", () => {
    expect(render([{ label: "Beállítások" }]).toJSON()).toBeNull();
  });
});
