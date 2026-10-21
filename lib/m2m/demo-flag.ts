// lib/m2m/demo-flag.ts
// The dashboard's NAV tax-account / "hiányzó bevallás" demo card previews a
// phase-4 capability (M2M tax filing). Owner decision 2026-10-21: do not
// communicate future features (bevallás, adótervezés) — so the card is off
// unless a deploy explicitly sets EXPO_PUBLIC_SHOW_M2M_DEMO=true.
export function isM2mDemoCardVisible(env: Record<string, string | undefined> = process.env): boolean {
  return env.EXPO_PUBLIC_SHOW_M2M_DEMO === "true";
}
