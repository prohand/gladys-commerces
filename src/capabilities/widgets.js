// -----------------------------------------------------------------------------
// Dashboard widgets (Gladys 5.1+).
//
//   - `store_hours`: which stores are open, until when — or one store in
//     detail, with today's hours;
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
import { pick } from '../i18n.js';
import { barcodePng, cardModules } from '../shops/barcode.js';
import { formatNumber } from '../shops/cards.js';
import {
  describeHoursError,
  describeHoursShort,
  describePlace,
  describeToday,
  describeWhen,
} from '../shops/stores.js';

const logger = createLogger({ name: 'widgets' });

export const WIDGET_KEYS = { STORE_HOURS: 'store_hours', LOYALTY_CARD: 'loyalty_card' };

export const CARD_WIDGET_ACTIONS = { SET_BALANCE: 'set_balance' };

const IMAGE_PREFIX = 'card-';

const clip = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

/** "12.50 €" in the reader's language. */
export function formatEuros(amount, language) {
  return new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(amount);
}

/** "Open · closes at 20:00", short enough for a status row (40). */
function statusLine(status, language) {
  const state = pick(
    language,
    status.open
      ? { en: 'Open', fr: 'Ouvert', de: 'Geöffnet', es: 'Abierto' }
      : { en: 'Closed', fr: 'Fermé', de: 'Geschlossen', es: 'Cerrado' },
  );
  if (!status.next) {
    return state;
  }
  const verb = pick(
    language,
    status.open
      ? { en: 'closes', fr: 'ferme', de: 'schließt', es: 'cierra' }
      : { en: 'opens', fr: 'ouvre', de: 'öffnet', es: 'abre' },
  );
  return clip(`${state} · ${verb} ${describeWhen(status.next, language)}`, 40);
}

/** Every store on one status list. */
function buildStoresOverview(watcher, language) {
  return {
    ttl_seconds: 60,
    components: [
      {
        type: 'status',
        items: watcher.stores.map((store) => {
          const status = watcher.status(store);
          return {
            label: clip(store.name, 40),
            value: status ? statusLine(status, language) : describeHoursShort(store.error),
            icon: 'shopping-bag',
            color: !status
              ? WIDGET_COLORS.WARNING
              : status.open
                ? WIDGET_COLORS.SUCCESS
                : WIDGET_COLORS.DANGER,
          };
        }),
      },
    ],
  };
}

/** One store in detail: a countdown tile and its state, next change, today's hours. */
function buildStoreDetail(watcher, store, language) {
  const status = watcher.status(store);
  if (!status) {
    return {
      ttl_seconds: 300,
      components: [
        { type: 'text', variant: 'heading', text: clip(store.name, 40) },
        { type: 'text', variant: 'body', text: describeHoursError(store.error) },
      ],
    };
  }
  const components = [{ type: 'text', variant: 'heading', text: clip(store.name, 40) }];
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
      label: { en: 'Now', fr: 'Maintenant', de: 'Jetzt', es: 'Ahora' },
      value: status.open
        ? { en: 'Open', fr: 'Ouvert', de: 'Geöffnet', es: 'Abierto' }
        : { en: 'Closed', fr: 'Fermé', de: 'Geschlossen', es: 'Cerrado' },
      icon: 'shopping-bag',
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
  const place = describePlace(store.place, language);
  if (place) {
    items.push({
      label: 'OpenStreetMap',
      value: clip(place, 40),
      icon: 'map-pin',
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  components.push({ type: 'status', items });
  // The minute count moves every minute; the core re-pulls at the TTL.
  return { ttl_seconds: 60, components };
}

/**
 * The content of the `store_hours` widget: the store chosen in the instance
 * settings in detail, or every store at a glance.
 */
export function buildStoreWidget({ watcher, settings = {}, language = 'en' }) {
  if (watcher.stores.length === 0) {
    return {
      ttl_seconds: 3600,
      components: [
        {
          type: 'text',
          variant: 'body',
          text: {
            en: 'No store yet: add your stores and their hours in the Configuration screen of the integration.',
            fr: "Aucun commerce : ajoutez vos commerces et leurs horaires dans l'écran Configuration de l'intégration.",
            de: 'Noch kein Geschäft: Tragen Sie Ihre Geschäfte und ihre Zeiten im Bildschirm Konfiguration der Integration ein.',
            es: 'Aún no hay comercios: añada sus comercios y su horario en la pantalla Configuración de la integración.',
          },
        },
      ],
    };
  }
  const store = settings?.store ? watcher.find(settings.store) : null;
  return store
    ? buildStoreDetail(watcher, store, language)
    : buildStoresOverview(watcher, language);
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
      { type: 'text', variant: 'heading', text: clip(card.name, 40) },
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
export function widgetHandlers({ watcher, wallet }) {
  return {
    [WIDGET_KEYS.STORE_HOURS]: {
      get: ({ settings, language }) => buildStoreWidget({ watcher, settings, language }),
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
