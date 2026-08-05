// lib/m2m/test-fixtures.ts
// Official NAV M2M dev test taxpayers (Postman sample + GitHub discussions).
export type M2mTestTaxpayer = {
  id: string;
  label: string;
  hint?: string;
};

export const M2M_TEST_TAXPAYERS: M2mTestTaxpayer[] = [
  {
    id: "8495512912",
    label: "Summary account demo",
    hint: "Tax balance, debt, overpayment",
  },
  {
    id: "12452284",
    label: "Missing declarations demo",
    hint: "9 missing VAT returns in test data",
  },
  {
    id: "25022870",
    label: "Public debt demo",
    hint: "Chamber fee outstanding",
  },
  {
    id: "12380880",
    label: "Árvai Digital Kft.",
    hint: "Detailed ledger lines",
  },
  {
    id: "26892920",
    label: "Polska Piramis szövetkezet",
    hint: "Detailed ledger (alternate)",
  },
  {
    id: "10609112",
    label: "Észak-magyarországi Városgazdálkodási Zrt.",
    hint: "Detailed ledger with FX items",
  },
];

export function pickRandomM2mTestTaxpayer(seed?: number): M2mTestTaxpayer {
  if (M2M_TEST_TAXPAYERS.length === 0) {
    throw new Error("No M2M test taxpayers configured.");
  }
  const index =
    seed !== undefined
      ? Math.abs(Math.floor(seed)) % M2M_TEST_TAXPAYERS.length
      : Math.floor(Math.random() * M2M_TEST_TAXPAYERS.length);
  return M2M_TEST_TAXPAYERS[index]!;
}
