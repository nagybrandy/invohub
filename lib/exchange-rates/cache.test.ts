// lib/exchange-rates/cache.test.ts
const mockWhere = jest.fn();
const mockOnConflictDoNothing = jest.fn();
const mockValues = jest.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));

jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: mockWhere,
      })),
    })),
    insert: jest.fn(() => ({
      values: mockValues,
    })),
  },
}));

import { db } from "@/db";
import { getCachedRate, saveRates } from "@/lib/exchange-rates/cache";

const mockDb = db as unknown as { select: jest.Mock; insert: jest.Mock };

describe("getCachedRate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when no row matches", async () => {
    mockWhere.mockResolvedValue([]);
    const result = await getCachedRate("EUR", "2026-09-22");
    expect(result).toBeNull();
  });

  it("returns the cached rate, converting the numeric column to a number", async () => {
    mockWhere.mockResolvedValue([
      { id: "x1", currency: "EUR", rateDate: "2026-09-18", rate: "395.120000", source: "MNB" },
    ]);
    const result = await getCachedRate("EUR", "2026-09-18");
    expect(result).toEqual({ currency: "EUR", rateDate: "2026-09-18", rate: 395.12 });
  });

  it("queries by both currency and date", async () => {
    mockWhere.mockResolvedValue([]);
    await getCachedRate("EUR", "2026-09-22");
    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });
});

describe("saveRates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnConflictDoNothing.mockResolvedValue(undefined);
  });

  it("does nothing (no DB call) for an empty list", async () => {
    await saveRates([]);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("inserts every rate with onConflictDoNothing (past dates are immutable)", async () => {
    await saveRates([
      { currency: "EUR", rateDate: "2026-09-18", rate: 395.12 },
      { currency: "EUR", rateDate: "2026-09-21", rate: 396.8 },
    ]);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith([
      expect.objectContaining({ currency: "EUR", rateDate: "2026-09-18", rate: "395.12", source: "MNB" }),
      expect.objectContaining({ currency: "EUR", rateDate: "2026-09-21", rate: "396.8", source: "MNB" }),
    ]);
    expect(mockOnConflictDoNothing).toHaveBeenCalledTimes(1);
  });
});
