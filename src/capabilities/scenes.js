// -----------------------------------------------------------------------------
// Scene triggers and actions (Gladys 5.1+).
//
// TRIGGERS — something happened, fired with `gladys.publishSceneEvent` by
// src/shops/stores.js: a store opens or closes in the configured number of
// minutes (filter: the store). Whether a store IS open is a state, not an
// event: it is the "Open" feature of its device, usable in any Gladys
// condition — and so is the balance of a loyalty card.
//
// ACTIONS — an operation a scene author places in a scene, with outputs the
// following actions read:
//   - `is_store_open`: is this store open now, and until when?
//   - `set_loyalty_balance`: set, or add to, the balance of a loyalty card
//     (e.g. a scene run after shopping).
// Neither fires an event: a scene bound to an event fired by its own action
// would loop through the integration.
//
// Keys are stored in the users' scenes: never rename them.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { STORE_TRIGGERS } from '../shops/stores.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_TRIGGERS = {
  STORE_OPENING_SOON: STORE_TRIGGERS.OPENING_SOON,
  STORE_CLOSING_SOON: STORE_TRIGGERS.CLOSING_SOON,
};

export const SCENE_ACTIONS = {
  is_store_open: 'is_store_open',
  set_loyalty_balance: 'set_loyalty_balance',
};

/** Values of the `mode` field of `set_loyalty_balance`. */
export const BALANCE_MODES = { SET: 'set', ADD: 'add' };

/**
 * The scene action handlers, keyed as SCENE_ACTIONS.
 * @param {{ watcher: import('../shops/stores.js').StoreWatcher, wallet: import('../shops/cards.js').Wallet }} context
 */
export function sceneActionHandlers({ watcher, wallet }) {
  return {
    async [SCENE_ACTIONS.is_store_open](fields) {
      const store = watcher.find(fields.device);
      if (!store) {
        // Throwing fails this action only; the scene logs why and goes on.
        throw new Error('This store is no longer in the configuration.');
      }
      const status = watcher.status(store);
      if (!status) {
        throw new Error(`Opening hours of "${store.name}" not understood: ${store.error?.message}`);
      }
      return {
        open: status.open,
        next_change: status.next?.time ?? '',
        minutes_to_change: status.next?.inMinutes ?? 0,
      };
    },

    async [SCENE_ACTIONS.set_loyalty_balance](fields) {
      const card = wallet.find(fields.device);
      if (!card) {
        throw new Error('This loyalty card is no longer in the configuration.');
      }
      const amount = Number(fields.amount);
      let balance = amount;
      if (fields.mode === BALANCE_MODES.ADD) {
        await wallet.load();
        balance = Math.max(0, (wallet.balanceOf(card)?.balance ?? 0) + amount);
      }
      logger.info(`Scene action set_loyalty_balance <- ${card.name}`);
      return { balance: await wallet.setBalance(card, balance) };
    },
  };
}
