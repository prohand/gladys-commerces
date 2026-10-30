// -----------------------------------------------------------------------------
// Scene triggers and actions (Gladys 5.1+).
//
// TRIGGERS — something happened, fired with `gladys.publishSceneEvent` by
// src/shops/stores.js: a store opens or closes in the configured number of
// minutes (filter: the store). Whether a store IS open is a state, not an
// event: it is the "Open" feature of its device, usable in any Gladys
// condition.
//
// ACTIONS — an operation a scene author places in a scene, with outputs the
// following actions read:
//   - `is_store_open`: is this store open now, and until when?
// It fires no event: a scene bound to an event fired by its own action would
// loop through the integration.
//
// Keys are stored in the users' scenes: never rename them.
// -----------------------------------------------------------------------------

import { describeHoursError, LookupError, STORE_TRIGGERS } from '../shops/stores.js';

export const SCENE_TRIGGERS = {
  STORE_OPENING_SOON: STORE_TRIGGERS.OPENING_SOON,
  STORE_CLOSING_SOON: STORE_TRIGGERS.CLOSING_SOON,
};

export const SCENE_ACTIONS = {
  is_store_open: 'is_store_open',
};

/**
 * The scene action handlers, keyed as SCENE_ACTIONS.
 * @param {{ watcher: import('../shops/stores.js').StoreWatcher }} context
 */
export function sceneActionHandlers({ watcher }) {
  return {
    async [SCENE_ACTIONS.is_store_open](fields) {
      const store = watcher.find(fields.device);
      if (!store) {
        // Throwing fails this action only; the scene logs why and goes on.
        throw new Error('This store is no longer in the configuration.');
      }
      const status = watcher.status(store);
      if (!status) {
        const why =
          store.error instanceof LookupError
            ? describeHoursError(store.error).en
            : `not understood: ${store.error?.message}`;
        throw new Error(`Opening hours of "${store.name}": ${why}`);
      }
      return {
        open: status.open,
        next_change: status.next?.time ?? '',
        minutes_to_change: status.next?.inMinutes ?? 0,
      };
    },
  };
}
