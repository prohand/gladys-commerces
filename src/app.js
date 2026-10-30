// -----------------------------------------------------------------------------
// The wiring of the integration: every handler registered on the SDK
// instance, before connect(). Kept apart from index.js so the tests run it
// against the SDK's fake Gladys, with a fake clock and an in-memory storage.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { buildDiscoveredDevices } from './devices/index.js';
import { actionHandlers } from './capabilities/actions.js';
import { SCENE_ACTIONS, sceneActionHandlers } from './capabilities/scenes.js';
import { cardImage, WIDGET_KEYS, widgetHandlers } from './capabilities/widgets.js';
import { Wallet } from './shops/cards.js';
import { HoursFinder, RETRY_MS } from './shops/finder.js';
import { StoreWatcher } from './shops/stores.js';

const logger = createLogger({ name: 'app' });

/**
 * @param {object} gladys a GladysIntegration (or the fake one of the tests)
 * @param {object} [deps] replacements for the tests
 * @param {object} [deps.storage] storage of the card balances
 * @param {object} [deps.hoursCache] storage of the hours found on OpenStreetMap
 * @param {typeof fetch} [deps.fetch] the network, for the OpenStreetMap lookups
 * @param {() => Date} [deps.now] clock
 * @param {boolean} [deps.timers] false: no interval timer (the tests tick by hand)
 */
export function createApp(gladys, deps = {}) {
  const { now, timers = true } = deps;
  const finder = new HoursFinder({
    gladys,
    now,
    ...(deps.fetch && { fetch: deps.fetch }),
    ...(deps.hoursCache && { cache: deps.hoursCache }),
  });
  const watcher = new StoreWatcher({ gladys, now, lookup: (search) => finder.get(search) });
  const wallet = new Wallet({ gladys, now, ...(deps.storage && { storage: deps.storage }) });
  let config = null;
  let lookupTimer = null;

  function configure(raw) {
    config = normalizeConfig(raw);
    watcher.configure(config);
    wallet.configure(config);
    return config;
  }
  configure(gladys.config ?? {});

  /**
   * Look the `auto` stores up on OpenStreetMap when needed (HoursFinder says
   * when), then publish their new state. Never throws: a store without hours
   * says why on the screens.
   */
  async function findHours() {
    try {
      if (!(await finder.refresh(watcher.searches, config.search_radius_km))) {
        return;
      }
      watcher.resolve();
      await watcher.tick();
      gladys.requestWidgetRefresh(WIDGET_KEYS.STORE_HOURS);
    } catch (err) {
      logger.error('Opening hours lookup failed', err);
    }
  }

  const devices = () => buildDiscoveredDevices(gladys, watcher.stores, wallet.cards);

  /** (Re)start the stores clock and publish what is known. */
  async function run() {
    await (timers ? watcher.start() : watcher.tick());
    await wallet.publishAll();
  }

  /** Look the `auto` stores up now if needed, then every hour. */
  async function startLookups() {
    if (timers && !lookupTimer) {
      // Asks the finder every hour: it only goes on the network once a day,
      // or an hour after a failure.
      lookupTimer = setInterval(findHours, RETRY_MS);
      lookupTimer.unref?.();
    }
    await findHours();
  }

  gladys.onScanRequest(async () => {
    await gladys.publishDiscoveredDevices(devices());
  });

  // A device just created has none of the states published before it
  // existed (Gladys drops them): the SDK forgets them, publish them again.
  gladys.onDeviceCreated(async () => {
    await watcher.tick();
    await wallet.publishAll();
  });

  for (const [key, handler] of Object.entries(actionHandlers({ watcher, wallet }))) {
    gladys.onAction(key, handler);
  }

  const sceneActions = sceneActionHandlers({ watcher, wallet });
  gladys.onSceneAction(SCENE_ACTIONS.is_store_open, sceneActions.is_store_open);
  gladys.onSceneAction(SCENE_ACTIONS.set_loyalty_balance, sceneActions.set_loyalty_balance);

  const widgets = widgetHandlers({ watcher, wallet });
  gladys.onWidgetGet(WIDGET_KEYS.STORE_HOURS, widgets.store_hours.get);
  gladys.onWidgetGet(WIDGET_KEYS.LOYALTY_CARD, widgets.loyalty_card.get);
  gladys.onWidgetAction(WIDGET_KEYS.LOYALTY_CARD, widgets.loyalty_card.action);
  gladys.onWidgetGetImage(async (imageKey) => cardImage(wallet, imageKey));

  gladys.onConfigUpdated(async (raw) => {
    logger.info('Configuration updated');
    configure(raw);
    // The stores and the cards are devices: publish them again (an upsert).
    await gladys.publishDiscoveredDevices(devices());
    await run();
    for (const key of Object.values(WIDGET_KEYS)) {
      gladys.requestWidgetRefresh(key);
    }
    await startLookups();
  });

  gladys.on('connected', async () => {
    try {
      configure(await gladys.getConfig());
      await gladys.publishDiscoveredDevices(devices());
      await run();
      // Connected means configured: an OpenStreetMap lookup that fails is
      // told per store, it does not disconnect the integration.
      await gladys.setConnectionStatus(true);
      await startLookups();
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
      await gladys
        .setConnectionStatus(false, {
          en: 'Initialization failed, check the integration logs.',
          fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
          de: 'Die Initialisierung ist fehlgeschlagen, prüfen Sie die Logs der Integration.',
          es: 'La inicialización ha fallado, consulte los registros de la integración.',
        })
        .catch(() => {});
    }
  });

  function stop() {
    watcher.stop();
    clearInterval(lookupTimer);
    lookupTimer = null;
  }
  gladys.on('disconnected', stop);

  return { watcher, wallet, finder, stop };
}
