// End to end: the handlers of src/app.js, driven by the SDK's fake Gladys,
// with a fake RappelConso and a fake clock.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createApp } from '../src/app.js';
import { recallIds, storeIds } from '../src/devices/index.js';
import { parseRecall } from '../src/leclerc/recalls.js';
import { fakeClock, memoryOf, v1Record, v2Record } from './helpers/fixtures.js';

async function setup({ config = {}, recalls = [v2Record(), v1Record()], found = [] } = {}) {
  const gladys = createFakeGladys({ config });
  const clock = fakeClock('2026-10-30T18:00:00Z'); // Friday 19:00 in Paris
  const app = createApp(gladys, {
    timers: false,
    now: clock,
    memory: memoryOf([]),
    fetchRecalls: async () => recalls.map(parseRecall),
    findRecalls: async () => found.map(parseRecall),
  });
  await gladys.connect();
  return { gladys, app, clock };
}

test('on connection: two devices, their states, the recall events', async () => {
  const { gladys } = await setup({ config: { store_name: 'E.Leclerc Carcassonne' } });
  const devices = gladys.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((device) => device.name),
    ['E.Leclerc Carcassonne', 'E.Leclerc product recalls'],
  );
  assert.equal(gladys.fake.lastState(storeIds(gladys).feature('open')), 1);
  assert.equal(gladys.fake.lastState(recallIds(gladys).feature('count')), 2);
  assert.equal(gladys.fake.sceneEvents.filter((e) => e.key === 'product_recalled').length, 2);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('scan request publishes the devices again', async () => {
  const { gladys } = await setup();
  const before = gladys.fake.requests.length;
  await gladys.fake.scanRequest();
  assert.ok(gladys.fake.requests.length > before);
  assert.equal(gladys.fake.discoveredDevices.length, 2);
});

test('a new configuration renames the store and re-reads the hours', async () => {
  const { gladys, app } = await setup();
  await gladys.fake.configUpdated({ store_name: 'Mon Leclerc', opening_hours: 'Mo-Su off' });
  assert.equal(gladys.fake.discoveredDevices[0].name, 'Mon Leclerc');
  assert.equal(app.store.status().open, false);
  assert.ok(gladys.fake.widgetRefreshes.length > 0);
});

test('action test_connection reports the hours and the recalls', async () => {
  const { gladys } = await setup();
  const ack = await gladys.fake.action('test_connection', {});
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /^Ouvert, ferme à 20:00\. RappelConso OK : 2 rappel\(s\)/);
  assert.ok(ack.data.message.de && ack.data.message.es);
});

test('action check_barcode: recalled, not recalled, not a barcode', async () => {
  const { gladys } = await setup({ found: [v2Record()] });
  const recalled = await gladys.fake.action('check_barcode', { barcode: '3564700012345' });
  assert.match(recalled.data.message.en, /^RECALLED: Marque Repère – Yaourt/);

  const clean = await setup({ found: [] });
  const none = await clean.gladys.fake.action('check_barcode', { barcode: '3017620422003' });
  assert.equal(none.data.message.fr, 'Aucun rappel trouvé pour 3017620422003.');

  const wrong = await clean.gladys.fake.action('check_barcode', { barcode: 'abc' });
  assert.equal(wrong.success, false);
});

test('scene actions return their declared outputs', async () => {
  const { gladys } = await setup({ found: [v2Record()] });
  const check = await gladys.fake.sceneAction('check_barcode', { barcode: '3564700012345' });
  assert.deepEqual(check.data.outputs, {
    recalled: true,
    product: 'Marque Repère – Yaourt nature 4x125 g',
    reason: 'Présence de Listeria monocytogenes',
    link: 'https://rappel.conso.gouv.fr/fiche-rappel/1/Interne',
  });
  const open = await gladys.fake.sceneAction('is_store_open', {});
  assert.deepEqual(open.data.outputs, { open: true, next_change: '20:00', minutes_to_change: 60 });
});

test('is_store_open fails, alone, when the hours cannot be read', async () => {
  const { gladys } = await setup({ config: { opening_hours: 'n/a' } });
  const ack = await gladys.fake.sceneAction('is_store_open', {});
  assert.equal(ack.success, false);
});

test('both widgets render exactly as sent, in every language', async () => {
  const { gladys } = await setup();
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const key of ['store_hours', 'product_recalls']) {
      const ack = await gladys.fake.widgetGet(key, { settings: { count: 8 }, language });
      assert.equal(ack.success, true, `${key} ${language}`);
      assert.deepEqual(validateWidgetContent(ack.data.content), [], `${key} ${language}`);
    }
  }
});

test('the widgets stay valid with no recall, no list, and unreadable hours', async () => {
  const { gladys } = await setup({ recalls: [], config: { opening_hours: 'oops' } });
  const store = await gladys.fake.widgetGet('store_hours', { settings: {}, language: 'fr' });
  assert.deepEqual(validateWidgetContent(store.data.content), []);
  assert.match(store.data.content.components[0].text.fr, /Les horaires ne sont pas compris/);
  const recalls = await gladys.fake.widgetGet('product_recalls', { settings: { count: 0 } });
  assert.deepEqual(validateWidgetContent(recalls.data.content), []);
  assert.equal(
    recalls.data.content.components.some((component) => component.type === 'card-list'),
    false,
  );
});

test('widget actions: barcode form and refresh', async () => {
  const { gladys } = await setup({ found: [] });
  const check = await gladys.fake.widgetAction(
    'product_recalls',
    'check_barcode',
    {},
    {
      settings: {},
      values: { barcode: '3017620422003' },
    },
  );
  assert.equal(check.success, true);
  assert.equal(check.data.message.en, 'No recall found for 3017620422003.');

  const noForm = await gladys.fake.widgetAction(
    'product_recalls',
    'check_barcode',
    {},
    {
      settings: {},
    },
  );
  assert.equal(noForm.success, false);

  const refresh = await gladys.fake.widgetAction(
    'product_recalls',
    'refresh',
    {},
    { settings: {} },
  );
  assert.equal(refresh.success, true);
});
