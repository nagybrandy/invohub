// lib/nav/country-code.ts
// Partner/company country is free text in InvoHub ("HU", "Magyarország",
// "Germany", …). NAV's base:CountryCodeType wants ISO 3166-1 alpha-2, so
// this resolves the common spellings and returns null — never a guess —
// for anything unknown.

const EU_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);

const NON_EU_CODES = new Set(["GB", "CH", "NO", "IS", "LI", "US", "CA", "RS", "UA", "TR", "CN", "JP", "AU", "BA", "ME", "MK", "AL", "MD", "IL", "IN"]);

const COUNTRY_NAMES: Record<string, string> = {
  magyarország: "HU", hungary: "HU", magyar: "HU",
  ausztria: "AT", austria: "AT", österreich: "AT",
  belgium: "BE", bulgária: "BG", bulgaria: "BG",
  ciprus: "CY", cyprus: "CY",
  csehország: "CZ", "cseh köztársaság": "CZ", czechia: "CZ", "czech republic": "CZ",
  németország: "DE", germany: "DE", deutschland: "DE",
  dánia: "DK", denmark: "DK",
  észtország: "EE", estonia: "EE",
  spanyolország: "ES", spain: "ES",
  finnország: "FI", finland: "FI",
  franciaország: "FR", france: "FR",
  görögország: "GR", greece: "GR",
  horvátország: "HR", croatia: "HR",
  írország: "IE", ireland: "IE",
  olaszország: "IT", italy: "IT",
  litvánia: "LT", lithuania: "LT",
  luxemburg: "LU", luxembourg: "LU",
  lettország: "LV", latvia: "LV",
  málta: "MT", malta: "MT",
  hollandia: "NL", netherlands: "NL", "the netherlands": "NL",
  lengyelország: "PL", poland: "PL",
  portugália: "PT", portugal: "PT",
  románia: "RO", romania: "RO",
  svédország: "SE", sweden: "SE",
  szlovénia: "SI", slovenia: "SI",
  szlovákia: "SK", slovakia: "SK",
  "egyesült királyság": "GB", "united kingdom": "GB", uk: "GB", "nagy-britannia": "GB",
  svájc: "CH", switzerland: "CH",
  norvégia: "NO", norway: "NO",
  izland: "IS", iceland: "IS",
  usa: "US", "egyesült államok": "US", "united states": "US", "amerikai egyesült államok": "US",
  kanada: "CA", canada: "CA",
  szerbia: "RS", serbia: "RS",
  ukrajna: "UA", ukraine: "UA",
  törökország: "TR", turkey: "TR",
};

export function toIsoCountryCode(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && (EU_COUNTRY_CODES.has(upper) || NON_EU_CODES.has(upper))) return upper;
  if (upper === "EL") return "GR";
  return COUNTRY_NAMES[trimmed.toLowerCase()] ?? null;
}

export function isEuCountryCode(code: string): boolean {
  return EU_COUNTRY_CODES.has(code.toUpperCase());
}

/** Country of an EU VAT number from its prefix (Greece uses "EL"). */
export function countryCodeFromVatNumber(vatNumber: string | undefined | null): string | null {
  const match = vatNumber?.trim().toUpperCase().match(/^([A-Z]{2})[0-9A-Z]/);
  if (!match) return null;
  return match[1] === "EL" ? "GR" : match[1];
}
