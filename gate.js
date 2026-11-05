/* gate.js : renvoie vers conditions.html si le client n'a pas encore accepté.
   À mettre tout en haut du <head> de CHAQUE page sauf conditions.html :
   <script src="gate.js"></script>
   La version doit être la même que dans conditions.html (CONFIG.version). */
(function () {
  var VERSION = "2026-11-02";
  try {
    var c = JSON.parse(localStorage.getItem("vnm_consent"));
    if (c && c.version === VERSION) return;
  } catch (e) {}
  var page = location.pathname.split("/").pop() || "index.html";
  location.replace("conditions.html?retour=" + encodeURIComponent(page));
})();
