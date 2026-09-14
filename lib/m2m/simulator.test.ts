// lib/m2m/simulator.test.ts
import { buildM2mSimulatorSnapshot } from "@/lib/m2m/simulator";
import { M2M_TEST_TAXPAYERS } from "@/lib/m2m/test-fixtures";

describe("buildM2mSimulatorSnapshot", () => {
  it("returns a fully-populated, read-only snapshot with no network calls", () => {
    const snapshot = buildM2mSimulatorSnapshot({ seed: 0 });
    expect(snapshot.environment).toBe("demo");
    expect(snapshot.taxpayer.id).toBe(M2M_TEST_TAXPAYERS[0]?.id);
    expect(snapshot.checks.every((c) => c.ok)).toBe(true);
    expect(snapshot.allEndpointsReachable).toBe(true);
    expect(snapshot.taxSummary).not.toBeNull();
    expect(snapshot.detailedTaxpayer?.taxNumber).toBe(snapshot.taxpayer.id);
  });

  it("uses a custom taxpayerId when provided", () => {
    const snapshot = buildM2mSimulatorSnapshot({ taxpayerId: "99999999" });
    expect(snapshot.taxpayer.id).toBe("99999999");
    expect(snapshot.detailedTaxpayer?.taxNumber).toBe("99999999");
  });

  it("is deterministic for a fixed seed", () => {
    const a = buildM2mSimulatorSnapshot({ seed: 2 });
    const b = buildM2mSimulatorSnapshot({ seed: 2 });
    expect(a).toEqual(b);
  });
});
