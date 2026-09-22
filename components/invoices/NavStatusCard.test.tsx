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

async function render(invoiceId = "inv-1", extra: Partial<React.ComponentProps<typeof NavStatusCard>> = {}) {
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<NavStatusCard invoiceId={invoiceId} pollIntervalMs={0} {...extra} />);
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

  function row(overrides: Record<string, unknown> = {}) {
    return {
      id: "s1",
      status: "sent",
      mode: "test",
      transactionId: "TX-1",
      messages: null,
      errorMessage: null,
      submittedAt: null,
      checkedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  function pressables(tree: TestRenderer.ReactTestRenderer) {
    return tree.root.findAll((node) => typeof node.props?.onPress === "function" && node.props?.testID);
  }

  // The Button mock forwards props to its Pressable, so dedupe by testID.
  function testIds(tree: TestRenderer.ReactTestRenderer) {
    return Array.from(new Set(pressables(tree).map((node) => node.props.testID)));
  }

  it("offers 'Újrapróbálás' (retry) with the recorded error for a failed submission, and resubmits on press", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ submissions: [row({ status: "error", transactionId: null, errorMessage: "INVALID_SECURITY_USER" })] })
      .mockResolvedValueOnce({}) // POST /api/nav/submit
      .mockResolvedValueOnce({ submissions: [row({ status: "sent" })] });
    const onChanged = jest.fn();

    const tree = await render("inv-1", { onChanged });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.nav.retry");
    expect(json).toContain("INVALID_SECURITY_USER");
    expect(json).not.toContain("invoices.nav.refresh\"");

    const retry = pressables(tree).find((node) => node.props.testID === "nav-status-retry")!;
    await act(async () => {
      await retry.props.onPress();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/nav/submit", {
      method: "POST",
      body: JSON.stringify({ invoiceId: "inv-1" }),
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it("offers retry for a NAV-aborted submission too", async () => {
    mockApiFetch.mockResolvedValueOnce({ submissions: [row({ status: "aborted" })] });
    const tree = await render();
    expect(pressables(tree).some((node) => node.props.testID === "nav-status-retry")).toBe(true);
  });

  it("offers only a status refresh (no resubmit) for an in-progress or DONE submission", async () => {
    mockApiFetch.mockResolvedValueOnce({ submissions: [row({ status: "done" })] });
    const tree = await render();
    expect(testIds(tree)).toEqual(["nav-status-refresh"]);
  });

  it("shows the submit button when nothing was submitted yet", async () => {
    mockApiFetch.mockResolvedValueOnce({ submissions: [] });
    const tree = await render();
    expect(testIds(tree)).toEqual(["nav-status-submit"]);
  });

  it("polls NAV status automatically while the submission is in progress, and stops once it is final", async () => {
    jest.useFakeTimers();
    try {
      mockApiFetch
        .mockResolvedValueOnce({ submissions: [row({ status: "sent" })] }) // initial load
        .mockResolvedValueOnce({ status: "DONE" }) // POST /api/nav/status
        .mockResolvedValueOnce({ submissions: [row({ status: "done" })] }); // reload

      await render("inv-1", { pollIntervalMs: 1000 });
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockApiFetch).toHaveBeenCalledWith("/api/nav/status", {
        method: "POST",
        body: JSON.stringify({ invoiceId: "inv-1" }),
      });
      const callsAfterDone = mockApiFetch.mock.calls.length;
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(mockApiFetch.mock.calls.length).toBe(callsAfterDone);
    } finally {
      jest.useRealTimers();
    }
  });
});
