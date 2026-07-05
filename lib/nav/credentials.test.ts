// lib/nav/credentials.test.ts
import { buildNavCredentials } from "@/lib/nav/credentials";

describe("buildNavCredentials", () => {
  it("defaults to test environment", () => {
    expect(buildNavCredentials(null)).toEqual({
      technicalUser: "sandbox",
      xmlSignKey: "sandbox",
      taxNumber: "00000000-0-00",
      environment: "test",
    });
  });

  it("uses saved company NAV settings", () => {
    expect(
      buildNavCredentials({
        id: "c1",
        userId: "u1",
        name: "Demo Kft.",
        taxNumber: "12345678-1-23",
        navTechnicalUser: "nav-user",
        navXmlSignKey: "sign-key",
        navEnvironment: "production",
        createdAt: "",
        updatedAt: "",
      })
    ).toEqual({
      technicalUser: "nav-user",
      xmlSignKey: "sign-key",
      taxNumber: "12345678-1-23",
      environment: "production",
    });
  });
});
