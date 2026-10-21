import { looksLikeTaxNumber, parseOpenCorporatesResults, searchHungarianCompanies } from "@/lib/company/search";

describe("looksLikeTaxNumber", () => {
  it.each(["12345678", "12345678-1", "12345678-1-23", "12345678123", " 12345678-2-41 "])("accepts %s", (v) => {
    expect(looksLikeTaxNumber(v)).toBe(true);
  });
  it.each(["", "Tech Kft", "1234567", "12345678-1-2", "abc12345678", "123456789012"])("rejects %s", (v) => {
    expect(looksLikeTaxNumber(v)).toBe(false);
  });
});

const OC_PAYLOAD = {
  results: {
    companies: [
      {
        company: {
          name: "TELEKOM MAGYARORSZÁG ZRT.",
          company_number: "01-10-041928",
          inactive: false,
          registered_address: { street_address: "Könyves Kálmán körút 36.", locality: "Budapest", postal_code: "1097" },
        },
      },
      { company: { name: "MEGSZŰNT KFT.", company_number: "01-09-000001", inactive: true } },
      { company: { name: "CÍM NÉLKÜL BT.", company_number: "02-06-000002", registered_address_in_full: "7621 Pécs, Fő u. 1." } },
    ],
  },
};

describe("parseOpenCorporatesResults", () => {
  it("maps active companies to name + address + registration number, never inventing an adószám", () => {
    const out = parseOpenCorporatesResults(OC_PAYLOAD);
    expect(out.map((r) => r.name)).toEqual(["TELEKOM MAGYARORSZÁG ZRT.", "CÍM NÉLKÜL BT."]);
    expect(out[0]).toMatchObject({ source: "registry", zipCode: "1097", city: "Budapest", registrationNumber: "01-10-041928", taxNumber: "" });
    expect(out[1].address).toBe("7621 Pécs, Fő u. 1.");
  });
  it("survives garbage", () => {
    expect(parseOpenCorporatesResults(null)).toEqual([]);
    expect(parseOpenCorporatesResults({ results: {} })).toEqual([]);
  });
});

describe("searchHungarianCompanies", () => {
  const lookup = jest.fn();
  beforeEach(() => lookup.mockReset());

  it("answers an adószám from NAV (authoritative) and never calls the registry", async () => {
    lookup.mockResolvedValue({ name: "Tech Solutions Kft.", taxNumber: "12345678-2-41", city: "Budapest", country: "HU" });
    const fetcher = jest.fn();
    const res = await searchHungarianCompanies("12345678-2-41", null, { env: { OPENCORPORATES_API_TOKEN: "t" }, fetcher, lookup });
    expect(res.results).toEqual([expect.objectContaining({ source: "nav", name: "Tech Solutions Kft." })]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("treats the empty shell NAV returns for an unknown number as a miss", async () => {
    lookup.mockResolvedValue({ name: "", taxNumber: "12345678-1-23", country: "HU" });
    const res = await searchHungarianCompanies("12345678", null, { env: {}, lookup });
    expect(res.results).toEqual([]);
  });

  it("without a provider token a name search returns nothing (and says so)", async () => {
    const res = await searchHungarianCompanies("telekom", null, { env: {}, lookup });
    expect(res).toEqual({ results: [], provider: "nav-only" });
  });

  it("with a token it queries OpenCorporates for jurisdiction hu and parses the hits", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => OC_PAYLOAD });
    const res = await searchHungarianCompanies("telekom", null, { env: { OPENCORPORATES_API_TOKEN: "tok" }, fetcher, lookup });
    expect(fetcher.mock.calls[0][0]).toContain("jurisdiction_code=hu");
    expect(fetcher.mock.calls[0][0]).toContain("q=telekom");
    expect(res.provider).toBe("opencorporates");
    expect(res.results).toHaveLength(2);
  });

  it("ignores too-short queries and swallows provider failures", async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error("down"));
    expect((await searchHungarianCompanies("te", null, { env: { OPENCORPORATES_API_TOKEN: "t" }, fetcher, lookup })).results).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await searchHungarianCompanies("telekom", null, { env: { OPENCORPORATES_API_TOKEN: "t" }, fetcher, lookup })).results).toEqual([]);
  });
});
