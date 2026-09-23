// lib/companies/public-company.test.ts
import { isNavConfigured, toPublicCompany } from "@/lib/companies/public-company";

describe("isNavConfigured", () => {
  const ready = {
    navTechnicalUser: "techuser",
    navTechnicalPasswordSet: true,
    navXmlSignKeySet: true,
    navXmlChangeKeySet: true,
  };

  it("is true only when the technical user and all three secrets are on file", () => {
    expect(isNavConfigured(ready)).toBe(true);
  });

  it("is false when any piece is missing", () => {
    expect(isNavConfigured({ ...ready, navTechnicalUser: "" })).toBe(false);
    expect(isNavConfigured({ ...ready, navTechnicalUser: undefined })).toBe(false);
    expect(isNavConfigured({ ...ready, navTechnicalPasswordSet: false })).toBe(false);
    expect(isNavConfigured({ ...ready, navXmlSignKeySet: false })).toBe(false);
    expect(isNavConfigured({ ...ready, navXmlChangeKeySet: false })).toBe(false);
  });

  it("is false for no company at all", () => {
    expect(isNavConfigured(null)).toBe(false);
    expect(isNavConfigured(undefined)).toBe(false);
  });
});
