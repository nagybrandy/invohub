// lib/id.test.ts
import { createId } from "@/lib/id";

describe("createId", () => {
  it("generates hyphenated ids", () => {
    jest.spyOn(Date, "now").mockReturnValueOnce(1_700_000_000_000);
    jest.spyOn(Math, "random").mockReturnValueOnce(0.111111111).mockReturnValueOnce(0.222222222);
    const id1 = createId();
    const id2 = createId();
    expect(id1).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
    jest.restoreAllMocks();
  });
});
