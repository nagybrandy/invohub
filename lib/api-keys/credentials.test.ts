// lib/api-keys/credentials.test.ts
import { parseApiKeyCredentials } from "@/lib/api-keys/credentials";

describe("parseApiKeyCredentials", () => {
  it("parses Bearer public:secret", () => {
    const request = new Request("http://localhost/api/v1/invoices", {
      headers: {
        Authorization: "Bearer ih_pk_abc:ih_sk_xyz",
      },
    });
    expect(parseApiKeyCredentials(request)).toEqual({
      publicKey: "ih_pk_abc",
      secretKey: "ih_sk_xyz",
    });
  });

  it("parses X-InvoHub headers", () => {
    const request = new Request("http://localhost/api/v1/invoices", {
      headers: {
        "X-InvoHub-Public-Key": "ih_pk_abc",
        "X-InvoHub-Secret-Key": "ih_sk_xyz",
      },
    });
    expect(parseApiKeyCredentials(request)).toEqual({
      publicKey: "ih_pk_abc",
      secretKey: "ih_sk_xyz",
    });
  });

  it("returns null when credentials missing", () => {
    const request = new Request("http://localhost/api/v1/invoices");
    expect(parseApiKeyCredentials(request)).toBeNull();
  });
});
