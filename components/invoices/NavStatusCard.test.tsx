// components/invoices/NavStatusCard.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { NavStatusCard } from "@/components/invoices/NavStatusCard";
import { apiFetch } from "@/lib/api/client";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}));

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("@/components/ui/badge", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/card", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function render(invoiceId = "inv-1") {
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<NavStatusCard invoiceId={invoiceId} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree!;
}

describe("NavStatusCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a submit button and 'not submitted' text when there is no submission yet", async () => {
    mockApiFetch.mockResolvedValueOnce({ submissions: [] });
    const tree = await render();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.nav.notSubmitted");
    expect(json).toContain("invoices.nav.submit");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/nav/status?invoiceId=inv-1");
  });

  it("shows status, transaction id, messages, and a refresh button for an existing submission", async () => {
    mockApiFetch.mockResolvedValueOnce({
      submissions: [
        {
          id: "s1",
          status: "processing",
          mode: "demo",
          transactionId: "DEMO123",
          messages: JSON.stringify(["A számla feldolgozás alatt (demó szimulátor)."]),
          errorMessage: null,
          submittedAt: "2026-01-01T00:00:00.000Z",
          checkedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const tree = await render();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("DEMO123");
    expect(json).toContain("processing"); // status value used as t()'s defaultValue in the mock
    expect(json).toContain("demó szimulátor");
    expect(json).toContain("invoices.nav.demoBadge");
    expect(json).toContain("invoices.nav.refresh");
  });

  it("submits to NAV and reloads when the submit button is pressed", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ submissions: [] }) // initial load
      .mockResolvedValueOnce({}) // POST /api/nav/submit
      .mockResolvedValueOnce({
        submissions: [
          {
            id: "s1",
            status: "sent",
            mode: "demo",
            transactionId: "DEMO999",
            messages: null,
            errorMessage: null,
            submittedAt: "2026-01-01T00:00:00.000Z",
            checkedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }); // reload after submit

    const tree = await render();
    const submitButton = tree.root.findAll((node) => typeof node.props?.onPress === "function")[0];

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/nav/submit", {
      method: "POST",
      body: JSON.stringify({ invoiceId: "inv-1" }),
    });
    expect(JSON.stringify(tree.toJSON())).toContain("DEMO999");
  });

  it("shows an error message when loading fails", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("network down"));
    const tree = await render();
    expect(JSON.stringify(tree.toJSON())).toContain("network down");
  });
});
