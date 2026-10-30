// -----------------------------------------------------------------------------
// Product recalls, from RappelConso: the official French recall register,
// published as open data by the Ministry of the Economy (no account, no key).
//
// The API is the Opendatasoft "explore v2.1" API of data.economie.gouv.fr. The
// register exists as two datasets: the current one (`rappelconso-v2-...`) and
// the historical one (`rappelconso0`), whose field names differ. Both are read
// through `parseRecall`, which accepts either naming, and the client falls back
// to the historical dataset when the current one answers 404.
//
// The register says WHO sold a product in a free-text `distributeurs` field:
// "E.Leclerc", "Leclerc, Carrefour", "Tous distributeurs", "GMS"... Which
// recalls concern an E.Leclerc customer is decided here, from that text, never
// by the server: a full-text query would miss "Tous distributeurs".
// -----------------------------------------------------------------------------

import { getJson, HttpError } from './http.js';

const API = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets';

/** The datasets, current first, with the name of their publication date field. */
export const DATASETS = [
  { id: 'rappelconso-v2-gtin-espaces', dateField: 'date_publication' },
  { id: 'rappelconso0', dateField: 'date_de_publication' },
];

/** The API serves 100 records a page at most. */
const PAGE_SIZE = 100;
/** A safety net: about 15 recalls are published a day, 90 days fit in 14 pages. */
const MAX_PAGES = 20;

/**
 * The product categories of RappelConso, keyed as the manifest options.
 * `match` is tested on the category without accents, in lower case. Keys are
 * stored in the users' configuration and scene filters: never rename them.
 */
export const RECALL_CATEGORIES = {
  food: {
    match: /^alimentation/,
    label: { en: 'Food', fr: 'Alimentation', de: 'Lebensmittel', es: 'Alimentación' },
  },
  baby: {
    match: /^bebe/,
    label: { en: 'Baby & children', fr: 'Bébés-Enfants', de: 'Baby & Kinder', es: 'Bebés y niños' },
  },
  hygiene: {
    match: /^hygiene/,
    label: {
      en: 'Hygiene & beauty',
      fr: 'Hygiène-Beauté',
      de: 'Hygiene & Schönheit',
      es: 'Higiene y belleza',
    },
  },
  pets: {
    match: /^animaux/,
    label: { en: 'Pets', fr: 'Animaux', de: 'Haustiere', es: 'Animales' },
  },
  home: {
    match: /^maison/,
    label: { en: 'Home', fr: 'Maison-Habitat', de: 'Haus & Wohnen', es: 'Hogar' },
  },
  electrical: {
    match: /^appareils/,
    label: {
      en: 'Appliances & tools',
      fr: 'Appareils électriques, outils',
      de: 'Elektrogeräte & Werkzeug',
      es: 'Aparatos y herramientas',
    },
  },
  clothing: {
    match: /^vetements/,
    label: { en: 'Clothing', fr: 'Vêtements, mode', de: 'Kleidung', es: 'Ropa' },
  },
  leisure: {
    match: /^sports/,
    label: {
      en: 'Sports & leisure',
      fr: 'Sports-loisirs',
      de: 'Sport & Freizeit',
      es: 'Deporte y ocio',
    },
  },
  vehicles: {
    match: /^automobiles|^vehicules|moyens de deplacement/,
    label: { en: 'Vehicles', fr: 'Automobiles', de: 'Fahrzeuge', es: 'Vehículos' },
  },
  other: {
    match: null,
    label: { en: 'Other', fr: 'Autres', de: 'Sonstiges', es: 'Otros' },
  },
};

/** Lower case, no accents: the register is typed by hand and is not consistent. */
export function plain(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** The category key of a register category text, `other` when none matches. */
export function categoryKey(category) {
  const text = plain(category);
  const found = Object.entries(RECALL_CATEGORIES).find(([, { match }]) => match?.test(text));
  return found ? found[0] : 'other';
}

const NAMES_LECLERC = /\bleclerc\b/;
const ALL_RETAILERS =
  /tous (les )?distributeurs|toutes (les )?enseignes|tous (les )?magasins|grandes? et moyennes? surfaces|\bgms\b|grande distribution|hypermarches|supermarches/;

/** Where a recalled product was sold, as far as E.Leclerc goes. */
export function retailerScope(retailers) {
  const text = plain(retailers);
  return {
    namesLeclerc: NAMES_LECLERC.test(text),
    allRetailers: ALL_RETAILERS.test(text),
  };
}

/** First non-empty value among the keys (both datasets name things differently). */
function first(record, ...keys) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value) && value.length > 0) {
      return value.join(' ');
    }
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

/** The barcodes (GTIN-8, 12, 13 or 14) a text quotes. */
export function extractBarcodes(text) {
  return [...String(text ?? '').matchAll(/(?<!\d)(\d{8}|\d{12,14})(?!\d)/g)].map(
    ([digits]) => digits,
  );
}

/** A barcode in a comparable form: digits only, padded to 14 (GTIN-14). */
export function normalizeBarcode(barcode) {
  const digits = String(barcode ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits.padStart(14, '0') : null;
}

/**
 * One record of either dataset, as the integration uses it. `null` for a
 * record without a reference: nothing would identify it from one read to the
 * next.
 */
export function parseRecall(record = {}) {
  const reference = first(record, 'numero_fiche', 'reference_fiche', 'rappel_guid', 'rappelguid');
  if (!reference) {
    return null;
  }
  const category = first(record, 'categorie_produit', 'categorie_de_produit');
  const retailers = first(record, 'distributeurs');
  const identification = first(record, 'identification_produits', 'identification_des_produits');
  const published = new Date(first(record, 'date_publication', 'date_de_publication'));
  const image = first(record, 'liens_vers_les_images')
    .split(/[\s|,]+/)
    .find((url) => url.startsWith('https://'));
  return {
    reference,
    version: Number(first(record, 'numero_version', 'ndeg_de_version')) || 1,
    category,
    categoryKey: categoryKey(category),
    subCategory: first(record, 'sous_categorie_produit', 'sous_categorie_de_produit'),
    brand: first(record, 'marque_produit', 'nom_de_la_marque_du_produit'),
    product: first(
      record,
      'libelle',
      'modeles_ou_references',
      'noms_des_modeles_ou_references',
      'sous_categorie_produit',
    ),
    retailers,
    ...retailerScope(retailers),
    barcodes: [
      ...new Set(
        [...extractBarcodes(identification), ...extractBarcodes(first(record, 'gtin'))]
          .map(normalizeBarcode)
          .filter(Boolean),
      ),
    ],
    reason: first(record, 'motif_rappel', 'motif_du_rappel'),
    risks: first(record, 'risques_encourus', 'risques_encourus_par_le_consommateur'),
    advice: first(record, 'conduites_a_tenir_par_le_consommateur'),
    link: first(record, 'lien_vers_la_fiche_rappel'),
    image: image ?? null,
    publishedAt: Number.isNaN(published.getTime()) ? null : published.toISOString(),
  };
}

/**
 * Whether a recall concerns the user, under the configured scope and
 * categories.
 * @param {ReturnType<typeof parseRecall>} recall
 * @param {{ recall_scope: string, recall_categories: string[] }} config
 */
export function concerns(recall, config) {
  const sold = recall.namesLeclerc || (config.recall_scope === 'all' && recall.allRetailers);
  const categories = config.recall_categories ?? [];
  return sold && (categories.length === 0 || categories.includes(recall.categoryKey));
}

/** One recall per reference, the latest version of its notice, newest first. */
export function latestVersions(recalls) {
  const byReference = new Map();
  for (const recall of recalls) {
    const known = byReference.get(recall.reference);
    if (!known || recall.version > known.version) {
      byReference.set(recall.reference, recall);
    }
  }
  return [...byReference.values()].sort((a, b) =>
    String(b.publishedAt).localeCompare(String(a.publishedAt)),
  );
}

/** Query one dataset, page after page. */
async function queryDataset(dataset, params, fetchImpl, pages = MAX_PAGES) {
  const records = [];
  for (let page = 0; page < pages; page += 1) {
    const query = new URLSearchParams({
      ...params,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    const body = await getJson(`${API}/${dataset.id}/records?${query}`, fetchImpl);
    const results = Array.isArray(body?.results) ? body.results : [];
    records.push(...results);
    if (results.length < PAGE_SIZE) {
      break;
    }
  }
  return records;
}

/** Run a query on the current dataset, on the historical one if it is gone. */
async function withFallback(buildParams, fetchImpl, pages) {
  let lastError;
  for (const dataset of DATASETS) {
    try {
      return await queryDataset(dataset, buildParams(dataset), fetchImpl, pages);
    } catch (err) {
      if (!(err instanceof HttpError) || err.status !== 404) {
        throw err;
      }
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Every recall published since `since`, newest first (all retailers: filter
 * with `concerns`).
 * @param {{ since: Date, fetchImpl?: typeof fetch }} options
 */
export async function fetchRecalls({ since, fetchImpl = fetch }) {
  const day = since.toISOString().slice(0, 10);
  const records = await withFallback(
    ({ dateField }) => ({
      where: `${dateField} >= date'${day}'`,
      order_by: `${dateField} desc`,
    }),
    fetchImpl,
  );
  return latestVersions(records.map(parseRecall).filter(Boolean));
}

/**
 * The recalls that quote a barcode, whatever their age and their retailer.
 * The server runs a full-text search; the exact barcode is checked here.
 * @param {string} barcode
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export async function findRecallsByBarcode(barcode, { fetchImpl = fetch } = {}) {
  const wanted = normalizeBarcode(barcode);
  if (!wanted) {
    throw new Error(`Invalid barcode: ${barcode}`);
  }
  const digits = String(barcode).replace(/\D/g, '');
  const records = await withFallback(() => ({ where: `"${digits}"` }), fetchImpl, 1);
  return latestVersions(
    records
      .map(parseRecall)
      .filter(Boolean)
      .filter((recall) => recall.barcodes.includes(wanted)),
  );
}
