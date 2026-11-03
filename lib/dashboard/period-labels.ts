// lib/dashboard/period-labels.ts
// "2026. november" (hu) / "November 2026" (en): the month the "Beérkezett
// fizetések" card covers (the summary API computes the current month only,
// there is no period parameter), and "2026. 11. 03." for the "mai állapot".
export function formatMonthLabel(date: Date, language: string): string {
  const locale = language.startsWith("hu") ? "hu-HU" : "en-GB";
  const label = date.toLocaleDateString(locale, { year: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatAsOfDate(date: Date, language: string): string {
  const locale = language.startsWith("hu") ? "hu-HU" : "en-GB";
  return date.toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit" });
}
