// -----------------------------------------------------------------------------
// Integration configuration.
//
// The values are filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. This module holds the defaults (they
// MUST match the manifest `default` values, see test/manifest.test.js) and
// normalizes what Gladys sends, so the rest of the code never deals with
// `undefined`, strings typed in a number field or values out of range.
// -----------------------------------------------------------------------------

/** The stores are in France: the hours are read on the French clock, holidays included. */
export const TIME_ZONE = 'Europe/Paris';

export const DEFAULT_CONFIG = {
  // `Name = hours | Name = hours`, read by src/shops/stores.js. Empty: no store.
  stores: '',
  // Minutes before an opening or a closing that fire the "soon" triggers.
  notice_minutes: 30,
  // `Name=number; Name=number`, read by src/shops/cards.js. Empty: no card.
  loyalty_cards: '',
};

/** Bounds of the number fields, the same as in the manifest. */
export const LIMITS = {
  notice_minutes: [5, 180],
};

/**
 * Merge the user config with the defaults, and force the types.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const text = (value, fallback) =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
  return {
    stores: text(raw.stores, DEFAULT_CONFIG.stores),
    notice_minutes: bounded(raw.notice_minutes, 'notice_minutes'),
    loyalty_cards: text(raw.loyalty_cards, DEFAULT_CONFIG.loyalty_cards),
  };
}

/** A number field, back to its default when empty or not a number, clamped. */
function bounded(value, key) {
  const number = value === '' || value === null ? NaN : Number(value);
  if (!Number.isFinite(number)) {
    return DEFAULT_CONFIG[key];
  }
  const [min, max] = LIMITS[key];
  return Math.min(max, Math.max(min, Math.round(number)));
}
