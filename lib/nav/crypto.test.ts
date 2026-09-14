// lib/nav/crypto.test.ts
// Fixed-vector tests for the NAV OSA 3.0 crypto primitives. Vectors are
// computed independently in this file (not re-derived from crypto.ts) so a
// regression in the implementation actually gets caught.
import { createCipheriv, createHash } from "crypto";
import {
  buildPasswordHash,
  buildRequestSignature,
  decryptExchangeToken,
  isValidSoftwareId,
  navSignatureTimestamp,
  sha3_512UpperHex,
  sha512UpperHex,
} from "@/lib/nav/crypto";

function referenceSha512Upper(input: string): string {
  return createHash("sha512").update(input, "utf8").digest("hex").toUpperCase();
}

function referenceSha3_512Upper(input: string): string {
  return createHash("sha3-512").update(input, "utf8").digest("hex").toUpperCase();
}

describe("sha512UpperHex / sha3_512UpperHex", () => {
  it("matches an independently computed SHA-512 digest", () => {
    expect(sha512UpperHex("secret123")).toBe(referenceSha512Upper("secret123"));
    expect(sha512UpperHex("secret123")).toHaveLength(128);
    expect(sha512UpperHex("secret123")).toBe(sha512UpperHex("secret123").toUpperCase());
  });

  it("matches an independently computed SHA3-512 digest", () => {
    expect(sha3_512UpperHex("hello")).toBe(referenceSha3_512Upper("hello"));
    expect(sha3_512UpperHex("hello")).toHaveLength(128);
  });
});

describe("navSignatureTimestamp", () => {
  it("formats as yyyyMMddHHmmss in UTC", () => {
    const date = new Date(Date.UTC(2026, 0, 5, 9, 3, 7)); // 2026-01-05T09:03:07Z
    expect(navSignatureTimestamp(date)).toBe("20260105090307");
  });
});

describe("buildPasswordHash", () => {
  it("is uppercase SHA-512 of the password", () => {
    expect(buildPasswordHash("secret123")).toBe(referenceSha512Upper("secret123"));
  });
});

describe("buildRequestSignature", () => {
  const requestId = "RID12345";
  const timestamp = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
  const signKey = "SIGNKEY";

  it("hashes requestId + timestamp + signKey when there are no invoice operations", () => {
    const expected = referenceSha3_512Upper(requestId + "20260101120000" + signKey);
    expect(buildRequestSignature({ requestId, timestamp, signKey })).toBe(expected);
  });

  it("appends one SHA3-512(operation + base64 invoiceData) hash per invoice operation, in order", () => {
    const invoiceDataBase64 = Buffer.from("hello", "utf8").toString("base64"); // "aGVsbG8="
    const opHash = referenceSha3_512Upper("CREATE" + invoiceDataBase64);
    const expected = referenceSha3_512Upper(requestId + "20260101120000" + signKey + opHash);

    const actual = buildRequestSignature({
      requestId,
      timestamp,
      signKey,
      invoiceOperations: [{ operation: "CREATE", invoiceDataBase64 }],
    });
    expect(actual).toBe(expected);
  });

  it("concatenates hashes for multiple operations in index order", () => {
    const dataA = Buffer.from("A", "utf8").toString("base64");
    const dataB = Buffer.from("B", "utf8").toString("base64");
    const hashA = referenceSha3_512Upper("CREATE" + dataA);
    const hashB = referenceSha3_512Upper("MODIFY" + dataB);
    const expected = referenceSha3_512Upper(requestId + "20260101120000" + signKey + hashA + hashB);

    const actual = buildRequestSignature({
      requestId,
      timestamp,
      signKey,
      invoiceOperations: [
        { operation: "CREATE", invoiceDataBase64: dataA },
        { operation: "MODIFY", invoiceDataBase64: dataB },
      ],
    });
    expect(actual).toBe(expected);
  });
});

describe("isValidSoftwareId", () => {
  it("accepts exactly 18 uppercase alphanumeric characters", () => {
    expect("1234567890123456789").toHaveLength(19);
    expect(isValidSoftwareId("1234567890123456789")).toBe(false); // 19 chars
    expect("1234567890123456").toHaveLength(16);
    expect(isValidSoftwareId("1234567890123456")).toBe(false); // 16 chars
    expect("INVOHUB12345678HUA").toHaveLength(18);
    expect(isValidSoftwareId("INVOHUB12345678HUA")).toBe(true); // 18 chars
    expect(isValidSoftwareId("invohub12345678hua")).toBe(false); // lowercase
    expect(isValidSoftwareId(undefined)).toBe(false);
    expect(isValidSoftwareId("")).toBe(false);
  });
});

describe("decryptExchangeToken (AES-128-ECB)", () => {
  it("decrypts a token encrypted with the same 16-byte key", () => {
    const exchangeKey = "1234567890ABCDEF"; // 16 bytes
    const plainToken = "b1aca173-d9e8-4561-9237-0511eed99eaa2P0ZHLXBRI2U";
    const cipher = createCipheriv("aes-128-ecb", Buffer.from(exchangeKey, "utf8"), Buffer.alloc(0));
    const encrypted = Buffer.concat([cipher.update(plainToken, "utf8"), cipher.final()]).toString("base64");

    expect(decryptExchangeToken(encrypted, exchangeKey)).toBe(plainToken);
  });

  it("throws when the exchange key isn't 16 bytes", () => {
    expect(() => decryptExchangeToken(Buffer.from("x").toString("base64"), "too-short")).toThrow();
  });
});
