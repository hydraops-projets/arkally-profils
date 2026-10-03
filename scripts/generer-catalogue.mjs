#!/usr/bin/env node
// Écrit `catalogue.json` d'après les profils acceptés par le contrôle :
//
//   node scripts/generer-catalogue.mjs
//
// Refuse d'écrire tant qu'un fichier est refusé : le catalogue ne liste jamais
// un profil que l'application écarterait.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controlerDepot, texteCatalogue } from './controles.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const { erreurs, profils } = controlerDepot(RACINE);
if (erreurs.length) {
  for (const { fichier, defauts } of erreurs) console.error(`REFUSÉ  ${fichier}\n  - ${defauts.join('\n  - ')}`);
  process.exit(1);
}
writeFileSync(join(RACINE, 'catalogue.json'), texteCatalogue(profils));
console.log(`catalogue.json : ${profils.length} profil(s).`);
