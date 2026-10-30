// -----------------------------------------------------------------------------
// The wiring of the integration: every handler registered on the SDK
// instance, before connect(). Kept apart from index.js so the tests run it
// against the SDK's fake Gladys, with a fake RappelConso and a fake clock.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { buildDiscoveredDevices } from './devices/index.js';
import { actionHandlers } from './capabilities/actions.js';
import { SCENE_ACTIONS, sceneActionHandlers } from './capabilities/scenes.js';
import { WIDGET_KEYS, widgetHandlers } from './capabilities/widgets.js';
import { RecallFeed } from './leclerc/recallFeed.js';
import { findRecallsByBarcode } from './leclerc/recalls.js';
import { StoreWatcher } from './leclerc/store.js';

const logger = createLogger({ name: 'app' });

/**
 * @param {object} gladys a GladysIntegration (or the fake one of the tests)
 * @param {object} [deps] replacements for the tests
 * @param {Function} [deps.fetchRecalls] RappelConso reader
 * @param {Function} [deps.findRecalls] RappelConso barcode search
 * @param {object} [deps.memory] memory of the recalls seen
 * @param {() => Date} [deps.now] clock
 * @param {boolean} [deps.timers] false: no interval timers (the tests tick by hand)
 */
export function createApp(gladys, deps = {}) {
  const { now, timers = true } = deps;
  const find = deps.findRecalls ?? findRecallsByBarcode;
  const store = new StoreWatcher({ gladys, now });
  const feed = new RecallFeed({
    gladys,
    now,
    ...(deps.fetchRecalls && { fetch: deps.fetchRecalls }),
    ...(deps.memory && { memory: deps.memory }),
  });

  function configure(raw) {
    const config = normalizeConfig(raw);
    store.configure(config);
    feed.configure(config);
    return config;
  }
  let config = configure(gladys.config ?? {});

  /** Start (or restart, on a new configuration) both loops. */
  async function run() {
    if (timers) {
      await Promise.all([store.start(), feed.start()]);
    } else {
      await store.tick();
      await feed.refresh().catch(() => {});
    }
  }

  gladys.onScanRequest(async () => {
    await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
  });

  // A device just created has none of the states published before it
  // existed (Gladys drops them): the SDK forgets them, publish them again.
  gladys.onDeviceCreated(async () => {
    await store.tick();
    if (feed.lastSuccess) {
      await feed.refresh().catch(() => {});
    }
  });

  for (const [key, handler] of Object.entries(actionHandlers({ store, feed, find }))) {
    gladys.onAction(key, handler);
  }

  const sceneActions = sceneActionHandlers({ store, find });
  gladys.onSceneAction(SCENE_ACTIONS.check_barcode, sceneActions.check_barcode);
  gladys.onSceneAction(SCENE_ACTIONS.is_store_open, sceneActions.is_store_open);

  const widgets = widgetHandlers({ store, feed, find });
  gladys.onWidgetGet(WIDGET_KEYS.STORE_HOURS, widgets.store_hours.get);
  gladys.onWidgetGet(WIDGET_KEYS.PRODUCT_RECALLS, widgets.product_recalls.get);
  gladys.onWidgetAction(WIDGET_KEYS.PRODUCT_RECALLS, widgets.product_recalls.action);

  gladys.onConfigUpdated(async (raw) => {
    logger.info('Configuration updated');
    config = configure(raw);
    // The store name is the device name: publish it again (an upsert).
    await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
    await run();
    for (const key of Object.values(WIDGET_KEYS)) {
      gladys.requestWidgetRefresh(key);
    }
  });

  gladys.on('connected', async () => {
    try {
      config = configure(await gladys.getConfig());
      await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
      await run();
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
    feed.stop();
  }
  gladys.on('disconnected', stop);

  return { store, feed, stop };
}
