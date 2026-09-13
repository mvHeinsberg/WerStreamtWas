# Streamguide – lokale Installation (Beelink Mini)

Dieses Projekt ist so vorbereitet, dass du es direkt auf deinem Beelink Mini
ablegen kannst. Dort hat die Maschine echten Internetzugang (anders als die
Sandbox, in der dieses Projekt entstanden ist), sodass die Live-Abrufe
tatsächlich funktionieren bzw. sich final austesten und korrigieren lassen.

## Was ist was

```
streamguide-lokal/
├── config/channels.json      Senderliste: Name, Gruppe (ÖRR/Privat), URL, Quelle
├── providers/                Live-Abruf-Module (funk, ARD Mediathek, ZDF)
├── data/manual/*.json        Von Hand pflegbare Sendepläne (v.a. RTL+/Joyn)
├── data/schedule.json        Wird von build.js erzeugt – NICHT von Hand bearbeiten
├── data/debug/                Rohantworten der Live-Abrufe, zur Fehlersuche
├── build.js                  Holt/aktualisiert alle Senderdaten -> schedule.json
├── server.js                 Schlanker Webserver, liefert die Oberfläche aus
└── public/index.html         Die eigentliche Guide-Oberfläche (liest schedule.json)
```

## 1. Voraussetzung: Node.js

Prüfen, ob Node.js (Version 18 oder neuer) installiert ist:

```bash
node --version
```

Falls nicht vorhanden (Linux/Ubuntu-artig auf dem Beelink):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

(Läuft der Beelink unter Windows, stattdessen den Installer von
https://nodejs.org herunterladen, LTS-Version.)

## 2. Projekt auf den Beelink bringen

Diesen ganzen Ordner (`streamguide-lokal/`) per USB-Stick, Netzwerkfreigabe
oder Download auf den Beelink kopieren, z. B. nach `~/streamguide-lokal`.

## 3. Erster Testlauf

```bash
cd ~/streamguide-lokal
node build.js
```

Das Skript versucht für jeden Sender einen Live-Abruf und fällt bei Fehlern
automatisch auf die manuellen Beispieldaten zurück. In der Konsole siehst du
pro Sender, ob "live" oder "Fallback" verwendet wurde.

**Wichtig:** Die Live-Provider (`providers/funk.js`, `providers/ardmediathek.js`)
konnten in der Entwicklungsumgebung nicht gegen die echten APIs getestet
werden, da dort kein Netzwerkzugriff auf diese Domains bestand. Es ist
wahrscheinlich, dass beim ersten echten Lauf das Feld-Mapping noch angepasst
werden muss. Vorgehen:

1. `node build.js` ausführen.
2. Meldet die Konsole für einen Sender einen Fehler wie "unerwartete
   Antwortstruktur" – die zugehörige Rohantwort liegt in `data/debug/<sender>-*.json`.
3. Diese Datei öffnen, die tatsächliche Struktur ansehen, und das Mapping in
   der jeweiligen `providers/*.js`-Datei entsprechend anpassen (Stellen sind
   mit `// TODO Field-Mapping prüfen` markiert).
4. `node build.js` erneut laufen lassen, bis es klappt.

Bis dahin funktioniert die Seite trotzdem – dank Fallback auf die manuellen
Beispieldaten in `data/manual/`.

## 4. Oberfläche starten

```bash
node server.js
```

Dann im Browser öffnen: `http://localhost:8080`
Im Heimnetz von einem anderen Gerät: `http://<IP-des-Beelink>:8080`
(IP herausfinden mit `hostname -I` bzw. `ip a`).

## 5. Automatische Aktualisierung alle 30 Minuten (Cronjob)

```bash
crontab -e
```

Zeile hinzufügen (Pfad anpassen):

```
*/30 * * * * cd /home/<user>/streamguide-lokal && /usr/bin/node build.js >> logs/build.log 2>&1
```

## 6. Server dauerhaft laufen lassen (Autostart)

Am einfachsten mit einem systemd-Service (Linux):

```bash
sudo tee /etc/systemd/system/streamguide.service > /dev/null <<'EOF'
[Unit]
Description=Streamguide Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/<user>/streamguide-lokal
ExecStart=/usr/bin/node server.js
Restart=on-failure
User=<user>

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now streamguide
```

Pfad `/home/<user>/streamguide-lokal` und `User=<user>` an deine tatsächliche
Umgebung anpassen.

## 6b. Optional: RTL+ / Joyn mit deinem eigenen Login abrufen

Für RTL+ und Joyn gibt es keine öffentliche API. Mit deinem eigenen,
bezahlten Account lässt sich trotzdem versuchen, die echten Daten
abzurufen – über einen **interaktiven Login**, kein gespeichertes Passwort:

**Wie es funktioniert:** Ein echtes Chromium-Fenster öffnet sich, du loggst
dich dort selbst ein (Passwort, Captcha, 2FA – alles wie gewohnt direkt auf
der echten Seite). Danach werden nur die resultierenden Session-Cookies
lokal gespeichert (`data/.sessions/`). Dein Passwort sieht dieses Skript nie
und speichert es nirgendwo.

**Wichtiger Hinweis zu den Nutzungsbedingungen:** Automatisierter Zugriff ist
in den AGB von RTL+ und Joyn ausdrücklich nicht vorgesehen – das ändert sich
auch mit deinem eigenen Login nicht. Es ist dein Account, du entscheidest
über dieses Risiko (im schlechtesten Fall Kontosperrung); dies ist nur für
den privaten Gebrauch auf deinem eigenen Gerät gedacht, nicht zum Weitergeben
oder öffentlichen Betrieb.

**Voraussetzung:** Eine grafische Oberfläche auf dem Beelink (oder eine
VNC-/Remote-Desktop-Verbindung dorthin), da sich ein sichtbares Browser­fenster
öffnen muss. Läuft der Beelink komplett headless, kannst du diesen einen
Schritt stattdessen auf einem anderen Rechner mit Bildschirm ausführen und
danach nur die Datei `data/.sessions/<service>.json` auf den Beelink kopieren.

**Schritte:**

```bash
npm install
npx playwright install chromium   # laedt den Browser herunter (~300 MB)

npm run login:rtlplus   # bzw.: node scripts/login-and-capture.js rtlplus https://plus.rtl.de
```

Im sich öffnenden Fenster: normal einloggen, dann zu den gewünschten
Sendern/Livestreams navigieren (damit das Skript die zugehörigen
Netzwerk-Antworten mitschneiden kann), danach im Terminal ENTER drücken.

Das Skript zeichnet dabei alle JSON-Antworten auf, deren URL nach
EPG/Sendeplan aussieht, und legt sie in `data/debug/rtlplus-capture-*/` ab.
Diese Dateien durchsehen, den Endpunkt mit den echten Sendezeiten/Titeln pro
Sender identifizieren und in `config/captured-endpoints/rtlplus.json`
eintragen (Vorlage: `rtlplus.json.example` im selben Ordner):

```json
{
  "rtlcrime": { "url": "https://...", "method": "GET", "jsonPath": "data.schedule" }
}
```

Danach `node build.js` erneut ausführen – der Sender sollte jetzt als "live"
statt "Fallback" erscheinen. Für Joyn läuft alles analog mit
`npm run login:joyn`.

**Falls das nicht klappt:** Manche Logins laufen über zusätzliche,
JavaScript-generierte Sicherheits-Tokens oder Captchas, die sich nicht per
einfachem Endpunkt-Abruf wiederholen lassen. In dem Fall bleibt die Seite
trotzdem benutzbar – sie fällt automatisch auf die manuell gepflegten Daten
zurück (Abschnitt 7). Die Session läuft außerdem irgendwann ab (typischerweise
nach einigen Tagen/Wochen); meldet `node build.js` dann "Session abgelaufen",
einfach den Login-Schritt wiederholen.

## 7. RTL+ / Joyn von Hand pflegen

Für diese Sender gibt es keine öffentliche API (siehe unten). Die Dateien in
`data/manual/` haben das Format:

```json
[
  { "time": "18:00", "title": "Cold Justice - Verdeckte Spuren - Allein gelassen" },
  { "time": "20:00", "title": "Spartacus: Blood And Sand - Tötet sie alle" }
]
```

Jeder Eintrag läuft bis zum Start des nächsten; der letzte bis 24:00 Uhr.
Einfach mit den echten, aktuellen Titeln überschreiben, wenn du sie aus der
jeweiligen App/Website abliest – `build.js` übernimmt sie beim nächsten Lauf.

**Stand der RTL+-Kanäle (verifiziert am 13.09.2026):** Die acht echten,
stream-exklusiven (nicht linear empfangbaren) RTL+-Kanäle sind RTLup, VOXup,
NOW!, TOGGO plus, RTL Crime, RTL Passion, RTL Living und GEO Television. Die
URLs in `config/channels.json` (`https://plus.rtl.de/<slug>/live`) wurden
einzeln per Klick verifiziert – wichtig: GEO Television liegt unter
`/geo/live`, **nicht** unter `/geo-television/live` (das leitet auf die
RTL+-Startseite um). Die Titel in `data/manual/*.json` sind echte, am
13.09.2026 im RTL+ TV-Programm erfasste Sendungen in der dort angezeigten
Reihenfolge – die Uhrzeiten dazu waren im Sendegitter selbst nicht als Text
auslesbar und sind daher genäherte Platzhalter (halbe/volle Stunden bzw. eine
grobe Schätzung der Sendelänge). Vor produktivem Gebrauch lohnt es sich, die
exakten Uhrzeiten einmal in der RTL+-App nachzuschlagen und die Dateien
entsprechend zu korrigieren. Frühere Platzhalter-Sendernamen ("Stern Crime",
"Autovision", "RTL+ Serien Extra") gab es so nicht – sie wurden durch die
echten Kanäle ersetzt.

## 8. Neuen Sender hinzufügen

1. Eintrag in `config/channels.json` ergänzen (Name, Gruppe, URL, `provider:
   "manual"`, `manualFile`).
2. Passende `data/manual/<name>.json` im obigen Format anlegen.
3. `node build.js` laufen lassen.

## Rechtlicher Stand (Recherche-Ergebnis)

| Sender | Zugang | Hinweis |
|---|---|---|
| funk | inoffiziell | Reverse-engineered, dokumentiert unter github.com/cemrich/funk-api – kann sich jederzeit ändern |
| ARD Kultur | inoffiziell | Internes ARD-Mediathek-Gateway, nicht offiziell für Dritte freigegeben |
| Sportschau Extra | kein Zugang | Kein strukturierter Feed gefunden, nur manuell pflegbar |
| ZDF Sportstudio Extra | eingeschränkt | Offizielles Developer Portal vorhanden (developer.zdf.de) – für eine belastbare Lösung dort Zugang beantragen. Der intern genutzte Zusatz-Endpunkt ist per robots.txt gesperrt und wird hier bewusst nicht angefragt |
| ARD Klassik (YouTube) | kein EPG-Konzept | Kein 24/7-Sender, sondern ein YouTube-Kanal mit Konzert-Livestreams zu festen Terminen. Kein API-Zugriff eingerichtet, Termine werden manuell in `data/manual/ard-klassik.json` gepflegt. |
| RTL+ (alle Kanäle) | kein Zugang | Keine öffentliche API, App-/Login-gebunden, eigene Nutzungsbedingungen |
| Joyn (alle Kanäle) | kein Zugang | Keine öffentliche API, eigene AGB. Die Live-TV-Programmseite (joyn.de/play/live-tv) rendert ein echtes klassisches EPG-Gitter mit Uhrzeiten direkt ins DOM (kein separat abrufbares JSON gefunden) - siehe Hinweis unten. |

**Stand der Joyn-Kanäle (recherchiert am 13.09.2026):** Joyn betreibt neben den
Simulcasts der linearen Sender (SAT.1, ProSieben, Kabel Eins, DMAX, TLC, MTV,
usw. - die brauchen wir hier NICHT, da linear empfangbar) auch eine große Zahl
reiner Stream-Kanäle ("FAST-Kanäle", auf der Seite intern teils als "ODC"
bezeichnet), die es im normalen Kabel-/Sat-/Antennenempfang nicht gibt. Für
dieses Projekt wurde eine Auswahl von acht davon aufgenommen: **Spiegel TV,
Spiegel TV Konflikte, Spiegel TV action+crime, Curiosity Now, Terra Mater
WILD, Ancient Aliens, Expedition Unknown, XL Geschichte**. Es gibt noch
deutlich mehr davon (u. a. Focus TV, Timeline Deutschland, Real Stories
Deutschland, Technik & Wissen, DMAX Macher, DOKU, Geschichte & Kultur, BBC
History, One Terra, xplore) - die lassen sich nach demselben Muster in
`config/channels.json` ergänzen. Wichtig: Die frühere Annahme, "Newstime" sei
ein eigener Joyn-Stream-Kanal, war falsch - Newstime ist tatsächlich eine
kurze Nachrichten-Einblendung innerhalb des Programms von ProSieben/Kabel
Eins, kein eigenständiger Sender. Der Kanal wurde deshalb aus der Liste
entfernt. Für zwei Kanäle (Curiosity Now, Ancient Aliens) wurde der genaue
Deep-Link (`?channel_id=...`) bereits per Klick bestätigt; bei den übrigen
sechs verweist die URL erstmal auf die allgemeine Programmseite
(`joyn.de/play/live-tv`), bis jemand einmal manuell nachschaut und die
`channel_id` einträgt.

Für den privaten Gebrauch auf deinem eigenen Gerät ist das unkritisch. Sobald
die Seite für Dritte sichtbar/öffentlich betrieben werden soll, lohnt sich
vorher eine rechtliche Prüfung der jeweiligen Nutzungsbedingungen –
insbesondere bevor irgendetwas an RTL+/Joyn-Daten automatisiert abgerufen
oder veröffentlicht wird.
