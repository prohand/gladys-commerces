// -----------------------------------------------------------------------------
// Dashboard widgets (Gladys 5.1+).
//
//   - `store_hours`: is the store open, until when, and today's hours;
//   - `loyalty_card`: a loyalty card's barcode, to scan at the till from a
//     phone, its balance, and a form to update that balance.
//
// The content is declarative (the core renders it, no HTML): see the
// "Dashboard widgets" section of the SDK README for the vocabulary and the
// budget — at most 8 components, 1 focal, 6 tiles, 1 status list, 4 buttons.
// The tests run every content through the SDK's `validateWidgetContent`.
//
// Widget and action keys are stored by the users' dashboards: never renamed.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { MAX_BALANCE } from '../devices/index.js';
import { barcodePng, cardModules } from '../leclerc/barcode.js';
import { formatNumber } from '../leclerc/cards.js';
import { describeHoursError, describeToday, describeWhen } from '../leclerc/store.js';

const logger = createLogger({ name: 'widgets' });

export const WIDGET_KEYS = { STORE_HOURS: 'store_hours', LOYALTY_CARD: 'loyalty_card' };

export const CARD_WIDGET_ACTIONS = { SET_BALANCE: 'set_balance' };

const IMAGE_PREFIX = 'card-';

const clip = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

/** "12.50 €" in the reader's language. */
export function formatEuros(amount, language) {
  return new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(amount);
}

export function buildStoreWidget({ store, language = 'en' }) {
  const status = store.status();
  if (!status) {
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: describeHoursError(store.error) }],
    };
  }
  const components = [
    { type: 'text', variant: 'heading', text: clip(store.config.store_name, 40) },
  ];
  if (status.next) {
    components.push({
      type: 'value',
      value: status.next.inMinutes,
      unit: 'min',
      label: status.open
        ? { en: 'Closes in', fr: 'Ferme dans', de: 'Schließt in', es: 'Cierra en' }
        : { en: 'Opens in', fr: 'Ouvre dans', de: 'Öffnet in', es: 'Abre en' },
      icon: 'clock',
      color: status.open ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
    });
  }
  const items = [
    {
      label: { en: 'Store', fr: 'Magasin', de: 'Markt', es: 'Tienda' },
      value: status.open
        ? { en: 'Open', fr: 'Ouvert', de: 'Geöffnet', es: 'Abierto' }
        : { en: 'Closed', fr: 'Fermé', de: 'Geschlossen', es: 'Cerrado' },
      icon: 'shopping-cart',
      color: status.open ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.DANGER,
    },
  ];
  if (status.next) {
    items.push({
      label: status.open
        ? { en: 'Closes', fr: 'Ferme', de: 'Schließt', es: 'Cierra' }
        : { en: 'Opens', fr: 'Ouvre', de: 'Öffnet', es: 'Abre' },
      value: clip(describeWhen(status.next, language), 40),
      icon: 'clock',
      color: WIDGET_COLORS.INFO,
    });
  }
  items.push({
    label: { en: 'Today', fr: "Aujourd'hui", de: 'Heute', es: 'Hoy' },
    value: describeToday(status),
    icon: 'calendar',
    color: WIDGET_COLORS.NEUTRAL,
  });
  components.push({ type: 'status', items });
  // The minute count moves every minute; the core re-pulls at the TTL.
  return { ttl_seconds: 60, components };
}

/** The card an instance shows: the one chosen in its settings, else the first. */
function chosenCard(wallet, settings) {
  return (settings?.card && wallet.find(settings.card)) || wallet.cards[0] || null;
}

/** The content of the `loyalty_card` widget. */
export function buildCardWidget({ wallet, settings = {}, language = 'en' }) {
  const card = chosenCard(wallet, settings);
  if (!card) {
    return {
      ttl_seconds: 3600,
      components: [
        {
          type: 'text',
          variant: 'body',
          text: {
            en: 'No loyalty card yet: add its number in the Configuration screen of the integration.',
            fr: "Aucune carte de fidélité : ajoutez son numéro dans l'écran Configuration de l'intégration.",
            de: 'Noch keine Kundenkarte: Tragen Sie ihre Nummer im Bildschirm Konfiguration der Integration ein.',
            es: 'Aún no hay tarjeta de fidelidad: añada su número en la pantalla Configuración de la integración.',
          },
        },
      ],
    };
  }
  const known = wallet.balanceOf(card);
  const { symbology } = cardModules(card.number);
  return {
    // The content only changes with a new balance, which nudges the widget.
    ttl_seconds: 3600,
    components: [
      { type: 'text', variant: 'heading', text: clip(`E.Leclerc · ${card.name}`, 40) },
      {
        type: 'image',
        // The bytes only depend on the number: the key may stay the same.
        key: `${IMAGE_PREFIX}${card.number}`,
        alt: {
          en: `Barcode of the card ${card.name}`,
          fr: `Code-barres de la carte ${card.name}`,
          de: `Barcode der Karte ${card.name}`,
          es: `Código de barras de la tarjeta ${card.name}`,
        },
        fit: 'contain',
      },
      {
        type: 'value',
        value: known ? clip(formatEuros(known.balance, language), 12) : '—',
        label: { en: 'Balance', fr: 'Cagnotte', de: 'Guthaben', es: 'Saldo' },
        icon: 'credit-card',
        color: WIDGET_COLORS.PRIMARY,
      },
      {
        type: 'text',
        variant: 'caption',
        text: clip(`${formatNumber(card.number)} · ${symbology}`, 80),
      },
      {
        type: 'button',
        label: {
          en: 'Update the balance',
          fr: 'Modifier la cagnotte',
          de: 'Guthaben aktualisieren',
          es: 'Actualizar el saldo',
        },
        icon: 'edit-2',
        style: 'primary',
        action: {
          key: CARD_WIDGET_ACTIONS.SET_BALANCE,
          params: { card: card.number },
          fields: [
            {
              key: 'balance',
              type: 'number',
              required: true,
              min: 0,
              max: MAX_BALANCE,
              ...(known && { default: known.balance }),
              label: {
                en: 'Balance (€)',
                fr: 'Cagnotte (€)',
                de: 'Guthaben (€)',
                es: 'Saldo (€)',
              },
            },
          ],
        },
      },
    ],
  };
}

/** The PNG of an image key the card widget declared, as raw base64. */
export function cardImage(wallet, imageKey) {
  const card = imageKey.startsWith(IMAGE_PREFIX)
    ? wallet.find(imageKey.slice(IMAGE_PREFIX.length))
    : null;
  if (!card) {
    throw new Error(`Unknown image: ${imageKey}`);
  }
  return barcodePng(card.number).toString('base64');
}

/**
 * The widget handlers, keyed by widget key: `get` for onWidgetGet, `action`
 * for onWidgetAction.
 */
export function widgetHandlers({ store, wallet }) {
  return {
    [WIDGET_KEYS.STORE_HOURS]: {
      get: ({ language }) => buildStoreWidget({ store, language }),
    },
    [WIDGET_KEYS.LOYALTY_CARD]: {
      async get({ settings, language }) {
        await wallet.load();
        return buildCardWidget({ wallet, settings, language });
      },
      async action(actionKey, params, { values } = {}) {
        logger.info(`Widget action loyalty_card.${actionKey}`);
        if (actionKey !== CARD_WIDGET_ACTIONS.SET_BALANCE) {
          throw new Error(`Unknown widget action: ${actionKey}`);
        }
        if (values?.balance === undefined) {
          // An older core drops the form and relays the tap alone.
          throw new Error('This Gladys is too old for the balance form: update Gladys.');
        }
        const card = wallet.find(params?.card);
        if (!card) {
          throw new Error('This card is no longer in the configuration.');
        }
        const balance = await wallet.setBalance(card, values.balance);
        return {
          en: `Balance of ${card.name}: ${formatEuros(balance, 'en')}`,
          fr: `Cagnotte de ${card.name} : ${formatEuros(balance, 'fr')}`,
          de: `Guthaben von ${card.name}: ${formatEuros(balance, 'de')}`,
          es: `Saldo de ${card.name}: ${formatEuros(balance, 'es')}`,
        };
      },
    },
  };
}
