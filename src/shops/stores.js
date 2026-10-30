// -----------------------------------------------------------------------------
// The stores and their opening hours.
//
// The user lists the shops they go to — supermarket, pharmacy, bakery, waste
// collection centre — with their hours in the OpenStreetMap syntax:
//
//   Supermarket = Mo-Sa 08:30-20:00; PH off | Pharmacy = Mo-Fr 09:00-19:00
//
// Stores are separated by `|` (or a line break), the name comes before `=`.
// `|` and `=` never appear in the opening_hours subset read by hours.js.
//
// Once a minute the watcher publishes, for each store, whether it is open and
// the minutes until that changes, and fires the "opens soon" / "closes soon"
// scene triggers once per change. Nothing goes on the network.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { TIME_ZONE } from '../config.js';
import { FEATURES, storeIds } from '../devices/index.js';
import { localize, pick } from '../i18n.js';
import { formatRanges, parseOpeningHours, storeStatus } from './hours.js';

const logger = createLogger({ name: 'stores' });

const TICK_MS = 60_000;

/** At most this many stores: the ones a household goes to. */
export const MAX_STORES = 10;

/** Scene trigger keys, as declared in the manifest: never renamed. */
export const STORE_TRIGGERS = {
  OPENING_SOON: 'store_opening_soon',
  CLOSING_SOON: 'store_closing_soon',
};

/**
 * The id of a store, part of its external id: its name in lower case, without
 * accents, words joined by dashes. Renaming a store makes it a new device.
 */
export function storeSlug(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Read the stores of the configuration.
 * @param {string} text
 * @returns {{
 *   stores: Array<{ id: string, name: string, hours: string, schedule: object|null, error: Error|null }>,
 *   errors: string[]
 * }} a store whose hours cannot be read is kept, with its error: the screens
 *   say what is wrong with it
 */
export function parseStores(text) {
  const stores = [];
  const errors = [];
  for (const entry of String(text ?? '')
    .split(/[|\n]/)
    .map((part) => part.trim())
    .filter(Boolean)) {
    const separator = entry.indexOf('=');
    const name = separator === -1 ? '' : entry.slice(0, separator).trim();
    const hours = separator === -1 ? '' : entry.slice(separator + 1).trim();
    const id = storeSlug(name);
    if (!id || !hours) {
      errors.push(entry);
      continue;
    }
    if (stores.some((store) => store.id === id)) {
      continue;
    }
    let schedule = null;
    let error = null;
    try {
      schedule = parseOpeningHours(hours);
    } catch (err) {
      error = err;
    }
    stores.push({ id, name, hours, schedule, error });
  }
  if (stores.length > MAX_STORES) {
    errors.push(...stores.splice(MAX_STORES).map((store) => store.name));
  }
  return { stores, errors };
}

export class StoreWatcher {
  /**
   * @param {object} options
   * @param {object} options.gladys the SDK instance
   * @param {() => Date} [options.now] clock, for the tests
   */
  constructor({ gladys, now = () => new Date() }) {
    this.gladys = gladys;
    this.now = now;
    this.config = null;
    this.stores = [];
    this.errors = [];
    this.timer = null;
    // Per store id, what the last ticks saw: survives a new configuration, so
    // saving the form does not announce again a change already announced.
    this.memory = new Map();
  }

  /** Read the stores of a (new) configuration. */
  configure(config) {
    this.config = config;
    ({ stores: this.stores, errors: this.errors } = parseStores(config.stores));
    for (const store of this.stores.filter((s) => s.error)) {
      logger.warn(`Opening hours of "${store.name}" not understood: ${store.error.message}`);
    }
    for (const entry of this.errors) {
      logger.warn(`Store not understood: "${entry}"`);
    }
  }

  /** The store of an id or of a device external id. */
  find(idOrExternalId) {
    return this.stores.find(
      (store) =>
        store.id === idOrExternalId || storeIds(this.gladys, store.id).device === idOrExternalId,
    );
  }

  /** A store's status now, `null` while its hours cannot be read. */
  status(store) {
    return store?.schedule ? storeStatus(store.schedule, this.now(), TIME_ZONE) : null;
  }

  /** Publish the features of every store and fire the due triggers. */
  async tick() {
    for (const store of this.stores) {
      await this.tickStore(store);
    }
  }

  async tickStore(store) {
    const status = this.status(store);
    if (!status) {
      return;
    }
    const ids = storeIds(this.gladys, store.id);
    const memory = this.memory.get(store.id) ?? { announced: null, primed: false, lastOpen: null };
    this.memory.set(store.id, memory);
    await this.gladys.publishChangedStates(
      [
        { device_feature_external_id: ids.feature(FEATURES.OPEN), state: status.open ? 1 : 0 },
        {
          device_feature_external_id: ids.feature(FEATURES.NEXT_CHANGE),
          state: status.next ? status.next.inMinutes : 0,
        },
      ],
      { heartbeat: 30 * 60_000 },
    );
    if (memory.lastOpen !== null && memory.lastOpen !== status.open) {
      this.gladys.requestWidgetRefresh('store_hours');
    }
    memory.lastOpen = status.open;

    const { next } = status;
    const due = next && next.inMinutes > 0 && next.inMinutes <= this.config.notice_minutes;
    // The first tick of a store only takes note: a restart inside the notice
    // window must not announce the same closing twice.
    if (due) {
      const key = `${next.open}@${Math.round(next.at.getTime() / 60_000)}`;
      if (memory.primed && key !== memory.announced) {
        const trigger = next.open ? STORE_TRIGGERS.OPENING_SOON : STORE_TRIGGERS.CLOSING_SOON;
        logger.info(`${trigger} ${store.name}: ${next.time}, in ${next.inMinutes} min`);
        await this.gladys
          .publishSceneEvent(trigger, {
            device: ids.device,
            store_name: store.name,
            time: next.time,
            minutes_left: next.inMinutes,
          })
          .catch((err) => logger.error(`Could not fire ${trigger}`, err));
      }
      memory.announced = key;
    }
    memory.primed = true;
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      this.tick().catch((err) => logger.error('Store tick failed', err));
    }, TICK_MS);
    this.timer.unref?.();
    return this.tick().catch((err) => logger.error('Store tick failed', err));
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}

/**
 * The state of the store in one sentence per language: "Open, closes at
 * 20:00." / "Closed, opens tomorrow at 08:30."
 */
export function describeStatus(status, timeZone = TIME_ZONE) {
  return localize((language) => {
    if (!status.next) {
      return pick(language, {
        en: status.open ? 'Open, around the clock.' : 'Closed, no opening this week.',
        fr: status.open ? 'Ouvert, en continu.' : 'Fermé, aucune ouverture cette semaine.',
        de: status.open ? 'Geöffnet, rund um die Uhr.' : 'Geschlossen, diese Woche keine Öffnung.',
        es: status.open ? 'Abierto, sin interrupción.' : 'Cerrado, sin apertura esta semana.',
      });
    }
    const when = describeWhen(status.next, language, timeZone);
    return status.open
      ? pick(language, {
          en: `Open, closes ${when}.`,
          fr: `Ouvert, ferme ${when}.`,
          de: `Geöffnet, schließt ${when}.`,
          es: `Abierto, cierra ${when}.`,
        })
      : pick(language, {
          en: `Closed, opens ${when}.`,
          fr: `Fermé, ouvre ${when}.`,
          de: `Geschlossen, öffnet ${when}.`,
          es: `Cerrado, abre ${when}.`,
        });
  });
}

/** "at 20:00", "tomorrow at 08:30", "on Monday at 08:30", in a language. */
export function describeWhen(next, language, timeZone = TIME_ZONE) {
  if (next.dayOffset === 0) {
    return pick(language, {
      en: `at ${next.time}`,
      fr: `à ${next.time}`,
      de: `um ${next.time}`,
      es: `a las ${next.time}`,
    });
  }
  if (next.dayOffset === 1) {
    return pick(language, {
      en: `tomorrow at ${next.time}`,
      fr: `demain à ${next.time}`,
      de: `morgen um ${next.time}`,
      es: `mañana a las ${next.time}`,
    });
  }
  const day = new Intl.DateTimeFormat(language, { weekday: 'long', timeZone }).format(next.at);
  return pick(language, {
    en: `on ${day} at ${next.time}`,
    fr: `${day} à ${next.time}`,
    de: `am ${day} um ${next.time}`,
    es: `el ${day} a las ${next.time}`,
  });
}

/** Today's hours, or "closed today". */
export function describeToday(status) {
  return status.today.length > 0
    ? formatRanges(status.today)
    : { en: 'Closed today', fr: "Fermé aujourd'hui", de: 'Heute geschlossen', es: 'Cerrado hoy' };
}

/** Why the hours could not be read, for the action and the widget. */
export function describeHoursError(error) {
  return localize((language) =>
    pick(language, {
      en: `The opening hours are not understood (${error.message}). Example: Mo-Sa 08:30-20:00; PH off`,
      fr: `Les horaires ne sont pas compris (${error.message}). Exemple : Mo-Sa 08:30-20:00; PH off`,
      de: `Die Öffnungszeiten werden nicht verstanden (${error.message}). Beispiel: Mo-Sa 08:30-20:00; PH off`,
      es: `No se entiende el horario (${error.message}). Ejemplo: Mo-Sa 08:30-20:00; PH off`,
    }),
  );
}
