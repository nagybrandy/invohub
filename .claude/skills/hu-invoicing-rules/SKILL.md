---
name: hu-invoicing-rules
description: Reference for Hungarian invoicing compliance rules InvoHub must follow — mandatory invoice fields under Áfa tv. 169. §, AAM/TAM/fordított adózás (reverse charge) text requirements, numbering continuity, storno/helyesbítő (correction) documents, and NAV Online Számla 3.0 submission modes. Used by the feature-auditor agent and anyone implementing Phase 1 invoicing work.
---

# Hungarian invoicing rules

InvoHub targets **egyéni vállalkozók (EV)** — Hungarian sole proprietors.
Every invoice InvoHub issues must satisfy the Hungarian VAT act (Áfa tv.,
2007. évi CXXVII. törvény) §169 mandatory-content rules and be reportable
to NAV Online Számla. Where this document is not certain of an exact legal
requirement, it says **ellenőrizendő** ("to be verified") — treat that as a
flag to check with a tax professional or NAV's own documentation
(onlineszamla.nav.gov.hu), not as settled fact.

## Mandatory invoice fields (Áfa tv. 169. §) — ellenőrizendő for exact
wording, but the field list is:

- Issue date (kiállítás kelte)
- Performance/completion date (teljesítés dátuma), when different from
  issue date
- Due date (fizetési határidő)
- Sequential invoice number (sorszám) — see Numbering below
- Issuer (kibocsátó) name, address, tax number
- Buyer (vevő) name, address, and tax number when the buyer is a Hungarian
  company/EV (not required for a private-individual buyer under most
  circumstances — ellenőrizendő for thresholds)
- Line items: description, quantity, unit price, net amount, VAT rate,
  VAT amount, gross amount
- Currency, and the exchange rate if not HUF
- VAT treatment marker — standard rate, AAM, TAM, or fordított adózás (see
  below)

## AAM / TAM / fordított adózás

- **AAM (alanyi adómentesség)** — VAT-exempt sole proprietor under the
  exemption threshold. Invoice must state the VAT-exempt legal basis in
  Hungarian (exact wording ellenőrizendő — commonly "Alanyi adómentes" plus
  a reference to the relevant Áfa tv. section) and show **0% VAT / no VAT
  amount charged**, not merely a 0 in the VAT column with no legal-basis
  text.
- **TAM (tárgyi adómentesség)** — VAT-exempt by the nature of the
  product/service (object-based exemption). Similarly needs the correct
  legal-basis text; do not conflate with AAM — they have different Áfa tv.
  bases (ellenőrizendő which section applies per activity).
- **Fordított adózás (reverse charge)** — VAT liability shifts to the
  buyer. The invoice must **not** show a VAT amount and must carry the
  reverse-charge legal text (ellenőrizendő exact wording).

If `lib/invoices/` or the invoice PDF template hardcodes VAT-treatment text,
that text is a compliance detail — verify it against current NAV guidance
rather than assuming it was correct when first written; wording has changed
across years.

## Numbering continuity

Invoice numbers must be sequential and gapless within a numbering series
(commonly per issuer per year, but a single series is also valid — check
what `db/schema.ts` / `lib/invoices/` actually implements). A gap or reused
number is a compliance defect NAV can flag. Concurrent invoice creation
must not be able to produce a duplicate or skipped number — check for a
database-level sequence/constraint rather than an in-app counter that races
under concurrent requests.

## Storno / helyesbítő (corrections)

Two ways to correct an issued invoice:
- **Storno (sztornó)** — a cancellation invoice that fully reverses the
  original (negative line items mirroring it 1:1).
- **Helyesbítő számla** — a correction invoice that adjusts specific
  fields/amounts.

Both **must reference the original invoice's number** so the correction is
traceable, and both must themselves be NAV-reportable documents (not just
an internal note). Check `lib/invoices/` and `db/schema.ts` for an explicit
`correctedInvoiceId`/`stornoOfInvoiceId`-style link, not just a free-text
note field.

## NAV Online Számla 3.0

- Modes: `test` and `production` environments exist in
  `lib/nav/environment.ts`; a `production` submission requires real NAV
  production credentials this repo does not have. Any agent/CI submission
  must use `test`.
- `lib/nav/invoice-xml.ts` builds the XML payload — verify against NAV's
  current XSD (onlineszamla.nav.gov.hu documentation) when the schema
  version changes; do not assume a template written for an earlier NAV API
  version is still correct.
- `lib/nav/submit-outgoing.ts` should handle NAV's async processing model
  (submit → poll transaction status) and surface rejection reasons, not
  just a boolean success/fail.
- Company/taxpayer lookup for auto-filling buyer details should use NAV's
  `queryTaxpayer` endpoint where implemented — check whether
  `lib/companies/` / `lib/company/` already does this or whether it's a
  manual-entry-only flow today (a known gap as of this writing).

## When auditing

Use this file's field list as your checklist, but never assert a legal
conclusion InvoHub's code doesn't already assert — when in doubt, report
"ellenőrizendő" and cite what needs checking, rather than presenting a
guess as fact.
