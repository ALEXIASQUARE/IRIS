// Progressif : le site reste complet sans JS. On se contente d'afficher
// l'année courante et, si le backend est joignable, la version publiée de
// l'app mobile (même source que le vérificateur de mise à jour de l'app —
// apps/backend/public/version.json).

(function () {
  "use strict";

  var API_ORIGIN = "https://backend-production-21788.up.railway.app";

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  var versionLine = document.getElementById("version-line");
  if (!versionLine || !window.fetch) return;

  fetch(API_ORIGIN + "/version.json", { mode: "cors" })
    .then(function (r) {
      return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status));
    })
    .then(function (data) {
      if (!data || !data.version) return;
      versionLine.textContent = "Dernière version : " + data.version;
      versionLine.hidden = false;
    })
    .catch(function () {
      /* backend injoignable ou CORS bloqué : on laisse la ligne masquée */
    });
})();
