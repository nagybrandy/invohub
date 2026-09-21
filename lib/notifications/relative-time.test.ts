// lib/notifications/relative-time.test.ts
import { describeRelativeWhen } from "@/lib/notifications/relative-time";

const NOW = new Date("2026-07-05T12:00:00.000Z");

function isoBefore(now: Date, ms: number): string {
  return new Date(now.getTime() - ms).toISOString();
}

function isoAfter(now: Date, ms: number): string {
  return new Date(now.getTime() + ms).toISOString();
}

describe("describeRelativeWhen", () => {
  it("20 seconds ago is justNow", () => {
    expect(describeRelativeWhen(isoBefore(NOW, 20 * 1000), NOW)).toEqual({ kind: "justNow" });
  });

  it("12 minutes ago is minutes: 12", () => {
    expect(describeRelativeWhen(isoBefore(NOW, 12 * 60 * 1000), NOW)).toEqual({
      kind: "minutes",
      count: 12,
    });
  });

  it("59 minutes 59 seconds ago is minutes: 59 (boundary)", () => {
    expect(
      describeRelativeWhen(isoBefore(NOW, 59 * 60 * 1000 + 59 * 1000), NOW)
    ).toEqual({ kind: "minutes", count: 59 });
  });

  it("60 minutes ago is hours: 1 (boundary)", () => {
    expect(describeRelativeWhen(isoBefore(NOW, 60 * 60 * 1000), NOW)).toEqual({
      kind: "hours",
      count: 1,
    });
  });

  it("5 hours ago is hours: 5", () => {
    expect(describeRelativeWhen(isoBefore(NOW, 5 * 60 * 60 * 1000), NOW)).toEqual({
      kind: "hours",
      count: 5,
    });
  });

  it("30 hours ago is yesterday", () => {
    expect(describeRelativeWhen(isoBefore(NOW, 30 * 60 * 60 * 1000), NOW)).toEqual({
      kind: "yesterday",
    });
  });

  it("6 days ago is absolute with formatDateOnly", () => {
    expect(describeRelativeWhen(isoBefore(NOW, 6 * 24 * 60 * 60 * 1000), NOW)).toEqual({
      kind: "absolute",
      date: "2026. 06. 29.",
    });
  });

  it("10 minutes in the future is justNow", () => {
    expect(describeRelativeWhen(isoAfter(NOW, 10 * 60 * 1000), NOW)).toEqual({
      kind: "justNow",
    });
  });

  it("never returns a negative count, in the past or the future", () => {
    const samples = [
      isoBefore(NOW, 20 * 1000),
      isoBefore(NOW, 12 * 60 * 1000),
      isoBefore(NOW, 5 * 60 * 60 * 1000),
      isoBefore(NOW, 30 * 60 * 60 * 1000),
      isoBefore(NOW, 6 * 24 * 60 * 60 * 1000),
      isoAfter(NOW, 10 * 60 * 1000),
      isoAfter(NOW, 30 * 60 * 60 * 1000),
      isoAfter(NOW, 6 * 24 * 60 * 60 * 1000),
    ];
    for (const iso of samples) {
      const result = describeRelativeWhen(iso, NOW);
      if (result.kind === "minutes" || result.kind === "hours") {
        expect(result.count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("a timestamp further in the future than 24h is absolute", () => {
    expect(describeRelativeWhen(isoAfter(NOW, 30 * 60 * 60 * 1000), NOW)).toEqual({
      kind: "absolute",
      date: expect.any(String),
    });
  });

  it("an unparseable string is absolute with the raw string and does not throw", () => {
    expect(() => describeRelativeWhen("not-a-date", NOW)).not.toThrow();
    expect(describeRelativeWhen("not-a-date", NOW)).toEqual({
      kind: "absolute",
      date: "not-a-date",
    });
  });
});
