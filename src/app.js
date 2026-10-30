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
import { Wallet } from './leclerc/cards.js';
import { StoreWatcher } from './leclerc/store.js';

const logger = createLogger({ name: 'app' });

/**
 * @param {object} gladys a GladysIntegration (or the fake one of the tests)
 * @param {object} [deps] replacements for the tests
 * @param {object} [deps.storage] storage of the card balances
 * @param {() => Date} [deps.now] clock
 * @param {boolean} [deps.timers] false: no interval timer (the tests tick by hand)
 */
export function createApp(gladys, deps = {}) {
  const { now, timers = true } = deps;
  const store = new StoreWatcher({ gladys, now });
  const wallet = new Wallet({ gladys, now, ...(deps.storage && { storage: deps.storage }) });

  function configure(raw) {
    const config = normalizeConfig(raw);
    store.configure(config);
    wallet.configure(config);
    return config;
  }
  let config = configure(gladys.config ?? {});

  const devices = () => buildDiscoveredDevices(gladys, config, wallet.cards);

  /** (Re)start the store clock and publish what is known. */
  async function run() {
    await (timers ? store.start() : store.tick());
    await wallet.publishAll();
  }

  gladys.onScanRequest(async () => {
    await gladys.publishDiscoveredDevices(devices());
  });

  // A device just created has none of the states published before it
  // existed (Gladys drops them): the SDK forgets them, publish them again.
  gladys.onDeviceCreated(async () => {
    await store.tick();
    await wallet.publishAll();
  });

  for (const [key, handler] of Object.entries(actionHandlers({ store, wallet }))) {
    gladys.onAction(key, handler);
  }

  const sceneActions = sceneActionHandlers({ store, wallet });
  gladys.onSceneAction(SCENE_ACTIONS.is_store_open, sceneActions.is_store_open);
  gladys.onSceneAction(SCENE_ACTIONS.set_loyalty_balance, sceneActions.set_loyalty_balance);

  const widgets = widgetHandlers({ store, wallet });
  gladys.onWidgetGet(WIDGET_KEYS.STORE_HOURS, widgets.store_hours.get);
  gladys.onWidgetGet(WIDGET_KEYS.LOYALTY_CARD, widgets.loyalty_card.get);
  gladys.onWidgetAction(WIDGET_KEYS.LOYALTY_CARD, widgets.loyalty_card.action);
  gladys.onWidgetGetImage(async (imageKey) => cardImage(wallet, imageKey));

  gladys.onConfigUpdated(async (raw) => {
    logger.info('Configuration updated');
    config = configure(raw);
    // The store name and the cards are devices: publish them again (an upsert).
    await gladys.publishDiscoveredDevices(devices());
    await run();
    for (const key of Object.values(WIDGET_KEYS)) {
      gladys.requestWidgetRefresh(key);
    }
  });

  gladys.on('connected', async () => {
    try {
      config = configure(await gladys.getConfig());
      await gladys.publishDiscoveredDevices(devices());
      await run();
      // Nothing to reach on the network: connected means configured.
      await gladys.setConnectionStatus(true);
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
    store.stop();
  }
  gladys.on('disconnected', stop);

  return { store, wallet, stop };
}
