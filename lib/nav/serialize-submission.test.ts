// lib/nav/serialize-submission.test.ts
import { serializeNavSubmission } from "@/lib/nav/serialize-submission";

describe("serializeNavSubmission", () => {
  it("exposes id as submissionId plus status/mode/transactionId/errorMessage only", () => {
    expect(
      serializeNavSubmission({
        id: "s1",
        status: "error",
        mode: "test",
        transactionId: null,
        errorMessage: "boom",
        // extra columns never leak
        ...({ invoiceId: "inv-1", messages: "[]" } as object),
      } as never)
    ).toEqual({ submissionId: "s1", status: "error", mode: "test", transactionId: null, errorMessage: "boom" });
  });

  it("passes null through", () => {
    expect(serializeNavSubmission(null)).toBeNull();
  });
});
