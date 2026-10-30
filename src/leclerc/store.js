// -----------------------------------------------------------------------------
// The store watcher: once a minute, is the store open, and when does that
// change? It publishes the two features of the store device and fires the
// "opens soon" / "closes soon" scene triggers.
//
// Nothing here goes on the network: the hours are the ones the user typed.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { TIME_ZONE } from '../config.js';
import { FEATURES, storeIds } from '../devices/index.js';
import { localize, pick } from '../i18n.js';
import { formatRanges, parseOpeningHours, storeStatus } from './hours.js';

const logger = createLogger({ name: 'store' });

const TICK_MS = 60_000;

/** Scene trigger keys, as declared in the manifest: never renamed. */
export const STORE_TRIGGERS = {
  OPENING_SOON: 'store_opening_soon',
  CLOSING_SOON: 'store_closing_soon',
};

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
    this.schedule = null;
    this.error = null;
    this.timer = null;
    // The next change already announced, so a trigger fires once per change.
    this.announced = null;
    this.primed = false;
    this.lastOpen = null;
  }

  /** Read the hours of a (new) configuration. */
  configure(config) {
    this.config = config;
    try {
      this.schedule = parseOpeningHours(config.opening_hours);
      this.error = null;
    } catch (err) {
      this.schedule = null;
      this.error = err;
      logger.warn(`Opening hours not understood: ${err.message}`);
    }
  }

  /** The status now, `null` while the hours cannot be read. */
  status() {
    return this.schedule ? storeStatus(this.schedule, this.now(), TIME_ZONE) : null;
  }

  /** Publish the features and fire the due trigger. */
  async tick() {
    const status = this.status();
    if (!status) {
      return;
    }
    const ids = storeIds(this.gladys);
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
    if (this.lastOpen !== null && this.lastOpen !== status.open) {
      this.gladys.requestWidgetRefresh('store_hours');
    }
    this.lastOpen = status.open;

    const { next } = status;
    const due = next && next.inMinutes > 0 && next.inMinutes <= this.config.notice_minutes;
    const key = due ? `${next.open}@${Math.round(next.at.getTime() / 60_000)}` : null;
    // The first tick after a start only takes note: a restart inside the
    // notice window must not announce the same closing twice.
    if (due) {
      if (this.primed && key !== this.announced) {
        const trigger = next.open ? STORE_TRIGGERS.OPENING_SOON : STORE_TRIGGERS.CLOSING_SOON;
        logger.info(`${trigger}: ${next.time}, in ${next.inMinutes} min`);
        await this.gladys
          .publishSceneEvent(trigger, {
            store_name: this.config.store_name,
            time: next.time,
            minutes_left: next.inMinutes,
          })
          .catch((err) => logger.error(`Could not fire ${trigger}`, err));
      }
      this.announced = key;
    }
    this.primed = true;
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
