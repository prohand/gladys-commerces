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
          en: 'No store created or typed yet.',
          fr: 'Aucun commerce créé ou écrit pour le moment.',
          de: 'Noch kein Geschäft angelegt oder eingetragen.',
          es: 'Aún no hay comercios creados ni escritos.',
        }),
      );
    }
    if (watcher.errors.length > 0) {
      const wrong = watcher.errors.join(' / ');
      lines.push(
        pick(language, {
          en: `Not understood, a shop name is missing (e.g. Leclerc, or Leclerc = Mo-Sa 08:30-20:00): ${wrong}.`,
          fr: `Non compris, il manque le nom du commerce (ex. Leclerc, ou Leclerc = Mo-Sa 08:30-20:00) : ${wrong}.`,
          de: `Nicht verstanden, der Name des Geschäfts fehlt (z. B. Leclerc oder Leclerc = Mo-Sa 08:30-20:00): ${wrong}.`,
          es: `No entendido, falta el nombre del comercio (p. ej. Leclerc, o Leclerc = Mo-Sa 08:30-20:00): ${wrong}.`,
        }),
      );
    }
    return lines.join('\n');
  });
}

/**
 * What the Discovery tab offers, or why it offers nothing: the shops found
 * only show there, a test of the configuration must say so.
 */
export function describeDiscovery(finder, config) {
  const { state, houses = [], message } = finder.status;
  const count = new Set(finder.nearby.map((shop) => shop.key)).size;
  const where = houses.join(', ');
  return localize((language) => {
    const prefix = pick(language, {
      en: 'Discovery tab:',
      fr: 'Onglet Découverte :',
      de: 'Reiter Erkennung:',
      es: 'Pestaña Descubrimiento:',
    });
    const text = (() => {
      if (config.discover_kinds.length === 0) {
        return pick(language, {
          en: 'no kind of shop checked, nothing is offered.',
          fr: "aucun type de commerce coché, rien n'est proposé.",
          de: 'keine Art von Geschäft angekreuzt, nichts wird angeboten.',
          es: 'ningún tipo de comercio marcado, no se propone nada.',
        });
      }
      switch (state) {
        case 'no_key':
          return pick(language, {
            en: 'no overpass.ch key: paste your free key in the configuration (steps in the documentation).',
            fr: 'pas de clé overpass.ch : collez votre clé gratuite dans la configuration (étapes dans la documentation).',
            de: 'kein overpass.ch-Schlüssel: Fügen Sie Ihren kostenlosen Schlüssel in die Konfiguration ein (Schritte in der Dokumentation).',
            es: 'sin clave de overpass.ch: pegue su clave gratuita en la configuración (pasos en la documentación).',
          });
        case 'no_house':
          return pick(language, {
            en: 'no house searched has a location: set it in Settings → Houses.',
            fr: "aucune maison cherchée n'a d'emplacement : renseignez-le dans Paramètres → Maisons.",
            de: 'kein gesuchtes Haus hat einen Standort: Legen Sie ihn unter Einstellungen → Häuser fest.',
            es: 'ninguna casa buscada tiene ubicación: indíquela en Ajustes → Casas.',
          });
        case 'no_access':
          return pick(language, {
            en: 'the integration cannot read the location of the houses: reinstall it to grant that access.',
            fr: "l'intégration ne peut pas lire l'emplacement des maisons : réinstallez-la pour lui donner cet accès.",
            de: 'die Integration kann den Standort der Häuser nicht lesen: Installieren Sie sie neu, um diesen Zugriff zu gewähren.',
            es: 'la integración no puede leer la ubicación de las casas: reinstálela para concederle ese acceso.',
          });
        case 'unreachable':
          return pick(language, {
            en: `OpenStreetMap could not be reached (${message}): new try within the hour, or test again.`,
            fr: `OpenStreetMap n'a pas pu être joint (${message}) : nouvel essai dans l'heure, ou testez de nouveau.`,
            de: `OpenStreetMap war nicht erreichbar (${message}): neuer Versuch innerhalb einer Stunde, oder erneut testen.`,
            es: `No se pudo contactar con OpenStreetMap (${message}): nuevo intento en la próxima hora, o pruebe de nuevo.`,
          });
        case 'ok':
          return count === 0
            ? pick(language, {
                en: `no shop of the kinds checked publishes its hours on OpenStreetMap within ${config.search_radius_km} km of ${where}.`,
                fr: `aucun commerce des types cochés ne publie ses horaires sur OpenStreetMap à moins de ${config.search_radius_km} km de ${where}.`,
                de: `kein Geschäft der angekreuzten Arten veröffentlicht seine Zeiten auf OpenStreetMap im Umkreis von ${config.search_radius_km} km um ${where}.`,
                es: `ningún comercio de los tipos marcados publica su horario en OpenStreetMap a menos de ${config.search_radius_km} km de ${where}.`,
              })
            : pick(language, {
                en: `${count} shop(s) found around ${where}: create the ones you go to.`,
                fr: `${count} commerce(s) trouvé(s) autour de ${where} : créez ceux où vous allez.`,
                de: `${count} Geschäft(e) rund um ${where} gefunden: Legen Sie die an, in die Sie gehen.`,
                es: `${count} comercio(s) encontrado(s) alrededor de ${where}: cree aquellos a los que va.`,
              });
        default:
          return pick(language, {
            en: 'looking on OpenStreetMap…',
            fr: 'recherche sur OpenStreetMap…',
            de: 'Suche auf OpenStreetMap…',
            es: 'buscando en OpenStreetMap…',
          });
      }
    })();
    return `${prefix} ${text}`;
  });
}

/**
 * @param {object} context
 * @param {object} context.watcher
 * @param {object} context.wallet
 * @param {object} [context.finder] the OpenStreetMap lookups (HoursFinder)
 * @param {() => object} [context.config] the configuration now
 * @param {() => Promise<void>} [context.findHours] a lookup asked by the user
 */
export function actionHandlers({ watcher, wallet, finder, config, findHours }) {
  return {
    async [ACTIONS.TEST_CONFIGURATION]() {
      // The user just saved or is checking: look up now, even after a failure.
      await findHours?.();
      const stores = describeStores(watcher);
      const discovery = finder ? describeDiscovery(finder, config()) : null;
      const cards = describeCards(wallet);
      return localize((language) =>
        [stores[language], discovery?.[language], cards[language]].filter(Boolean).join('\n'),
      );
    },
  };
}
