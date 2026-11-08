// components/invoices/composer/composer-dates.ts
// Calendar-day helpers for the composer (YYYY-MM-DD strings). Timezone-safe:
// "today" is the LOCAL day, and day arithmetic runs in UTC so a UTC+ zone
// (Budapest) never loses or gains a day.

export function todayIso(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export function addDaysIso(base: string, days: number): string {
  const [y, m, d] = base.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
