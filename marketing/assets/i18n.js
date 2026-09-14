// marketing/assets/i18n.js
// HU (default) / EN copy for the static marketing homepage. Consumed by site.js.
(function () {
  "use strict";

  var hu = {
    "meta.title": "InvoHub — számlázástól a bevallásig",
    "meta.description":
      "Az InvoHub magyar egyéni vállalkozóknak ad rendezett számlázási munkafolyamatot ma, és egyetlen rendszerbe vezeti a banki párosítást, az adótervezést és a NAV-bevallást a jövőben.",

    skip: "Ugrás a tartalomra",

    "brand.home": "InvoHub főoldal",
    "nav.main": "Fő navigáció",
    "nav.mobile": "Mobil navigáció",
    "nav.product": "Termék",
    "nav.workflow": "Munkafolyamat",
    "nav.roadmap": "EV-út",
    "nav.pricing": "Árazás",
    "nav.faq": "GYIK",
    "nav.blog": "Blog",
    "nav.login": "Belépés",
    "nav.cta": "Ingyenes regisztráció",
    "nav.openMenu": "Menü megnyitása",
    "nav.closeMenu": "Menü bezárása",

    "lang.label": "Nyelv",

    "hero.kicker": "Egyéni vállalkozóknak",
    "hero.title.prefix": "Számlázástól a ",
    "hero.title.accent": "bevallásig",
    "hero.title.suffix": ".",
    "hero.lede":
      "Az InvoHub ma rendezett számlázási munkafolyamatot ad egyéni vállalkozóknak, és fokozatosan bővül a banki párosítással, az adótervezéssel és a NAV-bevallással — hogy egy helyen legyen a bizonylattól az adóig minden.",
    "hero.cta": "Ingyenes regisztráció",
    "hero.tour": "Mit tud ma az InvoHub?",
    "hero.meta.platforms": "Web, iOS és Android",
    "hero.meta.docs": "Számla, díjbekérő, előleg, nyugta",
    "hero.meta.ev": "Egyéni vállalkozóknak tervezve",

    "panel.period": "Aktuális időszak",
    "panel.overview": "Áttekintés",
    "panel.recent": "Legutóbbi bizonylatok",

    "chip.paid": "Fizetve",
    "chip.sent": "Elküldve",
    "chip.due": "Határidős",
    "chip.live": "Elérhető",
    "chip.dev": "Fejlesztés alatt",
    "chip.planned": "Tervezett",

    "product.kicker": "Ma elérhető",
    "product.title": "Egy rendszer a bizonylat körüli teljes munkához",
    "product.lede":
      "A funkciók ugyanarra az adatkészletre épülnek, így a partner, a tétel és a fizetési állapot nem csúszik szét a folyamat közben.",
    "product.invoice.title": "Számla, díjbekérő, előleg",
    "product.invoice.body":
      "Tételsorokkal, ÁFA-számítással, dátumokkal és fizetési feltételekkel. A dokumentum a mentés előtt előnézetben ellenőrizhető.",
    "product.net": "Nettó részösszeg",
    "product.vat": "ÁFA 27%",
    "product.gross": "Bruttó összesen",
    "product.receipt.title": "Nyugta külön folyamatban",
    "product.receipt.body":
      "A nyugták saját, célzott felületen készülnek és követhetők, nem keverednek a számlák listájába.",
    "product.tag.receipt": "Nyugta",
    "product.tag.preview": "Előnézet",
    "product.tag.pdf": "PDF",
    "product.email.title": "PDF és e-mail küldés",
    "product.email.body":
      "A kész bizonylat előnézete, PDF-letöltése és e-mailes kiküldése ugyanabban a folyamatban marad.",
    "product.partners.title": "Partnerek és termékek",
    "product.partners.body":
      "Újrahasználható törzsadatok, hogy ne minden bizonylat üres mezőkkel induljon.",
    "product.reminders.title": "Fizetési emlékeztetők és áttekintés",
    "product.reminders.body":
      "Beállítható emlékeztetők a nyitott tételekhez, mellette bevételi, ÁFA-becslési és lejárt tartozás szerinti összesítés a vezérlőpulton.",
    "product.paid": "Fizetve",
    "product.open": "Nyitott",
    "product.import.title": "Import és API-kulcsok",
    "product.import.body":
      "Meglévő adatok táblázatos importja, valamint API-kulcsok a külső integrációkhoz.",
    "product.tag.import": "Táblázatos import",
    "product.tag.api": "API-kulcs",
    "product.nav.title": "NAV-adatszolgáltatás",
    "product.nav.body":
      "A NAV felé történő adatszolgáltatás jelenleg demó és teszt módban érhető el — éles környezetre nem küldünk adatot.",

    "workflow.kicker": "Munkafolyamat",
    "workflow.title": "A következő lépés mindig egyértelmű",
    "workflow.lede":
      "Három szakasz, amely megtartja a szükséges részleteket, de nem engedi eltűnni a fontos döntéseket.",
    "workflow.step1.title": "Alapadatok kiválasztása",
    "workflow.step1.body":
      "Partner, bizonylattípus és korábban rögzített termékek adják a rendezett kiindulópontot.",
    "workflow.step2.title": "Dokumentum ellenőrzése",
    "workflow.step2.body":
      "A tételsorok, dátumok, fizetési feltételek és az előnézet együtt nézhetők át a véglegesítés előtt.",
    "workflow.step3.title": "Mentés, letöltés vagy küldés",
    "workflow.step3.body":
      "A bizonylat piszkozatként menthető, véglegesíthető, PDF-ként letölthető vagy e-mailben elküldhető.",

    "roadmap.kicker": "Az egyéni vállalkozó útja",
    "roadmap.title": "A számlázástól a bevallásig, lépésről lépésre",
    "roadmap.lede":
      "Az alábbi státuszok pontosan mutatják, mi működik ma, mi van fejlesztés alatt, és mi csak terv — dátumot egyikhez sem ígérünk.",
    "roadmap.invoicing.title": "Számlázás",
    "roadmap.invoicing.body":
      "Bizonylatkiállítás, PDF és e-mail küldés, törzsadatok, emlékeztetők.",
    "roadmap.bank.title": "Banki párosítás",
    "roadmap.bank.body":
      "Beérkező tranzakciók és nyitott számlák ellenőrizhető összerendelése.",
    "roadmap.tax.title": "EV adókalkulátor",
    "roadmap.tax.body": "Egyéni vállalkozóknak szánt, tájékoztató jellegű adótervezési nézet.",
    "roadmap.nav.title": "Bevallás M2M-en",
    "roadmap.nav.body":
      "A bevallás előkészítése és beküldése a NAV gépi interfészén, hatósági tesztelés után.",

    "diff.kicker": "Miért az InvoHub",
    "diff.title": "Nem egy újabb számlázó — egy EV-nek épülő rendszer",
    "diff.lede":
      "A legtöbb számlázó program a bizonylatnál megáll. Az InvoHub célja, hogy ugyanabban a rendszerben legyen a bevétel, a banki egyeztetés és — hosszú távon — az adó is.",
    "diff.one.title": "Egy adatkészlet végig",
    "diff.one.body":
      "A partner, a tétel és a fizetési állapot nem külön táblázatokban él, hanem egy rendszerben marad a bevallásig vezető úton.",
    "diff.two.title": "EV-specifikus fókusz",
    "diff.two.body":
      "Nem általános vállalati számlázást építünk, hanem kifejezetten egyéni vállalkozók napi és éves teendőire tervezünk.",
    "diff.three.title": "Átlátható fejlesztési irány",
    "diff.three.body":
      "Pontosan látod, mi elérhető ma, mi van fejlesztés alatt, és mi a terv — nincs eltitkolt vagy túlígért funkció.",
    "diff.four.title": "Egy előfizetés, nem több eszköz",
    "diff.four.body":
      "A cél, hogy a számlázó, a banki egyeztetés és az adóbecslés helyett ne kelljen több különálló eszközt kezelned.",

    "pricing.kicker": "Árazás",
    "pricing.title": "Jelenleg ingyenes a béta alatt",
    "pricing.lede":
      "Az InvoHub aktív fejlesztés alatt áll. A béta időszakban minden elérhető funkciót díjmentesen használhatsz, végleges árazást csak a fejlesztés előrehaladtával hirdetünk.",
    "pricing.badge": "Béta — ingyenes",
    "pricing.item1": "Korlátlan számla, díjbekérő, előleg és nyugta a béta alatt",
    "pricing.item2": "PDF, e-mail küldés, partner- és termektörzs",
    "pricing.item3": "Fizetési emlékeztetők és áttekintő vezérlőpult",
    "pricing.cta": "Fiók létrehozása",
    "pricing.note": "Nincs elrejtett ár és nincs bankkártya-kötelezettség a regisztrációhoz.",

    "faq.kicker": "GYIK",
    "faq.title": "Gyakori kérdések",
    "faq.q1.q": "Az InvoHub kiváltja a könyvelőt?",
    "faq.q1.a":
      "Ez a hosszú távú célunk, de ma még nem tartunk itt. A tervezett adókalkulátor és a NAV-bevallás tájékoztató, nem hivatalos adótanácsadás — a könyvelőddel érdemes egyeztetni a végleges bevallás előtt.",
    "faq.q2.q": "Hogyan kezeli az InvoHub a NAV-adatszolgáltatást?",
    "faq.q2.a":
      "A NAV felé történő adatszolgáltatás jelenleg demó és teszt módban működik. Éles NAV-környezetbe nem küldünk adatot, amíg ezt nem jelentjük be külön.",
    "faq.q3.q": "Alanyi adómentes egyéni vállalkozóként is használható?",
    "faq.q3.a":
      "Igen, a bizonylatkiállítás alanyi adómentes és ÁFA-körös vállalkozóknak egyaránt támogatott; az adószámítási beállítások a cégprofilban módosíthatók.",
    "faq.q4.q": "Mennyire biztonságosak az adataim?",
    "faq.q4.a":
      "Az adatok titkosított kapcsolaton keresztül, hozzáférés-védett adatbázisban tárolódnak, és csak a saját fiókodból érhetők el.",
    "faq.q5.q": "Kell fizetnem a béta alatt?",
    "faq.q5.a":
      "Nem, a béta időszak alatt az elérhető funkciók díjmentesen használhatók, bankkártya megadása nélkül.",

    "blog.kicker": "Tudásbázis",
    "blog.title": "Gyakorlati írások a számlázásról",
    "blog.post1.title": "Magyar számlázás alapok induláskor",
    "blog.post1.body": "Mit érdemes tisztázni az első bizonylat kiállítása előtt.",
    "blog.post2.title": "Fizetési emlékeztetők a gyakorlatban",
    "blog.post2.body": "Nyitott számlák követhető, ismételhető kezelése.",
    "blog.post3.title": "Mi működik ma az InvoHubban",
    "blog.post3.body": "Elérhető és tervezett funkciók világos szétválasztása.",
    "blog.read": "Elolvasom →",

    "cta.kicker": "Kezdés",
    "cta.title": "Vidd rendezett rendszerbe a napi számlázást",
    "cta.lede": "Hozd létre a fiókodat, és nézd meg az InvoHub jelenleg elérhető munkafolyamatait.",
    "cta.button": "Ingyenes regisztráció",

    "footer.product": "Termék",
    "footer.features": "Elérhető funkciók",
    "footer.workflow": "Munkafolyamat",
    "footer.roadmap": "Fejlesztési irány",
    "footer.pricing": "Árazás",
    "footer.login": "Belépés az alkalmazásba",
    "footer.content": "Tartalom",
    "footer.blog": "Blog",
    "footer.faq": "GYIK",
    "footer.basics": "Számlázás alapok",
    "footer.master": "Törzsadatok",
    "footer.pdf": "PDF és e-mail küldés",
    "footer.legal": "Jogi",
    "footer.terms": "ÁSZF",
    "footer.privacy": "Adatkezelés",
    "footer.cookies": "Cookie tájékoztató",
    "footer.imprint": "Impresszum",
    "footer.cookiePrefs": "Cookie-beállítások",
    "footer.blurb":
      "Átlátható számlázási munkatér magyar egyéni vállalkozóknak — a bevallásig vezető úton.",

    "consent.title": "Cookie-kat használunk",
    "consent.body":
      "A működéshez szükséges tárolást mindig használjuk. Analitikai és marketing tárolás csak hozzájárulással aktiválódik.",
    "consent.settings": "Beállítások",
    "consent.essentialOnly": "Csak a szükséges",
    "consent.acceptAll": "Elfogadom",
    "consent.save": "Kiválasztás mentése",
    "consent.essential": "Szükséges — munkamenet, biztonság, beállítások tárolása.",
    "consent.analytics": "Analitika — használati statisztika, ha később bevezetjük.",
    "consent.marketing": "Marketing — kampánymérés, ha később bevezetjük.",
  };

  var en = {
    "meta.title": "InvoHub — from invoicing to your tax return",
    "meta.description":
      "InvoHub gives Hungarian sole traders (egyéni vállalkozó) a tidy invoicing workflow today, and is growing toward bank reconciliation, tax planning, and NAV tax-return filing.",

    skip: "Skip to content",

    "brand.home": "InvoHub home",
    "nav.main": "Main navigation",
    "nav.mobile": "Mobile navigation",
    "nav.product": "Product",
    "nav.workflow": "Workflow",
    "nav.roadmap": "EV journey",
    "nav.pricing": "Pricing",
    "nav.faq": "FAQ",
    "nav.blog": "Blog",
    "nav.login": "Log in",
    "nav.cta": "Start for free",
    "nav.openMenu": "Open menu",
    "nav.closeMenu": "Close menu",

    "lang.label": "Language",

    "hero.kicker": "For sole traders",
    "hero.title.prefix": "From invoicing to your ",
    "hero.title.accent": "tax return",
    "hero.title.suffix": ".",
    "hero.lede":
      "InvoHub gives Hungarian sole traders a tidy invoicing workflow today, and is gradually growing to include bank reconciliation, tax planning, and NAV filing — so everything from invoice to tax lives in one place.",
    "hero.cta": "Start for free",
    "hero.tour": "What can InvoHub do today?",
    "hero.meta.platforms": "Web, iOS and Android",
    "hero.meta.docs": "Invoice, proforma, advance, receipt",
    "hero.meta.ev": "Built for sole traders",

    "panel.period": "Current period",
    "panel.overview": "Overview",
    "panel.recent": "Recent documents",

    "chip.paid": "Paid",
    "chip.sent": "Sent",
    "chip.due": "Due",
    "chip.live": "Available",
    "chip.dev": "In development",
    "chip.planned": "Planned",

    "product.kicker": "Available today",
    "product.title": "One system for everything around the invoice",
    "product.lede":
      "Every feature runs on the same dataset, so the partner, the line item, and the payment status never drift apart mid-process.",
    "product.invoice.title": "Invoice, proforma, advance",
    "product.invoice.body":
      "Line items, VAT calculation, dates, and payment terms. The document can be checked in preview before it's saved.",
    "product.net": "Net subtotal",
    "product.vat": "VAT 27%",
    "product.gross": "Gross total",
    "product.receipt.title": "Receipts in their own flow",
    "product.receipt.body":
      "Receipts are created and tracked in a dedicated view, kept separate from the invoice list.",
    "product.tag.receipt": "Receipt",
    "product.tag.preview": "Preview",
    "product.tag.pdf": "PDF",
    "product.email.title": "PDF and email delivery",
    "product.email.body":
      "Previewing, downloading as PDF, and emailing the finished document all stay in the same flow.",
    "product.partners.title": "Partners and products",
    "product.partners.body":
      "Reusable master data, so every document doesn't start from empty fields.",
    "product.reminders.title": "Payment reminders and overview",
    "product.reminders.body":
      "Configurable reminders for open items, plus a dashboard summary of revenue, estimated VAT, and overdue balances.",
    "product.paid": "Paid",
    "product.open": "Open",
    "product.import.title": "Import and API keys",
    "product.import.body":
      "Spreadsheet import for existing data, plus API keys for external integrations.",
    "product.tag.import": "Spreadsheet import",
    "product.tag.api": "API key",
    "product.nav.title": "NAV data reporting",
    "product.nav.body":
      "Reporting to the Hungarian tax authority (NAV) is currently available in demo and test mode only — we do not send data to the live environment.",

    "workflow.kicker": "Workflow",
    "workflow.title": "The next step is always obvious",
    "workflow.lede":
      "Three stages that keep the details you need without letting the important decisions disappear.",
    "workflow.step1.title": "Pick the basics",
    "workflow.step1.body":
      "Partner, document type, and previously saved products give you a tidy starting point.",
    "workflow.step2.title": "Review the document",
    "workflow.step2.body":
      "Line items, dates, payment terms, and the preview can all be reviewed together before finalizing.",
    "workflow.step3.title": "Save, download, or send",
    "workflow.step3.body":
      "The document can be saved as a draft, finalized, downloaded as PDF, or emailed.",

    "roadmap.kicker": "The sole trader's journey",
    "roadmap.title": "From invoicing to your tax return, step by step",
    "roadmap.lede":
      "The statuses below show exactly what works today, what's in development, and what's only a plan — we don't promise dates for any of it.",
    "roadmap.invoicing.title": "Invoicing",
    "roadmap.invoicing.body": "Invoice creation, PDF and email delivery, master data, reminders.",
    "roadmap.bank.title": "Bank reconciliation",
    "roadmap.bank.body": "Verifiable matching of incoming transactions with open invoices.",
    "roadmap.tax.title": "EV tax calculator",
    "roadmap.tax.body": "An informational tax-planning view built for sole traders.",
    "roadmap.nav.title": "Filing via NAV M2M",
    "roadmap.nav.body":
      "Preparing and submitting the tax return through NAV's machine-to-machine interface, after official testing.",

    "diff.kicker": "Why InvoHub",
    "diff.title": "Not another invoicing tool — a system built for sole traders",
    "diff.lede":
      "Most invoicing software stops at the document. InvoHub's goal is to keep revenue, bank reconciliation, and — eventually — tax in the same system.",
    "diff.one.title": "One dataset, start to finish",
    "diff.one.body":
      "The partner, the line item, and the payment status don't live in separate spreadsheets — they stay in one system all the way to your tax return.",
    "diff.two.title": "Built specifically for sole traders",
    "diff.two.body":
      "We're not building generic business invoicing — we design for the daily and yearly needs of Hungarian sole traders (EV).",
    "diff.three.title": "A transparent roadmap",
    "diff.three.body":
      "You can see exactly what's available today, what's in development, and what's only planned — no hidden or overpromised features.",
    "diff.four.title": "One subscription, not several tools",
    "diff.four.body":
      "The goal is that you won't need separate tools for invoicing, bank reconciliation, and tax estimation.",

    "pricing.kicker": "Pricing",
    "pricing.title": "Free during the beta",
    "pricing.lede":
      "InvoHub is under active development. During the beta, every available feature is free to use — we'll announce final pricing as the product matures.",
    "pricing.badge": "Beta — free",
    "pricing.item1": "Unlimited invoices, proformas, advances, and receipts during beta",
    "pricing.item2": "PDF, email delivery, partner and product master data",
    "pricing.item3": "Payment reminders and an overview dashboard",
    "pricing.cta": "Create an account",
    "pricing.note": "No hidden pricing and no credit card required to sign up.",

    "faq.kicker": "FAQ",
    "faq.title": "Frequently asked questions",
    "faq.q1.q": "Does InvoHub replace my accountant?",
    "faq.q1.a":
      "That's our long-term goal, but we're not there yet. The planned tax calculator and NAV filing are informational, not official tax advice — check with your accountant before filing.",
    "faq.q2.q": "How does InvoHub handle NAV data reporting?",
    "faq.q2.a":
      "Reporting to NAV currently runs in demo and test mode only. We don't send data to the live NAV environment until we announce that separately.",
    "faq.q3.q": "Can I use it as a VAT-exempt sole trader?",
    "faq.q3.a":
      "Yes, invoicing supports both VAT-exempt (alanyi adómentes) and VAT-registered sole traders; tax settings can be adjusted in the company profile.",
    "faq.q4.q": "How secure is my data?",
    "faq.q4.a":
      "Data is stored over an encrypted connection in an access-controlled database, reachable only from your own account.",
    "faq.q5.q": "Do I have to pay during the beta?",
    "faq.q5.a": "No, available features are free to use during the beta, with no credit card required.",

    "blog.kicker": "Knowledge base",
    "blog.title": "Practical writing on invoicing",
    "blog.post1.title": "Hungarian invoicing basics for getting started",
    "blog.post1.body": "What to clarify before issuing your first document.",
    "blog.post2.title": "Payment reminders in practice",
    "blog.post2.body": "Trackable, repeatable handling of open invoices.",
    "blog.post3.title": "What works in InvoHub today",
    "blog.post3.body": "A clear split between available and planned features.",
    "blog.read": "Read more →",

    "cta.kicker": "Get started",
    "cta.title": "Bring your daily invoicing into a tidy system",
    "cta.lede": "Create your account and see InvoHub's currently available workflows.",
    "cta.button": "Start for free",

    "footer.product": "Product",
    "footer.features": "Available features",
    "footer.workflow": "Workflow",
    "footer.roadmap": "Roadmap",
    "footer.pricing": "Pricing",
    "footer.login": "Log in to the app",
    "footer.content": "Content",
    "footer.blog": "Blog",
    "footer.faq": "FAQ",
    "footer.basics": "Invoicing basics",
    "footer.master": "Master data",
    "footer.pdf": "PDF and email delivery",
    "footer.legal": "Legal",
    "footer.terms": "Terms",
    "footer.privacy": "Privacy",
    "footer.cookies": "Cookie notice",
    "footer.imprint": "Imprint",
    "footer.cookiePrefs": "Cookie settings",
    "footer.blurb": "A transparent invoicing workspace for Hungarian sole traders — on the road to your tax return.",

    "consent.title": "We use cookies",
    "consent.body":
      "We always use storage that's necessary for the site to work. Analytics and marketing storage only activate with your consent.",
    "consent.settings": "Settings",
    "consent.essentialOnly": "Essential only",
    "consent.acceptAll": "Accept all",
    "consent.save": "Save selection",
    "consent.essential": "Essential — session, security, and preference storage.",
    "consent.analytics": "Analytics — usage statistics, if we introduce them later.",
    "consent.marketing": "Marketing — campaign measurement, if we introduce it later.",
  };

  window.InvoHubMarketingI18n = {
    storageKey: "invohub.language",
    dictionaries: { hu: hu, en: en },
  };
})();
