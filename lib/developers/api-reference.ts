// lib/developers/api-reference.ts
// Single source of truth for the public developer docs (/developers): every
// external /api/v1 endpoint that really ships, with bilingual copy, params,
// request/response examples and a generated curl snippet. The drift test in
// api-reference.test.ts fails when this list and app/api/v1/** disagree, and
// docs/external-api.md is kept in step with it by hand.
//
// All example data is obviously fake (Minta Kft., 12345678-2-42, EXAMPLE ids).
// Credentials in snippets are shell variables, never key-looking strings.

export type Localized = { hu: string; en: string };

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type ApiParam = {
  name: string;
  location: "path" | "query" | "body";
  type: string;
  required: boolean;
  description: Localized;
};

export type ApiError = {
  status: number;
  /** Stable machine-readable `code` from the response body, when the route sets one. */
  code?: string;
  description: Localized;
};

export type ApiEndpointGroupId = "invoices" | "clients" | "products" | "exchangeRates";

export type ApiEndpoint = {
  /** Stable anchor id, e.g. "invoices.finalize". */
  id: string;
  group: ApiEndpointGroupId;
  method: HttpMethod;
  /** Path with `{id}` placeholders, e.g. `/api/v1/invoices/{id}/finalize`. */
  path: string;
  summary: Localized;
  description: Localized;
  params: ApiParam[];
  /** True when the route wraps its work in withIdempotency (Idempotency-Key header honoured). */
  idempotent?: boolean;
  /** JSON request body example. */
  requestExample?: string;
  responseStatus: number;
  /** JSON response example; omitted for 204 / binary responses. */
  responseExample?: string;
  /** Content type of a non-JSON success response (e.g. the PDF). */
  responseContentType?: string;
  errors: ApiError[];
};

export const API_BASE_URL = "https://app.invohub.hu";

export const API_ENDPOINT_GROUPS: { id: ApiEndpointGroupId; title: Localized }[] = [
  { id: "invoices", title: { hu: "Számlák", en: "Invoices" } },
  { id: "clients", title: { hu: "Ügyfelek", en: "Clients" } },
  { id: "products", title: { hu: "Termékek", en: "Products" } },
  { id: "exchangeRates", title: { hu: "MNB árfolyam", en: "MNB exchange rate" } },
];

// ---------------------------------------------------------------- examples

const j = (value: unknown) => JSON.stringify(value, null, 2);

const DRAFT_INVOICE = {
  id: "EXAMPLE_INVOICE_ID",
  invoiceNumber: "",
  documentType: "invoice",
  clientName: "Minta Kft.",
  clientTaxNumber: "12345678-2-42",
  clientZipCode: "1051",
  clientCity: "Budapest",
  clientAddress: "Minta utca 1.",
  issueDate: "2026-11-02",
  dueDate: "2026-11-16",
  status: "draft",
  currency: "HUF",
  lineItems: [
    {
      id: "EXAMPLE_LINE_ID",
      description: "Tanácsadás",
      quantity: 10,
      unitPrice: 15000,
      vatRate: 27,
      vatCategory: "normal",
      unit: "óra",
    },
  ],
  createdAt: "2026-11-02T09:00:00.000Z",
  updatedAt: "2026-11-02T09:00:00.000Z",
};

const ISSUED_INVOICE = { ...DRAFT_INVOICE, invoiceNumber: "INV-2026-00007", status: "unpaid" };

const NAV_RESULT = {
  outcome: "submitted",
  submission: {
    submissionId: "EXAMPLE_SUBMISSION_ID",
    status: "sent",
    mode: "demo",
    transactionId: "EXAMPLE_TRANSACTION_ID",
    errorMessage: null,
  },
};

const INVOICE_BODY = {
  clientName: "Minta Kft.",
  clientTaxNumber: "12345678-2-42",
  clientZipCode: "1051",
  clientCity: "Budapest",
  clientAddress: "Minta utca 1.",
  dueDate: "2026-11-16",
  lineItems: [
    { description: "Tanácsadás", quantity: 10, unitPrice: 15000, vatRate: 27, unit: "óra" },
  ],
};

const CLIENT = {
  id: "EXAMPLE_CLIENT_ID",
  userId: "EXAMPLE_USER_ID",
  name: "Minta Kft.",
  email: "szamla@minta.example",
  taxNumber: "12345678-2-42",
  address: "Minta utca 1.",
  city: "Budapest",
  zipCode: "1051",
  country: "HU",
  partyType: "company",
  createdAt: "2026-11-02T09:00:00.000Z",
  updatedAt: "2026-11-02T09:00:00.000Z",
};

const PRODUCT = {
  id: "EXAMPLE_PRODUCT_ID",
  userId: "EXAMPLE_USER_ID",
  name: "Tanácsadás (óra)",
  unitPrice: 15000,
  vatRate: 27,
  currency: "HUF",
  unit: "óra",
  createdAt: "2026-11-02T09:00:00.000Z",
  updatedAt: "2026-11-02T09:00:00.000Z",
};

// ---------------------------------------------------------------- helpers

const ID_PARAM = (what: Localized): ApiParam => ({
  name: "id",
  location: "path",
  type: "string",
  required: true,
  description: what,
});

const INVOICE_ID = ID_PARAM({ hu: "A számla azonosítója.", en: "The invoice id." });
const CLIENT_ID = ID_PARAM({ hu: "Az ügyfél azonosítója.", en: "The client id." });
const PRODUCT_ID = ID_PARAM({ hu: "A termék azonosítója.", en: "The product id." });

const NOT_FOUND_INVOICE: ApiError = {
  status: 404,
  description: {
    hu: "A számla nem létezik, vagy nem ehhez a kulcshoz tartozó felhasználóé.",
    en: "The invoice does not exist or belongs to another user.",
  },
};
const NOT_FOUND_CLIENT: ApiError = {
  status: 404,
  description: {
    hu: "Az ügyfél nem létezik, vagy nem ehhez a kulcshoz tartozó felhasználóé.",
    en: "The client does not exist or belongs to another user.",
  },
};
const NOT_FOUND_PRODUCT: ApiError = {
  status: 404,
  description: {
    hu: "A termék nem létezik, vagy nem ehhez a kulcshoz tartozó felhasználóé.",
    en: "The product does not exist or belongs to another user.",
  },
};
const INVALID_JSON: ApiError = {
  status: 400,
  description: { hu: "Hibás JSON törzs.", en: "Invalid JSON body." },
};
const BUYER_ADDRESS_MISSING: ApiError = {
  status: 422,
  code: "buyerAddressMissing",
  description: {
    hu: "Véglegesítéshez a vevő neve és teljes címe (clientZipCode, clientCity, clientAddress) kötelező (Áfa tv. 169. § e). Szám nem kerül kiosztásra.",
    en: "Finalizing needs the buyer name and full address (clientZipCode, clientCity, clientAddress). No number is assigned.",
  },
};
const COMPANY_PROFILE_INCOMPLETE: ApiError = {
  status: 422,
  code: "companyProfileIncomplete",
  description: {
    hu: "A cégprofil hiányos; a válasz `missingFields` tömbje felsorolja a hiányzó mezőket.",
    en: "The company profile is incomplete; the `missingFields` array in the response lists what is missing.",
  },
};
const NOT_DRAFT: ApiError = {
  status: 409,
  code: "notDraft",
  description: {
    hu: "Csak draft állapotú számlán végezhető el.",
    en: "Only possible on an invoice that is still a draft.",
  },
};

const IDEMPOTENCY_NOTE: Localized = {
  hu: " Az `Idempotency-Key` fejléc támogatott.",
  en: " The `Idempotency-Key` header is supported.",
};

const withIdem = (description: Localized): Localized => ({
  hu: description.hu + IDEMPOTENCY_NOTE.hu,
  en: description.en + IDEMPOTENCY_NOTE.en,
});

const INVOICE_WRITE_PARAMS: ApiParam[] = [
  { name: "clientName", location: "body", type: "string", required: true, description: { hu: "Vevő neve.", en: "Buyer name." } },
  {
    name: "lineItems",
    location: "body",
    type: "array",
    required: true,
    description: {
      hu: "Legalább egy tétel: `description` (string), `quantity` (number), `unitPrice` (number) kötelező; `vatRate` (0, 5, 18 vagy 27; alapértelmezés 27), `vatCategory` (`normal`, `AAM`, `TAM`, `KBAET`, `AHK`, `FAD`, `ATK`), `vatExemptionReason` (string), `unit` (string) opcionális. Nem `normal` ÁFA-kategóriánál az ÁFA-kulcs 0. Ha nem adsz meg `vatCategory`-t, `AAM` a cégprofil alanyi adómentessége esetén, különben `normal`.",
      en: "At least one line: `description` (string), `quantity` (number), `unitPrice` (number) are required; `vatRate` (0, 5, 18 or 27; default 27), `vatCategory` (`normal`, `AAM`, `TAM`, `KBAET`, `AHK`, `FAD`, `ATK`), `vatExemptionReason` (string), `unit` (string) are optional. For any category other than `normal` the VAT rate is 0. Without `vatCategory` the default is `AAM` when the company profile is VAT-exempt, otherwise `normal`.",
    },
  },
  { name: "clientTaxNumber", location: "body", type: "string", required: false, description: { hu: "Vevő adószáma.", en: "Buyer tax number." } },
  {
    name: "clientZipCode / clientCity / clientAddress",
    location: "body",
    type: "string",
    required: false,
    description: {
      hu: "A számlán szereplő vevőcím (a kiállításkori pillanatkép, nem az `/clients` végponton tárolt ügyfél címe). Draftnál elhagyható; véglegesítéskor mindhárom kötelező. Díjbekérőnél soha nem kötelező.",
      en: "The buyer address printed on the invoice (a snapshot at issue time, not the address stored on the client). Optional on a draft; all three are required to finalize. Never required on a proforma.",
    },
  },
  { name: "clientCountry", location: "body", type: "string", required: false, description: { hu: "Vevő országa.", en: "Buyer country." } },
  { name: "clientEuVatNumber", location: "body", type: "string", required: false, description: { hu: "Vevő közösségi adószáma.", en: "Buyer EU VAT number." } },
  { name: "invoiceNumber", location: "body", type: "string", required: false, description: { hu: "Egyedi számlaszám; ha üres, a véglegesítéskor kerül kiosztásra.", en: "Custom number; if empty it is assigned when the invoice is finalized." } },
  { name: "documentType", location: "body", type: "string", required: false, description: { hu: "`invoice` (alapértelmezés), `proforma` (díjbekérő) vagy `advance` (előlegszámla).", en: "`invoice` (default), `proforma` or `advance`." } },
  { name: "issueDate", location: "body", type: "string (YYYY-MM-DD)", required: false, description: { hu: "Kiállítás dátuma (alapértelmezés: ma).", en: "Issue date (default: today)." } },
  { name: "fulfillmentDate", location: "body", type: "string (YYYY-MM-DD)", required: false, description: { hu: "Teljesítés dátuma.", en: "Fulfilment date." } },
  { name: "dueDate", location: "body", type: "string (YYYY-MM-DD)", required: false, description: { hu: "Fizetési határidő (alapértelmezés: a kiállítás dátuma).", en: "Due date (default: the issue date)." } },
  { name: "status", location: "body", type: "string", required: false, description: { hu: "`draft` (alapértelmezés), `proforma`, `sent`, `paid`, `partially_paid`, `unpaid`, `overdue`, `cancelled`. Bármi, ami nem `draft`, végleges számlát jelent, ezért vevőcím kell hozzá.", en: "`draft` (default), `proforma`, `sent`, `paid`, `partially_paid`, `unpaid`, `overdue`, `cancelled`. Anything other than `draft` means a final invoice and therefore needs the buyer address." } },
  { name: "currency", location: "body", type: "string", required: false, description: { hu: "Hárombetűs ISO pénznemkód (pl. `HUF`, `EUR`). Alapértelmezés: `HUF`, külföldi cégprofilnál `EUR`.", en: "Three-letter ISO currency code (e.g. `HUF`, `EUR`). Default: `HUF`, or `EUR` for a non-Hungarian company profile." } },
  { name: "exchangeRate", location: "body", type: "number", required: false, description: { hu: "HUF árfolyam nem-HUF pénznemhez (pozitív szám). Ha kihagyod, a szerver a hivatalos MNB árfolyamot kéri le a teljesítés (ennek hiányában a kiállítás) napjára; ha az MNB nem érhető el, a számla árfolyam nélkül marad.", en: "HUF rate for a non-HUF currency (positive number). If omitted, the server looks up the official MNB rate for the fulfilment date (or the issue date); if MNB is unreachable the invoice is saved without a rate." } },
  { name: "paymentMethod", location: "body", type: "string", required: false, description: { hu: "`transfer`, `cash`, `card` vagy `other`.", en: "`transfer`, `cash`, `card` or `other`." } },
  { name: "notes", location: "body", type: "string", required: false, description: { hu: "Megjegyzés a számlán.", en: "Note printed on the invoice." } },
];

const INVOICE_CREATE_ONLY_PARAMS: ApiParam[] = [
  { name: "sendEmail", location: "body", type: "boolean", required: false, description: { hu: "Alapértelmezés: `false` (nem küld e-mailt). `true` esetén és draft számlánál a küldés előtt véglegesítés történik (szám kiosztás, `status` -> `sent`).", en: "Default `false` (no email). With `true`, a draft is finalized first (number assigned, `status` becomes `sent`) and then emailed." } },
  { name: "emailTo", location: "body", type: "string | string[]", required: false, description: { hu: "Címzett(ek) felülírása.", en: "Override the To recipients." } },
  { name: "emailCc", location: "body", type: "string | string[]", required: false, description: { hu: "Másolat (Cc) címzettek.", en: "Cc recipients." } },
  { name: "submitToNav", location: "body", type: "boolean", required: false, description: { hu: "`true`: NAV-beküldést kér akkor is, ha az automatikus nem futott le. Idempotens.", en: "`true` requests a NAV submission even if the automatic one did not run. Idempotent." } },
];

// -------------------------------------------------------------- endpoints

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: "invoices.list",
    group: "invoices",
    method: "GET",
    path: "/api/v1/invoices",
    summary: { hu: "Számlák listája", en: "List invoices" },
    description: {
      hu: "A kulcshoz tartozó felhasználó számláit adja vissza lapozva.",
      en: "Returns the invoices of the key's user, paginated.",
    },
    params: [
      { name: "status", location: "query", type: "string", required: false, description: { hu: "`draft`, `proforma`, `sent`, `paid`, `partially_paid`, `unpaid`, `overdue` vagy `cancelled`. Ismeretlen érték figyelmen kívül marad.", en: "`draft`, `proforma`, `sent`, `paid`, `partially_paid`, `unpaid`, `overdue` or `cancelled`. Unknown values are ignored." } },
      { name: "search", location: "query", type: "string", required: false, description: { hu: "Ügyfélnév, számlaszám vagy adószám részlete.", en: "Part of the client name, invoice number or tax number." } },
      { name: "needsExchangeRate", location: "query", type: "string", required: false, description: { hu: "`1` vagy `true`: csak a használható árfolyam nélküli, nem HUF-os kiállított számlák.", en: "`1` or `true`: only issued non-HUF invoices that have no usable rate." } },
      { name: "limit", location: "query", type: "integer", required: false, description: { hu: "Oldalméret, alapértelmezés 30, legfeljebb 100.", en: "Page size, default 30, at most 100." } },
      { name: "offset", location: "query", type: "integer", required: false, description: { hu: "Lapozási eltolás, alapértelmezés 0.", en: "Pagination offset, default 0." } },
    ],
    responseStatus: 200,
    responseExample: j({ invoices: [DRAFT_INVOICE], total: 1, limit: 30, offset: 0 }),
    errors: [],
  },
  {
    id: "invoices.create",
    group: "invoices",
    method: "POST",
    path: "/api/v1/invoices",
    summary: { hu: "Számla létrehozása", en: "Create an invoice" },
    description: withIdem({
      hu: "Draft vagy azonnal végleges számlát hoz létre. Alapértelmezés szerint draftot készít, szám nélkül és e-mail küldése nélkül. A válasz `email` mezője jelzi, történt-e küldés; a `nav` / `navSubmission` mező a NAV-beküldés eredménye (vagy `null`).",
      en: "Creates a draft or an immediately final invoice. By default it creates a number-less draft and sends no email. The `email` field of the response says whether an email went out; `nav` / `navSubmission` carry the NAV submission result (or `null`).",
    }),
    idempotent: true,
    params: [...INVOICE_WRITE_PARAMS, ...INVOICE_CREATE_ONLY_PARAMS],
    requestExample: j(INVOICE_BODY),
    responseStatus: 201,
    responseExample: j({ invoice: DRAFT_INVOICE, navSubmission: null, nav: null, email: { sent: false, skipped: true } }),
    errors: [
      INVALID_JSON,
      {
        status: 400,
        description: {
          hu: "Validációs hiba; az `error` mező megnevezi a hibás mezőt (ilyenkor nincs `code`).",
          en: "Validation error; the `error` field names the offending field (no `code` is set).",
        },
      },
      BUYER_ADDRESS_MISSING,
      COMPANY_PROFILE_INCOMPLETE,
    ],
  },
  {
    id: "invoices.get",
    group: "invoices",
    method: "GET",
    path: "/api/v1/invoices/{id}",
    summary: { hu: "Számla lekérdezése", en: "Get an invoice" },
    description: { hu: "Egy számla teljes adatai.", en: "The full record of one invoice." },
    params: [INVOICE_ID],
    responseStatus: 200,
    responseExample: j({ invoice: ISSUED_INVOICE }),
    errors: [NOT_FOUND_INVOICE],
  },
  {
    id: "invoices.update",
    group: "invoices",
    method: "PATCH",
    path: "/api/v1/invoices/{id}",
    summary: { hu: "Draft frissítése", en: "Update a draft" },
    description: {
      hu: "Csak draft számla módosítható. A törzset a létrehozással azonos szabályok szerint ellenőrzi, és teljes törzset vár (`clientName` és `lineItems` kötelező). Nem módosítja a `fulfillmentDate`, az `emailTo`, az `emailCc` és a `sendEmail` mezőt. Ha a `status` már nem `draft`, a PATCH véglegesíti a számlát, és a válasz `nav` mezője a NAV-beküldés eredménye.",
      en: "Only a draft can be updated. The body is validated like a create and must be complete (`clientName` and `lineItems` are required). It does not change `fulfillmentDate`, `emailTo`, `emailCc` or `sendEmail`. If `status` is no longer `draft`, the PATCH finalizes the invoice and the `nav` field of the response carries the NAV submission result.",
    },
    params: [INVOICE_ID, ...INVOICE_WRITE_PARAMS],
    requestExample: j({
      clientName: "Minta Kft.",
      lineItems: [{ description: "Tanácsadás", quantity: 12, unitPrice: 15000 }],
    }),
    responseStatus: 200,
    responseExample: j({ invoice: DRAFT_INVOICE, nav: null }),
    errors: [
      INVALID_JSON,
      { status: 400, code: "validationError", description: { hu: "Validációs hiba; az `error` mező megnevezi a hibás mezőt.", en: "Validation error; the `error` field names the offending field." } },
      NOT_FOUND_INVOICE,
      NOT_DRAFT,
      BUYER_ADDRESS_MISSING,
      COMPANY_PROFILE_INCOMPLETE,
    ],
  },
  {
    id: "invoices.delete",
    group: "invoices",
    method: "DELETE",
    path: "/api/v1/invoices/{id}",
    summary: { hu: "Draft törlése", en: "Delete a draft" },
    description: {
      hu: "Csak draft számla törölhető. Véglegesített számla a folytonos számozás miatt soha nem törölhető; helyette sztornózni kell.",
      en: "Only a draft can be deleted. A finalized invoice is never deleted because numbering must stay continuous; issue a storno instead.",
    },
    params: [INVOICE_ID],
    responseStatus: 204,
    errors: [NOT_FOUND_INVOICE, NOT_DRAFT],
  },
  {
    id: "invoices.finalize",
    group: "invoices",
    method: "POST",
    path: "/api/v1/invoices/{id}/finalize",
    summary: { hu: "Véglegesítés", en: "Finalize a draft" },
    description: withIdem({
      hu: "Draftból végleges bizonylatot készít és kiosztja a számlaszámot, ugyanazon a kódúton, mint az alkalmazás Véglegesítés gombja. Díjbekérő `proforma`, minden más `unpaid` státuszt kap. Nem küld e-mailt. Hiányzó árfolyamot (nem HUF) a hivatalos MNB árfolyammal pótol. A válasz `nav` mezője a NAV-beküldés eredménye, ha a NAV be van állítva.",
      en: "Turns a draft into a final document and assigns the invoice number, through the same code path as the app's Finalize button. A proforma becomes `proforma`, anything else `unpaid`. Sends no email. A missing non-HUF rate is filled from the official MNB rate. The `nav` field of the response carries the NAV submission result when NAV is configured.",
    }),
    idempotent: true,
    params: [INVOICE_ID],
    responseStatus: 200,
    responseExample: j({ invoice: ISSUED_INVOICE, nav: NAV_RESULT }),
    errors: [NOT_FOUND_INVOICE, NOT_DRAFT, BUYER_ADDRESS_MISSING, COMPANY_PROFILE_INCOMPLETE],
  },
  {
    id: "invoices.storno",
    group: "invoices",
    method: "POST",
    path: "/api/v1/invoices/{id}/storno",
    summary: { hu: "Sztornó", en: "Cancel with a storno" },
    description: withIdem({
      hu: "Sztornó (törlő) bizonylatot hoz létre, az eredetit `cancelled` állapotba állítja. A sztornó már végleges, ezért a NAV felé is jelentésre kerül, ha a NAV be van állítva (`nav` mező). Ez a hibás, végleges számla javításának útja.",
      en: "Creates a storno (cancellation) document and marks the original `cancelled`. The storno is final on creation, so it is reported to NAV when NAV is configured (`nav` field). This is the way to correct an issued invoice.",
    }),
    idempotent: true,
    params: [INVOICE_ID],
    responseStatus: 201,
    responseExample: j({
      invoice: { ...ISSUED_INVOICE, id: "EXAMPLE_STORNO_ID", documentType: "storno", originalInvoiceId: "EXAMPLE_INVOICE_ID" },
      nav: NAV_RESULT,
    }),
    errors: [
      NOT_FOUND_INVOICE,
      { status: 400, code: "proformaNotStornoable", description: { hu: "Díjbekérő nem sztornózható.", en: "A proforma cannot be cancelled with a storno." } },
      { status: 400, description: { hu: "A számla már sztornózva van (nincs `code`).", en: "The invoice is already cancelled (no `code`)." } },
    ],
  },
  {
    id: "invoices.modify",
    group: "invoices",
    method: "POST",
    path: "/api/v1/invoices/{id}/modify",
    summary: { hu: "Helyesbítő draft indítása", en: "Start a correction draft" },
    description: withIdem({
      hu: "Helyesbítő (korrekciós) draftot indít. A NAV a helyesbítő tételeit különbözetként kezeli, ezért a draft nulla különbözettel indul: az eredeti minden tételéhez egy ellentételező sor (negatív mennyiség) és az eredeti tétel szerkeszthető másolata kerül bele. A másolatokat írd át a helyes értékekre (PATCH), majd véglegesítsd (finalize).",
      en: "Starts a correction (helyesbítő) draft. NAV treats correction lines as differences, so the draft starts at zero difference: for every original line it holds a reversing line (negative quantity) and an editable copy of the original. Rewrite the copies to the correct values (PATCH), then finalize.",
    }),
    idempotent: true,
    params: [INVOICE_ID],
    responseStatus: 201,
    responseExample: j({
      invoice: { ...DRAFT_INVOICE, id: "EXAMPLE_MODIFY_ID", documentType: "modify", modifiesInvoiceId: "EXAMPLE_INVOICE_ID", modificationIndex: 1 },
    }),
    errors: [
      NOT_FOUND_INVOICE,
      { status: 400, code: "proformaNotStornoable", description: { hu: "Díjbekérő nem helyesbíthető.", en: "A proforma cannot be corrected." } },
    ],
  },
  {
    id: "invoices.convert",
    group: "invoices",
    method: "POST",
    path: "/api/v1/invoices/{id}/convert",
    summary: { hu: "Díjbekérő számlává alakítása", en: "Convert a proforma to an invoice" },
    description: withIdem({
      hu: "A díjbekérőből draft számlát készít. Ugyanaz a díjbekérő csak egyszer konvertálható, amíg a konverzió nem sztornózott.",
      en: "Creates a draft invoice from a proforma. The same proforma can only be converted once while the conversion has not been cancelled.",
    }),
    idempotent: true,
    params: [INVOICE_ID],
    responseStatus: 201,
    responseExample: j({ invoice: { ...DRAFT_INVOICE, id: "EXAMPLE_CONVERTED_ID", convertedFromInvoiceId: "EXAMPLE_INVOICE_ID" } }),
    errors: [
      NOT_FOUND_INVOICE,
      { status: 400, code: "notProforma", description: { hu: "A bizonylat nem díjbekérő.", en: "The document is not a proforma." } },
      { status: 400, code: "cancelled", description: { hu: "A díjbekérő sztornózva van.", en: "The proforma is cancelled." } },
      { status: 409, code: "alreadyConverted", description: { hu: "Már konvertálva; a válasz `invoice` mezője a meglévő számla.", en: "Already converted; the `invoice` field of the response is the existing invoice." } },
    ],
  },
  {
    id: "invoices.pdf",
    group: "invoices",
    method: "GET",
    path: "/api/v1/invoices/{id}/pdf",
    summary: { hu: "Számla PDF", en: "Invoice PDF" },
    description: {
      hu: "A számla PDF-je, ugyanazzal a generátorral és megjelenéssel, mint az alkalmazásban.",
      en: "The invoice as a PDF, from the same generator and appearance settings as the app.",
    },
    params: [INVOICE_ID],
    responseStatus: 200,
    responseContentType: "application/pdf",
    errors: [NOT_FOUND_INVOICE],
  },
  {
    id: "invoices.send",
    group: "invoices",
    method: "POST",
    path: "/api/v1/invoices/{id}/send",
    summary: { hu: "Számla küldése e-mailben", en: "Email an invoice" },
    description: withIdem({
      hu: "A számlát PDF csatolmánnyal e-mailben elküldi. A törzs elhagyható. Ha a számla még draft, a küldés előtt véglegesíti (a véglegesítés kapui itt is érvényesek).",
      en: "Emails the invoice with the PDF attached. The body is optional. If the invoice is still a draft it is finalized first (the same finalization checks apply).",
    }),
    idempotent: true,
    params: [
      INVOICE_ID,
      { name: "to", location: "body", type: "string | string[]", required: false, description: { hu: "Címzett(ek) felülírása.", en: "Override the To recipients." } },
      { name: "cc", location: "body", type: "string | string[]", required: false, description: { hu: "Másolat (Cc) címzettek.", en: "Cc recipients." } },
      { name: "templateType", location: "body", type: "string", required: false, description: { hu: "E-mail sablon típusa (alapértelmezés: `invoice_notification`).", en: "Email template type (default `invoice_notification`)." } },
    ],
    requestExample: j({ to: "szamla@minta.example", cc: ["iroda@minta.example"] }),
    responseStatus: 200,
    responseExample: j({ invoice: ISSUED_INVOICE, to: ["szamla@minta.example"], cc: ["iroda@minta.example"], pdfAttached: true }),
    errors: [
      { status: 404, code: "invoiceNotFound", description: { hu: "A számla nem található.", en: "The invoice was not found." } },
      { status: 422, code: "noRecipient", description: { hu: "Nincs címzett.", en: "There is no recipient." } },
      BUYER_ADDRESS_MISSING,
      COMPANY_PROFILE_INCOMPLETE,
      { status: 409, code: "invoiceFinalized", description: { hu: "Másik kérés közben véglegesítette ugyanezt a draftot.", en: "Another request finalized the same draft first." } },
      { status: 502, code: "emailSendFailed", description: { hu: "Az e-mail kiküldése sikertelen.", en: "The email could not be delivered." } },
      { status: 500, description: { hu: "`pdfFailed` vagy `templateNotFound` `code`-dal: a PDF vagy a sablon hiba miatt nem készült el.", en: "With `code` `pdfFailed` or `templateNotFound`: the PDF or template could not be produced." } },
    ],
  },
  {
    id: "invoices.markPaid",
    group: "invoices",
    method: "POST",
    path: "/api/v1/invoices/{id}/mark-paid",
    summary: { hu: "Fizetettnek jelölés", en: "Mark as paid" },
    description: {
      hu: "Befizetést rögzít. A törzs elhagyható: akkor a teljes fennmaradó összeg kerül rögzítésre. Az ismételt hívás hozzáadja a befizetést a korábbihoz (részfizetés), ezért ez a végpont szándékosan nem Idempotency-Key védett.",
      en: "Records a payment. The body is optional: without it the whole outstanding amount is recorded. Calling it again adds to the earlier payment (partial payments), which is why this endpoint deliberately does not honour Idempotency-Key.",
    },
    params: [
      INVOICE_ID,
      { name: "paymentMethod", location: "body", type: "string", required: false, description: { hu: "`transfer`, `cash`, `card` vagy `other`.", en: "`transfer`, `cash`, `card` or `other`." } },
      { name: "paidAmount", location: "body", type: "number", required: false, description: { hu: "Nem negatív összeg; alapértelmezés a fennmaradó összeg.", en: "Non-negative amount; defaults to the outstanding amount." } },
      { name: "paidAt", location: "body", type: "string (ISO 8601)", required: false, description: { hu: "A befizetés időpontja; alapértelmezés: most.", en: "When the payment was made; defaults to now." } },
    ],
    requestExample: j({ paymentMethod: "transfer", paidAmount: 50000, paidAt: "2026-11-10T12:00:00.000Z" }),
    responseStatus: 200,
    responseExample: j({ invoice: { ...ISSUED_INVOICE, status: "partially_paid", paymentMethod: "transfer", paidAmount: 50000, paidAt: "2026-11-10T12:00:00.000Z" } }),
    errors: [
      { status: 400, description: { hu: "Érvénytelen `paymentMethod` vagy negatív / nem szám `paidAmount` (nincs `code`).", en: "Invalid `paymentMethod`, or `paidAmount` is negative or not a number (no `code`)." } },
      NOT_FOUND_INVOICE,
    ],
  },
  {
    id: "invoices.navStatus",
    group: "invoices",
    method: "GET",
    path: "/api/v1/invoices/{id}/nav",
    summary: { hu: "NAV-beküldések állapota", en: "NAV submission status" },
    description: {
      hu: "A számla NAV-beküldéseinek rekordjai, a legfrissebb elöl. A rekord további mezőket is tartalmazhat a felsoroltakon kívül.",
      en: "The invoice's NAV submission records, newest first. A record may carry further fields beyond those shown.",
    },
    params: [INVOICE_ID],
    responseStatus: 200,
    responseExample: j({
      submissions: [
        {
          id: "EXAMPLE_SUBMISSION_ID",
          invoiceId: "EXAMPLE_INVOICE_ID",
          status: "done",
          mode: "demo",
          transactionId: "EXAMPLE_TRANSACTION_ID",
          errorMessage: null,
          createdAt: "2026-11-02T09:05:00.000Z",
        },
      ],
    }),
    errors: [NOT_FOUND_INVOICE],
  },
  {
    id: "invoices.navSubmit",
    group: "invoices",
    method: "POST",
    path: "/api/v1/invoices/{id}/nav",
    summary: { hu: "Beküldés a NAV-nak", en: "Submit to NAV" },
    description: {
      hu: "A kimenő számlát továbbítja a NAV Online Számla felé. A NAV-környezet a fiók NAV-beállítását követi (demó vagy teszt mód), a kérés nem választ környezetet. Idempotens: ha már van folyamatban lévő vagy sikeres beküldés, azt adja vissza (`alreadySubmitted: true`), és nem küld újat. Díjbekérő nem küldhető be. A végleges számlák egyébként véglegesítéskor automatikusan beküldésre kerülnek, ha a NAV be van állítva.",
      en: "Forwards the issued invoice to NAV Online Számla. The NAV environment follows the account's NAV settings (demo or test mode); the request does not choose one. Idempotent: if a submission is already in progress or done, that one is returned (`alreadySubmitted: true`) and nothing new is sent. A proforma cannot be submitted. Final invoices are otherwise submitted automatically on finalization when NAV is configured.",
    },
    params: [INVOICE_ID],
    responseStatus: 200,
    responseExample: j({
      invoice: ISSUED_INVOICE,
      navSubmission: NAV_RESULT.submission,
    }),
    errors: [
      NOT_FOUND_INVOICE,
      { status: 409, code: "draftNotSubmittable", description: { hu: "A draft (szám nélküli) bizonylat nem küldhető be.", en: "A draft (number-less) document cannot be submitted." } },
      { status: 409, code: "missingExchangeRate", description: { hu: "Nem HUF-os számlához nincs használható árfolyam.", en: "A non-HUF invoice has no usable exchange rate." } },
      { status: 422, code: "proformaNotSubmittable", description: { hu: "A díjbekérő nem számla, nem jelenthető.", en: "A proforma is not an invoice and is not reported." } },
      { status: 502, code: "navSubmitFailed", description: { hu: "A beküldés sikertelen; a hiba rögzítve van (`navSubmission`), újrapróbálható.", en: "The submission failed; the failure is recorded (`navSubmission`) and can be retried." } },
    ],
  },
  {
    id: "clients.list",
    group: "clients",
    method: "GET",
    path: "/api/v1/clients",
    summary: { hu: "Ügyfelek listája", en: "List clients" },
    description: { hu: "A kulcshoz tartozó felhasználó összes ügyfele.", en: "All clients of the key's user." },
    params: [],
    responseStatus: 200,
    responseExample: j({ clients: [CLIENT] }),
    errors: [],
  },
  {
    id: "clients.create",
    group: "clients",
    method: "POST",
    path: "/api/v1/clients",
    summary: { hu: "Ügyfél létrehozása", en: "Create a client" },
    description: { hu: "Új ügyfelet hoz létre.", en: "Creates a client." },
    params: [
      { name: "name", location: "body", type: "string", required: true, description: { hu: "Az ügyfél neve.", en: "Client name." } },
      { name: "email", location: "body", type: "string", required: false, description: { hu: "E-mail cím.", en: "Email address." } },
      { name: "taxNumber", location: "body", type: "string", required: false, description: { hu: "Adószám.", en: "Tax number." } },
      { name: "euVatNumber", location: "body", type: "string", required: false, description: { hu: "Közösségi adószám.", en: "EU VAT number." } },
      { name: "zipCode / city / address / country", location: "body", type: "string", required: false, description: { hu: "Cím mezők.", en: "Address fields." } },
      { name: "partyType", location: "body", type: "string", required: false, description: { hu: "`company` vagy `private_person`.", en: "`company` or `private_person`." } },
    ],
    requestExample: j({ name: "Minta Kft.", taxNumber: "12345678-2-42", email: "szamla@minta.example" }),
    responseStatus: 201,
    responseExample: j({ client: CLIENT }),
    errors: [
      INVALID_JSON,
      { status: 400, description: { hu: "A `name` hiányzik vagy üres (nincs `code`).", en: "`name` is missing or empty (no `code`)." } },
    ],
  },
  {
    id: "clients.get",
    group: "clients",
    method: "GET",
    path: "/api/v1/clients/{id}",
    summary: { hu: "Ügyfél lekérdezése", en: "Get a client" },
    description: { hu: "Egy ügyfél adatai.", en: "One client." },
    params: [CLIENT_ID],
    responseStatus: 200,
    responseExample: j({ client: CLIENT }),
    errors: [NOT_FOUND_CLIENT],
  },
  {
    id: "clients.update",
    group: "clients",
    method: "PATCH",
    path: "/api/v1/clients/{id}",
    summary: { hu: "Ügyfél frissítése", en: "Update a client" },
    description: {
      hu: "Az ügyfél mezőinek módosítása; a törzs ugyanazokat a mezőket fogadja, mint a létrehozás, mindet opcionálisan.",
      en: "Updates client fields; the body takes the same fields as create, all optional.",
    },
    params: [CLIENT_ID],
    requestExample: j({ email: "uj-szamla@minta.example" }),
    responseStatus: 200,
    responseExample: j({ client: { ...CLIENT, email: "uj-szamla@minta.example" } }),
    errors: [INVALID_JSON, NOT_FOUND_CLIENT],
  },
  {
    id: "clients.delete",
    group: "clients",
    method: "DELETE",
    path: "/api/v1/clients/{id}",
    summary: { hu: "Ügyfél törlése", en: "Delete a client" },
    description: { hu: "Törli az ügyfelet.", en: "Deletes the client." },
    params: [CLIENT_ID],
    responseStatus: 204,
    errors: [NOT_FOUND_CLIENT],
  },
  {
    id: "products.list",
    group: "products",
    method: "GET",
    path: "/api/v1/products",
    summary: { hu: "Termékek listája", en: "List products" },
    description: { hu: "A kulcshoz tartozó felhasználó termékei és szolgáltatásai.", en: "The products and services of the key's user." },
    params: [],
    responseStatus: 200,
    responseExample: j({ products: [PRODUCT] }),
    errors: [],
  },
  {
    id: "products.create",
    group: "products",
    method: "POST",
    path: "/api/v1/products",
    summary: { hu: "Termék létrehozása", en: "Create a product" },
    description: { hu: "Új terméket vagy szolgáltatást hoz létre.", en: "Creates a product or service." },
    params: [
      { name: "name", location: "body", type: "string", required: true, description: { hu: "A termék neve.", en: "Product name." } },
      { name: "unitPrice", location: "body", type: "number", required: true, description: { hu: "Egységár.", en: "Unit price." } },
      { name: "vatRate", location: "body", type: "number", required: false, description: { hu: "ÁFA-kulcs (%).", en: "VAT rate (%)." } },
      { name: "currency", location: "body", type: "string", required: false, description: { hu: "Pénznem kódja.", en: "Currency code." } },
      { name: "unit", location: "body", type: "string", required: false, description: { hu: "Mértékegység.", en: "Unit of measure." } },
      { name: "description", location: "body", type: "string", required: false, description: { hu: "Leírás.", en: "Description." } },
    ],
    requestExample: j({ name: "Tanácsadás (óra)", unitPrice: 15000, vatRate: 27, currency: "HUF", unit: "óra" }),
    responseStatus: 201,
    responseExample: j({ product: PRODUCT }),
    errors: [
      INVALID_JSON,
      { status: 400, description: { hu: "A `name` hiányzik vagy üres (nincs `code`).", en: "`name` is missing or empty (no `code`)." } },
    ],
  },
  {
    id: "products.get",
    group: "products",
    method: "GET",
    path: "/api/v1/products/{id}",
    summary: { hu: "Termék lekérdezése", en: "Get a product" },
    description: { hu: "Egy termék adatai.", en: "One product." },
    params: [PRODUCT_ID],
    responseStatus: 200,
    responseExample: j({ product: PRODUCT }),
    errors: [NOT_FOUND_PRODUCT],
  },
  {
    id: "products.update",
    group: "products",
    method: "PATCH",
    path: "/api/v1/products/{id}",
    summary: { hu: "Termék frissítése", en: "Update a product" },
    description: {
      hu: "A termék mezőinek módosítása; a törzs ugyanazokat a mezőket fogadja, mint a létrehozás, mindet opcionálisan.",
      en: "Updates product fields; the body takes the same fields as create, all optional.",
    },
    params: [PRODUCT_ID],
    requestExample: j({ unitPrice: 16000 }),
    responseStatus: 200,
    responseExample: j({ product: { ...PRODUCT, unitPrice: 16000 } }),
    errors: [INVALID_JSON, NOT_FOUND_PRODUCT],
  },
  {
    id: "products.delete",
    group: "products",
    method: "DELETE",
    path: "/api/v1/products/{id}",
    summary: { hu: "Termék törlése", en: "Delete a product" },
    description: { hu: "Törli a terméket.", en: "Deletes the product." },
    params: [PRODUCT_ID],
    responseStatus: 204,
    errors: [NOT_FOUND_PRODUCT],
  },
  {
    id: "exchangeRates.get",
    group: "exchangeRates",
    method: "GET",
    path: "/api/v1/exchange-rates",
    summary: { hu: "MNB árfolyam lekérdezése", en: "Look up an MNB rate" },
    description: {
      hu: "A hivatalos MNB HUF árfolyamot adja vissza a megadott napra, vagy az azt megelőző legutóbbi MNB-publikált napra (hétvégén, ünnepnapon az MNB nem publikál, ezért a `rateDate` eltérhet a kért dátumtól). Ugyanaz a forrás, amit a számlalétrehozás használ, ha nem adsz meg `exchangeRate`-et.",
      en: "Returns the official MNB HUF rate for the given day, or for the latest MNB-published day before it (MNB does not publish on weekends and holidays, so `rateDate` can differ from the requested date). It is the same source invoice creation uses when you omit `exchangeRate`.",
    },
    params: [
      { name: "currency", location: "query", type: "string", required: true, description: { hu: "Hárombetűs pénznemkód, pl. `EUR`. A `HUF` nem érvényes.", en: "Three-letter currency code, e.g. `EUR`. `HUF` is not valid." } },
      { name: "date", location: "query", type: "string (YYYY-MM-DD)", required: true, description: { hu: "A dátum; számlánál a teljesítés dátuma ajánlott.", en: "The date; for an invoice the fulfilment date is recommended." } },
    ],
    responseStatus: 200,
    responseExample: j({ currency: "EUR", rate: 397.5, rateDate: "2026-09-22", source: "MNB" }),
    errors: [
      { status: 400, description: { hu: "Hiányzó vagy érvénytelen `currency` / `date`, vagy `HUF` (nincs `code`).", en: "Missing or invalid `currency` / `date`, or `HUF` (no `code`)." } },
      { status: 404, description: { hu: "Az MNB-nek nincs árfolyama a pénznemhez a dátum környékén.", en: "MNB has no rate for the currency near the date." } },
      { status: 502, description: { hu: "Az MNB szolgáltatása nem érhető el.", en: "The MNB service could not be reached." } },
    ],
  },
];

// ---------------------------------------------------------------- derived

/** `/api/v1/invoices/{id}/pdf` -> `app/api/v1/invoices/[id]/pdf+api.ts` */
export function routeFileForPath(apiPath: string): string {
  return `app${apiPath.replace(/\{(\w+)\}/g, "[$1]")}+api.ts`;
}

const ID_PLACEHOLDER: Record<ApiEndpointGroupId, string> = {
  invoices: "INVOICE_ID",
  clients: "CLIENT_ID",
  products: "PRODUCT_ID",
  exchangeRates: "ID",
};

function exampleQuery(endpoint: ApiEndpoint): string {
  if (endpoint.id === "exchangeRates.get") return "?currency=EUR&date=2026-11-02";
  if (endpoint.id === "invoices.list") return "?status=unpaid&limit=10";
  return "";
}

/** Shell-ready curl for an endpoint. Credentials are env vars, never literals. */
export function buildCurlSnippet(endpoint: ApiEndpoint): string {
  const url = `${API_BASE_URL}${endpoint.path.replace("{id}", ID_PLACEHOLDER[endpoint.group])}${exampleQuery(endpoint)}`;
  const lines = [endpoint.method === "GET" ? `curl "${url}"` : `curl -X ${endpoint.method} "${url}"`];
  lines.push(`  -H "Authorization: Bearer $INVOHUB_PUBLIC_KEY:$INVOHUB_SECRET_KEY"`);
  if (endpoint.requestExample) lines.push(`  -H "Content-Type: application/json"`);
  if (endpoint.idempotent) lines.push(`  -H "Idempotency-Key: $(uuidgen)"`);
  if (endpoint.requestExample) {
    lines.push(`  -d '${JSON.stringify(JSON.parse(endpoint.requestExample))}'`);
  }
  if (endpoint.responseContentType === "application/pdf") lines.push(`  -o invoice.pdf`);
  return lines.join(" \\\n");
}
