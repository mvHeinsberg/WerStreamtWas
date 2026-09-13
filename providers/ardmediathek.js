// providers/ardmediathek.js
//
// Best-effort Anbindung an das INTERNE ARD Mediathek "page-gateway".
// Nicht offiziell fuer Dritte freigegeben, aber seit Jahren stabil von
// Open-Source-Tools genutzt (z.B. Streamlink-Plugin fuer ARD Mediathek).
//
// WICHTIG: Genau wie bei funk.js konnte dieser Endpunkt in der Entwicklungs-
// umgebung nicht live getestet werden (Netzwerksperre). Die Basis-URL/Pfad-
// Struktur ist aus oeffentlichen Referenzen bekannt, die exakte Seiten-ID
// fuer "ARD Kultur" bzw. das passende Widget muss beim ersten echten Lauf
// auf dem Beelink verifiziert werden (siehe data/debug/ardkultur-*.json).

const BASE_URL = 'https://api.ardmediathek.de/page-gateway';

async function fetchSchedule() {
  // ARD Kultur Themen-/Channel-Seite im page-gateway.
  const res = await fetch(`${BASE_URL}/pages/ard/editorial/ard-kultur?embedded=true`, {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`ARD Mediathek API antwortete mit HTTP ${res.status}`);
  const json = await res.json();

  // TODO Field-Mapping pruefen. Teaser liegen typischerweise unter
  // widgets[].teasers[] mit Feldern wie "longTitle"/"title" und ggf.
  // "broadcastedOn". Bei Abweichung anhand der Debug-Datei anpassen.
  const widgets = json?.widgets ?? [];
  const teasers = widgets.flatMap(w => w?.teasers ?? []);
  if (teasers.length === 0) {
    throw new Error('ARD Mediathek API: keine Teaser gefunden (siehe data/debug/)');
  }

  const schedule = teasers.slice(0, 10).map((t, i) => ({
    start: null, // i.d.R. Mediathek-Inhalte ohne festen Sendeslot
    end: null,
    title: t?.longTitle ?? t?.title ?? `ARD Kultur Beitrag ${i + 1}`
  })).filter(p => p.title);

  return { schedule, raw: json };
}

module.exports = { fetchSchedule };
