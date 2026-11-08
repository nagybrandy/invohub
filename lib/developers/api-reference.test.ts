// Drift guard: the public developer docs must list exactly the HTTP methods
// that app/api/v1/** really exports — nothing invented, nothing missing.
import * as fs from "fs";
import * as path from "path";
import {
  API_BASE_URL,
  API_ENDPOINTS,
  API_ENDPOINT_GROUPS,
  buildCurlSnippet,
  routeFileForPath,
} from "@/lib/developers/api-reference";

const V1_DIR = path.join(process.cwd(), "app", "api", "v1");
const HTTP_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"];

function listRouteFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listRouteFiles(full);
    return entry.name.endsWith("+api.ts") ? [full] : [];
  });
}

function exportedMethods(file: string): string[] {
  const source = fs.readFileSync(file, "utf8");
  return HTTP_METHODS.filter((m) =>
    new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(source),
  );
}

describe("developer API reference", () => {
  it("documents only endpoints whose route file exports that method", () => {
    for (const endpoint of API_ENDPOINTS) {
      const file = path.join(process.cwd(), routeFileForPath(endpoint.path));
      expect(fs.existsSync(file)).toBe(true);
      expect(exportedMethods(file)).toContain(endpoint.method);
    }
  });

  it("documents every method exported under app/api/v1", () => {
    const actual = listRouteFiles(V1_DIR)
      .flatMap((file) => {
        const rel = path.relative(path.join(process.cwd(), "app"), file).split(path.sep).join("/");
        const apiPath = "/" + rel.replace(/\+api\.ts$/, "").replace(/\[(\w+)\]/g, "{$1}");
        return exportedMethods(file).map((m) => `${m} ${apiPath}`);
      })
      .sort();
    const documented = API_ENDPOINTS.map((e) => `${e.method} ${e.path}`).sort();
    expect(documented).toEqual(actual);
  });

  it("has unique ids, group membership and bilingual copy for every endpoint", () => {
    const ids = API_ENDPOINTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groupIds = API_ENDPOINT_GROUPS.map((g) => g.id);
    for (const e of API_ENDPOINTS) {
      expect(groupIds).toContain(e.group);
      expect(e.summary.hu.trim()).not.toBe("");
      expect(e.summary.en.trim()).not.toBe("");
      expect(e.description.hu.trim()).not.toBe("");
      expect(e.description.en.trim()).not.toBe("");
      expect(e.path.startsWith("/api/v1/")).toBe(true);
    }
  });

  it("keeps request and response examples valid JSON", () => {
    for (const e of API_ENDPOINTS) {
      if (e.requestExample) expect(() => JSON.parse(e.requestExample!)).not.toThrow();
      if (e.responseExample) expect(() => JSON.parse(e.responseExample!)).not.toThrow();
    }
  });

  it("builds curl snippets with env-var credentials and no real-looking keys", () => {
    for (const e of API_ENDPOINTS) {
      const curl = buildCurlSnippet(e);
      expect(curl).toContain(API_BASE_URL + e.path.split("{id}")[0]);
      expect(curl).not.toContain("{id}");
      expect(curl).toContain("$INVOHUB_PUBLIC_KEY:$INVOHUB_SECRET_KEY");
      expect(curl).not.toMatch(/ih_(pk|sk)_[0-9a-f]{8,}/);
    }
    const create = API_ENDPOINTS.find((e) => e.id === "invoices.create")!;
    expect(buildCurlSnippet(create)).toContain("Idempotency-Key");
    expect(buildCurlSnippet(create)).toContain("-X POST");
    const get = API_ENDPOINTS.find((e) => e.id === "invoices.get")!;
    expect(buildCurlSnippet(get)).not.toContain("-d ");
  });

  it("marks Idempotency-Key support exactly on the routes that use withIdempotency", () => {
    for (const e of API_ENDPOINTS) {
      const source = fs.readFileSync(path.join(process.cwd(), routeFileForPath(e.path)), "utf8");
      const start = source.search(new RegExp(`export\\s+(async\\s+)?function\\s+${e.method}\\b`));
      const rest = source.slice(start + 10);
      const next = rest.search(/\nexport\s/);
      const methodBlock = next === -1 ? rest : rest.slice(0, next);
      expect(Boolean(e.idempotent)).toBe(methodBlock.includes("withIdempotency("));
    }
  });
});
