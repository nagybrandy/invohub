// lib/nav/reencrypt.test.ts
import { decryptNavSecret, encryptNavSecret } from "@/lib/nav/credentials";
import { planNavSecretReencryption } from "@/lib/nav/reencrypt";

const K1 = Buffer.alloc(32, 1).toString("base64");
const K2 = Buffer.alloc(32, 2).toString("base64");
const ENV_KEYS = ["NAV_CREDENTIALS_KEY", "NAV_CREDENTIALS_KEY_ID", "NAV_CREDENTIALS_PREVIOUS_KEYS"] as const;

describe("planNavSecretReencryption", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("encrypts legacy plaintext, re-keys old key ids, and leaves current values alone", () => {
    process.env.NAV_CREDENTIALS_KEY = K1;
    process.env.NAV_CREDENTIALS_KEY_ID = "k1";
    const underK1 = encryptNavSecret("old-key-secret");

    process.env.NAV_CREDENTIALS_KEY = K2;
    process.env.NAV_CREDENTIALS_KEY_ID = "k2";
    process.env.NAV_CREDENTIALS_PREVIOUS_KEYS = `k1:${K1}`;
    const current = encryptNavSecret("current-secret");

    const plan = planNavSecretReencryption([
      { id: "a", navTechnicalPassword: "legacy-plain-pw", navXmlSignKey: underK1, navXmlChangeKey: current },
      { id: "b", navTechnicalPassword: current, navXmlSignKey: null, navXmlChangeKey: null },
    ]);

    expect(plan.failures).toEqual([]);
    expect(plan.unchangedRows).toBe(1);
    expect(plan.updates).toHaveLength(1);
    const [update] = plan.updates;
    expect(update.id).toBe("a");
    expect(Object.keys(update.set).sort()).toEqual(["navTechnicalPassword", "navXmlSignKey"]);
    expect(update.set.navTechnicalPassword).toMatch(/^gcm2:k2:/);
    expect(decryptNavSecret(update.set.navTechnicalPassword!)).toBe("legacy-plain-pw");
    expect(decryptNavSecret(update.set.navXmlSignKey!)).toBe("old-key-secret");
    // The previous values are carried for a compare-and-set UPDATE.
    expect(update.previous.navXmlSignKey).toBe(underK1);
  });

  it("reports undecryptable values by row id + column only, never the value", () => {
    process.env.NAV_CREDENTIALS_KEY = K1;
    process.env.NAV_CREDENTIALS_KEY_ID = "k1";
    const underK1 = encryptNavSecret("lost");
    process.env.NAV_CREDENTIALS_KEY = K2;
    process.env.NAV_CREDENTIALS_KEY_ID = "k2"; // k1 not kept as a previous key

    const plan = planNavSecretReencryption([
      { id: "a", navTechnicalPassword: underK1, navXmlSignKey: null, navXmlChangeKey: null },
    ]);

    expect(plan.updates).toEqual([]);
    expect(plan.failures).toEqual([{ id: "a", column: "navTechnicalPassword" }]);
    expect(JSON.stringify(plan)).not.toContain(underK1);
  });
});
