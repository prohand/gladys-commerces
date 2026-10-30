// -----------------------------------------------------------------------------
// The two devices of the integration.
//
//   - the STORE: is it open (a read-only switch, 1 = open), and the minutes
//     until it opens or closes — computed locally from the opening hours;
//   - the RECALLS: how many product recalls concern the store over the
//     configured window, and the title of the latest one — read from the
//     RappelConso open data.
//
// The external ids are forever (Gladys keys devices, history, scenes and
// dashboards on them): there is one store and one recall feed per
// integration, so their platform ids are fixed words, never a label the user
// can change.
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
  RECALL_COUNT: 'count',
  LAST_RECALL: 'last',
};

export function storeIds(gladys) {
  return gladys.externalIds('store', 'main');
}

export function recallIds(gladys) {
  return gladys.externalIds('recalls', 'rappelconso');
}

/** Upper bound of the "minutes until" feature: the week and a day looked ahead. */
const MAX_MINUTES = 8 * 24 * 60;

export function buildStoreDevice(gladys, config) {
  const ids = storeIds(gladys);
  return {
    name: config.store_name,
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

export function buildRecallsDevice(gladys) {
  const ids = recallIds(gladys);
  return {
    name: 'E.Leclerc product recalls',
    external_id: ids.device,
    features: [
      {
        name: 'Recalls',
        external_id: ids.feature(FEATURES.RECALL_COUNT),
        category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
        type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
        min: 0,
        max: 10000,
        read_only: true,
        has_feedback: false,
        keep_history: true,
      },
      {
        name: 'Latest recall',
        external_id: ids.feature(FEATURES.LAST_RECALL),
        category: DEVICE_FEATURE_CATEGORIES.TEXT,
        type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
        min: 0,
        max: 0,
        read_only: true,
        has_feedback: false,
        keep_history: false,
      },
    ],
  };
}

export function buildDiscoveredDevices(gladys, config) {
  return [buildStoreDevice(gladys, config), buildRecallsDevice(gladys)];
}
