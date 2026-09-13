#!/usr/bin/env node
// scripts/login-and-capture.js
//
// Interaktiver Login-Helfer.
//
// Oeffnet einen ECHTEN, sichtbaren Chromium-Browser. Du loggst dich dort
// selbst ganz normal ein (inkl. Captcha/2FA, falls noetig). Dein Passwort
// tippst du direkt in die echte RTL+/Joyn-Seite ein - dieses Skript sieht
// und speichert es nie. Gespeichert werden am Ende nur die Session-Cookies
// (in data/.sessions/<service>.json) - behandle diese Datei trotzdem wie ein
// Passwort: nicht weitergeben, nicht in ein Git-Repo committen.
//
// Waehrenddessen zeichnet das Skript alle JSON-Netzwerkantworten auf, deren
// URL nach EPG/Sendeplan aussieht - die landen zur Auswertung in
// data/debug/<service>-capture-<zeitstempel>/. Darin suchst du den Endpunkt
// mit den echten Sendezeiten/Titeln und traegst ihn in
// config/captured-endpoints/<service>.json ein (siehe README).
//
// Aufruf:
//   node scripts/login-and-capture.js rtlplus https://plus.rtl.de
//   node scripts/login-and-capture.js joyn https://www.joyn.de
//
// Voraussetzung: einmalig "npm install" und "npx playwright install chromium"
// ausgefuehrt (braucht Internet + etwas Speicherplatz fuer den Browser).
// Erfordert eine grafische Oberflaeche auf dem Beelink (oder eine
// Remote-Desktop/VNC-Verbindung dorthin). Alternativ: dieses Skript auf einem
// anderen Rechner mit Bildschirm ausfuehren und danach nur die erzeugte Datei
// data/.sessions/<service>.json auf den Beelink kopieren.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error(
    'Playwright ist nicht installiert. Bitte einmalig ausfuehren:\n' +
    '  npm install\n' +
    '  npx playwright install chromium\n'
  );
  process.exit(1);
}

const [, , service, startUrl] = process.argv;
if (!service || !startUrl) {
  console.error('Nutzung: node scripts/login-and-capture.js <service> <start-url>');
  console.error('Beispiel: node scripts/login-and-capture.js rtlplus https://plus.rtl.de');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const SESSION_DIR = path.join(ROOT, 'data', '.sessions');
const CAPTURE_DIR = path.join(ROOT, 'data', 'debug', `${service}-capture-${Date.now()}`);
fs.mkdirSync(SESSION_DIR, { recursive: true });
fs.mkdirSync(CAPTURE_DIR, { recursive: true });

const KEYWORDS = ['epg', 'schedule', 'programm', 'program', 'channel', 'live', 'broadcast', 'sendung'];

function waitForEnter(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

async function main() {
  const sessionFile = path.join(SESSION_DIR, `${service}.json`);
  const browser = await chromium.launch({ headless: false });
  const context = fs.existsSync(sessionFile)
    ? await browser.newContext({ storageState: sessionFile })
    : await browser.newContext();

  let captureCount = 0;
  context.on('response', async (res) => {
    const url = res.url();
    if (!KEYWORDS.some((k) => url.toLowerCase().includes(k))) return;
    const ct = res.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try {
      const json = await res.json();
      captureCount += 1;
      const safeName = url.replace(/[^a-z0-9]+/gi, '_').slice(0, 80);
      fs.writeFileSync(
        path.join(CAPTURE_DIR, `${captureCount}_${safeName}.json`),
        JSON.stringify({ url, status: res.status(), data: json }, null, 2)
      );
      console.log(`  [aufgezeichnet] ${url}`);
    } catch {
      // kein valides JSON -> ignorieren
    }
  });

  const page = await context.newPage();
  await page.goto(startUrl);

  console.log('\nEin Browser-Fenster hat sich geoeffnet.');
  console.log('1. Logge dich dort ganz normal mit deinem Account ein.');
  console.log('2. Navigiere danach zu genau den Sendern/EPG-Seiten, die spaeter');
  console.log('   automatisch abgerufen werden sollen (z.B. Stern Crime, GEO Television).');
  console.log('3. Komm dann hierher zurueck und druecke ENTER.\n');
  await waitForEnter('Weiter mit ENTER, sobald du fertig bist... ');

  await context.storageState({ path: sessionFile });
  await browser.close();

  console.log(`\nSession gespeichert: ${sessionFile}`);
  console.log(`${captureCount} passende JSON-Antworten aufgezeichnet in:\n  ${CAPTURE_DIR}\n`);
  console.log('Naechster Schritt:');
  console.log('1. Dateien dort durchsehen und den Endpunkt mit den echten Sendezeiten/Titeln finden.');
  console.log(`2. In config/captured-endpoints/${service}.json pro Sender-ID eintragen, z.B.:`);
  console.log(`   { "sterncrime": { "url": "<gefundene URL>", "jsonPath": "data.schedule" } }`);
  console.log('3. node build.js erneut ausfuehren.\n');
}

main().catch((err) => {
  console.error('Fehler:', err.message);
  process.exit(1);
});
