// __tests__/screens/public-pages.test.tsx
// Blog, 404 and the public receipt check render inside PublicPage (landing
// header + footer, prose column) and keep their testIDs and navigation
// (SPEC §10.6).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: {
      push: (...args: unknown[]) => mockPush(...args),
      replace: (...args: unknown[]) => mockReplace(...args),
    },
    useLocalSearchParams: () => ({ token: "tok-1" }),
    Stack: { Screen: () => null },
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "hu" },
  }),
}));
jest.mock("@/components/marketing/PublicPage", () => {
  const actual = jest.requireActual("@/components/marketing/PublicPage");
  const { View } = require("react-native");
  return {
    ...actual,
    PublicPage: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <View testID={testID}>{children}</View>
    ),
  };
});
jest.mock("@/lib/auth-client", () => ({ useSession: () => ({ data: null }) }));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ primary: "#000", muted: "#000", ok: "#000", destructive: "#000" }),
}));

import { BlogArticleScreen, BlogIndexScreen } from "@/components/marketing/BlogScreens";
import NotFound from "@/app/+not-found";
import PublicReceiptViewScreen from "@/app/receipts/view";

const summary = {
  slug: "alapok",
  title: "Alapok",
  description: "Leírás",
  publishedAt: "2026-01-02",
  readingMinutes: 4,
};

async function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(element);
    await Promise.resolve();
  });
  return tree;
}

function find(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll((n) => n.props.testID === testID && typeof n.type !== "string");
}

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
});

describe("BlogIndexScreen", () => {
  it("renders the index inside PublicPage with one card per post", async () => {
    const tree = await render(<BlogIndexScreen posts={[summary]} />);
    expect(find(tree, "blog-index-page").length).toBeGreaterThan(0);
    expect(find(tree, "blog-card-alapok").length).toBeGreaterThan(0);
    expect(find(tree, "blog-index-cta").length).toBeGreaterThan(0);
  });

  it("opens the article and the login from the cards and the CTA", async () => {
    const tree = await render(<BlogIndexScreen posts={[summary]} />);
    act(() => find(tree, "blog-card-alapok")[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("alapok"));
    const cta = find(tree, "blog-index-cta").find((n) => typeof n.props.onPress === "function");
    act(() => cta?.props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/login");
  });
});

describe("BlogArticleScreen", () => {
  const post = {
    ...summary,
    sections: [{ heading: "Fejezet", paragraphs: ["Első bekezdés"] }],
  } as never;

  it("renders the title, sections and related posts", async () => {
    const tree = await render(<BlogArticleScreen post={post} related={[summary]} />);
    expect(find(tree, "blog-article-page").length).toBeGreaterThan(0);
    expect(find(tree, "blog-article-title").length).toBeGreaterThan(0);
    expect(find(tree, "blog-related-alapok").length).toBeGreaterThan(0);
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain("Fejezet");
    expect(text).toContain("Első bekezdés");
  });

  it("goes back to the index", async () => {
    const tree = await render(<BlogArticleScreen post={post} related={[]} />);
    act(() => find(tree, "blog-back-to-index")[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/blog");
  });
});

describe("NotFound", () => {
  it("shows the translated message and both links", async () => {
    const tree = await render(<NotFound />);
    const text = JSON.stringify(tree.toJSON());
    expect(find(tree, "not-found-page").length).toBeGreaterThan(0);
    expect(text).toContain("publicSite.notFound.title");
    expect(text).toContain("publicSite.notFound.home");
    expect(text).toContain("publicSite.notFound.invoices");
  });
});

describe("PublicReceiptViewScreen", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows the verified receipt inside PublicPage", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        receipt: {
          receiptNumber: "NY-1",
          issuerName: "Kiállító Kft.",
          clientName: null,
          totalAmount: 1000,
          currency: "HUF",
          issuedAt: "2026-01-02T10:00:00.000Z",
          language: "hu",
        },
      }),
    }) as never;
    const tree = await render(<PublicReceiptViewScreen />);
    await act(async () => {
      await Promise.resolve();
    });
    const text = JSON.stringify(tree.toJSON());
    expect(find(tree, "receipt-verify-page").length).toBeGreaterThan(0);
    expect(text).toContain("NY-1");
    expect(text).toContain("receipts.verify.verified");
  });

  it("shows the error note when the check fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Nem található" }),
    }) as never;
    const tree = await render(<PublicReceiptViewScreen />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(JSON.stringify(tree.toJSON())).toContain("Nem található");
  });
});
