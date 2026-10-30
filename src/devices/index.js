// -----------------------------------------------------------------------------
// The devices of the integration.
//
//   - one device per STORE: is it open (a read-only switch, 1 = open), and
//     the minutes until it opens or closes — computed from its hours. A store
//     is typed in the configuration, or created from the Discovery tab among
//     the shops found on OpenStreetMap around the houses;
//   - one device per LOYALTY CARD: its balance in euros, set by the user.
//
// The external ids are forever (Gladys keys devices, history, scenes and
// dashboards on them): a typed store is identified by the slug of its name
// (see storeSlug), a discovered one by its OpenStreetMap id (`osm-w101`), a
// card by its number, never by the name the user gives it.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

/** Feature keys, part of the external ids: never renamed. */
export const FEATURES = {
  OPEN: 'open',
  NEXT_CHANGE: 'next_change',
  BALANCE: 'balance',
};

export function storeIds(gladys, storeId) {
  return gladys.externalIds('store', storeId);
}

/** Prefix of the ids of the stores created from the Discovery tab. */
export const OSM_PREFIX = 'osm-';

/** Device params of a discovered store: its hours, kept by Gladys. */
export const PARAMS = { HOURS: 'OSM_OPENING_HOURS', URL: 'OSM_URL' };

export function cardIds(gladys, number) {
  return gladys.externalIds('card', number);
}

/** Upper bound of the "minutes until" feature: the week and a day looked ahead. */
const MAX_MINUTES = 8 * 24 * 60;

export function buildStoreDevice(gladys, store) {
  const ids = storeIds(gladys, store.id);
  return {
    name: store.name,
    external_id: ids.device,
    ...(store.shop && {
      params: [
        { name: PARAMS.HOURS, value: store.shop.hours },
        { name: PARAMS.URL, value: store.shop.osm },
      ],
    }),
    features: [
      {
        name: 'Open',
        external_id: ids.feature(FEATURES.OPEN),
        // A read-only switch rather than an opening sensor: on an opening
        // sensor Gladys reads 1 as a closed door, the opposite of a store.
        category: DEVICE_FEATURE_CATEGORIES.SWITCH,
        type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
        min: 0,
        max: 1,
        read_only: true,
        has_feedback: false,
        keep_history: true,
      },
      {
        name: 'Minutes until it opens or closes',
        external_id: ids.feature(FEATURES.NEXT_CHANGE),
        category: DEVICE_FEATURE_CATEGORIES.DURATION,
        type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
        unit: DEVICE_FEATURE_UNITS.MINUTES,
        min: 0,
        max: MAX_MINUTES,
        read_only: true,
        has_feedback: false,
        keep_history: false,
      },
    ],
  };
}

/** Upper bound of a balance, in euros. */
export const MAX_BALANCE = 100000;

export function buildCardDevice(gladys, card) {
  const ids = cardIds(gladys, card.number);
  return {
    name: card.name,
    external_id: ids.device,
    features: [
      {
        name: 'Balance',
        external_id: ids.feature(FEATURES.BALANCE),
        category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
        type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
        unit: DEVICE_FEATURE_UNITS.EURO,
        min: 0,
        max: MAX_BALANCE,
        // Set from the widget or a scene action, never from the device card:
        // a read-only feature keeps Gladys from sending it a command.
        read_only: true,
        has_feedback: false,
        keep_history: true,
      },
    ],
  };
}

/** "E.Leclerc (Maison, 1.3 km)": a nearby shop, in the list of its house. */
export function nearbyName(shop) {
  const distance =
    shop.distance < 1000 ? `${shop.distance} m` : `${(shop.distance / 1000).toFixed(1)} km`;
  return `${shop.name} (${shop.house}, ${distance})`;
}

/**
 * @param {object} gladys
 * @param {Array<{ id: string, name: string }>} stores the stores of the watcher
 * @param {Array<{ number: string, name: string }>} cards the cards of the wallet
 * @param {Array<object>} [nearby] the shops found around the houses, to offer
 *   (HoursFinder.nearby); a shop found near two houses is offered once
 */
export function buildDiscoveredDevices(gladys, stores = [], cards = [], nearby = []) {
  const offered = nearby
    .filter((shop, index) => nearby.findIndex((other) => other.key === shop.key) === index)
    .filter((shop) => !stores.some((store) => store.id === `${OSM_PREFIX}${shop.key}`))
    .map((shop) => ({ id: `${OSM_PREFIX}${shop.key}`, name: nearbyName(shop), shop }));
  return [
    ...stores.map((store) => buildStoreDevice(gladys, store)),
    ...offered.map((store) => buildStoreDevice(gladys, store)),
    ...cards.map((card) => buildCardDevice(gladys, card)),
  ];
}
