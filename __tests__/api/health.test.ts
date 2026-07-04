// __tests__/api/health.test.ts
import { GET } from "@/app/api/health+api";

describe("GET /api/health", () => {
  it("returns ok status payload", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("invohub");
    expect(typeof body.timestamp).toBe("string");
  });
});
