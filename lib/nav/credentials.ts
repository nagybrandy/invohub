// lib/nav/credentials.ts
// Build NAV API credentials from the saved company profile.
import type { Company } from "@/lib/companies/service";
import type { NavCredentials } from "@/lib/nav/client";
import { parseNavEnvironment } from "@/lib/nav/environment";

export function buildNavCredentials(company: Company | null): NavCredentials {
  return {
    technicalUser: company?.navTechnicalUser ?? "sandbox",
    xmlSignKey: company?.navXmlSignKey ?? "sandbox",
    taxNumber: company?.taxNumber ?? "00000000-0-00",
    environment: parseNavEnvironment(company?.navEnvironment),
  };
}
