// -----------------------------------------------------------------------------
// The recall feed: reads RappelConso at the configured interval, keeps the
// recalls that concern the store, publishes the recall device and fires the
// "product recalled" scene trigger once per new recall.
//
// "New" means not seen before, and what was seen is remembered in /data (the
// one writable volume): without it, a restart would either announce every
// recall of the window again, or — priming silently — miss the ones published
// while the integration was down, which are exactly the ones nobody saw.
// -----------------------------------------------------------------------------

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { FEATURES, recallIds } from '../devices/index.js';
import { localize, pick } from '../i18n.js';
import { concerns, fetchRecalls, RECALL_CATEGORIES } from './recalls.js';

const logger = createLogger({ name: 'recalls' });

const DAY_MS = 24 * 60 * 60_000;

/** Scene trigger key, as declared in the manifest: never renamed. */
export const RECALL_TRIGGER = 'product_recalled';

/** Values of the trigger's `sold_at` filter. */
export const SOLD_AT = { LECLERC: 'leclerc', ALL_RETAILERS: 'all_retailers' };

/** A burst cap: a first read after weeks offline must not flood the scenes. */
const MAX_EVENTS_PER_READ = 20;

/** The core takes strings of 1000 characters at most in an event. */
const clip = (text, length = 1000) =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text;

/** The memory of the recalls already seen, as a JSON file. */
export function fileMemory(directory = process.env.DATA_DIR ?? '/data') {
  const path = join(directory, 'recalls-seen.json');
  return {
    async load() {
      try {
        const { references } = JSON.parse(await readFile(path, 'utf8'));
        return Array.isArray(references) ? new Set(references.map(String)) : null;
      } catch {
        return null;
      }
    },
    async save(references) {
      try {
        await writeFile(path, JSON.stringify({ references: [...references] }));
      } catch (err) {
        logger.warn(`Could not remember the recalls seen in ${path}: ${err.message}`);
      }
    },
  };
}

export class RecallFeed {
  /**
   * @param {object} options
   * @param {object} options.gladys the SDK instance
   * @param {typeof fetchRecalls} [options.fetch] the RappelConso reader
   * @param {{ load(): Promise<Set<string>|null>, save(refs: Set<string>): Promise<void> }} [options.memory]
   * @param {() => Date} [options.now] clock
   */
  constructor({ gladys, fetch = fetchRecalls, memory = fileMemory(), now = () => new Date() }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.memory = memory;
    this.now = now;
    this.config = null;
    /** The recalls that concern the store, newest first. */
    this.recalls = [];
    /** How many recalls the register published over the window, all retailers. */
    this.published = 0;
    this.seen = null;
    this.lastSuccess = null;
    this.lastError = null;
    this.timer = null;
    this.running = null;
  }

  configure(config) {
    this.config = config;
  }

  /** One read. Concurrent calls share the read under way. */
  refresh() {
    this.running ??= this.read().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  async read() {
    const ids = recallIds(this.gladys);
    let fetched;
    try {
      fetched = await this.fetch({
        since: new Date(this.now().getTime() - this.config.recall_days * DAY_MS),
      });
    } catch (err) {
      this.lastError = err;
      logger.error('RappelConso could not be read', err);
      await this.gladys
        .publishTransports([{ external_id: ids.device, transport: DEVICE_TRANSPORTS.UNREACHABLE }])
        .catch(() => {});
      await this.gladys
        .setConnectionStatus(false, {
          en: 'RappelConso cannot be reached, the recalls will be read again later.',
          fr: 'RappelConso est injoignable, les rappels seront relus plus tard.',
          de: 'RappelConso ist nicht erreichbar, die Rückrufe werden später erneut gelesen.',
          es: 'RappelConso no responde, los avisos se volverán a leer más tarde.',
        })
        .catch(() => {});
      throw err;
    }

    this.published = fetched.length;
    this.recalls = fetched.filter((recall) => concerns(recall, this.config));
    this.lastSuccess = this.now();
    this.lastError = null;
    logger.info(`${this.recalls.length} recall(s) concern the store, out of ${fetched.length}`);

    await this.announce(fetched.map((recall) => recall.reference));
    await this.gladys.publishChangedStates(
      [
        {
          device_feature_external_id: ids.feature(FEATURES.RECALL_COUNT),
          state: this.recalls.length,
        },
        {
          device_feature_external_id: ids.feature(FEATURES.LAST_RECALL),
          text: this.recalls[0] ? clip(title(this.recalls[0]), 200) : '-',
        },
      ],
      { heartbeat: 6 * 60 * 60_000 },
    );
    await this.gladys.publishTransports([
      { external_id: ids.device, transport: DEVICE_TRANSPORTS.CLOUD },
    ]);
    await this.gladys.setConnectionStatus(true);
    this.gladys.requestWidgetRefresh('product_recalls');
    return this.recalls;
  }

  /**
   * Fire the trigger for the recalls not seen before, oldest first. Every
   * recall read counts as seen, concerning the store or not: widening the
   * scope or the categories later must not replay old recalls as news.
   */
  async announce(references) {
    this.seen ??= await this.memory.load();
    if (this.seen === null) {
      // First run ever: what is already published is history, not news.
      logger.info('First read: the current recalls are taken as already seen');
    } else {
      const fresh = this.recalls.filter((recall) => !this.seen.has(recall.reference));
      for (const recall of fresh.slice(0, MAX_EVENTS_PER_READ).reverse()) {
        logger.info(`New recall ${recall.reference}: ${title(recall)}`);
        await this.gladys
          .publishSceneEvent(RECALL_TRIGGER, recallEvent(recall))
          .catch((err) => logger.error(`Could not fire ${RECALL_TRIGGER}`, err));
      }
    }
    // Only what is still in the window: the file stays small, and a recall
    // leaving the window never comes back into it.
    this.seen = new Set(references);
    await this.memory.save(this.seen);
  }

  start() {
    this.stop();
    this.timer = setInterval(
      () => this.refresh().catch(() => {}),
      this.config.refresh_interval * 60_000,
    );
    this.timer.unref?.();
    return this.refresh().catch(() => {});
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}

/** "Brand – product", the way a recall is named everywhere. */
export function title(recall) {
  const product = recall.product || recall.subCategory || recall.reference;
  return recall.brand && !product.toLowerCase().includes(recall.brand.toLowerCase())
    ? `${recall.brand} – ${product}`
    : product;
}

/** The data of the `product_recalled` event: flat, one primitive per key. */
export function recallEvent(recall) {
  return {
    category: recall.categoryKey,
    sold_at: recall.namesLeclerc ? SOLD_AT.LECLERC : SOLD_AT.ALL_RETAILERS,
    product: clip(title(recall)),
    brand: clip(recall.brand),
    reason: clip(recall.reason),
    risks: clip(recall.risks),
    link: clip(recall.link),
    reference: recall.reference,
  };
}

/** A category key in a language. */
export function categoryLabel(key, language) {
  return pick(language, (RECALL_CATEGORIES[key] ?? RECALL_CATEGORIES.other).label);
}

/** "12 recalls concern your store over 30 days (184 published)." */
export function describeFeed(feed) {
  const count = feed.recalls.length;
  const days = feed.config.recall_days;
  return localize((language) =>
    pick(language, {
      en: `RappelConso OK: ${count} recall(s) concern your store over ${days} day(s), out of ${feed.published} published.`,
      fr: `RappelConso OK : ${count} rappel(s) concernent votre magasin sur ${days} jour(s), sur ${feed.published} publiés.`,
      de: `RappelConso OK: ${count} Rückruf(e) betreffen Ihren Markt in ${days} Tag(en), von ${feed.published} veröffentlichten.`,
      es: `RappelConso OK: ${count} aviso(s) afectan a su tienda en ${days} día(s), de ${feed.published} publicados.`,
    }),
  );
}
