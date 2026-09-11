// lib/blog/posts.ts
// Curated Hungarian marketing articles about accurate InvoHub topics.
import type { BlogPost } from "@/lib/blog/types";

export const blogPosts: BlogPost[] = [
  {
    slug: "magyar-szamlazas-alapok",
    titleEn: "Hungarian invoicing basics",
    title: "Magyar számlázás alapok: mit kell tudni induláskor",
    description:
      "Áttekintés a magyar vállalkozói számlázás alapfogalmairól: kötelező adatok, ÁFA-logika, határidők és a digitális bizonylatkezelés szerepe.",
    publishedAt: "2026-09-10",
    readingMinutes: 7,
    tags: ["számlázás", "alapok", "NAV"],
    relatedSlugs: [
      "pdf-es-email-szamlakuldes",
      "partner-es-termek-torzsadatok",
      "elerheto-es-tervezett-funkciok",
    ],
    sections: [
      {
        heading: "Miért számít a pontos bizonylat",
        paragraphs: [
          "Magyarországon a számla nem csupán fizetési felszólítás: adóügyi bizonylat. A kötelező tartalmi elemek, a kibocsátás időpontja és az ÁFA-kezelés együtt határozzák meg, hogy a dokumentum ellenőrizhető és követhető legyen.",
          "Egyéni vállalkozóknak és kisvállalkozásoknak különösen fontos, hogy a napi számlázás ne szétszóródjon e-mailek, táblázatok és félkész sablonok között. A rendezett adatbázis csökkenti a hibák és a késedelmes korrekciók esélyét.",
        ],
      },
      {
        heading: "A számla tipikus kötelező adatai",
        paragraphs: [
          "A gyakorlatban a számla tartalmazza a kibocsátó és a vevő azonosító adatait (név, cím, adószám ahol releváns), a számla sorszámát, a teljesítés és a kibocsátás dátumát, a fizetési határidőt, a tételeket mennyiséggel és egységárral, valamint az ÁFA-kulcsokat és az összesítő összegeket.",
          "A pontos partner- és terméktörzs ezért nem „extra funkció”, hanem a hibamentes számlázás alapja. Ha ezek az adatok újrahasználhatók, kevesebb mezőt kell minden alkalommal kézzel kitölteni.",
        ],
      },
      {
        heading: "ÁFA és státuszok a mindennapi munkában",
        paragraphs: [
          "A magyar ÁFA-kulcsok és mentességek kezelése akkor megbízható, ha a tételsorok szintjén rögzíted őket, és a dokumentum előnézete is ezt mutatja. A piszkozat, elküldött és fizetett státuszok segítenek látni, hol tart a folyamat.",
          "Az InvoHub jelenleg a számlakészítést, az előnézetet, a PDF-kezelést és a küldési folyamatot támogatja. A NAV Online Számla kapcsolódás a termék része a beküldési munkafolyamatokhoz; a jogszabályi megfelelés végső ellenőrzése mindig a felhasználó felelőssége.",
        ],
      },
      {
        heading: "Hol kezdj, ha most állítod össze a rendszert",
        paragraphs: [
          "Először rögzítsd a cégadataidat, majd a gyakori partnereket és termékeket. Ezután készíts egy mintaszámlát, ellenőrizd az előnézetet, és csak utána küldj éles dokumentumot.",
          "Ha a folyamat átlátható, a következő lépések — emlékeztetők, nyugták, exportok — természetesen illeszkednek ugyanarra az adatkészletre.",
        ],
      },
    ],
  },
  {
    slug: "pdf-es-email-szamlakuldes",
    titleEn: "PDF and email invoice delivery",
    title: "PDF és e-mail számlaküldés: ellenőrzött kézbesítési folyamat",
    description:
      "Hogyan érdemes a kész számlát előnézni, PDF-ként letölteni és e-mailben elküldeni úgy, hogy a tartalom és a címzett adatai végig ellenőrizhetők maradjanak.",
    publishedAt: "2026-09-09",
    readingMinutes: 6,
    tags: ["PDF", "e-mail", "küldés"],
    relatedSlugs: [
      "magyar-szamlazas-alapok",
      "fizetesi-emlekeztetok",
      "partner-es-termek-torzsadatok",
    ],
    sections: [
      {
        heading: "Előnézet előbb, küldés később",
        paragraphs: [
          "A leggyakoribb számlázási hibák a sietős küldésből erednek: rossz tétel, elírás a partneradatban, hiányzó fizetési határidő. Ezért a megbízható folyamat mindig előnézettel kezdődik.",
          "Az előnézetnek ugyanazokat az összegeket, ÁFA-sorokat és szövegeket kell mutatnia, mint a végleges PDF-nek. Ha eltérés van, a hiba még a kézbesítés előtt javítható.",
        ],
      },
      {
        heading: "A PDF szerepe a magyar gyakorlatban",
        paragraphs: [
          "A PDF a legelterjedtebb formátum a partner felé történő átadáshoz és az archívumhoz. Fontos, hogy a fájlnév, a számlaszám és a tartalom egyértelműen összekapcsolható legyen.",
          "Az InvoHubban a PDF-generálás a számlaadatból történik, nem külön, kézzel szerkesztett dokumentumból. Így a listanézet, a részletező és a letöltött fájl ugyanarra a forrásra támaszkodik.",
        ],
      },
      {
        heading: "E-mailes kézbesítés kontrollpontokkal",
        paragraphs: [
          "Az e-mail küldésnél ellenőrizd a címzettet, a tárgyat és azt, hogy a megfelelő bizonylat van csatolva. Érdemes sablonokat használni, de a személyre szabott adatoknak a számlából kell érkezniük.",
          "A sikeres küldés után a számla státusza követhető legyen (például elküldve). Ez segít elválasztani a még szerkeszthető piszkozatokat a már partnerhez eljuttatott dokumentumoktól.",
        ],
      },
      {
        heading: "Mi tartozik a folyamathoz — és mi nem",
        paragraphs: [
          "A PDF-előnézet, letöltés és e-mail küldés elérhető funkció. A banki tranzakciók automatikus párosítása ezzel szemben tervezett irány, nem része a jelenlegi kézbesítési folyamatnak.",
          "Ha a küldés után fizetésre vársz, a következő logikus eszköz a fizetési emlékeztető — erről külön cikkben írunk.",
        ],
      },
    ],
  },
  {
    slug: "fizetesi-emlekeztetok",
    titleEn: "Payment reminders",
    title: "Fizetési emlékeztetők: nyitott számlák követhető kezelése",
    description:
      "Hogyan építs beállítható emlékeztetőket a lejáró és lejárt számlákhoz anélkül, hogy a kommunikáció kaotikussá válna.",
    publishedAt: "2026-09-08",
    readingMinutes: 5,
    tags: ["emlékeztető", "fizetés", "követelés"],
    relatedSlugs: [
      "pdf-es-email-szamlakuldes",
      "magyar-szamlazas-alapok",
      "elerheto-es-tervezett-funkciok",
    ],
    sections: [
      {
        heading: "Miért kell rendszer a nyitott tételekhez",
        paragraphs: [
          "A késedelmes fizetés gyakran nem rosszindulat, hanem elveszett e-mail vagy hiányzó belső folyamat. Ha nincs emlékeztető-rutin, a vállalkozó vagy túl későn szól, vagy túl sokat foglalkozik manuális utánkövetéssel.",
          "Egy jó emlékeztető-folyamat időzíthető, a számla adataiból dolgozik, és naplózza, hogy mikor ment ki az üzenet.",
        ],
      },
      {
        heading: "Beállítható időzítés és egyértelmű üzenet",
        paragraphs: [
          "Érdemes külön kezelni a lejárat előtti barátságos emlékeztetőt és a lejárat utáni határozottabb üzenetet. Mindkettőnek tartalmaznia kell a számlaszámot, az összeget és a fizetési határidőt.",
          "Az InvoHub emlékeztető beállításai a nyitott számlákhoz kapcsolódnak, így nem kell külön listát vezetni arról, kinek mikor írtál.",
        ],
      },
      {
        heading: "Kapcsolat a számlaküldéssel",
        paragraphs: [
          "Az emlékeztető nem helyettesíti az eredeti számlaküldést. Először a dokumentumnak el kell jutnia a partnerhez PDF-ben vagy e-mailben, majd az emlékeztető erre a már létező bizonylatra hivatkozik.",
          "Ha a partneradat hiányos, az emlékeztető sem lesz megbízható. A törzsadatok minősége itt is közvetlenül hat a kintlévőség-kezelésre.",
        ],
      },
      {
        heading: "Tervezett, de még nem elérhető: banki párosítás",
        paragraphs: [
          "A beérkező banki tranzakciók és a nyitott számlák automatikus vagy támogatott párosítása tervezett funkció. Amíg ez nem érhető el, a fizetés rögzítése és az emlékeztetők manuális ellenőrzéssel egészítik ki egymást.",
          "Ez a megkülönböztetés fontos: az emlékeztető ma használható eszköz; a banki matching későbbi fejlesztési irány.",
        ],
      },
    ],
  },
  {
    slug: "partner-es-termek-torzsadatok",
    titleEn: "Partner and product master data",
    title: "Partner- és terméktörzs: kevesebb üres mező, pontosabb számla",
    description:
      "Miért érdemes újrahasználható partner- és termékadatokat vezetni, és hogyan gyorsítja ez a napi számlázást.",
    publishedAt: "2026-09-07",
    readingMinutes: 5,
    tags: ["partnerek", "termékek", "törzsadat"],
    relatedSlugs: [
      "magyar-szamlazas-alapok",
      "pdf-es-email-szamlakuldes",
      "elerheto-es-tervezett-funkciok",
    ],
    sections: [
      {
        heading: "A törzsadat a ismétlődő munka ellenszere",
        paragraphs: [
          "Ha minden számlát üres űrlappal kezdesz, a cím, adószám, tételnév és ÁFA-kulcs újra és újra elírható. A partner- és terméktörzs ezt a kockázatot csökkenti.",
          "A cél nem a „minél több adat mező”, hanem az, hogy a gyakran használt, helyes adatok egy helyen legyenek, és onnan kerüljenek a számlára.",
        ],
      },
      {
        heading: "Partnerek: azonosítás és kapcsolattartás",
        paragraphs: [
          "A partnerkarton tipikusan a számlázási nevet, címet, adószámot és az e-mail elérhetőséget tartalmazza. Ezek kellenek a szabályos bizonylathoz és a kézbesítéshez is.",
          "Amikor a partner kiválasztható listából, a számla gyorsabban készül, és a későbbi emlékeztetők is ugyanarra a címre mehetnek.",
        ],
      },
      {
        heading: "Termékek és szolgáltatások: egységes tételsorok",
        paragraphs: [
          "A terméktörzs a megnevezést, egységet, egységárat és ÁFA-kulcsot tartja készenlétben. Így a visszatérő szolgáltatások nem „emlékezetből” kerülnek a számlára.",
          "Az InvoHubban a partnerek és termékek a számlázási munkafolyamat része: a létrehozott törzsadatok újra felhasználhatók a következő dokumentumoknál.",
        ],
      },
      {
        heading: "Minőségi ellenőrzés néhány perces rutinnal",
        paragraphs: [
          "Negyedévente érdemes átnézni a leggyakoribb partnereket és termékeket: változott-e a cím, az adószám, az ár vagy az ÁFA-kezelés. Egy rövid karbantartás sok későbbi korrekciót megspórol.",
          "A tiszta törzsadat a későbbi funkciók — például a tervezett banki párosítás — számára is jobb alapot ad, mert egyértelműbbé teszi, melyik számla melyik partnerhez tartozik.",
        ],
      },
    ],
  },
  {
    slug: "elerheto-es-tervezett-funkciok",
    titleEn: "Available vs planned features",
    title: "Elérhető és tervezett funkciók: mi működik ma az InvoHubban",
    description:
      "Egyértelmű lista arról, mi érhető el most, és mi van csak tervezett irányként megjelölve — banki párosítás, EV adókalkulátor és M2M.",
    publishedAt: "2026-09-06",
    readingMinutes: 6,
    tags: ["termék", "roadmap", "átláthatóság"],
    relatedSlugs: [
      "magyar-szamlazas-alapok",
      "fizetesi-emlekeztetok",
      "pdf-es-email-szamlakuldes",
    ],
    sections: [
      {
        heading: "Miért fontos a pontos címkézés",
        paragraphs: [
          "A marketing és a termék akkor marad megbízható, ha világosan elválasztja az elérhető funkciókat a jövőbeli irányoktól. Ez a cikk ezért szándékosan két listát használ.",
          "Ha egy képesség mellett a „tervezett” jelölés szerepel, az azt jelenti: nincs éles, általános rendelkezésre állás, és nincs ígért indulási dátum.",
        ],
      },
      {
        heading: "Elérhető ma",
        paragraphs: [
          "Számlakészítés partner- és tételsorokkal, előnézet, PDF-letöltés és e-mailes küldés. Partner- és terméktörzs a gyorsabb újraszámlázáshoz. Fizetési emlékeztetők a nyitott tételekhez. Nyugták külön munkafolyamatban. Beállítások a cégadatokhoz, sablonokhoz és PDF-megjelenéshez.",
          "Ezek a funkciók a napi magyar számlázási munkát támogatják. A konkrét jogszabályi megfelelés és a NAV-beküldések helyességének ellenőrzése a felhasználó feladata.",
        ],
      },
      {
        heading: "Tervezett: banki párosítás",
        paragraphs: [
          "A banki párosítás célja, hogy a beérkező tranzakciókat támogatott módon össze lehessen rendelni a nyitott számlákkal. Ez beleegyezésen alapuló banki kapcsolódást, normalizált tranzakciókat és felülvizsgálható javaslatokat igényel.",
          "Állapot: tervezett. Nem érhető el a jelenlegi szolgáltatásban, és nem szabad úgy kommunikálni, mintha már automatikusan egyeztetné a fizetéseket.",
        ],
      },
      {
        heading: "Tervezett: EV adókalkulátor",
        paragraphs: [
          "Az egyéni vállalkozói adókalkulátor tájékoztató jellegű számításokat adna a támogatott adózási módokhoz, verziózott szabályokkal és magyarázható eredményekkel. Nem helyettesítené a könyvelői tanácsadást.",
          "Állapot: tervezett. Amíg nincs élesítve, az InvoHub nem ígér adószámítási eredményt a felületen.",
        ],
      },
      {
        heading: "Tervezett: M2M bevallási / gépi beküldési folyamat",
        paragraphs: [
          "Az M2M (machine-to-machine) irány scoped API-kulcsokat, idempotens beküldést, webhookokat és auditnaplót feltételez. Ez a későbbi integrációs réteg része.",
          "Állapot: tervezett. A mai termékben a hangsúly a felhasználói felületen keresztüli számlázási munkafolyamaton van, nem a teljes gépi bevallási automatizmuson.",
        ],
      },
      {
        heading: "Hogyan dönts a következő lépésről",
        paragraphs: [
          "Ha ma szeretnél rendezetten számlázni, kezdd a törzsadatokkal, a számlakészítéssel és a PDF/e-mail folyamattal. Az emlékeztetők a kintlévőségekhez adnak segítséget.",
          "A banki párosítás, az EV kalkulátor és az M2M akkor válik relevánssá, amikor ezek a fejlesztési fázisok elkészülnek — addig a roadmap csak irányt mutat, nem elérhető szolgáltatást.",
        ],
      },
    ],
  },
];
