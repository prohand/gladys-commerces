// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen.
//
//   - `test_configuration`: reads the stores and the loyalty cards, and says
//     what came out of both.
//
// The resolved multi-language object is shown under the button; a thrown
// error is shown too. Keys are stored: never renamed.
// -----------------------------------------------------------------------------

import { localize, pick } from '../i18n.js';
import { cardModules } from '../shops/barcode.js';
import { describeHoursError, describePlace, describeStatus } from '../shops/stores.js';

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

/**
 * One line per store: "Bakery: Open, closes at 20:00.", and for a store
 * looked up on OpenStreetMap the shop found, to check it is the right one.
 */
export function describeStores(watcher) {
  return localize((language) => {
    const lines = watcher.stores.map((store) => {
      const status = watcher.status(store);
      const text = status ? describeStatus(status) : describeHoursError(store.error);
      const colon = language === 'fr' ? ' :' : ':';
      const place = describePlace(store.place, language);
      const found = place ? ` (OpenStreetMap${colon} ${place}, ${store.hours})` : '';
      return `${store.name}${colon} ${text[language]}${found}`;
    });
    if (lines.length === 0) {
      lines.push(
        pick(language, {
          en: 'No store.',
          fr: 'Aucun commerce.',
          de: 'Kein Geschäft.',
          es: 'Ningún comercio.',
        }),
      );
    }
    if (watcher.errors.length > 0) {
      const wrong = watcher.errors.join(' / ');
      lines.push(
        pick(language, {
          en: `Not understood (Name = hours or Name = auto expected): ${wrong}.`,
          fr: `Non compris (Nom = horaires ou Nom = auto attendu) : ${wrong}.`,
          de: `Nicht verstanden (Name = Zeiten oder Name = auto erwartet): ${wrong}.`,
          es: `No entendido (se espera Nombre = horario o Nombre = auto): ${wrong}.`,
        }),
      );
    }
    return lines.join('\n');
  });
}

export function actionHandlers({ watcher, wallet }) {
  return {
    async [ACTIONS.TEST_CONFIGURATION]() {
      const stores = describeStores(watcher);
      const cards = describeCards(wallet);
      return localize((language) => `${stores[language]}\n${cards[language]}`);
    },
  };
}
