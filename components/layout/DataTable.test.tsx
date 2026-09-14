// components/layout/DataTable.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Text as RNText } from "react-native";
import { DataTable, type Column } from "@/components/layout/DataTable";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));

type Row = { id: string; name: string; total: number };

const rows: Row[] = [
  { id: "1", name: "Tech Solutions", total: 571500 },
  { id: "2", name: "Green Energy Zrt.", total: 104775 },
];

const columns: Column<Row>[] = [
  { key: "name", header: "Partner", render: (r) => r.name },
  {
    key: "total",
    header: "Bruttó",
    numeric: true,
    sortable: true,
    render: (r) => r.total.toLocaleString("hu-HU"),
  },
];

function render(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <DataTable
        columns={columns}
        rows={rows}
        keyExtractor={(r) => r.id}
        {...props}
      />
    );
  });
  return tree!;
}

describe("DataTable", () => {
  it("renders a header row with column labels", () => {
    const tree = render();
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("Partner");
    expect(texts).toContain("Bruttó");
  });

  it("renders every row's cells", () => {
    const tree = render();
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("Tech Solutions");
    expect(texts).toContain("Green Energy Zrt.");
  });

  it("right-aligns a numeric column with tabular-nums", () => {
    const tree = render();
    const total = rows[0].total.toLocaleString("hu-HU");
    const cell = tree.root.findByProps({ children: total });
    expect(cell.props.className).toContain("tabular-nums");
    expect(cell.props.className).toContain("text-right");
  });

  it("calls onSortChange with the column key and shows a direction indicator", () => {
    const onSortChange = jest.fn();
    const tree = render({ onSortChange, sort: { key: "total", direction: "asc" } });
    const sortHeader = tree.root.findByProps({ testID: "data-table-sort-total" });
    act(() => {
      sortHeader.props.onPress();
    });
    expect(onSortChange).toHaveBeenCalledWith("total");
    const indicator = tree.root.findByProps({ testID: "data-table-sort-indicator-total" });
    expect(indicator.props.children).toBe("▲");
  });

  it("shows no direction indicator for a column that isn't the active sort", () => {
    const tree = render({ sort: { key: "name", direction: "asc" } });
    const indicator = tree.root.findByProps({ testID: "data-table-sort-indicator-total" });
    expect(indicator.props.children).toBe("");
  });

  it("calls onRowPress with the row", () => {
    const onRowPress = jest.fn();
    const tree = render({ onRowPress });
    const dataRows = tree.root.findAllByProps({ testID: "data-table-row" });
    act(() => {
      dataRows[0].props.onPress();
    });
    expect(onRowPress).toHaveBeenCalledWith(rows[0]);
  });

  it("renders a per-row overflow menu via rowActions", () => {
    const tree = render({
      rowActions: (row) => <RNText testID={`menu-${row.id}`}>⋯</RNText>,
    });
    expect(tree.root.findByProps({ testID: "menu-1" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "menu-2" })).toBeTruthy();
  });

  it("loading renders skeleton rows instead of data", () => {
    const tree = render({ loading: true });
    expect(tree.root.findByProps({ testID: "data-table-skeleton" })).toBeTruthy();
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).not.toContain("Tech Solutions");
  });

  it("empty rows render StateView", () => {
    const tree = render({ rows: [] });
    expect(tree.root.findByProps({ testID: "state-view-empty" })).toBeTruthy();
  });

  it("empty rows render a custom empty node when given", () => {
    const tree = render({ rows: [], empty: <RNText testID="custom-empty">Nincs adat</RNText> });
    expect(tree.root.findByProps({ testID: "custom-empty" })).toBeTruthy();
    expect(() => tree.root.findByProps({ testID: "state-view-empty" })).toThrow();
  });

  it("wraps the table in a horizontally scrollable container", () => {
    const tree = render();
    const scroll = tree.root.findByProps({ testID: "data-table-scroll" });
    expect(scroll.props.horizontal).toBe(true);
  });

  it("supports a renderMobile fallback per row", () => {
    const tree = render({
      renderMobile: (row) => <RNText testID={`mobile-${row.id}`}>{row.name}</RNText>,
    });
    expect(tree.root.findByProps({ testID: "mobile-1" })).toBeTruthy();
  });
});
