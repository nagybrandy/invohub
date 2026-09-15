// lib/dashboard/vat-period.ts
// "2026. III. negyedév" (hu) / "Q3 2026" (en) — the period the estimated-VAT
// figure on the dashboard covers (A3: name the period, never change the
// number). Kept in its own module (not the useDashboardSummary hook) so a
// screen can import it without depending on that hook's module — tests that
// mock the hook wholesale don't accidentally strip this pure helper too.
export function formatVatPeriodLabel(date: Date, language: string): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  const year = date.getFullYear();
  if (language.startsWith("hu")) {
    const roman = ["I", "II", "III", "IV"][quarter - 1];
    return `${year}. ${roman}. negyedév`;
  }
  return `Q${quarter} ${year}`;
}
