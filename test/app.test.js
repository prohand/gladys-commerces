// End to end: the handlers of src/app.js, driven by the SDK's fake Gladys,
// with a fake clock and an in-memory storage of the balances.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';
import { createApp } from '../src/app.js';
import { cardIds, storeIds } from '../src/devices/index.js';
import { fakeClock, MARIE, memoryStorage, PAUL } from './helpers/fixtures.js';

const CARDS = `Marie=${MARIE}; Paul=${PAUL}`;

async function setup({ config = { loyalty_cards: CARDS }, balances = {} } = {}) {
  const gladys = createFakeGladys({ config });
  const clock = fakeClock('2026-10-30T18:00:00Z'); // Friday 19:00 in Paris
  const storage = memoryStorage(balances);
  const app = createApp(gladys, { timers: false, now: clock, storage });
  await gladys.connect();
  return { gladys, app, clock, storage };
}

test('on connection: the store and one device per card, with their states', async () => {
  const { gladys } = await setup({
    config: { store_name: 'E.Leclerc Carcassonne', loyalty_cards: CARDS },
    balances: { [MARIE]: { balance: 7.5, updated_at: 'x' } },
  });
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['E.Leclerc Carcassonne', 'E.Leclerc card Marie', 'E.Leclerc card Paul'],
  );
  assert.equal(gladys.fake.lastState(storeIds(gladys).feature('open')), 1);
  assert.equal(gladys.fake.lastState(cardIds(gladys, MARIE).feature('balance')), 7.5);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('scan request publishes the devices again', async () => {
  const { gladys } = await setup();
  const before = gladys.fake.requests.length;
  await gladys.fake.scanRequest();
  assert.ok(gladys.fake.requests.length > before);
  assert.equal(gladys.fake.discoveredDevices.length, 3);
});

test('a new configuration renames the store, re-reads the hours and the cards', async () => {
  const { gladys, app } = await setup();
  await gladys.fake.configUpdated({ store_name: 'Mon Leclerc', opening_hours: 'Mo-Su off' });
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['Mon Leclerc'],
  );
  assert.equal(app.store.status().open, false);
  assert.ok(gladys.fake.widgetRefreshes.length > 0);
});

test('action test_configuration reports the hours and the cards', async () => {
  const { gladys } = await setup({ config: { loyalty_cards: `${CARDS}; Zoé=abc` } });
  const ack = await gladys.fake.action('test_configuration', {});
  assert.equal(ack.success, true);
  assert.equal(
    ack.data.message.fr,
    'Ouvert, ferme à 20:00. 2 carte(s) de fidélité : Marie (EAN-13), Paul (Code 128). Non compris : Zoé=abc.',
  );
  assert.ok(ack.data.message.de && ack.data.message.es);
});

test('scene action is_store_open', async () => {
  const { gladys } = await setup();
  const open = await gladys.fake.sceneAction('is_store_open', {});
  assert.deepEqual(open.data.outputs, { open: true, next_change: '20:00', minutes_to_change: 60 });

  const broken = await setup({ config: { opening_hours: 'n/a' } });
  assert.equal((await broken.gladys.fake.sceneAction('is_store_open', {})).success, false);
});

test('scene action set_loyalty_balance sets, adds, spends, never below zero', async () => {
  const { gladys, storage } = await setup();
  const device = cardIds(gladys, MARIE).device;
  const run = async (fields) =>
    (await gladys.fake.sceneAction('set_loyalty_balance', { device, ...fields })).data.outputs;
  assert.deepEqual(await run({ mode: 'set', amount: 10 }), { balance: 10 });
  assert.deepEqual(await run({ mode: 'add', amount: 2.5 }), { balance: 12.5 });
  assert.deepEqual(await run({ mode: 'add', amount: -20 }), { balance: 0 });
  assert.equal(storage.balances[MARIE].balance, 0);
  const unknown = await gladys.fake.sceneAction('set_loyalty_balance', {
    device: 'ext:test-integration:card:999',
    mode: 'set',
    amount: 1,
  });
  assert.equal(unknown.success, false);
});

test('both widgets render exactly as sent, in every language', async () => {
  const { gladys } = await setup({ balances: { [PAUL]: { balance: 3.2, updated_at: 'x' } } });
  for (const language of ['en', 'fr', 'de', 'es']) {
    const store = await gladys.fake.widgetGet('store_hours', { settings: {}, language });
    assert.deepEqual(validateWidgetContent(store.data.content), [], `store ${language}`);
    for (const card of [undefined, cardIds(gladys, PAUL).device]) {
      const ack = await gladys.fake.widgetGet('loyalty_card', { settings: { card }, language });
      assert.deepEqual(validateWidgetContent(ack.data.content), [], `card ${language}`);
    }
  }
  const paul = await gladys.fake.widgetGet('loyalty_card', {
    settings: { card: cardIds(gladys, PAUL).device },
    language: 'fr',
  });
  const tile = paul.data.content.components.find((component) => component.type === 'value');
  assert.equal(tile.value.replace(/\s/g, ' '), '3,20 €');
});

test('the widgets stay valid with no card and with unreadable hours', async () => {
  const { gladys } = await setup({ config: { opening_hours: 'oops' } });
  const store = await gladys.fake.widgetGet('store_hours', { settings: {}, language: 'fr' });
  assert.deepEqual(validateWidgetContent(store.data.content), []);
  assert.match(store.data.content.components[0].text.fr, /Les horaires ne sont pas compris/);
  const card = await gladys.fake.widgetGet('loyalty_card', { settings: {} });
  assert.deepEqual(validateWidgetContent(card.data.content), []);
  assert.match(card.data.content.components[0].text.en, /^No loyalty card yet/);
});

test('the barcode image of a card is served, only for a configured card', async () => {
  const { gladys } = await setup();
  const content = (await gladys.fake.widgetGet('loyalty_card', { settings: {} })).data.content;
  const { key } = content.components.find((component) => component.type === 'image');
  const ack = await gladys.fake.widgetGetImage(key);
  assert.equal(ack.success, true);
  assert.deepEqual(validateWidgetImage(ack.data.image), []);
  assert.equal((await gladys.fake.widgetGetImage('card-4006381333931')).success, false);
});

test('widget form: the balance typed is kept and acknowledged', async () => {
  const { gladys, storage } = await setup();
  const ack = await gladys.fake.widgetAction(
    'loyalty_card',
    'set_balance',
    { card: MARIE },
    { settings: {}, values: { balance: 15 } },
  );
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /^Cagnotte de Marie : 15,00/);
  assert.equal(storage.balances[MARIE].balance, 15);

  const noForm = await gladys.fake.widgetAction(
    'loyalty_card',
    'set_balance',
    { card: MARIE },
    {
      settings: {},
    },
  );
  assert.equal(noForm.success, false);
});
