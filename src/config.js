// -----------------------------------------------------------------------------
// Integration configuration.
//
// The values are filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. This module holds the defaults (they
// MUST match the manifest `default` values, see test/manifest.test.js) and
// normalizes what Gladys sends, so the rest of the code never deals with
// `undefined`, strings typed in a number field or values out of range.
// -----------------------------------------------------------------------------

import { RECALL_CATEGORIES } from './leclerc/recalls.js';

/** Which recalls concern the user's store. */
export const RECALL_SCOPES = {
  // Only the recalls whose list of retailers names E.Leclerc.
  LECLERC: 'leclerc',
  // Also the ones sold "by all retailers" / "in supermarkets": E.Leclerc
  // included, even when the notice does not name it.
  ALL: 'all',
};

/** Every store is in France: the hours are read on the French clock. */
export const TIME_ZONE = 'Europe/Paris';

export const DEFAULT_CONFIG = {
  store_name: 'E.Leclerc',
  opening_hours: 'Mo-Sa 08:30-20:00; PH off',
  // Minutes before an opening or a closing that fire the "soon" triggers.
  notice_minutes: 30,
  recall_scope: RECALL_SCOPES.ALL,
  // Empty: every category.
  recall_categories: [],
  // How far back the recall list and counter look, in days.
  recall_days: 30,
  // Minutes between two reads of the RappelConso open data.
  refresh_interval: 60,
};

/** Bounds of the number fields, the same as in the manifest. */
export const LIMITS = {
  notice_minutes: [5, 180],
  recall_days: [1, 90],
  refresh_interval: [15, 1440],
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
    recall_scope: Object.values(RECALL_SCOPES).includes(raw.recall_scope)
      ? raw.recall_scope
      : DEFAULT_CONFIG.recall_scope,
    recall_categories: list(raw.recall_categories).filter((key) => key in RECALL_CATEGORIES),
    recall_days: bounded(raw.recall_days, 'recall_days'),
    refresh_interval: bounded(raw.refresh_interval, 'refresh_interval'),
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

/** A multi_select value: an array, or a comma-separated string from an old form. */
function list(value) {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}
