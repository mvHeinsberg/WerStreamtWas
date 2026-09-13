// build.js
//
// Orchestriert alle Sender aus config/channels.json:
//  - Sender mit provider != "manual": versucht Live-Abruf ueber
//    providers/<provider>.js. Bei Fehler ODER wenn keine Sendezeiten
//    geliefert werden -> Fallback auf data/manual/<manualFile>.
//  - Sender mit provider === "manual" (RTL+/Joyn/Sportschau): liest direkt
//    aus data/manual/<manualFile> (von Hand pflegen, siehe README.md).
//
// Ergebnis wird nach data/schedule.json geschrieben; das wird von
// public/index.html per fetch() geladen. Fuer regelmaessige Aktualisierung
// alle 30 Minuten per Cronjob ausfuehren (siehe README.md).

const fs = require('fs');
const path = require('path');

const channels = require('./config/channels.json');

const providers = {
  funk: require('./providers/funk.js'),
  ardmediathek: require('./providers/ardmediathek.js'),
  zdf: require('./providers/zdf.js'),
  rtlplus: require('./providers/rtlplus.js'),
  joyn: require('./providers/joyn.js')
};

const ROOT = __dirname;
const MANUAL_DIR = path.join(ROOT, 'data', 'manual');
const DEBUG_DIR = path.join(ROOT, 'data', 'debug');

function evenlySpread(titles) {
  const n = titles.length || 1;
  const slot = Math.floor(1440 / n);
  return titles.map((title, i) => ({
    start: i * slot,
    end: i === n - 1 ? 1440 : (i + 1) * slot,
    title
  }));
}

function loadManual(fileName) {
  const p = path.join(MANUAL_DIR, fileName);
  if (!fs.existsSync(p)) {
    console.warn(`  -> Manuelle Datei fehlt: data/manual/${fileName}`);
    return [];
  }
  const entries = JSON.parse(fs.readFileSync(p, 'utf8'));
  return entries.map((entry, i, arr) => {
    const [h, m] = entry.time.split(':').map(Number);
    const start = h * 60 + m;
    let end;
    if (i + 1 < arr.length) {
      const [h2, m2] = arr[i + 1].time.split(':').map(Number);
      end = h2 * 60 + m2;
    } else {
      end = 24 * 60;
    }
    return { start, end, title: entry.title };
  });
}

async function buildChannel(ch) {
  if (ch.provider === 'manual') {
    return { schedule: loadManual(ch.manualFile), usedFallback: false, source: 'manuell' };
  }

  const providerFn = providers[ch.provider];
  if (!providerFn) {
    console.warn(`  -> Kein Provider-Modul fuer '${ch.provider}', nutze manuelle Daten.`);
    return { schedule: loadManual(ch.manualFile), usedFallback: true, source: 'manuell (kein Provider)' };
  }

  try {
    const { schedule: fetched, raw } = await providerFn.fetchSchedule(ch);

    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(DEBUG_DIR, `${ch.id}-${Date.now()}.json`),
      JSON.stringify(raw, null, 2)
    );

    if (!fetched || fetched.length === 0) {
      throw new Error('Leeres Ergebnis vom Provider');
    }

    const needsSpread = fetched.some(p => p.start == null);
    const schedule = needsSpread ? evenlySpread(fetched.map(p => p.title)) : fetched;

    return { schedule, usedFallback: false, source: 'live' };
  } catch (err) {
    console.warn(`  -> Live-Abruf fuer '${ch.id}' fehlgeschlagen: ${err.message}`);
    console.warn(`     Nutze Fallback: data/manual/${ch.manualFile}`);
    return { schedule: loadManual(ch.manualFile), usedFallback: true, source: `Fallback (${err.message})` };
  }
}

async function run() {
  console.log(`Baue schedule.json - ${new Date().toLocaleString('de-DE')}`);
  const result = [];

  for (const ch of channels) {
    console.log(`- ${ch.name} (${ch.provider})`);
    const { schedule, usedFallback, source } = await buildChannel(ch);
    result.push({
      id: ch.id,
      name: ch.name,
      group: ch.group,
      url: ch.url,
      sourceStatus: ch.sourceStatus,
      sourceNote: ch.sourceNote,
      usedFallback,
      dataSource: source,
      schedule
    });
  }

  const output = { generatedAt: new Date().toISOString(), channels: result };
  fs.writeFileSync(path.join(ROOT, 'data', 'schedule.json'), JSON.stringify(output, null, 2));

  const liveCount = result.filter(r => !r.usedFallback && r.dataSource === 'live').length;
  console.log(`\nFertig: ${result.length} Sender, davon ${liveCount} live, ${result.length - liveCount} manuell/Fallback.`);
  console.log('data/schedule.json aktualisiert.');
}

run().catch(err => {
  console.error('Build fehlgeschlagen:', err);
  process.exit(1);
});
