// marketing/assets/site.js
// Progressive enhancement for the static site: navigation, consent, scroll reveal.
(function () {
  "use strict";

  var CONSENT_KEY = "invohub.cookie-consent.v1";

  function byTestId(id) {
    return document.querySelector('[data-testid="' + id + '"]');
  }

  /* ---------- Current year ---------- */
  var yearSlot = document.querySelector("[data-year]");
  if (yearSlot) {
    yearSlot.textContent = String(new Date().getFullYear());
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
    toggle.setAttribute("aria-label", open ? "Menü bezárása" : "Menü megnyitása");
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

  /* ---------- Cookie consent ---------- */
  var dialog = byTestId("cookie-consent-dialog");

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
      /* Storage may be unavailable; the banner still closes for this session. */
    }
  }

  function consentBoxes() {
    return dialog ? dialog.querySelectorAll("[data-consent]") : [];
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
  }

  function closeConsent() {
    if (dialog) {
      dialog.hidden = true;
    }
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
