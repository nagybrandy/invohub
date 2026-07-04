// lib/email/templates/defaults/index.test.ts
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email/templates/defaults";
import { EMAIL_TEMPLATE_TYPES } from "@/lib/email/templates/types";

describe("DEFAULT_EMAIL_TEMPLATES", () => {
  it("covers all template types", () => {
    const types = DEFAULT_EMAIL_TEMPLATES.map((t) => t.type);
    for (const type of EMAIL_TEMPLATE_TYPES) {
      expect(types).toContain(type);
    }
  });

  it("each template has subject and bodies", () => {
    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      expect(tpl.subject.length).toBeGreaterThan(0);
      expect(tpl.bodyHtml.length).toBeGreaterThan(0);
      expect(tpl.bodyText.length).toBeGreaterThan(0);
    }
  });
});
