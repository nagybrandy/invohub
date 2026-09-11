// lib/legal-content.ts
// Review-marked bilingual legal drafts for the public InvoHub website.
export type LegalDocumentId =
  | "terms"
  | "privacy"
  | "cookies"
  | "imprint";

export type LegalDocument = {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
};

type LegalLocale = "hu" | "en";

const commonDraft = {
  hu: {
    updated: "Tervezet – 2026. szeptember 11.",
    notice:
      "JOGI TERVEZET: ez a szöveg nem minősül jogi tanácsadásnak, és közzététel vagy szolgáltatásindítás előtt magyar ügyvéd, valamint – ahol releváns – adatvédelmi tisztviselő (DPO) felülvizsgálata szükséges.",
  },
  en: {
    updated: "Draft – 11 September 2026",
    notice:
      "LEGAL DRAFT: this text is not legal advice. A Hungarian lawyer and, where relevant, a data protection officer (DPO) must review it before publication or service launch.",
  },
} as const;

const documents: Record<LegalLocale, Record<LegalDocumentId, LegalDocument>> = {
  hu: {
    terms: {
      title: "Általános Szerződési Feltételek (ÁSZF)",
      updated: commonDraft.hu.updated,
      sections: [
        { heading: "Felülvizsgálati figyelmeztetés", body: commonDraft.hu.notice },
        {
          heading: "1. Szolgáltató és hatály",
          body: "A szolgáltató végleges cégnevét, székhelyét, nyilvántartási számát, adószámát és elérhetőségeit az indulás előtt ki kell tölteni. A feltételek az InvoHub webes és mobil számlázási szolgáltatás használatát szabályozzák.",
        },
        {
          heading: "2. Fiók és szolgáltatás",
          body: "A felhasználó felel a megadott adatok pontosságáért és a hozzáférési adatok biztonságáért. A szolgáltatás funkcióit, díjait, próbaidejét, támogatási szintjét és rendelkezésre állását a végleges kereskedelmi feltételekben kell rögzíteni.",
        },
        {
          heading: "3. Számlázás, NAV és felelősség",
          body: "Az InvoHub technikai segítséget nyújt a bizonylatok kezeléséhez és a NAV-adatszolgáltatáshoz. A felhasználó köteles a bizonylatok, adózási beállítások és beküldések helyességét ellenőrizni; a végleges felelősségi és hibakezelési szabályokat jogi felülvizsgálat után kell meghatározni.",
        },
        {
          heading: "4. Megszűnés és panaszkezelés",
          body: "A felmondási, adattörlési, adatexportálási, visszatérítési és panaszkezelési folyamatok végleges határidejeit és elérhetőségeit az indulás előtt ki kell tölteni.",
        },
      ],
    },
    privacy: {
      title: "Adatkezelési tájékoztató",
      updated: commonDraft.hu.updated,
      sections: [
        { heading: "Felülvizsgálati figyelmeztetés", body: commonDraft.hu.notice },
        {
          heading: "1. Adatkezelő",
          body: "Az adatkezelő végleges cégadatai, adatvédelmi kapcsolattartója és DPO-adatai – ha kijelölése kötelező – az indulás előtt kitöltendők.",
        },
        {
          heading: "2. Kezelt adatok és célok",
          body: "Fiók- és kapcsolattartási adatok, céges és számlázási adatok, bizonylatok, technikai naplók, biztonsági adatok és támogatási kommunikáció kezelhető a szerződés teljesítése, jogi kötelezettség, biztonság és hozzájáruláson alapuló kommunikáció céljából.",
        },
        {
          heading: "3. Jogalap, megőrzés és címzettek",
          body: "A konkrét GDPR-jogalapot, megőrzési időt, adatfeldolgozókat (például hosting, adatbázis, e-mail), harmadik országbeli adattovábbításokat és garanciákat a tényleges beszállítói szerződések alapján kell véglegesíteni.",
        },
        {
          heading: "4. Érintetti jogok",
          body: "Az érintett hozzáférést, helyesbítést, törlést, korlátozást, adathordozhatóságot és tiltakozást kérhet, továbbá visszavonhatja hozzájárulását és panaszt tehet a NAIH-nál. A kérelmek végleges kapcsolati címét indulás előtt meg kell adni.",
        },
      ],
    },
    cookies: {
      title: "Cookie tájékoztató",
      updated: commonDraft.hu.updated,
      sections: [
        { heading: "Felülvizsgálati figyelmeztetés", body: commonDraft.hu.notice },
        {
          heading: "1. Kategóriák",
          body: "A szükséges tárolás a munkamenet, biztonság, nyelv és cookie-beállítás működéséhez kell. Az analitikai és marketing kategória alapértelmezetten tiltott, és csak külön hozzájárulással engedélyezhető.",
        },
        {
          heading: "2. Jelenlegi használat",
          body: "Ebben a termékszeletben az InvoHub nem telepít analitikai vagy marketing követőt. A választást az eszközön tároljuk, hogy a hozzájárulási panel ne jelenjen meg minden látogatáskor.",
        },
        {
          heading: "3. Beállítás módosítása",
          body: "A „Cookie-beállítások” gombbal a választás bármikor újranyitható és módosítható. Új követő bevezetése előtt a leltárt, szolgáltatót, célt, időtartamot és adattovábbítást itt fel kell tüntetni.",
        },
      ],
    },
    imprint: {
      title: "Impresszum",
      updated: commonDraft.hu.updated,
      sections: [
        { heading: "Felülvizsgálati figyelmeztetés", body: commonDraft.hu.notice },
        {
          heading: "Szolgáltató adatai – kitöltendő",
          body: "Cégnév: [KITÖLTENDŐ] · Székhely: [KITÖLTENDŐ] · Cégjegyzékszám/nyilvántartási szám: [KITÖLTENDŐ] · Adószám: [KITÖLTENDŐ] · Képviselő: [KITÖLTENDŐ].",
        },
        {
          heading: "Kapcsolat és tárhelyszolgáltató – kitöltendő",
          body: "E-mail: [KITÖLTENDŐ] · Telefon: [KITÖLTENDŐ] · Tárhelyszolgáltató neve, címe és elérhetősége: [KITÖLTENDŐ a végleges Vercel-szerződés és infrastruktúra alapján].",
        },
      ],
    },
  },
  en: {
    terms: {
      title: "General Terms and Conditions",
      updated: commonDraft.en.updated,
      sections: [
        { heading: "Review notice", body: commonDraft.en.notice },
        { heading: "Scope", body: "Provider identity, commercial terms, account rules, service levels, invoicing responsibilities, termination, refunds, complaints and governing law must be completed and reviewed before launch." },
      ],
    },
    privacy: {
      title: "Privacy Notice",
      updated: commonDraft.en.updated,
      sections: [
        { heading: "Review notice", body: commonDraft.en.notice },
        { heading: "Processing outline", body: "The final notice must identify the controller, purposes, GDPR legal bases, retention periods, processors, international transfers, safeguards, contact channel and data-subject rights based on the actual production systems and contracts." },
      ],
    },
    cookies: {
      title: "Cookie Notice",
      updated: commonDraft.en.updated,
      sections: [
        { heading: "Review notice", body: commonDraft.en.notice },
        { heading: "Current categories", body: "Essential storage supports sessions, security, language and consent settings. Analytics and marketing default to denied. This product slice installs no analytics or marketing trackers; preferences can be reopened at any time." },
      ],
    },
    imprint: {
      title: "Imprint",
      updated: commonDraft.en.updated,
      sections: [
        { heading: "Review notice", body: commonDraft.en.notice },
        { heading: "Provider details – incomplete", body: "Company name, registered office, registration number, tax number, representative, contact details and hosting provider details must be completed before launch." },
      ],
    },
  },
};

export function getLegalDocument(
  id: LegalDocumentId,
  language: string,
): LegalDocument {
  return documents[language.startsWith("hu") ? "hu" : "en"][id];
}
