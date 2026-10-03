// Contrôles d'un dépôt de profils : chaque fonction rend la liste de ses
// défauts, tableau vide = accepté. Aucune ne modifie un fichier.
//
// Le schéma (`schema.json`) est vérifié par Ajv ; ce qui suit est ce qu'un
// schéma ne sait pas dire, plus les fichiers qui accompagnent un profil.
// Miroir de `src/data/validerProfil.ts` et `scripts/generer-profils.mjs` du
// dépôt `mobile` : une règle changée ici se reporte là-bas.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

/** Dossiers d'un dépôt de profils, relatifs à sa racine. */
export const DOSSIERS = { profils: 'profils', icones: 'icones', images: 'images' };

/** Taille maximale d'une icône de compteur, en octets. */
export const TAILLE_MAX_SVG = 8192;
/** Taille maximale d'une image de profil, en octets. */
export const TAILLE_MAX_PNG = 32768;
/** Côté d'une image de profil, en pixels (affichée en 22 points). */
export const COTE_PNG = 96;

export const NOM_SVG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.svg$/;
export const NOM_PNG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.png$/;

/** Raisons de refuser une icône SVG (texte déjà débarrassé des blancs de bord). */
export function defautsSvg(texte) {
  const defauts = [];
  if (Buffer.byteLength(texte, 'utf8') > TAILLE_MAX_SVG) defauts.push(`plus de ${TAILLE_MAX_SVG} octets`);
  if (!/^<svg[\s>]/.test(texte)) defauts.push('ne commence pas par <svg');
  if (!/<\/svg>$/.test(texte)) defauts.push('ne finit pas par </svg>');
  if (!/\sviewBox="[^"]+"/.test(texte)) defauts.push('viewBox absent');
  if (/<script|<foreignObject|<iframe|<!ENTITY|<!DOCTYPE|<\?xml/i.test(texte)) defauts.push('élément interdit');
  if (/\son[a-z]+\s*=/i.test(texte)) defauts.push('attribut d’événement (on…)');
  if (/(xlink:)?href\s*=\s*"(?!#)/i.test(texte)) defauts.push('lien externe');
  if (/url\(\s*['"]?(?!#)/i.test(texte)) defauts.push('url() externe');
  if (/javascript:/i.test(texte)) defauts.push('javascript:');
  return defauts;
}

const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Raisons de refuser une image de profil PNG. */
export function defautsPng(octets) {
  const defauts = [];
  if (octets.length > TAILLE_MAX_PNG) defauts.push(`plus de ${TAILLE_MAX_PNG} octets`);
  // Signature, puis le premier bloc, IHDR : largeur et hauteur sur 4 octets.
  if (octets.length < 24 || !octets.subarray(0, 8).equals(SIGNATURE_PNG) || octets.toString('ascii', 12, 16) !== 'IHDR') {
    defauts.push('pas une image PNG');
    return defauts;
  }
  const largeur = octets.readUInt32BE(16);
  const hauteur = octets.readUInt32BE(20);
  if (largeur !== COTE_PNG || hauteur !== COTE_PNG) {
    defauts.push(`${largeur} × ${hauteur} pixels, ${COTE_PNG} × ${COTE_PNG} attendus`);
  }
  return defauts;
}

/** Règles d'un profil qu'un schéma JSON ne sait pas dire. */
export function defautsHorsSchema(profil) {
  const defauts = [];
  const j = profil.players;
  if (!(j.min <= j.default && j.default <= j.max)) defauts.push('players : min ≤ default ≤ max attendu');
  const ids = profil.counters.map((c) => c.id);
  if (new Set(ids).size !== ids.length) defauts.push('counters : identifiants en double');
  return defauts;
}

/**
 * Langues complètes d'un profil : celles que portent tous ses textes — nom,
 * description, nom de chaque compteur. Un texte écrit dans une seule langue
 * n'y entre pas : c'est un nom propre (« Flip 7 »), valable partout. Sauf si
 * tous le sont : la langue est alors celle-là.
 */
export function languesCompletes(profil) {
  const tous = [profil.name, profil.description, ...profil.counters.map((c) => c.name)].filter(Boolean);
  const traduits = tous.filter((t) => Object.keys(t).length > 1);
  const textes = traduits.length ? traduits : tous;
  const [premier, ...autres] = textes.map((t) => Object.keys(t));
  return premier.filter((l) => autres.every((a) => a.includes(l))).sort();
}

function lister(racine, dossier, extension) {
  const chemin = join(racine, dossier);
  if (!existsSync(chemin)) return [];
  return readdirSync(chemin)
    .filter((f) => statSync(join(chemin, f)).isFile())
    .filter((f) => !extension || f.endsWith(extension))
    .sort();
}

/**
 * Contrôle tout un dépôt de profils.
 * Rend `{ erreurs, avertissements, profils }` : les erreurs par fichier
 * (`{ fichier, defauts }`), les avertissements en phrases, et les profils
 * acceptés (`{ fichier, profil }`).
 */
export function controlerDepot(racine) {
  const schema = JSON.parse(readFileSync(join(racine, 'schema.json'), 'utf8'));
  const valider = new Ajv2020({ allErrors: true }).compile(schema);
  const erreurs = [];
  const avertissements = [];
  const profils = [];
  const refuser = (fichier, defauts) => defauts.length && erreurs.push({ fichier, defauts });

  const icones = new Set();
  for (const f of lister(racine, DOSSIERS.icones)) {
    const fichier = `${DOSSIERS.icones}/${f}`;
    if (!NOM_SVG.test(f)) { refuser(fichier, ['nom refusé (lettres, chiffres, - et _, terminé par .svg)']); continue; }
    const defauts = defautsSvg(readFileSync(join(racine, fichier), 'utf8').trim());
    refuser(fichier, defauts);
    if (!defauts.length) icones.add(f);
  }

  const images = new Set();
  for (const f of lister(racine, DOSSIERS.images)) {
    const fichier = `${DOSSIERS.images}/${f}`;
    if (!NOM_PNG.test(f)) { refuser(fichier, ['nom refusé (lettres, chiffres, - et _, terminé par .png)']); continue; }
    const defauts = defautsPng(readFileSync(join(racine, fichier)));
    refuser(fichier, defauts);
    if (!defauts.length) images.add(f);
  }

  const iconesEmployees = new Set();
  const imagesEmployees = new Set();
  for (const f of lister(racine, DOSSIERS.profils)) {
    const fichier = `${DOSSIERS.profils}/${f}`;
    if (!f.endsWith('.json')) { refuser(fichier, ['seuls des fichiers .json vont ici']); continue; }
    let profil;
    try {
      profil = JSON.parse(readFileSync(join(racine, fichier), 'utf8'));
    } catch (e) {
      refuser(fichier, [`JSON illisible : ${e.message}`]);
      continue;
    }
    if (!valider(profil)) {
      refuser(fichier, valider.errors.map((e) => `${e.instancePath || '/'} ${e.message}${e.params?.additionalProperty ? ` (« ${e.params.additionalProperty} »)` : ''}`));
      continue;
    }
    const defauts = defautsHorsSchema(profil);
    if (`${profil.id}.json` !== f) defauts.push(`fichier à nommer d’après l’id : ${profil.id}.json`);
    if (profil.icon) {
      imagesEmployees.add(profil.icon);
      if (!images.has(profil.icon)) defauts.push(`icon : ${DOSSIERS.images}/${profil.icon} absent ou refusé`);
    }
    profil.counters.forEach((c, i) => {
      if (!c.icon) return;
      iconesEmployees.add(c.icon);
      if (!icones.has(c.icon)) defauts.push(`counters[${i}].icon : ${DOSSIERS.icones}/${c.icon} absent ou refusé`);
    });
    refuser(fichier, defauts);
    if (!defauts.length) profils.push({ fichier, profil });
  }

  for (const f of icones) if (!iconesEmployees.has(f)) avertissements.push(`${DOSSIERS.icones}/${f} n’est employée par aucun profil`);
  for (const f of images) if (!imagesEmployees.has(f)) avertissements.push(`${DOSSIERS.images}/${f} n’est employée par aucun profil`);
  return { erreurs, avertissements, profils };
}

/** Catalogue de tous les profils acceptés, trié par id ; aucune date, pour rester stable. */
export function catalogue(profils) {
  return {
    schema: 1,
    profils: profils
      .map(({ fichier, profil }) => ({
        id: profil.id,
        schema: profil.schema,
        version: profil.version,
        name: profil.name,
        ...(profil.description ? { description: profil.description } : {}),
        langues: languesCompletes(profil),
        icon: profil.icon,
        fichier,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/** Texte du fichier `catalogue.json`, tel qu'il doit être écrit. */
export function texteCatalogue(profils) {
  return `${JSON.stringify(catalogue(profils), null, 2)}\n`;
}
