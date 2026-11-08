// components/marketing/DeveloperDocs.test.tsx
// The public developer docs render every documented endpoint, in both
// languages, with code blocks that scroll horizontally (never widen the page).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ScrollView } from "react-native";
import { API_ENDPOINTS } from "@/lib/developers/api-reference";
import hu from "@/lib/i18n/locales/hu";
import en from "@/lib/i18n/locales/en";

let mockLanguage = "hu";

jest.mock("react-i18next", () => {
  const resolve = (dict: unknown, key: string): unknown =>
    key
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
        dict,
      );
  return {
    useTranslation: () => ({
      t: (key: string, vars?: Record<string, string>) => {
        const dict = mockLanguage === "en" ? require("@/lib/i18n/locales/en").default : require("@/lib/i18n/locales/hu").default;
        const value = resolve(dict, key);
        if (typeof value !== "string") return key;
        return value.replace(/\{\{(\w+)\}\}/g, (_m, name) => vars?.[name] ?? "");
      },
      i18n: { language: mockLanguage },
    }),
  };
});
jest.mock("@/components/marketing/PublicPage", () => ({
  PublicPage: ({ children, testID }: { children: React.ReactNode; testID?: string }) => {
    const { View } = require("react-native");
    return <View testID={testID}>{children}</View>;
  },
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

import { CodeBlock, DeveloperDocsScreen, RichText } from "@/components/marketing/DeveloperDocs";

function render(language: "hu" | "en") {
  mockLanguage = language;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DeveloperDocsScreen />);
  });
  return tree;
}

const json = (tree: TestRenderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

describe("DeveloperDocsScreen", () => {
  it("renders a card for every documented endpoint", () => {
    const tree = render("hu");
    for (const endpoint of API_ENDPOINTS) {
      expect(tree.root.findAllByProps({ testID: `developers-endpoint-${endpoint.id}` }).length).toBeGreaterThan(0);
    }
    expect(tree.root.findAllByProps({ testID: "developers-page" }).length).toBeGreaterThan(0);
  });

  it("shows the Hungarian copy: where to create keys, rate limit wording, NAV wording", () => {
    const text = json(render("hu"));
    expect(text).toContain("Beállítások → API kulcsok");
    expect(text).toContain("legfeljebb 120 kérést");
    expect(text).toContain("nem pontos globális kvóta");
    expect(text).toContain("demó vagy teszt mód");
    expect(text).toContain("https://app.invohub.hu/api/v1/...");
  });

  it("shows the English copy when the language is English", () => {
    const text = json(render("en"));
    expect(text).toContain("Settings → API keys");
    expect(text).toContain("not a precise global quota");
    expect(text).toContain("demo or test mode");
    expect(text).toContain("Create an invoice");
  });

  it("renders every code block in a horizontal ScrollView", () => {
    const tree = render("hu");
    const scrollers = tree.root.findAllByType(ScrollView);
    expect(scrollers.length).toBeGreaterThanOrEqual(API_ENDPOINTS.length);
    for (const scroller of scrollers) {
      expect(scroller.props.horizontal).toBe(true);
    }
  });

  it("has a table of contents linking to every section and endpoint group", () => {
    const tree = render("hu");
    const toc = tree.root.findAllByProps({ testID: "developers-toc" })[0];
    expect(toc).toBeDefined();
    for (const id of ["section-auth", "section-errors", "section-rateLimits", "section-endpoints", "group-invoices", "group-clients", "group-products", "group-exchangeRates"]) {
      expect(tree.root.findAllByProps({ testID: `developers-toc-${id}` }).length).toBeGreaterThan(0);
    }
  });

  it("makes no future-feature claims", () => {
    const all = (json(render("hu")) + json(render("en"))).toLowerCase();
    for (const banned of ["m2m", "bevallás", "tax return", "könyvelő", "accountant", "hamarosan", "coming soon", "bank"]) {
      expect(all).not.toContain(banned);
    }
  });
});

describe("helpers", () => {
  it("RichText splits backtick spans into monospace children", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<RichText text="Use `code` here" />);
    });
    expect(json(tree)).toContain("code");
    expect(json(tree)).not.toContain("`");
  });

  it("CodeBlock keeps its text verbatim", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<CodeBlock code={'{ "a": 1 }'} />);
    });
    expect(json(tree)).toContain('{ \\"a\\": 1 }');
  });

  it("has docs copy in both locales", () => {
    expect(hu.developers.title).toBeTruthy();
    expect(en.developers.title).toBeTruthy();
  });
});
