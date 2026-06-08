import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const RACINE = __dirname;

const typesMime = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.pdf':  'application/pdf',
};

const serveur = http.createServer((requete, reponse) => {
  let cheminUrl = requete.url.split('?')[0];

  if (cheminUrl === '/' || cheminUrl === '') {
    cheminUrl = '/index.html';
  } else if (cheminUrl.endsWith('/')) {
    cheminUrl += 'index.html';
  }

  const cheminFichier = path.resolve(RACINE, cheminUrl.replace(/^\//, ''));

  if (!cheminFichier.startsWith(RACINE)) {
    reponse.writeHead(403, { 'Content-Type': 'text/plain' });
    reponse.end('Acces refuse');
    return;
  }

  const extension = path.extname(cheminFichier).toLowerCase();
  const typeMime = typesMime[extension] || 'application/octet-stream';

  fs.readFile(cheminFichier, (erreur, donnees) => {
    if (erreur) {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      reponse.end('Ressource introuvable : ' + cheminUrl);
      return;
    }
    reponse.writeHead(200, { 'Content-Type': typeMime });
    reponse.end(donnees);
  });
});

serveur.listen(PORT, () => {
  console.log(`Serveur UpcycleConnect demarre : http://localhost:${PORT}`);
  console.log(`Racine servie : ${RACINE}`);
  console.log('Ctrl+C pour arreter.');
});
