// components/email/EmailPreview.web.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { EmailPreview } from "@/components/email/EmailPreview.web";
import { SAMPLE_VARIABLES } from "@/lib/email/templates/editor";
import { renderTemplate } from "@/lib/email/templates/render";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const BODY = "<p>Kedves {{clientName}},</p><p>Számla: <strong>{{invoiceNumber}}</strong> – {{total}}</p>";

function frame() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<EmailPreview subject="{{invoiceNumber}} – {{companyName}}" bodyHtml={BODY} />);
  });
  return tree.root.findAllByType("iframe" as never)[0]!;
}

describe("EmailPreview (web)", () => {
  it("shows the body with placeholders filled, the same as the sender renders it", () => {
    const srcDoc = frame().props.srcDoc as string;
    expect(srcDoc).toContain(renderTemplate(BODY, SAMPLE_VARIABLES));
    expect(srcDoc).toContain("Kedves Minta Kft.,");
    expect(srcDoc).not.toContain("{{");
  });

  it("gives the frame an explicit inline height so the body is never collapsed", () => {
    const style = frame().props.style as { height?: number | string; width?: string };
    expect(style.height).toBeGreaterThanOrEqual(300);
    expect(style.width).toBe("100%");
  });
});
