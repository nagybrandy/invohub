// scripts/design-prototype/runtime/shell.js
// Browser glue for the single-file design prototype, inlined before the app
// bundle (after mock-backend.js):
//   1. a virtual location/history, so Expo Router can navigate under file://
//      (the build rewrites window.location/window.history in the bundle to
//      window.__vloc / window.__vhist),
//   2. a fetch() interceptor that answers /api/* from the mock backend,
//   3. a small "Prototípus" panel: demo logins, a list of every screen, reset.
(function () {
  "use strict";

  var ORIGIN = "https://app.invohub.prototype";
  var realHistory = window.history;
  var realLocation = window.location;

  // ------------------------------------------------------------ 1. router
  var initial = "/";
  try {
    var h = realLocation.hash;
    if (h && h.indexOf("#/") === 0) initial = h.slice(1);
  } catch (e) { /* ignore */ }

  var stack = [{ path: initial, state: null }];
  var index = 0;

  function cur() { return stack[index]; }
  function resolve(url) {
    return new URL(url == null ? cur().path : String(url), ORIGIN + cur().path);
  }
  function pathOf(u) { return u.pathname + u.search + u.hash; }
  function syncRealUrl() {
    try { realHistory.replaceState(null, "", "#" + cur().path); } catch (e) { /* file:// quirks */ }
  }
  function fireEvents(prev, next) {
    setTimeout(function () {
      try { window.dispatchEvent(new PopStateEvent("popstate", { state: cur().state })); } catch (e) { /* ignore */ }
      if (pathOf(resolve(prev)) !== pathOf(resolve(next))) {
        // hashchange is not needed by Expo Router; skipped on purpose.
      }
    }, 0);
  }

  var vloc = {};
  function define(name, getter) { Object.defineProperty(vloc, name, { get: getter, enumerable: true }); }
  define("href", function () { return ORIGIN + cur().path; });
  define("origin", function () { return ORIGIN; });
  define("protocol", function () { return "https:"; });
  define("host", function () { return "app.invohub.prototype"; });
  define("hostname", function () { return "app.invohub.prototype"; });
  define("port", function () { return ""; });
  define("pathname", function () { return resolve().pathname; });
  define("search", function () { return resolve().search; });
  define("hash", function () { return resolve().hash; });
  vloc.assign = function (u) { vhist.pushState(null, "", u); fireEvents(); };
  vloc.replace = function (u) { vhist.replaceState(null, "", u); fireEvents(); };
  vloc.reload = function () { realLocation.reload(); };
  vloc.toString = function () { return ORIGIN + cur().path; };

  var vhist = {
    get length() { return stack.length; },
    get state() { return cur().state; },
    scrollRestoration: "auto",
    pushState: function (state, title, url) {
      var next = pathOf(resolve(url));
      stack = stack.slice(0, index + 1);
      stack.push({ path: next, state: state === undefined ? null : state });
      index = stack.length - 1;
      syncRealUrl();
    },
    replaceState: function (state, title, url) {
      stack[index] = { path: pathOf(resolve(url)), state: state === undefined ? null : state };
      syncRealUrl();
    },
    go: function (delta) {
      var target = Math.max(0, Math.min(stack.length - 1, index + (delta || 0)));
      if (target === index) return;
      var prev = cur().path;
      index = target;
      syncRealUrl();
      fireEvents(prev, cur().path);
    },
    back: function () { this.go(-1); },
    forward: function () { this.go(1); },
  };

  window.__vloc = vloc;
  window.__vhist = vhist;

  // Programmatic navigation (used by the panel).
  function navigate(path) {
    vhist.pushState(null, "", path);
    fireEvents();
  }

  // ------------------------------------------------------------ 2. fetch
  var storage = null;
  try { storage = window.localStorage; storage.getItem("x"); } catch (e) { storage = null; }
  var backend = window.InvoHubMock.createBackend({ storage: storage });
  window.__invohubBackend = backend;

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  var LATENCY_MS = 120;

  function toResponse(result) {
    if (result.pdf) {
      return new Response(new Blob([result.pdf], { type: "application/pdf" }), { status: result.status, headers: { "Content-Type": "application/pdf" } });
    }
    var text = result.body === null ? "null" : JSON.stringify(result.body);
    return new Response(result.status === 204 ? null : text, { status: result.status, headers: { "Content-Type": "application/json" } });
  }

  window.fetch = function (input, init) {
    var url;
    var method = (init && init.method) || "GET";
    var bodyPromise = Promise.resolve(init && typeof init.body === "string" ? init.body : null);
    try {
      if (typeof Request !== "undefined" && input instanceof Request) {
        url = new URL(input.url, ORIGIN);
        method = (init && init.method) || input.method;
        if (!(init && init.body)) bodyPromise = input.clone().text().catch(function () { return null; });
      } else {
        url = new URL(String(input), ORIGIN);
      }
    } catch (e) {
      return realFetch ? realFetch(input, init) : Promise.reject(e);
    }
    var sameOrigin = url.origin === ORIGIN || url.protocol === "file:" || url.hostname === "";
    if (sameOrigin && url.pathname.indexOf("/api/") === 0) {
      return bodyPromise.then(function (body) {
        return new Promise(function (resolveFetch) {
          setTimeout(function () {
            var result;
            try {
              result = backend.handle(method, url.pathname + url.search, body);
            } catch (e) {
              result = { status: 500, body: { error: String((e && e.message) || e) } };
            }
            resolveFetch(toResponse(result));
          }, LATENCY_MS);
        });
      });
    }
    return realFetch ? realFetch(input, init) : Promise.reject(new TypeError("Network disabled in the prototype"));
  };

  // ------------------------------------------------------------ 3. panel
  var PANEL_KEY = "invohub-prototype-panel";
  function readFlag(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function writeFlag(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  var css =
    "#ihp-root{position:fixed;right:14px;bottom:14px;z-index:2147483000;font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a}" +
    "#ihp-root *{box-sizing:border-box}" +
    "#ihp-fab{display:flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:9px 14px;background:#0f172a;color:#fff;font:600 12px/1 inherit;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}" +
    "#ihp-panel{display:none;position:absolute;right:0;bottom:44px;width:340px;max-height:min(78vh,640px);overflow:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 18px 50px rgba(15,23,42,.28);padding:14px}" +
    "#ihp-root.open #ihp-panel{display:block}" +
    "#ihp-panel h4{margin:14px 0 6px;font:700 11px/1 inherit;letter-spacing:.06em;text-transform:uppercase;color:#64748b}" +
    "#ihp-panel h4:first-of-type{margin-top:0}" +
    "#ihp-panel p{margin:0 0 6px;color:#475569}" +
    ".ihp-user,.ihp-link{display:flex;width:100%;justify-content:space-between;align-items:center;gap:8px;text-align:left;border:1px solid #e2e8f0;background:#f8fafc;border-radius:9px;padding:8px 10px;margin:0 0 5px;cursor:pointer;color:#0f172a;font:inherit}" +
    ".ihp-user:hover,.ihp-link:hover{background:#eef2ff;border-color:#c7d2fe}" +
    ".ihp-user small{display:block;color:#64748b}" +
    ".ihp-user.me{border-color:#6366f1;background:#eef2ff}" +
    ".ihp-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}" +
    ".ihp-grid .ihp-link{margin:0;padding:7px 9px}" +
    ".ihp-row{display:flex;gap:6px;margin-top:10px}" +
    ".ihp-btn{flex:1;border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px;cursor:pointer;font:600 12px/1 inherit;color:#0f172a}" +
    ".ihp-btn:hover{background:#f1f5f9}" +
    "#ihp-x{position:absolute;top:8px;right:10px;border:0;background:transparent;font-size:18px;cursor:pointer;color:#64748b}" +
    "@media (max-width:767px){#ihp-root{bottom:86px;right:10px}#ihp-panel{width:min(340px,calc(100vw - 24px))}}";

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "onclick") n.addEventListener("click", attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  function goRealReload(path) {
    try { realHistory.replaceState(null, "", "#" + path); } catch (e) { /* ignore */ }
    realLocation.reload();
  }

  function screens() {
    var user = backend.state().users.filter(function (u) { return u.id === backend.state().sessionUserId; })[0];
    var ids = user ? backend.invoiceIds(user.id) : [];
    var firsts = user ? backend.firstIds(user.id) : {};
    var pick = function (pred) { var f = ids.filter(pred)[0]; return f ? f.id : null; };
    var detail = pick(function (i) { return i.status === "sent" || i.status === "unpaid"; });
    var draft = pick(function (i) { return i.status === "draft"; });
    var proforma = pick(function (i) { return i.documentType === "proforma"; });
    var paid = pick(function (i) { return i.status === "paid"; });
    var failedNav = pick(function (i) { return i.number === "INV-2026-00017"; });
    var groups = [
      { title: "Nyilvános", items: [
        ["Főoldal", "/"], ["Bejelentkezés / regisztráció", "/login"], ["Elfelejtett jelszó", "/forgot-password"],
        ["Új jelszó", "/reset-password?token=demo"], ["Blog", "/blog"], ["Blogcikk", "/blog/magyar-szamlazas-alapok"],
        ["Nyugta-ellenőrzés", "/receipts/view?token=demo-token-1"], ["ÁSZF", "/aszf"], ["Adatkezelés", "/adatkezeles"],
        ["Süti-tájékoztató", "/cookie-tajekoztato"], ["Impresszum", "/impresszum"], ["404-es oldal", "/nincs-ilyen-oldal"],
      ] },
      { title: "Alkalmazás (bejelentkezve)", items: [
        ["Irányítópult", "/dashboard"], ["Számlák", "/invoices"], ["Új számla", "/invoices/new"],
        ["Partnerek", "/clients"], ["Új partner", "/clients/new"], ["Termékek", "/products"],
        ["Nyugták", "/receipts"], ["Új nyugta", "/receipts/new"], ["E-mail szerkesztő", "/email-editor"],
        ["Beállítások", "/settings"], ["Cégadatok", "/settings/company"], ["PDF sablon", "/settings/pdf"],
        ["Emlékeztetők", "/settings/reminders"], ["E-mail sablonok", "/settings/templates"], ["Onboarding", "/onboarding"], ["Import", "/import"], ["Admin", "/admin"],
      ] },
    ];
    var withIds = [];
    if (detail) withIds.push(["Számla részletei", "/invoices/" + detail]);
    if (paid) withIds.push(["Kifizetett számla", "/invoices/" + paid]);
    if (proforma) withIds.push(["Díjbekérő részletei", "/invoices/" + proforma]);
    if (draft) { withIds.push(["Piszkozat szerkesztése", "/invoices/" + draft + "/edit"]); withIds.push(["Piszkozat részletei", "/invoices/" + draft]); }
    if (failedNav) withIds.push(["NAV-hibás számla", "/invoices/" + failedNav]);
    if (firsts.client) withIds.push(["Partner szerkesztése", "/clients/" + firsts.client + "/edit"]);
    if (firsts.product) withIds.push(["Termék szerkesztése", "/products/" + firsts.product + "/edit"]);
    if (firsts.receipt) withIds.push(["Nyugta részletei", "/receipts/" + firsts.receipt]);
    if (withIds.length) groups.push({ title: "Részletező oldalak", items: withIds });
    return groups;
  }

  function mountPanel() {
    if (document.getElementById("ihp-root")) return;
    var style = el("style", {});
    style.textContent = css;
    document.head.appendChild(style);

    var root = el("div", { id: "ihp-root" });
    var panel = el("div", { id: "ihp-panel" });
    var fab = el("button", { id: "ihp-fab", type: "button", text: "Prototípus" });
    root.appendChild(panel);
    root.appendChild(fab);
    document.body.appendChild(root);

    function render() {
      panel.innerHTML = "";
      panel.appendChild(el("button", { id: "ihp-x", type: "button", text: "×", "aria-label": "Bezár", onclick: function () { root.classList.remove("open"); writeFlag(PANEL_KEY, "closed"); } }));
      panel.appendChild(el("h4", { text: "Demó felhasználók" }));
      panel.appendChild(el("p", { text: "Minden jelszó: " + window.InvoHubMock.PASSWORD + " – minden adat kitalált, semmi nem megy ki az oldalról." }));
      var me = backend.state().sessionUserId;
      var describe = {
        "u-anna": "Egyéni vállalkozó – teli fiók (számlák, partnerek, nyugták)",
        "u-peter": "Új fiók – üres állapotok, onboarding",
        "u-eszter": "Könyvelő – teli fiók",
        "u-admin": "Admin – admin felület is látszik",
      };
      backend.users().forEach(function (u) {
        var btn = el("button", { type: "button", class: "ihp-user" + (u.id === me ? " me" : ""), onclick: function () {
          backend.signInAs(u.id);
          goRealReload(u.id === "u-peter" ? "/onboarding" : "/dashboard");
        } }, [
          el("span", {}, [el("strong", { text: u.name }), el("small", { text: u.email + " · " + (describe[u.id] || u.role) })]),
          el("span", { text: u.id === me ? "aktív" : "belép →" }),
        ]);
        panel.appendChild(btn);
      });
      screens().forEach(function (g) {
        panel.appendChild(el("h4", { text: g.title }));
        var grid = el("div", { class: "ihp-grid" });
        g.items.forEach(function (it) {
          grid.appendChild(el("button", { type: "button", class: "ihp-link", text: it[0], onclick: function () { navigate(it[1]); root.classList.remove("open"); } }));
        });
        panel.appendChild(grid);
      });
      panel.appendChild(el("div", { class: "ihp-row" }, [
        el("button", { type: "button", class: "ihp-btn", text: "Kijelentkezés", onclick: function () { backend.signOut(); goRealReload("/login"); } }),
        el("button", { type: "button", class: "ihp-btn", text: "Adatok visszaállítása", onclick: function () { backend.reset(); goRealReload(cur().path); } }),
      ]));
      panel.appendChild(el("p", { text: "Tipp: a megnyitott képernyő a címsor végén (#/...) is látszik, újratöltés után ugyanitt marad." }));
    }

    fab.addEventListener("click", function () {
      render();
      root.classList.toggle("open");
      writeFlag(PANEL_KEY, root.classList.contains("open") ? "open" : "closed");
    });

    if (readFlag(PANEL_KEY) !== "closed") { render(); root.classList.add("open"); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountPanel);
  else mountPanel();
})();
