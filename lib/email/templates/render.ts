// lib/email/templates/render.ts
// Simple {{variable}} substitution for email templates.
import type { TemplateVariables } from "@/lib/email/templates/types";

export function renderTemplate(
  template: string,
  variables: TemplateVariables
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key as keyof TemplateVariables];
    return value ?? "";
  });
}
