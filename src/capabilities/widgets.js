// -----------------------------------------------------------------------------
// Dashboard widgets (Gladys 5.1+).
//
//   - `store_hours`: is the store open, until when, and today's hours;
//   - `product_recalls`: the latest recalls that concern the store, a form to
//     check a barcode, and a refresh button.
//
// The content is declarative (the core renders it, no HTML): see the
// "Dashboard widgets" section of the SDK README for the vocabulary and the
// budget — at most 8 components, 1 focal, 6 tiles, 1 status list, 4 buttons.
// The tests run every content through the SDK's `validateWidgetContent`.
//
// Widget and action keys are stored by the users' dashboards: never renamed.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { localize, pick } from '../i18n.js';
import { categoryLabel, describeFeed, title } from '../leclerc/recallFeed.js';
import { describeHoursError, describeToday, describeWhen } from '../leclerc/store.js';
import { checkBarcode, describeCheck } from './barcode.js';

const logger = createLogger({ name: 'widgets' });

export const WIDGET_KEYS = { STORE_HOURS: 'store_hours', PRODUCT_RECALLS: 'product_recalls' };

export const RECALL_WIDGET_ACTIONS = { CHECK_BARCODE: 'check_barcode', REFRESH: 'refresh' };

/** How many recalls the list shows when the instance says nothing. */
export const DEFAULT_RECALLS_SHOWN = 5;
/** A `list` card-list holds 8 rows at most. */
const MAX_RECALLS_SHOWN = 8;

const RAPPEL_CONSO_URL = 'https://rappel.conso.gouv.fr/';

const clip = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

/** The content of the `store_hours` widget. */
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

/** How many recalls an instance lists. */
function recallsShown(settings) {
  const value = Number(settings?.count ?? DEFAULT_RECALLS_SHOWN);
  return Number.isFinite(value)
    ? Math.min(MAX_RECALLS_SHOWN, Math.max(0, Math.round(value)))
    : DEFAULT_RECALLS_SHOWN;
}

/** One recall as a row of the list; the detail panel carries the notice. */
function recallItem(recall, language) {
  const lines = [
    [{ en: 'Reason', fr: 'Motif', de: 'Grund', es: 'Motivo' }, recall.reason],
    [{ en: 'Risks', fr: 'Risques', de: 'Risiken', es: 'Riesgos' }, recall.risks],
    [{ en: 'What to do', fr: 'Que faire', de: 'Was tun', es: 'Qué hacer' }, recall.advice],
    [
      { en: 'Sold at', fr: 'Distributeurs', de: 'Verkauft bei', es: 'Vendido en' },
      recall.retailers,
    ],
  ]
    .filter(([, text]) => text)
    // French puts a space before the colon.
    .map(([label, text]) => `${pick(language, label)}${language === 'fr' ? ' :' : ':'} ${text}`);
  const item = {
    title: clip(title(recall), 60),
    subtitle: clip(categoryLabel(recall.categoryKey, language), 60),
    badge: {
      text: clip(categoryLabel(recall.categoryKey, language), 16),
      color: recall.namesLeclerc ? WIDGET_COLORS.DANGER : WIDGET_COLORS.WARNING,
    },
    description: clip(lines.join('\n'), 2000),
  };
  if (recall.publishedAt) {
    item.date = recall.publishedAt;
  }
  if (recall.link.startsWith('https://')) {
    item.links = [
      {
        url: recall.link,
        label: {
          en: 'Recall notice',
          fr: 'Fiche de rappel',
          de: 'Rückrufmeldung',
          es: 'Ficha del aviso',
        },
      },
    ];
  }
  return item;
}

/** The content of the `product_recalls` widget. */
export function buildRecallsWidget({ feed, settings = {}, language = 'en' }) {
  const components = [];
  if (feed.lastError && !feed.lastSuccess) {
    components.push({
      type: 'text',
      variant: 'caption',
      text: {
        en: 'RappelConso cannot be reached yet.',
        fr: 'RappelConso est injoignable pour le moment.',
        de: 'RappelConso ist noch nicht erreichbar.',
        es: 'RappelConso aún no responde.',
      },
    });
  }
  components.push({
    type: 'value',
    value: feed.recalls.length,
    label: localize((lang) =>
      pick(lang, {
        en: `Recalls, ${feed.config.recall_days} days`,
        fr: `Rappels, ${feed.config.recall_days} jours`,
        de: `Rückrufe, ${feed.config.recall_days} Tage`,
        es: `Avisos, ${feed.config.recall_days} días`,
      }),
    ),
    icon: 'alert-triangle',
    color: feed.recalls.length > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
  });
  const shown = recallsShown(settings);
  if (shown > 0 && feed.recalls.length > 0) {
    components.push({
      type: 'card-list',
      display: 'list',
      items: feed.recalls.slice(0, shown).map((recall) => recallItem(recall, language)),
    });
  }
  components.push(
    {
      type: 'button',
      label: {
        en: 'Check a barcode',
        fr: 'Vérifier un code-barres',
        de: 'Barcode prüfen',
        es: 'Comprobar un código',
      },
      icon: 'search',
      style: 'primary',
      action: {
        key: RECALL_WIDGET_ACTIONS.CHECK_BARCODE,
        fields: [
          {
            key: 'barcode',
            type: 'string',
            required: true,
            label: {
              en: 'Barcode (8 or 13 digits)',
              fr: 'Code-barres (8 ou 13 chiffres)',
              de: 'Barcode (8 oder 13 Ziffern)',
              es: 'Código de barras (8 o 13 cifras)',
            },
          },
        ],
      },
    },
    {
      type: 'button',
      label: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
      icon: 'refresh-cw',
      style: 'secondary',
      action: { key: RECALL_WIDGET_ACTIONS.REFRESH },
    },
    {
      type: 'button',
      label: { en: 'RappelConso', fr: 'RappelConso', de: 'RappelConso', es: 'RappelConso' },
      icon: 'external-link',
      style: 'secondary',
      link: { url: RAPPEL_CONSO_URL },
    },
  );
  return { ttl_seconds: 300, components };
}

/**
 * The widget handlers, keyed by widget key: `get` for onWidgetGet, `action`
 * for onWidgetAction.
 */
export function widgetHandlers({ store, feed, find }) {
  return {
    [WIDGET_KEYS.STORE_HOURS]: {
      get: ({ language }) => buildStoreWidget({ store, language }),
    },
    [WIDGET_KEYS.PRODUCT_RECALLS]: {
      get: ({ settings, language }) => buildRecallsWidget({ feed, settings, language }),
      async action(actionKey, _params, { values } = {}) {
        logger.info(`Widget action product_recalls.${actionKey}`);
        if (actionKey === RECALL_WIDGET_ACTIONS.CHECK_BARCODE) {
          if (!values?.barcode) {
            // An older core drops the form and relays the tap alone.
            throw new Error('This Gladys is too old for the barcode form: update Gladys.');
          }
          return describeCheck(await checkBarcode(values.barcode, { find }), 200);
        }
        if (actionKey === RECALL_WIDGET_ACTIONS.REFRESH) {
          await feed.refresh();
          return describeFeed(feed);
        }
        throw new Error(`Unknown widget action: ${actionKey}`);
      },
    },
  };
}
