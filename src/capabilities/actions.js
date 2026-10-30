// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen.
//
//   - `test_connection`: reads the opening hours and RappelConso, and says
//     what came out of both;
//   - `check_barcode`: is this product recalled?
//
// The resolved multi-language object is shown under the button; a thrown
// error is shown too. Keys are stored: never renamed.
// -----------------------------------------------------------------------------

import { localize } from '../i18n.js';
import { describeFeed } from '../leclerc/recallFeed.js';
import { describeHoursError, describeStatus } from '../leclerc/store.js';
import { checkBarcode, describeCheck } from './barcode.js';

export const ACTIONS = { TEST_CONNECTION: 'test_connection', CHECK_BARCODE: 'check_barcode' };

export function actionHandlers({ store, feed, find }) {
  return {
    async [ACTIONS.TEST_CONNECTION]() {
      const status = store.status();
      const hours = status ? describeStatus(status) : describeHoursError(store.error);
      let recalls;
      try {
        await feed.refresh();
        recalls = describeFeed(feed);
      } catch (err) {
        recalls = localize(
          (language) =>
            ({
              en: `RappelConso cannot be reached: ${err.message}`,
              fr: `RappelConso est injoignable : ${err.message}`,
              de: `RappelConso ist nicht erreichbar: ${err.message}`,
              es: `RappelConso no responde: ${err.message}`,
            })[language],
        );
      }
      return localize((language) => `${hours[language]} ${recalls[language]}`);
    },

    async [ACTIONS.CHECK_BARCODE](fields) {
      return describeCheck(await checkBarcode(fields.barcode, { find }));
    },
  };
}
