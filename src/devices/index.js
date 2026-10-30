// -----------------------------------------------------------------------------
// The devices of the integration.
//
//   - one device per STORE: is it open (a read-only switch, 1 = open), and
//     the minutes until it opens or closes — computed from its hours;
//   - one device per LOYALTY CARD: its balance in euros, set by the user.
//
// The external ids are forever (Gladys keys devices, history, scenes and
// dashboards on them): a store is identified by the slug of its name (see
// storeSlug), a card by its number, never by the name the user gives it.
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

/**
 * @param {object} gladys
 * @param {Array<{ id: string, name: string }>} stores the stores of the watcher
 * @param {Array<{ number: string, name: string }>} cards the cards of the wallet
 */
export function buildDiscoveredDevices(gladys, stores = [], cards = []) {
  return [
    ...stores.map((store) => buildStoreDevice(gladys, store)),
    ...cards.map((card) => buildCardDevice(gladys, card)),
  ];
}
