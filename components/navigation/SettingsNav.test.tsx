// components/navigation/SettingsNav.test.tsx
// The Beállítások navigation: wide = search + grouped rows (current row marked,
// API kulcsok after a divider); narrow = a single "‹ Beállítások" back link.
import TestRenderer, { act } from "react-test-renderer";
import { SettingsNav } from "@/components/navigation/SettingsNav";

const mockPush = jest.fn();
let mockPathname = "/settings/billing";
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  usePathname: () => mockPathname,
}));

const mockLabels: Record<string, string> = {
  "settingsPages.items.company.title": "Céges profil",
  "settingsPages.items.company.description": "Cégadatok és bankszámla",
  "settingsPages.items.billing.title": "Számlázási beállítások",
  "settingsPages.items.billing.description": "Adózás és alapértelmezések",
  "settingsPages.items.pdf.title": "Számla testreszabása",
  "settingsPages.items.pdf.description": "A PDF megjelenése",
  "settingsPages.items.templates.title": "E-mailek szövege",
  "settingsPages.items.templates.description": "Kiküldött levelek",
  "settingsPages.items.reminders.title": "Kiküldés és emlékeztetők",
  "settingsPages.items.reminders.description": "Fizetési emlékeztetők",
  "settingsPages.items.nav.title": "NAV",
  "settingsPages.items.nav.description": "Adatszolgáltatás",
  "settingsPages.items.access.title": "Számlázófiókok és hozzáférés",
  "settingsPages.items.access.description": "Meghívók",
  "settingsPages.items.appearance.title": "Nyelv és megjelenés",
  "settingsPages.items.appearance.description": "Téma",
  "settingsPages.items.apiKeys.title": "API kulcsok",
  "settingsPages.items.apiKeys.description": "Integrációk",
  "settingsPages.noResults": "Nincs találat",
};
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => mockLabels[key] ?? key }),
}));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
for (const m of ["box", "pressable", "text"]) {
  jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
}
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#64748b", primary: "#00c", faint: "#999" }),
}));

function render(wide: boolean) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<SettingsNav wide={wide} />);
  });
  const all = (id: string) => tree.root.findAll((n) => n.props?.testID === id);
  return { tree, all, json: () => JSON.stringify(tree.toJSON()) };
}

describe("SettingsNav (narrow)", () => {
  beforeEach(() => mockPush.mockClear());

  it("is a back link to the start list and navigates there in one tap", () => {
    const { all } = render(false);
    const [link] = all("settings-back-link");
    expect(link.props.accessibilityLabel).toBe("settingsPages.backToStart");
    act(() => link.props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/settings");
  });

  it("does not render the search or the rows", () => {
    const { all } = render(false);
    expect(all("settings-search")).toHaveLength(0);
    expect(all("settings-nav-billing")).toHaveLength(0);
  });
});

describe("SettingsNav (wide)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = "/settings/billing";
  });

  it("lists every page, API kulcsok last", () => {
    const { json } = render(true);
    const text = json();
    const order = [
      "Céges profil",
      "Számlázási beállítások",
      "Számla testreszabása",
      "E-mailek szövege",
      "Kiküldés és emlékeztetők",
      "NAV",
      "Számlázófiókok és hozzáférés",
      "Nyelv és megjelenés",
      "API kulcsok",
    ];
    const positions = order.map((label) => text.indexOf(label));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("marks only the current page", () => {
    const { all } = render(true);
    const selected = (id: string) => all(id)[0].props.accessibilityState?.selected;
    expect(selected("settings-nav-billing")).toBe(true);
    expect(selected("settings-nav-company")).toBe(false);
  });

  it("treats the e-mail editor as part of E-mailek szövege", () => {
    mockPathname = "/email-editor";
    const { all } = render(true);
    expect(all("settings-nav-templates")[0].props.accessibilityState?.selected).toBe(true);
  });

  it("opens a page when its row is pressed", () => {
    const { all } = render(true);
    act(() => all("settings-nav-pdf")[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/settings/pdf");
  });

  it("filters the rows by the search text, ignoring accents", () => {
    const { all } = render(true);
    act(() => all("settings-search")[0].props.onChangeText("szamla test"));
    expect(all("settings-nav-pdf").length).toBeGreaterThan(0);
    expect(all("settings-nav-company")).toHaveLength(0);
  });

  it("says so when nothing matches", () => {
    const { all } = render(true);
    act(() => all("settings-search")[0].props.onChangeText("zzzz"));
    expect(all("settings-search-empty").length).toBeGreaterThan(0);
    expect(all("settings-nav-billing")).toHaveLength(0);
  });
});
