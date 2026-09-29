// lib/dates/budapest.test.ts
import { addBudapestDays, budapestDateKey, budapestDayRange } from "@/lib/dates/budapest";

describe("budapestDateKey", () => {
  it("rolls an instant into the next Budapest calendar day (CEST, UTC+2)", () => {
    expect(budapestDateKey(new Date("2026-07-05T23:00:00Z"))).toBe("2026-07-06");
  });

  it("rolls an instant into the next Budapest calendar day (CET, UTC+1)", () => {
    expect(budapestDateKey(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });
});

describe("addBudapestDays", () => {
  it("subtracts days within a month", () => {
    expect(addBudapestDays("2026-07-06", -1)).toBe("2026-07-05");
  });

  it("crosses a month boundary", () => {
    expect(addBudapestDays("2026-03-01", -3)).toBe("2026-02-26");
  });
});

describe("budapestDayRange", () => {
  it("spans 23 hours on the spring-forward DST day", () => {
    const { start, end } = budapestDayRange("2026-03-29");
    const hours = (end.getTime() - start.getTime() + 1) / (60 * 60 * 1000);
    expect(hours).toBe(23);
  });

  it("spans 25 hours on the fall-back DST day", () => {
    const { start, end } = budapestDayRange("2026-10-25");
    const hours = (end.getTime() - start.getTime() + 1) / (60 * 60 * 1000);
    expect(hours).toBe(25);
  });

  it("bounds a CEST (UTC+2) calendar day precisely", () => {
    const { start, end } = budapestDayRange("2026-07-05");
    expect(start.toISOString()).toBe("2026-07-04T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-05T21:59:59.999Z");
  });
});
