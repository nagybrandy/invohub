// lib/dashboard/money-parts.ts
// The design sets the number big and the currency small ("2 223 014" + "Ft").
// Splits what formatCurrency() produced; the string itself is never rebuilt.
export type MoneyParts = { value: string; unit: string };

export function splitMoney(formatted: string): MoneyParts {
  // "1 234 Ft" / "1,234.50 CHF": currency last. "€1,234.50": symbol first.
  const trailing = formatted.match(/^(.*\S)\s+(\S+)$/);
  if (trailing) return { value: trailing[1], unit: trailing[2] };
  return { value: formatted, unit: "" };
}
