// marketing/assets/site.js
// Progressive enhancement: floating nav, HU/EN i18n, consent, scroll reveal.
(function () {
  "use strict";

  var CONSENT_KEY = "invohub.cookie-consent.v1";
  var i18n = window.InvoHubMarketingI18n || {
    storageKey: "invohub.language",
    dictionaries: { hu: {}, en: {} },
  };

  function byTestId(id) {
    return document.querySelector('[data-testid="' + id + '"]');
  }

  function readLanguage() {
    try {
      var stored = window.localStorage.getItem(i18n.storageKey);
      if (stored === "en" || stored === "hu") {
        return stored;
      }
    } catch (error) {
      /* ignore */
    }
    return "hu";
  }

  function writeLanguage(code) {
    try {
      window.localStorage.setItem(i18n.storageKey, code);
    } catch (error) {
      /* ignore */
    }
  }

  function t(code, key) {
    var dict = i18n.dictionaries[code] || i18n.dictionaries.hu || {};
    return dict[key] || (i18n.dictionaries.hu && i18n.dictionaries.hu[key]) || key;
  }

  var language = readLanguage();

  function applyI18n(code) {
    document.documentElement.lang = code;

    var title = t(code, "meta.title");
    if (title) {
      document.title = title;
    }

    var description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute("content", t(code, "meta.description"));
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (node) {
      var key = node.getAttribute("data-i18n");
      if (!key) {
        return;
      }
      node.textContent = t(code, key);
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-attr]"), function (node) {
      var pairs = node.getAttribute("data-i18n-attr").split(";");
      pairs.forEach(function (pair) {
        var parts = pair.split(":");
        if (parts.length !== 2) {
          return;
        }
        node.setAttribute(parts[0].trim(), t(code, parts[1].trim()));
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-lang-btn]"), function (btn) {
      var btnLang = btn.getAttribute("data-lang-btn");
      btn.classList.toggle("is-active", btnLang === code);
      btn.setAttribute("aria-pressed", btnLang === code ? "true" : "false");
    });

    if (toggle) {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute(
        "aria-label",
        open ? t(code, "nav.closeMenu") : t(code, "nav.openMenu"),
      );
    }
  }

  /* ---------- Current year ---------- */
  var yearSlot = document.querySelector("[data-year]");
  if (yearSlot) {
    yearSlot.textContent = String(new Date().getFullYear());
  }

  /* ---------- Floating header ---------- */
  var header = byTestId("marketing-header");

  function syncHeaderSolid() {
    if (!header) {
      return;
    }
    var solid = window.scrollY > 18;
    header.classList.toggle("is-solid", solid);
  }

  if (header) {
    syncHeaderSolid();
    window.addEventListener("scroll", syncHeaderSolid, { passive: true });
  }

  /* ---------- Mobile navigation ---------- */
  var toggle = byTestId("marketing-menu-toggle");
  var menu = byTestId("marketing-mobile-menu");

  function setMenuOpen(open) {
    if (!toggle || !menu) {
      return;
    }
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute(
      "aria-label",
      open ? t(language, "nav.closeMenu") : t(language, "nav.openMenu"),
    );
    if (header) {
      header.classList.toggle("is-menu-open", open);
    }
    // Lock background scroll behind the fullscreen overlay.
    document.body.style.overflow = open ? "hidden" : "";
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      setMenuOpen(menu.hidden);
    });

    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setMenuOpen(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    });
  }

  /* ---------- Language switcher ---------- */
  function setLanguage(code) {
    if (code !== "hu" && code !== "en") {
      return;
    }
    language = code;
    writeLanguage(code);
    applyI18n(code);
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-lang-btn]"), function (btn) {
    btn.addEventListener("click", function () {
      setLanguage(btn.getAttribute("data-lang-btn"));
    });
  });

  applyI18n(language);

  /* ---------- Cookie consent (compact bottom bar) ---------- */
  var dialog = byTestId("cookie-consent-dialog");
  var settingsPanel = document.getElementById("consent-settings");
  var settingsToggle = byTestId("cookie-consent-settings");

  function readConsent() {
    try {
      var raw = window.localStorage.getItem(CONSENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeConsent(analytics, marketing) {
    var consent = {
      essential: true,
      analytics: analytics,
      marketing: marketing,
      updatedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    } catch (error) {
      /* Storage may be unavailable; the bar still closes for this session. */
    }
  }

  function consentBoxes() {
    return settingsPanel ? settingsPanel.querySelectorAll("[data-consent]") : [];
  }

  function closeSettings() {
    if (settingsPanel) {
      settingsPanel.hidden = true;
    }
    if (settingsToggle) {
      settingsToggle.setAttribute("aria-expanded", "false");
    }
  }

  function openConsent() {
    if (!dialog) {
      return;
    }

    var stored = readConsent();
    Array.prototype.forEach.call(consentBoxes(), function (box) {
      box.checked = Boolean(stored && stored[box.getAttribute("data-consent")]);
    });

    dialog.hidden = false;
    closeSettings();
  }

  function closeConsent() {
    if (dialog) {
      dialog.hidden = true;
    }
    closeSettings();
  }

  function decide(analytics, marketing) {
    writeConsent(analytics, marketing);
    closeConsent();
  }

  if (dialog) {
    if (!readConsent()) {
      openConsent();
    }

    var essentialOnly = byTestId("cookie-consent-essential");
    var acceptAll = byTestId("cookie-consent-accept-all");
    var saveChoice = byTestId("cookie-consent-save");
    var reopen = byTestId("footer-cookie-preferences");

    if (essentialOnly) {
      essentialOnly.addEventListener("click", function () {
        decide(false, false);
      });
    }

    if (acceptAll) {
      acceptAll.addEventListener("click", function () {
        decide(true, true);
      });
    }

    if (settingsToggle && settingsPanel) {
      settingsToggle.addEventListener("click", function () {
        var open = settingsPanel.hidden;
        settingsPanel.hidden = !open;
        settingsToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    if (saveChoice) {
      saveChoice.addEventListener("click", function () {
        var selection = { analytics: false, marketing: false };
        Array.prototype.forEach.call(consentBoxes(), function (box) {
          selection[box.getAttribute("data-consent")] = box.checked;
        });
        decide(selection.analytics, selection.marketing);
      });
    }

    if (reopen) {
      reopen.addEventListener("click", openConsent);
    }
  }
})();
