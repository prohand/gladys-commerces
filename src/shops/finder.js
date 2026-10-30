// -----------------------------------------------------------------------------
// Opening hours found automatically, on OpenStreetMap.
//
// A store written `Name = auto` (or `Name = auto: words to look for`) has no
// hours in the configuration: they are looked up on OpenStreetMap, among the
// shops around the houses of Gladys that carry an `opening_hours` tag — the
// syntax hours.js reads. The nearest match to any house wins.
//
// This is the only network call of the integration, and only when a store
// asks for it: the Overpass API receives the words looked for and an area
// around each located house. The results are kept in /data/hours.json, so a
// restart without network keeps the hours, and refreshed once a day (the
// shops update their hours on the map from time to time).
// -----------------------------------------------------------------------------

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'finder' });

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'gladys-commerces (+https://github.com/prohand/gladys-commerces)';

/** Results older than this are looked up again. */
export const REFRESH_MS = 24 * 3600_000;
/** After a failed lookup, the next try. */
export const RETRY_MS = 3600_000;
const TIMEOUT_MS = 60_000;

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
 * The Overpass query: every shop with opening hours whose name or brand holds
 * one of the searches, around each located house.
 */
export function overpassQuery(searches, houses, radiusMeters) {
  const pattern = searches.map(searchPattern).join('|');
  const around = houses.map(
    (house) => `(around:${radiusMeters},${house.latitude},${house.longitude})`,
  );
  const lines = around.flatMap((area) =>
    ['name', 'brand'].map((tag) => `  nwr["opening_hours"]["${tag}"~"${pattern}",i]${area};`),
  );
  return `[out:json][timeout:50];\n(\n${lines.join('\n')}\n);\nout tags center 1000;`;
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

/**
 * The nearest shop of each search, among the elements Overpass returned.
 * @returns {Record<string, object>} per search, the shop found (absent: none)
 */
export function nearestShops(elements, searches, houses, radiusMeters) {
  const found = {};
  for (const element of elements) {
    const tags = element.tags ?? {};
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!tags.opening_hours || latitude === undefined || longitude === undefined) {
      continue;
    }
    const names = [tags.name, tags.brand].filter(Boolean);
    for (const search of searches) {
      if (!names.some((name) => nameMatches(name, search))) {
        continue;
      }
      for (const house of houses) {
        const distance = distanceMeters(house, { latitude, longitude });
        if (distance > radiusMeters || (found[search] && found[search].distance <= distance)) {
          continue;
        }
        found[search] = {
          hours: tags.opening_hours.trim(),
          name: tags.name ?? tags.brand,
          city: tags['addr:city'] ?? null,
          house: house.name,
          distance: Math.round(distance),
          osm: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        };
      }
    }
  }
  return found;
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
async function locatedHouses(gladys) {
  try {
    const houses = await gladys.getHouses();
    return houses.filter(
      (house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
    );
  } catch (err) {
    logger.warn(`The houses of Gladys could not be read: ${err.message}`);
    return null;
  }
}

/**
 * Looks the stores up and keeps the results.
 *
 * `results[search]` is the shop found (`{ hours, name, city, house, distance,
 * osm }`) or why there is none (`{ error, radiusKm? }`, error being
 * `not_found`, `unreachable`, `no_house` or `no_access`): plain objects, kept
 * as JSON.
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
    this.signature = null;
    this.checkedAt = 0;
    this.failedAt = 0;
    this.loaded = false;
    this.running = null;
  }

  /** What is known of a search: a shop, an error, or `undefined` (never looked up). */
  get(search) {
    return this.results[search];
  }

  /**
   * Look the searches up when needed: never looked up, older than a day, the
   * houses or the radius changed, or the last try failed an hour ago.
   * @returns {Promise<boolean>} whether the results changed
   */
  refresh(searches, radiusKm) {
    // One lookup at a time: a new configuration saved during a lookup waits.
    const previous = this.running ?? Promise.resolve();
    const running = previous
      .catch(() => {})
      .then(() => this.lookup([...new Set(searches)].sort(), radiusKm))
      .finally(() => {
        if (this.running === running) {
          this.running = null;
        }
      });
    this.running = running;
    return running;
  }

  async lookup(searches, radiusKm) {
    if (searches.length === 0) {
      return false;
    }
    if (!this.loaded) {
      this.loaded = true;
      const saved = await this.cache.load();
      if (saved?.results) {
        this.signature = saved.signature ?? null;
        this.checkedAt = Date.parse(saved.checked_at) || 0;
        this.results = saved.results;
      }
    }
    const houses = await locatedHouses(this.gladys);
    if (!houses || houses.length === 0) {
      return this.keep(searches, () => ({ error: houses ? 'no_house' : 'no_access' }));
    }
    const radius = radiusKm * 1000;
    const signature = JSON.stringify({
      houses: houses.map((house) => [house.latitude, house.longitude]),
      radius,
    });
    const now = this.now().getTime();
    // Only a shop or a "not found" is an answer: anything else is asked again.
    const answered = (result) => Boolean(result?.hours) || result?.error === 'not_found';
    const stale =
      signature !== this.signature ||
      now - this.checkedAt >= REFRESH_MS ||
      !searches.every((search) => answered(this.results[search]));
    if (!stale) {
      return false;
    }
    const lastAnswers = (search) =>
      answered(this.results[search]) ? this.results[search] : { error: 'unreachable' };
    if (now - this.failedAt < RETRY_MS) {
      return this.keep(searches, lastAnswers);
    }

    let found;
    try {
      found = nearestShops(
        await this.overpass(overpassQuery(searches, houses, radius)),
        searches,
        houses,
        radius,
      );
    } catch (err) {
      logger.warn(`OpenStreetMap lookup failed: ${err.message}`);
      this.failedAt = now;
      // The hours found before stay: a shop rarely changes its hours.
      return this.keep(searches, lastAnswers);
    }
    this.failedAt = 0;
    this.signature = signature;
    this.checkedAt = now;
    this.results = Object.fromEntries(
      searches.map((search) => [search, found[search] ?? { error: 'not_found', radiusKm }]),
    );
    for (const search of searches) {
      const shop = found[search];
      logger.info(
        shop
          ? `"${search}": ${shop.name} at ${shop.distance} m of ${shop.house}, ${shop.hours}`
          : `"${search}": no shop with opening hours within ${radiusKm} km`,
      );
    }
    await this.cache
      .save({
        signature,
        checked_at: new Date(now).toISOString(),
        results: this.results,
      })
      .catch((err) => logger.error('Could not save the hours found', err));
    return true;
  }

  /** Keep the searches only, each with what `value` gives. */
  keep(searches, value) {
    const before = JSON.stringify(this.results);
    this.results = Object.fromEntries(searches.map((search) => [search, value(search)]));
    return JSON.stringify(this.results) !== before;
  }

  async overpass(query) {
    const response = await this.fetch(OVERPASS_URL, {
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
    const { elements } = await response.json();
    if (!Array.isArray(elements)) {
      throw new Error('Overpass answered without elements');
    }
    return elements;
  }
}
