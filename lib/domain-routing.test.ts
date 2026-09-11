// lib/domain-routing.test.ts
import { getDomainRedirect } from "@/lib/domain-routing";

const config = {
  marketingHost: "invohub.hu",
  appHost: "app.invohub.hu",
};

describe("domain routing", () => {
  it("moves authenticated product routes from marketing to app host", () => {
    expect(
      getDomainRedirect("invohub.hu", "/invoices/new?from=home", config),
    ).toBe("https://app.invohub.hu/invoices/new?from=home");
  });

  it("keeps marketing and assets on the marketing host", () => {
    expect(getDomainRedirect("invohub.hu", "/", config)).toBeNull();
    expect(getDomainRedirect("invohub.hu", "/_expo/app.js", config)).toBeNull();
  });

  it("sends the app root to login and legal pages to marketing", () => {
    expect(getDomainRedirect("app.invohub.hu", "/", config)).toBe(
      "https://app.invohub.hu/login",
    );
    expect(
      getDomainRedirect("app.invohub.hu", "/adatkezeles", config),
    ).toBe("https://invohub.hu/adatkezeles");
  });

  it("ignores preview and local hosts", () => {
    expect(getDomainRedirect("localhost:8081", "/dashboard", config)).toBeNull();
  });
});
