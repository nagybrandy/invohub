// lib/email/templates/editor.test.ts
import { buildPreviewDocument, htmlToText, placeholder, SAMPLE_VARIABLES, TEMPLATE_VARIABLE_KEYS } from "@/lib/email/templates/editor";

describe("htmlToText — the bodyText fallback the editor stores", () => {
  it("keeps paragraphs, breaks and list items as lines and drops the tags", () => {
    expect(htmlToText("<p>Kedves {{clientName}}!</p><p>Számla: <strong>{{invoiceNumber}}</strong><br>Összeg: {{total}}</p><ul><li>egy</li><li>kettő</li></ul>"))
      .toBe("Kedves {{clientName}}!\nSzámla: {{invoiceNumber}}\nÖsszeg: {{total}}\n• egy\n• kettő");
  });

  it("decodes the entities a contentEditable surface produces", () => {
    expect(htmlToText("Tom&nbsp;&amp;&nbsp;Jerry &lt;kft&gt;")).toBe("Tom & Jerry <kft>");
  });
});

describe("preview document", () => {
  it("renders every placeholder with the sample data inside a full document", () => {
    const doc = buildPreviewDocument("<p>{{clientName}} – {{invoiceNumber}} – {{total}} – {{dueDate}} – <a href=\"{{paymentLink}}\">fizetés</a> – {{companyName}}</p>");
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    for (const key of TEMPLATE_VARIABLE_KEYS) {
      expect(doc).toContain(SAMPLE_VARIABLES[key]);
      expect(doc).not.toContain(placeholder(key));
    }
  });
});
