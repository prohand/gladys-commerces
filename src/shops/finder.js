// -----------------------------------------------------------------------------
// Opening hours found automatically, on OpenStreetMap.
//
// Two ways, both answered by one Overpass query around the houses of Gladys
// (all the located houses, or the ones picked in the configuration):
//
//   - by name: a store written without hours (`Leclerc`, `Leclerc = auto`,
//     `Leclerc = auto: words`) takes the hours of the nearest shop of that
//     name that carries an `opening_hours` tag — the syntax hours.js reads;
//   - by discovery: the nearest shops of the kinds picked in the
//     configuration (supermarket, bakery…) are offered in the Discovery tab,
//     per house; the ones the user creates keep their hours up to date.
//
// This is the only network call of the integration: the Overpass API
// receives the words looked for, the kinds, and an area around each house.
// The main server is often busy (timeouts, 502): a second public server is
// asked when it fails, the same query, so the data sent stays the same.
// The results are kept in /data/hours.json, so a restart without network
// keeps the hours, and refreshed once a day (the shops update their hours on
// the map from time to time).
// -----------------------------------------------------------------------------

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'finder' });

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
/** Asked when the main server fails. */
export const OVERPASS_FALLBACK_URL = 'https://overpass.kumi.systems/api/interpreter';
const USER_AGENT =
  'gladys-horaires-commerces (+https://github.com/prohand/gladys-horaires-commerces)';

/** Results older than this are looked up again. */
export const REFRESH_MS = 24 * 3600_000;
/** After a failed lookup, the next try. */
export const RETRY_MS = 3600_000;
const TIMEOUT_MS = 60_000;

/** The nearest shops of each kind offered per house, in the Discovery tab. */
export const PER_KIND = 3;

/**
 * The kinds of shops the Discovery tab can offer: the OpenStreetMap tag, its
 * values, and an extra tag that must be there. Keys are stored in the
 * configuration (`discover_kinds`): never renamed.
 */
export const SHOP_KINDS = {
  supermarket: { tag: 'shop', values: ['supermarket'] },
  convenience: { tag: 'shop', values: ['convenience'] },
  bakery: { tag: 'shop', values: ['bakery', 'pastry'] },
  butcher: { tag: 'shop', values: ['butcher'] },
  greengrocer: { tag: 'shop', values: ['greengrocer'] },
  pharmacy: { tag: 'amenity', values: ['pharmacy'] },
  post_office: { tag: 'amenity', values: ['post_office'] },
  doityourself: { tag: 'shop', values: ['doityourself', 'hardware'] },
  garden_centre: { tag: 'shop', values: ['garden_centre'] },
  sports: { tag: 'shop', values: ['sports'] },
  hairdresser: { tag: 'shop', values: ['hairdresser'] },
  recycling_centre: { tag: 'amenity', values: ['recycling'], extra: ['recycling_type', 'centre'] },
};

/** The kind of a shop, from its tags; `null` for none of SHOP_KINDS. */
export function kindOf(tags = {}) {
  for (const [kind, { tag, values, extra }] of Object.entries(SHOP_KINDS)) {
    if (values.includes(tags[tag]) && (!extra || tags[extra[0]] === extra[1])) {
      return kind;
    }
  }
  return null;
}

/** `{ type: 'way', id: 101 }` → `w101`: a shop in the cache and in a store id. */
export const shopKey = (element) => `${element.type[0]}${element.id}`;
const KEY = /^([nwr])(\d{1,15})$/;

/**
 * `auto` or `auto: words` as the hours of a store. `auto` is not valid
 * opening_hours: no hours typed by hand can be read this way.
 * @returns {string|null} the words to look for (`fallback` for a bare `auto`)
 */
export function autoSearch(hours, fallback) {
  const match = /^auto\s*(?::\s*(.*))?$/i.exec(String(hours ?? '').trim());
  if (!match) {
    return null;
  }
  return searchKey(match[1] || fallback);
}

/** The words of a text, lower case, without accents: `E.Leclerc Bourges` → `e leclerc bourges`. */
export function searchKey(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join(' ');
}

/** Whether a shop name holds the words looked for, in that order. */
export function nameMatches(name, search) {
  const words = searchKey(name).split(' ');
  let from = 0;
  for (const word of search.split(' ')) {
    const at = words.findIndex((candidate, index) => index >= from && candidate.includes(word));
    if (at === -1) {
      return false;
    }
    from = at + 1;
  }
  return true;
}

// A letter as the OpenStreetMap names may write it, accented or not. An
// alternation rather than a bracket class: an accented letter is two bytes,
// which a bracket class only matches on a UTF-8 aware regex engine.
const ACCENTS = {
  a: 'aàâäÀÂÄ',
  c: 'cçÇ',
  e: 'eéèêëÉÈÊË',
  i: 'iîïÎÏ',
  o: 'oôöÔÖ',
  u: 'uùûüÙÛÜ',
  y: 'yÿŸ',
};

/**
 * The Overpass regular expression of the words looked for. Built from the
 * words of searchKey only (letters and digits): nothing typed by the user
 * reaches the query as is.
 */
export function searchPattern(search) {
  return search
    .split(' ')
    .map((word) =>
      [...word]
        .map((char) => (ACCENTS[char] ? `(${[...ACCENTS[char]].join('|')})` : char))
        .join(''),
    )
    .join('.*');
}

/**
 * The Overpass query, one for everything:
 *   - the shops with opening hours whose name or brand holds a search;
 *   - the named shops with opening hours of the kinds to discover;
 *   - the shops already created from the Discovery tab, by id.
 * Only constants, numbers and searchPattern reach it: nothing typed as is.
 */
export function overpassQuery({ searches = [], kinds = [], known = [], houses, radiusMeters }) {
  const lines = [];
  const pattern = searches.map(searchPattern).join('|');
  // The kinds sharing a tag (and extra tag) go in one line.
  const groups = new Map();
  for (const kind of kinds) {
    const { tag, values, extra } = SHOP_KINDS[kind];
    const id = `${tag}|${extra ?? ''}`;
    const group = groups.get(id) ?? { tag, extra, values: [] };
    group.values.push(...values);
    groups.set(id, group);
  }
  for (const house of houses) {
    const area = `(around:${radiusMeters},${house.latitude},${house.longitude})`;
    if (pattern) {
      for (const tag of ['name', 'brand']) {
        lines.push(`  nwr["opening_hours"]["${tag}"~"${pattern}",i]${area};`);
      }
    }
    for (const { tag, extra, values } of groups.values()) {
      const more = extra ? `["${extra[0]}"="${extra[1]}"]` : '';
      lines.push(
        `  nwr["opening_hours"]["name"]["${tag}"~"^(${values.join('|')})$"]${more}${area};`,
      );
    }
  }
  const types = { n: 'node', w: 'way', r: 'relation' };
  for (const [letter, type] of Object.entries(types)) {
    const ids = known.map((key) => KEY.exec(key)).filter((match) => match?.[1] === letter);
    if (ids.length > 0) {
      lines.push(`  ${type}(id:${ids.map((match) => match[2]).join(',')});`);
    }
  }
  // `out center`, not `out tags center`: the tags verbosity drops the
  // coordinates of the nodes, and many shops are a node.
  return `[out:json][timeout:50];\n(\n${lines.join('\n')}\n);\nout center;`;
}

/** Distance in meters between two points (haversine). */
export function distanceMeters(a, b) {
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.sqrt(h));
}

/** What a store shows of a shop: `null` for an element without hours or place. */
export function shopOf(element) {
  const tags = element.tags ?? {};
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const name = tags.name ?? tags.brand;
  if (!tags.opening_hours || !name || latitude === undefined || longitude === undefined) {
    return null;
  }
  return {
    key: shopKey(element),
    name,
    city: tags['addr:city'] ?? null,
    hours: tags.opening_hours.trim(),
    osm: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    latitude,
    longitude,
  };
}

/** The shop with its distance to a house. */
function near(shop, house) {
  const { latitude, longitude, ...rest } = shop;
  const distance = Math.round(distanceMeters(house, { latitude, longitude }));
  return { ...rest, house: house.name, distance };
}

/**
 * The nearest shop of each search, among the elements Overpass returned.
 * @returns {Record<string, object>} per search, the shop found (absent: none)
 */
export function nearestShops(elements, searches, houses, radiusMeters) {
  const found = {};
  for (const element of elements) {
    const shop = shopOf(element);
    if (!shop) {
      continue;
    }
    const names = [element.tags.name, element.tags.brand].filter(Boolean);
    for (const search of searches) {
      if (!names.some((name) => nameMatches(name, search))) {
        continue;
      }
      for (const house of houses) {
        const candidate = near(shop, house);
        if (
          candidate.distance <= radiusMeters &&
          !(found[search] && found[search].distance <= candidate.distance)
        ) {
          found[search] = candidate;
        }
      }
    }
  }
  return found;
}

/**
 * The shops to offer in the Discovery tab: per house and per kind, the
 * PER_KIND nearest, the houses in their order, each by distance.
 * @returns {Array<object>} shops with their `kind`, `house` and `distance`
 */
export function nearbyShops(elements, kinds, houses, radiusMeters) {
  const shops = elements
    .map((element) => ({ shop: shopOf(element), kind: kindOf(element.tags) }))
    .filter(({ shop, kind }) => shop && kinds.includes(kind));
  return houses.flatMap((house) =>
    kinds
      .flatMap((kind) =>
        shops
          .filter((candidate) => candidate.kind === kind)
          .map(({ shop }) => ({ ...near(shop, house), kind }))
          .filter((shop) => shop.distance <= radiusMeters)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, PER_KIND),
      )
      .sort((a, b) => a.distance - b.distance),
  );
}

/** The results, as a JSON file in /data. */
export function fileCache(directory = process.env.DATA_DIR ?? '/data') {
  const path = join(directory, 'hours.json');
  return {
    async load() {
      try {
        const cache = JSON.parse(await readFile(path, 'utf8'));
        return cache && typeof cache === 'object' ? cache : null;
      } catch {
        return null;
      }
    },
    async save(cache) {
      await writeFile(path, JSON.stringify(cache));
    },
  };
}

/** The houses with a location, `null` when Gladys refuses to give them. */
async function locatedHouses(gladys, selectors = []) {
  try {
    const houses = await gladys.getHouses();
    return houses.filter(
      (house) =>
        Number.isFinite(house.latitude) &&
        Number.isFinite(house.longitude) &&
        (selectors.length === 0 || selectors.includes(house.selector)),
    );
  } catch (err) {
    logger.warn(`The houses of Gladys could not be read: ${err.message}`);
    return null;
  }
}

const unique = (list = []) => [...new Set(list)].sort();

/**
 * Looks the stores up and keeps the results, as plain objects (kept as JSON):
 *
 *   - `results[search]`: the shop found (`{ key, name, city, hours, osm,
 *     house, distance }`) or why there is none (`{ error, radiusKm? }`, error
 *     being `not_found`, `unreachable`, `no_house` or `no_access`);
 *   - `nearby`: the shops to offer in the Discovery tab (nearbyShops);
 *   - `shops[key]`: the shops created from the Discovery tab, by key.
 */
export class HoursFinder {
  /**
   * @param {object} options
   * @param {object} options.gladys the SDK instance (getHouses)
   * @param {typeof fetch} [options.fetch] for the tests
   * @param {object} [options.cache] storage of the results (fileCache)
   * @param {() => Date} [options.now] clock
   */
  constructor({ gladys, fetch = globalThis.fetch, cache = fileCache(), now = () => new Date() }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.cache = cache;
    this.now = now;
    this.results = {};
    this.nearby = [];
    this.shops = {};
    this.signature = null;
    this.checkedAt = 0;
    this.failedAt = 0;
    // Lookups that went on the network, to know whether one ran meanwhile.
    this.tries = 0;
    this.loaded = false;
    // How the last lookup went, for the test action: `idle` (never asked),
    // `ok`, `no_house`, `no_access` or `unreachable` (with `message`).
    this.status = { state: 'idle', houses: [] };
    this.running = null;
  }

  /** What is known of a search: a shop, an error, or `undefined` (never looked up). */
  get(search) {
    return this.results[search];
  }

  /** A shop of the Discovery tab, by key: the nearby ones and the created ones. */
  shop(key) {
    return this.nearby.find((shop) => shop.key === key) ?? this.shops[key];
  }

  /**
   * Look up when needed: never looked up, older than a day, the houses, the
   * radius or the kinds changed, a created shop unknown, or the last try
   * failed an hour ago.
   * @param {object} request
   * @param {string[]} [request.searches] the searches of the stores
   * @param {number} request.radiusKm
   * @param {string[]} [request.kinds] the kinds to discover (SHOP_KINDS keys)
   * @param {string[]} [request.houses] the selectors of the houses (empty: all)
   * @param {string[]} [request.known] the keys of the shops created
   * @param {boolean} [request.force] asked by the user: no wait after a
   *   failure, unless the lookup it waited for just failed
   * @returns {Promise<boolean>} whether the results changed
   */
  refresh(request) {
    // One lookup at a time: a new configuration saved during a lookup waits.
    const previous = this.running ?? Promise.resolve();
    const tries = this.tries;
    const running = previous
      .catch(() => {})
      .then(() =>
        this.lookup({
          searches: unique(request.searches),
          radiusKm: request.radiusKm,
          kinds: unique(request.kinds).filter((kind) => kind in SHOP_KINDS),
          houses: unique(request.houses),
          known: unique(request.known).filter((key) => KEY.test(key)),
          // Asked during a lookup that failed: that lookup was the try, a
          // second query at once would only load a busy server again.
          force: Boolean(request.force) && (this.tries === tries || this.failedAt === 0),
        }),
      )
      .finally(() => {
        if (this.running === running) {
          this.running = null;
        }
      });
    this.running = running;
    return running;
  }

  async lookup({ searches, radiusKm, kinds, houses: selectors, known, force }) {
    if (searches.length === 0 && kinds.length === 0 && known.length === 0) {
      return false;
    }
    if (!this.loaded) {
      this.loaded = true;
      const saved = await this.cache.load();
      if (saved?.results) {
        this.signature = saved.signature ?? null;
        this.checkedAt = Date.parse(saved.checked_at) || 0;
        this.results = saved.results;
        this.nearby = Array.isArray(saved.nearby) ? saved.nearby : [];
        this.shops = saved.shops && typeof saved.shops === 'object' ? saved.shops : {};
      }
    }
    const before = this.snapshot();
    const changed = () => this.snapshot() !== before;

    const houses = await locatedHouses(this.gladys, selectors);
    if (!houses || houses.length === 0) {
      const error = houses ? 'no_house' : 'no_access';
      this.status = { state: error, houses: [] };
      this.results = Object.fromEntries(searches.map((search) => [search, { error }]));
      this.nearby = [];
      return changed();
    }
    const radius = radiusKm * 1000;
    // `query` changes with the query: older results are looked up again.
    const signature = JSON.stringify({
      query: 2,
      houses: houses.map((house) => [house.name, house.latitude, house.longitude]),
      radius,
      kinds,
    });
    const now = this.now().getTime();
    // Only a shop or a "not found" is an answer: anything else is asked again.
    const answered = (result) => Boolean(result?.hours) || result?.error === 'not_found';
    const stale =
      signature !== this.signature ||
      now - this.checkedAt >= REFRESH_MS ||
      !searches.every((search) => answered(this.results[search])) ||
      !known.every((key) => this.shop(key));
    const lastAnswers = () => {
      this.results = Object.fromEntries(
        searches.map((search) => [
          search,
          answered(this.results[search]) ? this.results[search] : { error: 'unreachable' },
        ]),
      );
      return changed();
    };
    if (!stale) {
      this.status = { state: 'ok', houses: houses.map((house) => house.name) };
      return false;
    }
    if (!force && now - this.failedAt < RETRY_MS) {
      return lastAnswers();
    }

    let elements;
    this.tries += 1;
    try {
      elements = await this.overpass(
        overpassQuery({ searches, kinds, known, houses, radiusMeters: radius }),
      );
    } catch (err) {
      logger.warn(`OpenStreetMap lookup failed: ${err.message}`);
      this.failedAt = now;
      this.status = {
        state: 'unreachable',
        message: err.message,
        houses: houses.map((house) => house.name),
      };
      // The hours found before stay: a shop rarely changes its hours.
      return lastAnswers();
    }
    this.failedAt = 0;
    this.status = { state: 'ok', houses: houses.map((house) => house.name) };
    this.signature = signature;
    this.checkedAt = now;
    const found = nearestShops(elements, searches, houses, radius);
    this.results = Object.fromEntries(
      searches.map((search) => [search, found[search] ?? { error: 'not_found', radiusKm }]),
    );
    this.nearby = nearbyShops(elements, kinds, houses, radius);
    // A created shop gone from the map keeps its last hours.
    const shops = {};
    for (const key of known) {
      const element = elements.find((candidate) => shopKey(candidate) === key);
      const shop = (element && shopOf(element)) ?? this.shops[key];
      if (shop) {
        shops[key] = { ...shop, latitude: undefined, longitude: undefined };
      }
    }
    this.shops = shops;
    for (const search of searches) {
      const shop = found[search];
      logger.info(
        shop
          ? `"${search}": ${shop.name} at ${shop.distance} m of ${shop.house}, ${shop.hours}`
          : `"${search}": no shop with opening hours within ${radiusKm} km`,
      );
    }
    if (kinds.length > 0) {
      logger.info(`${this.nearby.length} shop(s) to offer in the Discovery tab`);
    }
    await this.cache
      .save({
        signature,
        checked_at: new Date(now).toISOString(),
        results: this.results,
        nearby: this.nearby,
        shops: this.shops,
      })
      .catch((err) => logger.error('Could not save the hours found', err));
    return true;
  }

  snapshot() {
    return JSON.stringify([this.results, this.nearby, this.shops]);
  }

  /** The query on the main server, then on the fallback one if it fails. */
  async overpass(query) {
    try {
      return await this.ask(OVERPASS_URL, query);
    } catch (err) {
      logger.warn(`${new URL(OVERPASS_URL).host} failed (${err.message}), trying the fallback`);
    }
    return this.ask(OVERPASS_FALLBACK_URL, query);
  }

  async ask(url, query) {
    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': USER_AGENT,
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Overpass answered ${response.status}`);
    }
    const { elements, remark } = await response.json();
    if (!Array.isArray(elements)) {
      throw new Error('Overpass answered without elements');
    }
    // A busy server answers 200 with a remark (timeout, out of memory) and
    // what it had time to find: not an answer to keep for a day.
    if (remark && /error|timed out|timeout/i.test(remark)) {
      throw new Error(`Overpass: ${remark}`);
    }
    return elements;
  }
}
