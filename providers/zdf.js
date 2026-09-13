// providers/zdf.js
//
// ZDF betreibt ein OFFIZIELLES Developer Portal (https://developer.zdf.de) -
// fuer eine belastbare Loesung lohnt sich dort eine Registrierung/Anfrage.
// Der intern von zdf.de/sport genutzte Zusatz-Endpunkt (sportapi.zdf.de) ist
// per robots.txt fuer automatisierte Abrufe gesperrt und wird hier daher
// bewusst NICHT angefragt (Rechts-/Compliance-Grund, nicht nur technisch).
//
// Diese Datei liefert deshalb aktuell keinen Live-Abruf, sondern wirft
// gezielt einen Fehler, damit build.js sauber auf die manuell gepflegte
// Datei data/manual/zdfsport.json zurueckfaellt. Sobald ein offizieller
// API-Zugang ueber developer.zdf.de vorliegt, hier die echte Anbindung
// eintragen (Auth-Header/Key nicht vergessen).

async function fetchSchedule() {
  throw new Error(
    'Kein offizieller ZDF-API-Zugang hinterlegt (developer.zdf.de) - ' +
    'nutze data/manual/zdfsport.json bis dahin.'
  );
}

module.exports = { fetchSchedule };
