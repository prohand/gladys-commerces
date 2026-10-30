// Test helpers: a fake clock and an in-memory storage of the card balances.
// Nothing here touches the disk or the network.

/** A storage of the balances, kept in the test. */
export function memoryStorage(balances = {}) {
  const storage = {
    balances: structuredClone(balances),
    async load() {
      return structuredClone(storage.balances);
    },
    async save(next) {
      storage.balances = structuredClone(next);
    },
  };
  return storage;
}

/** A clock the test moves. */
export function fakeClock(iso) {
  let now = new Date(iso);
  const clock = () => new Date(now);
  clock.set = (value) => {
    now = new Date(value);
  };
  clock.advance = (minutes) => {
    now = new Date(now.getTime() + minutes * 60_000);
  };
  return clock;
}

/** Two valid card numbers: an EAN-13 and a number Code 128 carries. */
export const MARIE = '2900123456785';
export const PAUL = '123456789012345';

/** A fetch answering like Overpass, with the queries it received. */
export function fakeOverpass(elements = []) {
  const fetch = async (url, options) => {
    fetch.urls.push(url);
    fetch.queries.push(new URLSearchParams(options.body).get('data'));
    if (fetch.down) {
      throw new Error('network down');
    }
    return { ok: true, status: 200, json: async () => ({ elements: fetch.elements }) };
  };
  fetch.queries = [];
  fetch.urls = [];
  fetch.elements = elements;
  fetch.down = false;
  return fetch;
}

/** A storage of the hours found, kept in the test. */
export function memoryCache(saved = null) {
  const cache = {
    saved: structuredClone(saved),
    async load() {
      return structuredClone(cache.saved);
    },
    async save(next) {
      cache.saved = structuredClone(next);
    },
  };
  return cache;
}

/** Two houses of Gladys, in Bourges and in Vierzon (about 30 km apart). */
export const HOUSES = [
  { id: 'h1', name: 'Maison', selector: 'maison', latitude: 47.081, longitude: 2.3988 },
  { id: 'h2', name: 'Campagne', selector: 'campagne', latitude: 47.2219, longitude: 2.0686 },
];

/** Shops as Overpass returns them: a node, a way (with its center). */
export const OSM_SHOPS = [
  {
    type: 'way',
    id: 101,
    center: { lat: 47.0901, lon: 2.4102 },
    tags: {
      name: 'E.Leclerc',
      brand: 'E.Leclerc',
      shop: 'supermarket',
      'addr:city': 'Bourges',
      opening_hours: 'Mo-Sa 08:30-20:00; PH off',
    },
  },
  {
    type: 'node',
    id: 202,
    lat: 47.2231,
    lon: 2.0702,
    tags: { name: 'Pharmacie du Marché', amenity: 'pharmacy', opening_hours: 'Mo-Fr 09:00-19:00' },
  },
  {
    type: 'node',
    id: 203,
    lat: 47.0815,
    lon: 2.399,
    tags: {
      name: 'Pharmacie Centrale',
      amenity: 'pharmacy',
      opening_hours: 'Mo-Sa 09:00-12:00,14:00-19:00',
    },
  },
  {
    type: 'node',
    id: 304,
    lat: 47.082,
    lon: 2.4,
    tags: {
      name: 'Boulangerie Dupont',
      shop: 'bakery',
      opening_hours: 'Tu-Su 07:00-13:00; sunrise-sunset',
    },
  },
  {
    type: 'way',
    id: 405,
    center: { lat: 47.2105, lon: 2.0811 },
    tags: {
      name: 'Déchetterie de Vierzon',
      amenity: 'recycling',
      recycling_type: 'centre',
      opening_hours: 'Mo-Sa 09:00-12:00,14:00-18:00',
    },
  },
  {
    type: 'node',
    id: 506,
    lat: 47.0812,
    lon: 2.3995,
    // No name: never offered, a store needs one.
    tags: { amenity: 'pharmacy', opening_hours: '24/7' },
  },
];
