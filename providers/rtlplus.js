// providers/rtlplus.js
//
// Nutzt eine per scripts/login-and-capture.js gespeicherte, echte RTL+
// Session (Cookies) - kein Passwort wird hier gespeichert oder verarbeitet.
//
// Voraussetzung pro Sender (ch.id, z.B. "sterncrime"):
//  1. Einmalig: node scripts/login-and-capture.js rtlplus https://plus.rtl.de
//  2. Danach in data/debug/rtlplus-capture-*/ den Endpunkt mit den echten
//     Sendezeiten/Titeln fuer diesen Sender identifizieren.
//  3. Eintrag in config/captured-endpoints/rtlplus.json ergaenzen:
//     { "sterncrime": { "url": "<gefundene URL>", "jsonPath": "data.schedule" } }
//
// Ohne diese zwei Schritte wirft diese Funktion bewusst einen sprechenden
// Fehler, und build.js faellt automatisch auf die manuellen Beispieldaten
// in data/manual/ zurueck - die Seite bleibt also immer benutzbar.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SESSION_FILE = path.join(ROOT, 'data', '.sessions', 'rtlplus.json');
const ENDPOINT_FILE = path.join(ROOT, 'config', 'captured-endpoints', 'rtlplus.json');

function getByPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

async function fetchSchedule(ch) {
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error(
      'Keine RTL+ Session gefunden - erst ausfuehren: ' +
      'node scripts/login-and-capture.js rtlplus https://plus.rtl.de'
    );
  }
  if (!fs.existsSync(ENDPOINT_FILE)) {
    throw new Error(
      `Keine config/captured-endpoints/rtlplus.json vorhanden - Endpunkt fuer '${ch.id}' ` +
      'erst per Capture-Schritt identifizieren (siehe README, Abschnitt "Eigener Login").'
    );
  }

  const endpoints = JSON.parse(fs.readFileSync(ENDPOINT_FILE, 'utf8'));
  const endpoint = endpoints[ch.id];
  if (!endpoint) {
    throw new Error(`Kein Endpunkt fuer Sender '${ch.id}' in config/captured-endpoints/rtlplus.json hinterlegt.`);
  }

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    throw new Error('Playwright nicht installiert - "npm install && npx playwright install chromium" ausfuehren.');
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ storageState: SESSION_FILE });
    const res = await context.request.fetch(endpoint.url, { method: endpoint.method || 'GET' });

    if (res.status() === 401 || res.status() === 403) {
      throw new Error(`RTL+ Session offenbar abgelaufen (HTTP ${res.status()}) - Login-Schritt wiederholen.`);
    }
    if (!res.ok()) {
      throw new Error(`RTL+ Endpunkt antwortete mit HTTP ${res.status()}`);
    }

    const json = await res.json().catch(() => null);
    if (!json) throw new Error('RTL+ Endpunkt lieferte kein JSON.');

    const items = endpoint.jsonPath ? getByPath(json, endpoint.jsonPath) : json;
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(`Kein Array unter jsonPath "${endpoint.jsonPath || '(root)'}" gefunden - config anpassen.`);
    }

    // TODO Feldnamen pruefen/anpassen, sobald echte Struktur bekannt ist.
    const schedule = items.slice(0, 14).map((it, i) => ({
      start: typeof it.start === 'number' ? it.start : null,
      end: typeof it.end === 'number' ? it.end : null,
      title: it.title ?? it.name ?? it.longTitle ?? `Sendung ${i + 1}`
    }));

    return { schedule, raw: json };
  } finally {
    await browser.close();
  }
}

module.exports = { fetchSchedule };
