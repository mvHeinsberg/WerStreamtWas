// server.js
//
// Winziger, abhaengigkeitsfreier Static-File-Server (nur Node.js Bordmittel).
// Liefert die Oberflaeche aus public/ und die Daten aus data/schedule.json.
//
// Start:  node server.js        (Standardport 8080)
//         PORT=3000 node server.js   (anderer Port)
// Danach im Browser: http://localhost:8080  bzw. http://<beelink-ip>:8080

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (reqPath === '/') reqPath = '/public/index.html';
  else if (reqPath === '/schedule.json') reqPath = '/data/schedule.json';
  else if (!reqPath.startsWith('/public/') && !reqPath.startsWith('/data/')) {
    reqPath = '/public' + reqPath;
  }

  const filePath = path.normalize(path.join(ROOT, reqPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Verboten');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Nicht gefunden: ' + reqPath);
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Streamguide laeuft: http://localhost:${PORT}`);
  console.log('Im lokalen Netzwerk erreichbar unter http://<IP-des-Beelink>:' + PORT);
});
