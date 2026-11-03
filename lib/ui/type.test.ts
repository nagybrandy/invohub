// lib/ui/type.test.ts
import { type } from "@/lib/ui/type";

describe("type presets", () => {
  it("follows the tokens.md scale", () => {
    expect(type.pageTitle).toContain("text-[26px]");
    expect(type.pageTitle).toContain("phone:text-[22px]");
    expect(type.pageTitle).toContain("font-heading");
    expect(type.sectionTitle).toContain("text-base");
    expect(type.sectionTitle).toContain("phone:text-[15px]");
    expect(type.itemTitle).toContain("text-[15px]");
    expect(type.itemTitle).toContain("font-semibold");
    expect(type.meta).toContain("text-[13px]");
    expect(type.micro).toBe("text-xs");
    expect(type.heroNumber).toContain("text-[30px]");
    expect(type.kpiNumber).toContain("text-xl");
  });

  it("money is tabular and never wraps", () => {
    expect(type.money).toContain("tabular-nums");
    expect(type.money).toContain("whitespace-nowrap");
  });

  it("uses token classes only (no hard-coded hex)", () => {
    for (const value of Object.values(type)) expect(value).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
