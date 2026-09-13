// providers/funk.js
//
// Best-effort Anbindung an die INOFFIZIELLE, reverse-engineered funk.net API.
// Community-Dokumentation (nicht offiziell von funk/ARD/ZDF autorisiert):
//   https://github.com/cemrich/funk-api
//   https://github.com/lagmoellertim/freenet-funk-api
//
// WICHTIG: Dieser Endpunkt ist nicht offiziell dokumentiert und kann sich
// jederzeit ohne Ankuendigung aendern. Diese Datei konnte in der
// Entwicklungsumgebung NICHT gegen die echte API getestet werden (kein
// Netzwerkzugriff dort). Beim ersten Lauf auf dem Beelink unbedingt die
// Datei data/debug/funk-*.json ansehen und das Field-Mapping unten anpassen,
// falls sich hier keine oder falsche Titel ergeben.

const BASE_URL = 'https://www.funk.net/api/v4.1';

async function fetchSchedule() {
  const res = await fetch(`${BASE_URL}/channels?size=50`, {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`funk API antwortete mit HTTP ${res.status}`);
  const json = await res.json();

  // TODO Field-Mapping pruefen (siehe Kommentar oben). Wir versuchen mehrere
  // plausible Strukturen; welche zutrifft zeigt sich erst mit echtem Zugriff.
  const items = json?.result ?? json?.channels ?? json?.data ?? [];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('funk API: unerwartete Antwortstruktur (siehe data/debug/)');
  }

  // funk ist ueberwiegend VOD-lastig und liefert i.d.R. keine klassischen
  // Sendezeiten -> start/end bleibt null, build.js verteilt die Titel dann
  // gleichmaessig ueber den Tag ("virtuelle Zeitleiste").
  const schedule = items.slice(0, 10).map((item, i) => ({
    start: null,
    end: null,
    title: item?.title ?? item?.name ?? `funk Beitrag ${i + 1}`
  })).filter(p => p.title);

  return { schedule, raw: json };
}

module.exports = { fetchSchedule };
