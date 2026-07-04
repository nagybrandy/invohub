// lib/api/session.test.ts
jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

import { jsonResponse, unauthorizedResponse } from "@/lib/api/session";

describe("api session helpers", () => {
  it("unauthorizedResponse returns 401 JSON", async () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("jsonResponse serializes data", async () => {
    const res = jsonResponse({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
  });
});
