// lib/m2m/test-fixtures.test.ts
import { M2M_TEST_TAXPAYERS, pickRandomM2mTestTaxpayer } from "@/lib/m2m/test-fixtures";

describe("pickRandomM2mTestTaxpayer", () => {
  it("returns a known fixture for a fixed seed", () => {
    const first = pickRandomM2mTestTaxpayer(0);
    const again = pickRandomM2mTestTaxpayer(0);
    expect(first.id).toBe(M2M_TEST_TAXPAYERS[0]?.id);
    expect(again.id).toBe(first.id);
  });

  it("cycles through fixtures with different seeds", () => {
    const ids = new Set(
      [0, 1, 2, 3].map((seed) => pickRandomM2mTestTaxpayer(seed).id)
    );
    expect(ids.size).toBeGreaterThan(1);
  });
});
