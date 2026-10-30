// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen.
//
//   - `test_configuration`: reads the opening hours and the loyalty cards, and
//     says what came out of both.
//
// The resolved multi-language object is shown under the button; a thrown
// error is shown too. Keys are stored: never renamed.
// -----------------------------------------------------------------------------

import { localize, pick } from '../i18n.js';
import { cardModules } from '../leclerc/barcode.js';
import { describeHoursError, describeStatus } from '../leclerc/store.js';

export const ACTIONS = { TEST_CONFIGURATION: 'test_configuration' };

/** "2 card(s): Marie (EAN-13), Paul (Code 128). Not understood: abc." */
export function describeCards(wallet) {
  const list = wallet.cards
    .map((card) => `${card.name} (${cardModules(card.number).symbology})`)
    .join(', ');
  return localize((language) => {
    const cards =
      wallet.cards.length === 0
        ? pick(language, {
            en: 'No loyalty card.',
            fr: 'Aucune carte de fidélité.',
            de: 'Keine Kundenkarte.',
            es: 'Ninguna tarjeta de fidelidad.',
          })
        : pick(language, {
            en: `${wallet.cards.length} loyalty card(s): ${list}.`,
            fr: `${wallet.cards.length} carte(s) de fidélité : ${list}.`,
            de: `${wallet.cards.length} Kundenkarte(n): ${list}.`,
            es: `${wallet.cards.length} tarjeta(s) de fidelidad: ${list}.`,
          });
    if (wallet.errors.length === 0) {
      return cards;
    }
    const wrong = wallet.errors.join(' / ');
    return `${cards} ${pick(language, {
      en: `Not understood: ${wrong}.`,
      fr: `Non compris : ${wrong}.`,
      de: `Nicht verstanden: ${wrong}.`,
      es: `No entendido: ${wrong}.`,
    })}`;
  });
}

export function actionHandlers({ store, wallet }) {
  return {
    async [ACTIONS.TEST_CONFIGURATION]() {
      const status = store.status();
      const hours = status ? describeStatus(status) : describeHoursError(store.error);
      const cards = describeCards(wallet);
      return localize((language) => `${hours[language]} ${cards[language]}`);
    },
  };
}
