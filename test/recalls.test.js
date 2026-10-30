import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import {
  categoryKey,
  concerns,
  DATASETS,
  extractBarcodes,
  fetchRecalls,
  findRecallsByBarcode,
  latestVersions,
  normalizeBarcode,
  parseRecall,
  retailerScope,
} from '../src/leclerc/recalls.js';
import { fakeFetch, v1Record, v2Record } from './helpers/fixtures.js';

test('a record of the current dataset', () => {
  const recall = parseRecall(v2Record());
  assert.equal(recall.reference, '2026-10-0001');
  assert.equal(recall.categoryKey, 'food');
  assert.equal(recall.brand, 'Marque Repère');
  assert.equal(recall.product, 'Yaourt nature 4x125 g');
  assert.equal(recall.namesLeclerc, true);
  assert.deepEqual(recall.barcodes, ['03564700012345']);
  assert.equal(recall.image, 'https://rappel.conso.gouv.fr/image/1.jpg');
  assert.equal(recall.publishedAt, '2026-10-28T09:00:00.000Z');
});

test('a record of the historical dataset reads the same', () => {
  const recall = parseRecall(v1Record());
  assert.equal(recall.reference, '2026-09-0042');
  assert.equal(recall.version, 2);
  assert.equal(recall.categoryKey, 'baby');
  assert.equal(recall.product, 'Hochet lapin');
  assert.equal(recall.namesLeclerc, false);
  assert.equal(recall.allRetailers, true);
  assert.deepEqual(recall.barcodes, ['00000012345678']);
  assert.equal(recall.reason, 'Petites pièces détachables');
});

test('a record without a reference is skipped', () => {
  assert.equal(parseRecall({ distributeurs: 'Leclerc' }), null);
});

test('categories are read without accents, unknown ones are "other"', () => {
  assert.equal(categoryKey('Hygiène-Beauté'), 'hygiene');
  assert.equal(categoryKey('Appareils électriques, Outils'), 'electrical');
  assert.equal(categoryKey('Automobiles et moyens de déplacement'), 'vehicles');
  assert.equal(categoryKey('Something new'), 'other');
});

test('who sold it, as typed by hand in the register', () => {
  assert.deepEqual(retailerScope('LECLERC, Carrefour'), {
    namesLeclerc: true,
    allRetailers: false,
  });
  assert.deepEqual(retailerScope('E. Leclerc'), { namesLeclerc: true, allRetailers: false });
  assert.deepEqual(retailerScope('Grandes et moyennes surfaces'), {
    namesLeclerc: false,
    allRetailers: true,
  });
  assert.deepEqual(retailerScope('Auchan'), { namesLeclerc: false, allRetailers: false });
  // A word containing "leclerc" is not E.Leclerc.
  assert.equal(retailerScope('Leclercq frères').namesLeclerc, false);
});

test('the scope and the categories of the configuration filter the recalls', () => {
  const named = parseRecall(v2Record());
  const everywhere = parseRecall(v1Record());
  const elsewhere = parseRecall(v2Record({ distributeurs: 'Auchan' }));
  const all = normalizeConfig({});
  assert.equal(concerns(named, all), true);
  assert.equal(concerns(everywhere, all), true);
  assert.equal(concerns(elsewhere, all), false);

  const leclercOnly = normalizeConfig({ recall_scope: 'leclerc' });
  assert.equal(concerns(everywhere, leclercOnly), false);

  const foodOnly = normalizeConfig({ recall_categories: ['food'] });
  assert.equal(concerns(named, foodOnly), true);
  assert.equal(concerns(everywhere, foodOnly), false);
});

test('barcodes: extracted from free text, compared as GTIN-14', () => {
  assert.deepEqual(extractBarcodes('GTIN 3017620422003 lot 1234 / 76543210'), [
    '3017620422003',
    '76543210',
  ]);
  assert.equal(normalizeBarcode('3 017620 422003'), '03017620422003');
  assert.equal(normalizeBarcode('123'), null);
});

test('one recall per notice, its latest version, newest first', () => {
  const recalls = latestVersions([
    parseRecall(v2Record({ numero_version: 1, motif_rappel: 'old' })),
    parseRecall(v2Record({ numero_version: 2, motif_rappel: 'new' })),
    parseRecall(v1Record()),
  ]);
  assert.deepEqual(
    recalls.map((recall) => [recall.reference, recall.reason]),
    [
      ['2026-10-0001', 'new'],
      ['2026-09-0042', 'Petites pièces détachables'],
    ],
  );
});

test('fetchRecalls asks for the window, newest first, page after page', async () => {
  const page = (count, offset) =>
    Array.from({ length: count }, (_, i) =>
      v2Record({ numero_fiche: `ref-${offset + i}`, date_publication: '2026-10-20' }),
    );
  const fetchImpl = fakeFetch((url) => {
    const offset = Number(url.searchParams.get('offset'));
    return { body: { results: offset === 0 ? page(100, 0) : page(3, 100) } };
  });
  const recalls = await fetchRecalls({ since: new Date('2026-09-30T10:00:00Z'), fetchImpl });
  assert.equal(recalls.length, 103);
  assert.equal(fetchImpl.calls.length, 2);
  const [first] = fetchImpl.calls;
  assert.equal(first.pathname.includes(DATASETS[0].id), true);
  assert.equal(first.searchParams.get('where'), "date_publication >= date'2026-09-30'");
  assert.equal(first.searchParams.get('order_by'), 'date_publication desc');
  assert.equal(first.searchParams.get('limit'), '100');
});

test('fetchRecalls falls back to the historical dataset when the current one is gone', async () => {
  const fetchImpl = fakeFetch((url) =>
    url.pathname.includes(DATASETS[0].id) ? { status: 404 } : { body: { results: [v1Record()] } },
  );
  const recalls = await fetchRecalls({ since: new Date('2026-09-01'), fetchImpl });
  assert.equal(recalls.length, 1);
  assert.equal(
    fetchImpl.calls[1].searchParams.get('where'),
    "date_de_publication >= date'2026-09-01'",
  );
});

test('any other error is not hidden by the fallback', async () => {
  const fetchImpl = fakeFetch(() => ({ status: 503 }));
  await assert.rejects(fetchRecalls({ since: new Date(), fetchImpl }), /HTTP 503/);
  assert.equal(fetchImpl.calls.length, 1);
});

test('a barcode is searched in full text, then matched exactly', async () => {
  const fetchImpl = fakeFetch(() => ({
    body: {
      results: [
        v2Record(),
        // Quoted in a lot number, not as the barcode of the product.
        v2Record({ numero_fiche: 'other', identification_produits: 'Lot 35647000123450' }),
      ],
    },
  }));
  const recalls = await findRecallsByBarcode('3564700012345', { fetchImpl });
  assert.deepEqual(
    recalls.map((recall) => recall.reference),
    ['2026-10-0001'],
  );
  assert.equal(fetchImpl.calls[0].searchParams.get('where'), '"3564700012345"');
  await assert.rejects(findRecallsByBarcode('abc', { fetchImpl }), /Invalid barcode/);
});
