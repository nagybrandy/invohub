// components/layout/DataTable.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { DataTable, type Column } from "@/components/layout/DataTable";

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5", destructive: "#dc2626" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

type Row = { id: string; name: string; count: number };

const columns: Column<Row>[] = [
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "count", header: "Count", numeric: true, render: (r) => r.count },
];

const rows: Row[] = [{ id: "1", name: "Acme", count: 3 }];

function render() {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <DataTable columns={columns} rows={rows} keyExtractor={(r) => r.id} />
    );
  });
  return tree!;
}

describe("DataTable", () => {
  it("wraps a plain string/number cell render in <Text> instead of a bare text node", () => {
    const tree = render();
    // A bare string child directly under a Box/View (not wrapped in Text)
    // is exactly the "Unexpected text node" React Native warning this
    // guards against — every rendered cell text must live inside a Text
    // component's `children`.
    const textNodes = tree.root.findAll(
      (node) => typeof node.props?.children === "string" || typeof node.props?.children === "number"
    );
    const values = textNodes.map((n) => n.props.children);
    expect(values).toEqual(expect.arrayContaining(["Acme", 3]));
  });

  it("renders header and row content", () => {
    const tree = render();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Name");
    expect(json).toContain("Count");
    expect(json).toContain("Acme");
  });
});
