// -----------------------------------------------------------------------------
// Loyalty cards (Carte E.Leclerc).
//
// E.Leclerc offers no public API for its cards: the balance of the "Ticket
// E.Leclerc" kitty cannot be read automatically without the customer's
// password and an unofficial, unstable interface — which this integration
// refuses to depend on. What it does instead:
//   - the user types the card numbers (one per member of the household);
//   - the dashboard shows each card's barcode, to scan at the till;
//   - the user updates the balance from the widget or a scene; it is kept in
//     /data and published as a Gladys feature, usable in any condition.
// -----------------------------------------------------------------------------

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';
import { FEATURES, MAX_BALANCE, cardIds } from '../devices/index.js';

const logger = createLogger({ name: 'cards' });

/** At most this many cards: a household, not a customer file. */
export const MAX_CARDS = 10;

/**
 * Read the cards of the configuration: `Marie=2900123456785; Paul=2900...`.
 * Entries are separated by `;`, `,` or a line break; the name before `=` or
 * `:` is optional. Spaces inside a number are ignored.
 * @param {string} text
 * @returns {{ cards: Array<{ number: string, name: string }>, errors: string[] }}
 */
export function parseCards(text) {
  const cards = [];
  const errors = [];
  for (const entry of String(text ?? '')
    .split(/[;,\n]/)
    .map((part) => part.trim())
    .filter(Boolean)) {
    const match = /^(?:(.+?)\s*[=:]\s*)?([\d\s-]+)$/.exec(entry);
    const number = match?.[2].replace(/[\s-]/g, '');
    if (!match || !/^\d{6,20}$/.test(number)) {
      errors.push(entry);
      continue;
    }
    if (cards.some((card) => card.number === number)) {
      continue;
    }
    cards.push({ number, name: match[1]?.trim() || `•••• ${number.slice(-4)}` });
  }
  if (cards.length > MAX_CARDS) {
    errors.push(...cards.splice(MAX_CARDS).map((card) => card.number));
  }
  return { cards, errors };
}

/** `2900123456785` → `2 900123 456785` for an EAN-13, groups of 4 otherwise. */
export function formatNumber(number) {
  return number.length === 13
    ? `${number[0]} ${number.slice(1, 7)} ${number.slice(7)}`
    : number.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** The balances, as a JSON file in /data. */
export function fileStorage(directory = process.env.DATA_DIR ?? '/data') {
  const path = join(directory, 'cards.json');
  return {
    async load() {
      try {
        const { balances } = JSON.parse(await readFile(path, 'utf8'));
        return balances && typeof balances === 'object' ? balances : {};
      } catch {
        return {};
      }
    },
    async save(balances) {
      await writeFile(path, JSON.stringify({ balances }));
    },
  };
}

/** The cards of the configuration and their balances. */
export class Wallet {
  /**
   * @param {object} options
   * @param {object} options.gladys the SDK instance
   * @param {{ load(): Promise<object>, save(balances: object): Promise<void> }} [options.storage]
   * @param {() => Date} [options.now] clock
   */
  constructor({ gladys, storage = fileStorage(), now = () => new Date() }) {
    this.gladys = gladys;
    this.storage = storage;
    this.now = now;
    this.cards = [];
    this.errors = [];
    /** number → { balance, updated_at } */
    this.balances = null;
  }

  configure(config) {
    ({ cards: this.cards, errors: this.errors } = parseCards(config.loyalty_cards));
    for (const entry of this.errors) {
      logger.warn(`Loyalty card not understood: "${entry}"`);
    }
  }

  async load() {
    this.balances ??= await this.storage.load();
    return this.balances;
  }

  /** The card of a number or of a device external id. */
  find(numberOrExternalId) {
    return this.cards.find(
      (card) =>
        card.number === numberOrExternalId ||
        cardIds(this.gladys, card.number).device === numberOrExternalId,
    );
  }

  balanceOf(card) {
    return this.balances?.[card.number] ?? null;
  }

  /** Set a card's balance, keep it, publish it. */
  async setBalance(card, value) {
    const balance = Number(value);
    if (!Number.isFinite(balance) || balance < 0 || balance > MAX_BALANCE) {
      throw new Error(`The balance must be between 0 and ${MAX_BALANCE} €`);
    }
    await this.load();
    const rounded = Math.round(balance * 100) / 100;
    this.balances[card.number] = { balance: rounded, updated_at: this.now().toISOString() };
    try {
      await this.storage.save(this.balances);
    } catch (err) {
      // Published anyway: Gladys keeps the value, only a restart would lose it.
      logger.warn(`Could not keep the balance in /data: ${err.message}`);
    }
    await this.gladys.publishState(
      cardIds(this.gladys, card.number).feature(FEATURES.BALANCE),
      rounded,
    );
    this.gladys.requestWidgetRefresh('loyalty_card');
    return rounded;
  }

  /** Publish the known balances again (start, device created). */
  async publishAll() {
    await this.load();
    const states = this.cards
      .filter((card) => this.balanceOf(card))
      .map((card) => ({
        device_feature_external_id: cardIds(this.gladys, card.number).feature(FEATURES.BALANCE),
        state: this.balanceOf(card).balance,
      }));
    if (states.length > 0) {
      await this.gladys.publishChangedStates(states, { heartbeat: 6 * 60 * 60_000 });
    }
  }
}
