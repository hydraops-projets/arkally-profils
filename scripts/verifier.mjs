#!/usr/bin/env node
// Contrôle du dépôt, rejoué par GitHub sur chaque proposition.
//
//   node scripts/verifier.mjs
//   node scripts/verifier.mjs --modifies <liste> --apercu <url> --resume <fichier.md>
//
// --modifies : fichier qui liste les chemins changés par la proposition, un par
//              ligne — les profils et icônes qu'elle apporte sont montrés en tête ;
// --apercu   : adresse où lire les fichiers de la proposition (raw.githubusercontent…),
//              pour afficher ses icônes dans le résumé ;
// --resume   : fichier Markdown où écrire le résumé (GITHUB_STEP_SUMMARY sur GitHub).
//
// Échoue (code 1) sur tout fichier refusé ou un catalogue pas à jour. Ne regarde
// pas les langues : la relecture des traductions se fait à la validation.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DOSSIERS, controlerDepot, texteCatalogue } from './controles.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values: options } = parseArgs({
  options: { modifies: { type: 'string' }, apercu: { type: 'string' }, resume: { type: 'string' } },
});

/** Ce qu'une proposition de profil a à toucher ; le reste se relit de près. */
const PERIMETRE = [`${DOSSIERS.profils}/`, `${DOSSIERS.icones}/`, `${DOSSIERS.images}/`, 'catalogue.json'];

const { erreurs, avertissements, profils } = controlerDepot(RACINE);
const catalogueAJour =
  existsSync(join(RACINE, 'catalogue.json')) && readFileSync(join(RACINE, 'catalogue.json'), 'utf8') === texteCatalogue(profils);
const modifies = options.modifies
  ? readFileSync(options.modifies, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  : [];
const horsPerimetre = modifies.filter((f) => !PERIMETRE.some((p) => f === p || f.startsWith(p)));

// Console : ce que lit celui qui lance le script à la main.
for (const { fichier, defauts } of erreurs) console.error(`REFUSÉ  ${fichier}\n  - ${defauts.join('\n  - ')}`);
for (const a of avertissements) console.warn(`NOTE    ${a}`);
if (!catalogueAJour) console.error('REFUSÉ  catalogue.json pas à jour : node scripts/generer-catalogue.mjs');
if (horsPerimetre.length) console.warn(`NOTE    hors des profils, icônes et images : ${horsPerimetre.join(', ')}`);
const ok = erreurs.length === 0 && catalogueAJour;
console.log(ok ? `ACCEPTÉ ${profils.length} profil(s).` : 'Contrôle en échec.');

if (options.resume) appendFileSync(options.resume, resume());
process.exit(ok ? 0 : 1);

function echapper(t) {
  return String(t).replace(/[&<>|]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '|': '&#124;' })[c]);
}

function texte(t) {
  return echapper(t?.fr ?? t?.en ?? Object.values(t ?? {})[0] ?? '');
}

function image(chemin, taille) {
  if (!options.apercu) return '';
  return `<img src="${options.apercu.replace(/\/$/, '')}/${chemin}" width="${taille}" height="${taille}">`;
}

/** Résumé Markdown : verdict, refus, puis aperçu de ce que la proposition apporte. */
function resume() {
  const l = [`## ${ok ? '✅ Proposition acceptée par le contrôle' : '❌ Proposition refusée par le contrôle'}`, ''];
  l.push('Ni les traductions ni le contenu ne sont jugés ici : ils sont relus à la validation.', '');
  if (erreurs.length || !catalogueAJour) {
    l.push('### À corriger', '');
    for (const { fichier, defauts } of erreurs) l.push(`- \`${fichier}\``, ...defauts.map((d) => `  - ${echapper(d)}`));
    if (!catalogueAJour) l.push('- `catalogue.json` n’est pas à jour : `node scripts/generer-catalogue.mjs` (ou laisser : il est refait à la validation)');
    l.push('');
  }
  if (horsPerimetre.length || avertissements.length) {
    l.push('### À regarder', '');
    if (horsPerimetre.length) l.push(`- ⚠️ La proposition touche autre chose que des profils, icônes et images : ${horsPerimetre.map((f) => `\`${f}\``).join(', ')}`);
    for (const a of avertissements) l.push(`- ${echapper(a)}`);
    l.push('');
  }

  const apportes = modifies.length ? profils.filter((p) => modifies.includes(p.fichier)) : profils;
  const iconesApportees = modifies.filter((f) => f.startsWith(`${DOSSIERS.icones}/`) && existsSync(join(RACINE, f)));
  if (apportes.length) l.push(`### ${modifies.length ? 'Profils de la proposition' : 'Profils'}`, '');
  for (const { profil } of apportes) {
    const img = profil.icon ? `${image(`${DOSSIERS.images}/${profil.icon}`, 48)} ` : '';
    l.push(`#### ${img}${texte(profil.name)} — \`${profil.id}\` ${profil.version}`, '');
    if (profil.description) l.push(texte(profil.description), '');
    l.push(`Joueurs : ${profil.players.min} à ${profil.players.max}, ${profil.players.default} par défaut.`, '');
    l.push('| Icône | Compteur | Départ | Bornes | Défaite | Victoire | Pas |', '|---|---|---|---|---|---|---|');
    for (const c of profil.counters) {
      const icone = c.icon ? `${image(`${DOSSIERS.icones}/${c.icon}`, 32)} \`${c.icon}\`` : '—';
      const bornes = c.min !== undefined || c.max !== undefined ? `${c.min ?? '…'} à ${c.max ?? '…'}` : '—';
      const pas = `${c.step ?? 1}${c.bigStep ? ` / ${c.bigStep}` : ''}`;
      l.push(`| ${icone} | ${c.primary ? '**' : ''}${texte(c.name)}${c.primary ? '**' : ''} | ${c.initial} | ${bornes} | ${c.loseAt ?? '—'} | ${c.winAt ?? '—'} | ${pas} |`);
    }
    l.push('');
  }
  if (iconesApportees.length) {
    l.push('### Icônes de la proposition', '', 'Dessinées en noir : l’application les peint à la couleur du compteur.', '');
    l.push(iconesApportees.map((f) => `${image(f, 48)} \`${f.slice(DOSSIERS.icones.length + 1)}\``).join(' &nbsp; '), '');
  }
  return `${l.join('\n')}\n`;
}
