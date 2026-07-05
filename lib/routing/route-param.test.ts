// lib/routing/route-param.test.ts
jest.mock("expo-router", () => ({
  useGlobalSearchParams: jest.fn(() => ({})),
  useLocalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => "/"),
}));

import { idFromAppPathname } from "@/lib/routing/route-param";

describe("idFromAppPathname", () => {
  it("extracts invoice id from pathname", () => {
    expect(idFromAppPathname("/invoices/mr682pvd-ketybxz3p")).toBe("mr682pvd-ketybxz3p");
  });

  it("extracts invoice id when nested under edit", () => {
    expect(idFromAppPathname("/invoices/mr682pvd-ketybxz3p/edit")).toBe("mr682pvd-ketybxz3p");
  });

  it("ignores reserved segments", () => {
    expect(idFromAppPathname("/invoices/new")).toBeUndefined();
  });
});
