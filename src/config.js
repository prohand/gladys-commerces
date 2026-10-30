// -----------------------------------------------------------------------------
// Integration configuration.
//
// The values are filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. This module holds the defaults (they
// MUST match the manifest `default` values, see test/manifest.test.js) and
// normalizes what Gladys sends, so the rest of the code never deals with
// `undefined`, strings typed in a number field or values out of range.
// -----------------------------------------------------------------------------

/** Every store is in France: the hours are read on the French clock. */
export const TIME_ZONE = 'Europe/Paris';

export const DEFAULT_CONFIG = {
  store_name: 'E.Leclerc',
  opening_hours: 'Mo-Sa 08:30-20:00; PH off',
  // Minutes before an opening or a closing that fire the "soon" triggers.
  notice_minutes: 30,
  // `Name=number; Name=number`, read by src/leclerc/cards.js. Empty: no card.
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
    store_name: text(raw.store_name, DEFAULT_CONFIG.store_name),
    opening_hours: text(raw.opening_hours, DEFAULT_CONFIG.opening_hours),
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
