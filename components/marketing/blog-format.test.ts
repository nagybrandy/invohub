// components/marketing/blog-format.test.ts
import { formatBlogDate } from "@/components/marketing/blog-format";

describe("formatBlogDate", () => {
  it("formats the publication date in the active language without drifting a day", () => {
    expect(formatBlogDate("2026-09-14", "hu")).toBe("2026. szeptember 14.");
    expect(formatBlogDate("2026-09-14", "en")).toBe("14 September 2026");
  });
});
