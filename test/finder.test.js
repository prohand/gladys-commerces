// The OpenStreetMap lookup of the `auto` stores, with a fake Overpass and an
// in-memory cache: nothing goes on the network nor on the disk.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoSearch,
  distanceMeters,
  HoursFinder,
  kindOf,
  nearbyShops,
  PER_KIND,
  nameMatches,
  nearestShops,
  overpassQuery,
  REFRESH_MS,
  RETRY_MS,
  searchKey,
  searchPattern,
} from '../src/shops/finder.js';
import { parseStores } from '../src/shops/stores.js';
import { fakeClock, fakeOverpass, HOUSES, memoryCache, OSM_SHOPS } from './helpers/fixtures.js';

test('auto and auto: words are lookups, anything else is hours', () => {
  assert.equal(autoSearch('auto', 'Leclerc'), 'leclerc');
  assert.equal(autoSearch(' AUTO ', 'Leclerc'), 'leclerc');
  assert.equal(autoSearch('auto: Pharmacie du Marché', 'Pharmacie'), 'pharmacie du marche');
  assert.equal(autoSearch('auto:', 'Leclerc'), 'leclerc');
  assert.equal(autoSearch('Mo-Sa 08:30-20:00', 'Leclerc'), null);
  assert.equal(autoSearch('automne', 'Leclerc'), null);
});

test('stores to look up wait for their hours, the others are read at once', () => {
  const { stores, errors } = parseStores(
    'Leclerc = auto | Pharmacie = auto: Pharmacie du Marché | Bio = 24/7 | Lidl | Super U = | auto: Boulangerie Dupont | auto',
  );
  assert.deepEqual(errors, ['auto']);
  assert.deepEqual(
    stores.map((store) => [store.id, store.name, store.search, store.error?.reason ?? null]),
    [
      ['leclerc', 'Leclerc', 'leclerc', 'pending'],
      ['pharmacie', 'Pharmacie', 'pharmacie du marche', 'pending'],
      ['bio', 'Bio', null, null],
      // A name alone, or nothing after `=`: looked up, the default.
      ['lidl', 'Lidl', 'lidl', 'pending'],
      ['super-u', 'Super U', 'super u', 'pending'],
      ['boulangerie-dupont', 'Boulangerie Dupont', 'boulangerie dupont', 'pending'],
    ],
  );
});

test('names: words in order, accents and case ignored', () => {
  assert.equal(searchKey('E.Leclerc  Bourges'), 'e leclerc bourges');
  assert.ok(nameMatches('E.Leclerc', 'leclerc'));
  assert.ok(nameMatches('Pharmacie du Marché', 'pharmacie marche'));
  assert.ok(!nameMatches('Pharmacie du Marché', 'marche pharmacie'));
  assert.ok(!nameMatches('Carrefour', 'leclerc'));
});

test('the query holds only letters, digits and accent classes from the user', () => {
  assert.equal(searchPattern('cafe 2'), '(c|ç|Ç)(a|à|â|ä|À|Â|Ä)f(e|é|è|ê|ë|É|È|Ê|Ë).*2');
  const query = overpassQuery({
    searches: [searchKey('Bob"); out; ("')],
    houses: HOUSES.slice(0, 1),
    radiusMeters: 10000,
  });
  assert.ok(!query.includes('");'), query);
  assert.match(query, /around:10000,47\.081,2\.3988/);
  assert.ok(query.includes('["name"~"b(o|ô|ö|Ô|Ö)b.*(o|ô|ö|Ô|Ö)(u|ù|û|ü|Ù|Û|Ü)t",i]'), query);
});

test('distance: Bourges to Vierzon is about 30 km', () => {
  const km = distanceMeters(HOUSES[0], HOUSES[1]) / 1000;
  assert.ok(km > 29 && km < 32, km);
});

test('the nearest shop of any house wins, within the radius', () => {
  const found = nearestShops(
    OSM_SHOPS,
    ['leclerc', 'pharmacie', 'pharmacie marche'],
    HOUSES,
    10000,
  );
  assert.equal(found.leclerc.name, 'E.Leclerc');
  assert.equal(found.leclerc.city, 'Bourges');
  assert.equal(found.leclerc.house, 'Maison');
  assert.equal(found.leclerc.osm, 'https://www.openstreetmap.org/way/101');
  // Two pharmacies: the one 60 m from a house beats the one 150 m from the other.
  assert.equal(found.pharmacie.name, 'Pharmacie Centrale');
  assert.equal(found['pharmacie marche'].house, 'Campagne');
  assert.deepEqual(nearestShops(OSM_SHOPS, ['leclerc'], HOUSES, 500), {});
});

function finderSetup({ houses = HOUSES, cache = memoryCache() } = {}) {
  const fetch = fakeOverpass(OSM_SHOPS);
  const clock = fakeClock('2026-10-30T10:00:00Z');
  const gladys = { houses, getHouses: async () => gladys.houses };
  const finder = new HoursFinder({ gladys, fetch, cache, now: clock });
  return { finder, fetch, clock, gladys, cache };
}

test('a lookup is kept a day, then made again', async () => {
  const { finder, fetch, clock, cache } = finderSetup();
  assert.equal(await finder.refresh({ searches: ['leclerc', 'zzz'], radiusKm: 10 }), true);
  assert.equal(finder.get('leclerc').hours, 'Mo-Sa 08:30-20:00; PH off');
  assert.deepEqual(finder.get('zzz'), { error: 'not_found', radiusKm: 10 });
  assert.equal(cache.saved.results.leclerc.name, 'E.Leclerc');
  assert.equal(fetch.queries.length, 1);

  clock.advance(60);
  assert.equal(await finder.refresh({ searches: ['leclerc', 'zzz'], radiusKm: 10 }), false);
  assert.equal(fetch.queries.length, 1);
  // A new search, a new radius: looked up at once.
  await finder.refresh({ searches: ['leclerc', 'pharmacie'], radiusKm: 10 });
  await finder.refresh({ searches: ['leclerc', 'pharmacie'], radiusKm: 5 });
  assert.equal(fetch.queries.length, 3);

  clock.advance(REFRESH_MS / 60_000);
  await finder.refresh({ searches: ['leclerc', 'pharmacie'], radiusKm: 5 });
  assert.equal(fetch.queries.length, 4);
});

test('lookups asked together run one after the other', async () => {
  const { finder, fetch } = finderSetup();
  let inFlight = 0;
  let most = 0;
  finder.fetch = async (...args) => {
    most = Math.max(most, (inFlight += 1));
    await new Promise((resolve) => setImmediate(resolve));
    inFlight -= 1;
    return fetch(...args);
  };
  await Promise.all([
    finder.refresh({ searches: ['leclerc'], radiusKm: 10 }),
    finder.refresh({ searches: ['pharmacie'], radiusKm: 10 }),
    finder.refresh({ searches: ['leclerc', 'pharmacie'], radiusKm: 10 }),
  ]);
  assert.equal(most, 1);
  assert.equal(finder.get('pharmacie').name, 'Pharmacie Centrale');
});

test('a restart reads the hours found before, without the network', async () => {
  const first = finderSetup();
  await first.finder.refresh({ searches: ['leclerc'], radiusKm: 10 });
  const again = finderSetup({ cache: first.cache });
  again.fetch.down = true;
  assert.equal(await again.finder.refresh({ searches: ['leclerc'], radiusKm: 10 }), false);
  assert.equal(again.finder.get('leclerc').name, 'E.Leclerc');
  assert.equal(again.fetch.queries.length, 0);
});

test('network down: the hours found stay, the others wait an hour', async () => {
  const { finder, fetch, clock } = finderSetup();
  await finder.refresh({ searches: ['leclerc'], radiusKm: 10 });
  fetch.down = true;
  clock.advance(REFRESH_MS / 60_000);
  await finder.refresh({ searches: ['leclerc', 'pharmacie'], radiusKm: 10 });
  assert.equal(finder.get('leclerc').name, 'E.Leclerc');
  assert.deepEqual(finder.get('pharmacie'), { error: 'unreachable' });
  const tries = fetch.queries.length;
  await finder.refresh({ searches: ['leclerc', 'pharmacie'], radiusKm: 10 });
  assert.equal(fetch.queries.length, tries);
  fetch.down = false;
  clock.advance(RETRY_MS / 60_000);
  await finder.refresh({ searches: ['leclerc', 'pharmacie'], radiusKm: 10 });
  assert.equal(finder.get('pharmacie').name, 'Pharmacie Centrale');
});

test('no located house, or no access to the houses: nothing is asked', async () => {
  const unlocated = finderSetup({ houses: [{ ...HOUSES[0], latitude: null, longitude: null }] });
  await unlocated.finder.refresh({ searches: ['leclerc'], radiusKm: 10 });
  assert.deepEqual(unlocated.finder.get('leclerc'), { error: 'no_house' });
  assert.equal(unlocated.fetch.queries.length, 0);
  // The house gets a location: looked up at the next refresh.
  unlocated.gladys.houses = HOUSES;
  await unlocated.finder.refresh({ searches: ['leclerc'], radiusKm: 10 });
  assert.equal(unlocated.finder.get('leclerc').name, 'E.Leclerc');

  const refused = finderSetup();
  refused.gladys.getHouses = async () => {
    throw new Error('403');
  };
  await refused.finder.refresh({ searches: ['leclerc'], radiusKm: 10 });
  assert.deepEqual(refused.finder.get('leclerc'), { error: 'no_access' });
});

test('no store to look up: no network, no disk', async () => {
  const { finder, fetch } = finderSetup({
    cache: {
      load: async () => assert.fail('read'),
      save: async () => assert.fail('written'),
    },
  });
  assert.equal(await finder.refresh({ searches: [], radiusKm: 10 }), false);
  assert.equal(fetch.queries.length, 0);
});

test('kinds: a tag, its values, an extra tag', () => {
  assert.equal(kindOf({ shop: 'pastry' }), 'bakery');
  assert.equal(kindOf({ amenity: 'recycling', recycling_type: 'centre' }), 'recycling_centre');
  assert.equal(kindOf({ amenity: 'recycling', recycling_type: 'container' }), null);
  assert.equal(kindOf({ shop: 'car' }), null);
});

test('the query: kinds per house, created shops by id', () => {
  const query = overpassQuery({
    kinds: ['supermarket', 'bakery', 'recycling_centre'],
    known: ['w101', 'n203', 'n9', 'x1'],
    houses: HOUSES,
    radiusMeters: 5000,
  });
  assert.ok(
    query.includes(
      'nwr["opening_hours"]["name"]["shop"~"^(supermarket|bakery|pastry)$"](around:5000,47.081,2.3988);',
    ),
    query,
  );
  assert.ok(
    query.includes(
      '["amenity"~"^(recycling)$"]["recycling_type"="centre"](around:5000,47.2219,2.0686);',
    ),
  );
  assert.ok(query.includes('  node(id:203,9);'));
  assert.ok(query.includes('  way(id:101);'));
  assert.ok(!query.includes('relation') && !query.includes('x1'));
  assert.ok(!query.includes('"brand"'), 'no search, no name line');
});

test('discovery: per house and per kind, the nearest ones, named shops only', () => {
  const nearby = nearbyShops(OSM_SHOPS, ['pharmacy', 'recycling_centre'], HOUSES, 10000);
  assert.deepEqual(
    nearby.map((shop) => [shop.house, shop.kind, shop.name]),
    [
      ['Maison', 'pharmacy', 'Pharmacie Centrale'],
      ['Campagne', 'pharmacy', 'Pharmacie du Marché'],
      ['Campagne', 'recycling_centre', 'Déchetterie de Vierzon'],
    ],
  );
  assert.equal(nearby[0].key, 'n203');
  const many = Array.from({ length: 6 }, (_, i) => ({
    type: 'node',
    id: i,
    lat: 47.081 + i / 1000,
    lon: 2.3988,
    tags: { name: `Boulangerie ${i}`, shop: 'bakery', opening_hours: '24/7' },
  }));
  const bakeries = nearbyShops(many, ['bakery'], HOUSES.slice(0, 1), 10000);
  assert.equal(bakeries.length, PER_KIND);
  assert.deepEqual(
    bakeries.map((shop) => shop.name),
    ['Boulangerie 0', 'Boulangerie 1', 'Boulangerie 2'],
  );
});

test('discovery: only the houses picked, the created shops kept up to date', async () => {
  const { finder, fetch } = finderSetup();
  await finder.refresh({ radiusKm: 10, kinds: ['pharmacy'], houses: ['campagne'] });
  assert.deepEqual(
    finder.nearby.map((shop) => shop.name),
    ['Pharmacie du Marché'],
  );
  assert.ok(fetch.queries[0].includes('47.2219') && !fetch.queries[0].includes('47.081,'));
  // A shop created, then gone from the offer (no more kind): asked by id.
  await finder.refresh({ radiusKm: 10, kinds: [], houses: ['campagne'], known: ['n202'] });
  assert.equal(fetch.queries.length, 2);
  assert.match(fetch.queries[1], /node\(id:202\)/);
  assert.equal(finder.shop('n202').hours, 'Mo-Fr 09:00-19:00');
  // Gone from the map too: it keeps its last hours.
  fetch.elements = [];
  await finder.refresh({ radiusKm: 5, kinds: [], houses: ['campagne'], known: ['n202'] });
  assert.equal(finder.shop('n202').hours, 'Mo-Fr 09:00-19:00');
});
