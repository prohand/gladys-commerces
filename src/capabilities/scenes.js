// -----------------------------------------------------------------------------
// Scene triggers and actions (Gladys 5.1+).
//
// TRIGGERS — something happened, fired with `gladys.publishSceneEvent`:
//   - `product_recalled`: a new recall concerns the store (src/leclerc/recallFeed.js);
//   - `store_opening_soon` / `store_closing_soon`: the store opens or closes in
//     the configured number of minutes (src/leclerc/store.js).
// Whether the store IS open is a state, not an event: it is the "Open"
// feature of the store device, usable in any Gladys condition.
//
// ACTIONS — an operation a scene author places in a scene, with outputs the
// following actions read:
//   - `check_barcode`: is this product recalled?
//   - `is_store_open`: is the store open now, and until when?
// Neither fires an event: a scene bound to an event fired by its own action
// would loop through the integration.
//
// Keys are stored in the users' scenes: never rename them.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { RECALL_TRIGGER, SOLD_AT, title } from '../leclerc/recallFeed.js';
import { STORE_TRIGGERS } from '../leclerc/store.js';
import { checkBarcode } from './barcode.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_TRIGGERS = {
  PRODUCT_RECALLED: RECALL_TRIGGER,
  STORE_OPENING_SOON: STORE_TRIGGERS.OPENING_SOON,
  STORE_CLOSING_SOON: STORE_TRIGGERS.CLOSING_SOON,
};

export { SOLD_AT };

export const SCENE_ACTIONS = {
  check_barcode: 'check_barcode',
  is_store_open: 'is_store_open',
};

/**
 * The scene action handlers, keyed as SCENE_ACTIONS.
 * @param {{ store: import('../leclerc/store.js').StoreWatcher, find?: Function }} context
 */
export function sceneActionHandlers({ store, find }) {
  return {
    async [SCENE_ACTIONS.check_barcode](fields) {
      logger.info(`Scene action check_barcode <- ${fields.barcode}`);
      const { recalls } = await checkBarcode(fields.barcode, { find });
      const recall = recalls[0];
      return {
        recalled: Boolean(recall),
        product: recall ? title(recall) : '',
        reason: recall?.reason ?? '',
        link: recall?.link ?? '',
      };
    },

    async [SCENE_ACTIONS.is_store_open]() {
      const status = store.status();
      if (!status) {
        // Throwing fails this action only; the scene logs why and goes on.
        throw new Error(`Opening hours not understood: ${store.error?.message}`);
      }
      return {
        open: status.open,
        next_change: status.next?.time ?? '',
        minutes_to_change: status.next?.inMinutes ?? 0,
      };
    },
  };
}
