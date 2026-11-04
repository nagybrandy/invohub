// components/marketing/blog-format.ts
// Date formatting shared by the landing's insight cards and the blog screens.
export function formatBlogDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale.startsWith("hu") ? "hu-HU" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
