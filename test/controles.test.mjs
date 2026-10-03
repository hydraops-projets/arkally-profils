// Tests du contrôle : `npm test` (node --test). Chaque refus est éprouvé sur
// une copie du dépôt, dans un dossier temporaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controlerDepot, defautsPng, defautsSvg, languesCompletes, texteCatalogue } from '../scripts/controles.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Copie du dépôt (sans node_modules), modifiée par `preparer`, puis contrôlée. */
function controlerCopie(preparer) {
  const dossier = mkdtempSync(join(tmpdir(), 'profils-'));
  try {
    for (const f of ['schema.json', 'profils', 'icones', 'images']) cpSync(join(RACINE, f), join(dossier, f), { recursive: true });
    preparer(dossier);
    return controlerDepot(dossier);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

function modifierMtg(modifier) {
  return (dossier) => {
    const chemin = join(dossier, 'profils/mtg.json');
    const p = JSON.parse(readFileSync(chemin, 'utf8'));
    modifier(p);
    writeFileSync(chemin, JSON.stringify(p));
  };
}

const refusesMtg = (r) => r.erreurs.filter((e) => e.fichier === 'profils/mtg.json');

test('le dépôt est accepté et son catalogue à jour', () => {
  const { erreurs, profils } = controlerDepot(RACINE);
  assert.deepEqual(erreurs, []);
  assert.equal(readFileSync(join(RACINE, 'catalogue.json'), 'utf8'), texteCatalogue(profils));
});

test('le script de contrôle réussit sur le dépôt', () => {
  assert.doesNotThrow(() => execFileSync('node', ['scripts/verifier.mjs'], { cwd: RACINE, stdio: 'pipe' }));
});

test('profil refusé par le schéma', async (t) => {
  const cas = {
    'champ inconnu': (p) => { p.couleur = 'rouge'; },
    'nom en chaîne simple': (p) => { p.name = 'Magic'; },
    'ancien champ iconsvg': (p) => { p.counters[3].iconsvg = 'MTG-planeswalker.svg'; },
    'icône hors du dossier': (p) => { p.counters[0].icon = '../secret.svg'; },
    'bigStep absent du principal': (p) => { delete p.counters[0].bigStep; },
    'bigStep sur un secondaire': (p) => { p.counters[1].bigStep = 5; },
    'deux compteurs principaux': (p) => { p.counters[1].primary = true; p.counters[1].bigStep = 5; },
    'format plus récent': (p) => { p.schema = 2; },
  };
  for (const [titre, modifier] of Object.entries(cas)) {
    await t.test(titre, () => assert.notDeepEqual(refusesMtg(controlerCopie(modifierMtg(modifier))), []));
  }
});

test('profil refusé hors du schéma', async (t) => {
  const cas = {
    'joueurs : défaut hors bornes': (p) => { p.players = { min: 3, max: 6, default: 2 }; },
    'identifiants de compteur en double': (p) => { p.counters[2].id = p.counters[1].id; },
    'id différent du nom de fichier': (p) => { p.id = 'magic'; },
    'icône absente': (p) => { p.counters[0].icon = 'inconnue.svg'; },
    'image absente': (p) => { p.icon = 'inconnue.png'; },
  };
  for (const [titre, modifier] of Object.entries(cas)) {
    await t.test(titre, () => assert.notDeepEqual(refusesMtg(controlerCopie(modifierMtg(modifier))), []));
  }
});

test('JSON illisible refusé', () => {
  const r = controlerCopie((d) => writeFileSync(join(d, 'profils/mtg.json'), '{ "schema": 1,'));
  assert.match(refusesMtg(r)[0].defauts[0], /JSON illisible/);
});

test('un SVG dangereux est refusé, et le profil qui l’emploie aussi', () => {
  assert.deepEqual(defautsSvg('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>'), []);
  for (const svg of [
    '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>',
    '<svg viewBox="0 0 1 1" onload="x()"></svg>',
    '<svg viewBox="0 0 1 1"><image href="https://a.b/c.png"/></svg>',
    '<svg viewBox="0 0 1 1"><path fill="url(https://a.b)"/></svg>',
    '<svg viewBox="0 0 1 1"><a xlink:href="javascript:x()"/></svg>',
    `<svg viewBox="0 0 1 1"><path d="${'M0 0 '.repeat(2000)}"/></svg>`,
    '<svg><path d="M0 0"/></svg>',
  ]) assert.notDeepEqual(defautsSvg(svg), [], svg);

  const r = controlerCopie((d) => writeFileSync(join(d, 'icones/heart-outline.svg'), '<svg viewBox="0 0 1 1" onload="x()"></svg>'));
  assert.ok(r.erreurs.some((e) => e.fichier === 'icones/heart-outline.svg'));
  assert.ok(refusesMtg(r).length);
});

test('une image hors format est refusée', () => {
  assert.deepEqual(defautsPng(readFileSync(join(RACINE, 'images/MTG.png'))), []);
  assert.notDeepEqual(defautsPng(Buffer.from('pas une image')), []);
  const grande = Buffer.from(readFileSync(join(RACINE, 'images/MTG.png')));
  grande.writeUInt32BE(512, 16);
  assert.match(defautsPng(grande).join(), /512 × 96/);
  assert.match(defautsPng(Buffer.concat([readFileSync(join(RACINE, 'images/MTG.png')), Buffer.alloc(40000)])).join(), /octets/);
});

test('langues complètes : un nom propre ne les restreint pas', () => {
  const nom = { en: 'Flip 7' };
  const score = { fr: 'Score', en: 'Score', es: 'Puntuación' };
  assert.deepEqual(languesCompletes({ name: nom, description: nom, counters: [{ name: score }] }), ['en', 'es', 'fr']);
  assert.deepEqual(languesCompletes({ name: nom, counters: [{ name: score }, { name: { fr: 'Vie', en: 'Life' } }] }), ['en', 'fr']);
  assert.deepEqual(languesCompletes({ name: nom, counters: [{ name: { fr: 'Score' } }] }), []);
});
