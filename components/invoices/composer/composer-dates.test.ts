// Date helpers must be calendar-day exact in a UTC+ zone (Budapest): addDaysIso
// used to parse local midnight and print it as UTC, losing a day.
process.env.TZ = "Europe/Budapest";
import { addDaysIso, todayIso } from "@/components/invoices/composer/composer-dates";

afterEach(() => jest.useRealTimers());

describe("composer date helpers (Europe/Budapest)", () => {
  it("adds calendar days without losing one", () => {
    expect(addDaysIso("2026-11-08", 7)).toBe("2026-11-15");
    expect(addDaysIso("2026-11-08", 0)).toBe("2026-11-08");
    expect(addDaysIso("2026-10-20", 15)).toBe("2026-11-04"); // across the CET switch
    expect(addDaysIso("2026-03-20", 15)).toBe("2026-04-04"); // across the CEST switch
  });

  it("todayIso is the local day just after midnight Budapest time", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-07T23:30:00Z")); // 00:30 on the 8th in Budapest
    expect(todayIso()).toBe("2026-11-08");
  });

  it("todayIso is still the local day late in the evening", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-08T22:30:00Z")); // 23:30 on the 8th
    expect(todayIso()).toBe("2026-11-08");
  });
});
