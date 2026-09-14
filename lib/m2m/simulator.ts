// lib/m2m/simulator.ts
// In-process demo simulator for the NAV M2M Adózó snapshot — zero M2M_*
// env vars needed. Deterministic, read-only, same shape as the real
// snapshot from lib/m2m/demo-user.ts so the dashboard card works out of the
// box; the real (test env) path is used automatically once the owner
// configures M2M_* once (see isM2mConfigured()).
import { pickRandomM2mTestTaxpayer } from "@/lib/m2m/test-fixtures";
import type { M2mDemoSnapshot } from "@/lib/m2m/demo-user";

export type M2mSimulatorOptions = {
  taxpayerId?: string;
  seed?: number;
};

export function buildM2mSimulatorSnapshot(options: M2mSimulatorOptions = {}): M2mDemoSnapshot {
  const taxpayer =
    options.taxpayerId != null
      ? { id: options.taxpayerId, label: `Demó azonosító ${options.taxpayerId}` }
      : pickRandomM2mTestTaxpayer(options.seed);

  const checks: M2mDemoSnapshot["checks"] = [
    { name: "Token + aláíró kulcs", ok: true, resultCode: "OK", message: "Demó munkamenet létrehozva" },
    { name: "Összesített adószámla", ok: true, resultCode: "SIKERES", message: null },
    { name: "Hiányzó bevallás", ok: true, resultCode: "SIKERES", message: null },
    { name: "Köztartozás", ok: true, resultCode: "SIKERES", message: null },
    { name: "Tételes adószámla", ok: true, resultCode: "SIKERES", message: null },
  ];

  return {
    taxpayer,
    environment: "demo",
    checks,
    taxSummary: { totalBalance: 125000, taxDebt: 0, overpayment: 125000 },
    missingDeclarations: [
      { title: "Havi ÁFA bevallás (demó)", type: "'65", period: "2026/06", dueDate: "2026-07-20" },
    ],
    publicDebt: { outstanding: 0, assessed: 0, items: [] },
    detailedTaxpayer: {
      name: taxpayer.label,
      taxNumber: taxpayer.id,
      address: "Demó utca 1., Budapest",
      period: "2026",
    },
    allEndpointsReachable: true,
  };
}
