// lib/nav/reencrypt.ts
// Pure planning step for scripts/reencrypt-nav-secrets.mjs: given company
// rows as stored, compute which NAV secret columns must be rewritten under
// the current NAV_CREDENTIALS_KEY / NAV_CREDENTIALS_KEY_ID — legacy plaintext,
// legacy gcm1 values, and values sealed under a previous key id.
// The plan never contains plaintext; failures carry only row id + column.
import {
  decryptNavSecretOrPassthrough,
  encryptNavSecret,
  needsNavSecretReencryption,
} from "@/lib/nav/credentials";

export const NAV_SECRET_COLUMNS = ["navTechnicalPassword", "navXmlSignKey", "navXmlChangeKey"] as const;
export type NavSecretColumn = (typeof NAV_SECRET_COLUMNS)[number];

export type NavSecretRow = { id: string } & Record<NavSecretColumn, string | null>;

export type NavSecretUpdate = {
  id: string;
  /** New sealed values, only for the columns that change. */
  set: Partial<Record<NavSecretColumn, string>>;
  /** The values read, for a compare-and-set UPDATE (skip the row if it changed meanwhile). */
  previous: Partial<Record<NavSecretColumn, string>>;
};

export type NavSecretReencryptionPlan = {
  updates: NavSecretUpdate[];
  failures: { id: string; column: NavSecretColumn }[];
  unchangedRows: number;
};

export function planNavSecretReencryption(rows: NavSecretRow[]): NavSecretReencryptionPlan {
  const plan: NavSecretReencryptionPlan = { updates: [], failures: [], unchangedRows: 0 };

  for (const row of rows) {
    const update: NavSecretUpdate = { id: row.id, set: {}, previous: {} };
    let rowFailed = false;

    for (const column of NAV_SECRET_COLUMNS) {
      const stored = row[column];
      if (!stored || !needsNavSecretReencryption(stored)) continue;
      try {
        const plain = decryptNavSecretOrPassthrough(stored);
        if (!plain) continue;
        update.set[column] = encryptNavSecret(plain);
        update.previous[column] = stored;
      } catch {
        plan.failures.push({ id: row.id, column });
        rowFailed = true;
      }
    }

    if (Object.keys(update.set).length > 0) plan.updates.push(update);
    else if (!rowFailed) plan.unchangedRows += 1;
  }

  return plan;
}
