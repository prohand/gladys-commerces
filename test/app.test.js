// End to end: the handlers of src/app.js, driven by the SDK's fake Gladys,
// with a fake clock and an in-memory storage of the balances.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';
import { createApp } from '../src/app.js';
import { cardIds, storeIds } from '../src/devices/index.js';
import {
  fakeClock,
  fakeOverpass,
  HOUSES,
  MARIE,
  memoryCache,
  memoryStorage,
  OSM_SHOPS,
  PAUL,
} from './helpers/fixtures.js';

const CARDS = `Marie=${MARIE}; Paul=${PAUL}`;
const STORES = 'Leclerc = Mo-Sa 08:30-20:00; PH off | Pharmacie = Mo-Fr 09:00-19:00';

async function setup({ config = { stores: STORES, loyalty_cards: CARDS }, balances = {} } = {}) {
  const gladys = createFakeGladys({ config, houses: HOUSES });
  const clock = fakeClock('2026-10-30T18:00:00Z'); // Friday 19:00 in Paris
  const storage = memoryStorage(balances);
  const fetch = fakeOverpass(OSM_SHOPS);
  const hoursCache = memoryCache();
  const app = createApp(gladys, { timers: false, now: clock, storage, fetch, hoursCache });
  await gladys.connect();
  return { gladys, app, clock, storage, fetch, hoursCache };
}

test('on connection: one device per store and per card, with their states', async () => {
  const { gladys } = await setup({
    config: { stores: STORES, loyalty_cards: CARDS },
    balances: { [MARIE]: { balance: 7.5, updated_at: 'x' } },
  });
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['Leclerc', 'Pharmacie', 'Marie', 'Paul'],
  );
  assert.equal(gladys.fake.lastState(storeIds(gladys, 'leclerc').feature('open')), 1);
  assert.equal(gladys.fake.lastState(storeIds(gladys, 'pharmacie').feature('open')), 0);
  assert.equal(gladys.fake.lastState(cardIds(gladys, MARIE).feature('balance')), 7.5);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('scan request publishes the devices again', async () => {
  const { gladys } = await setup();
  const before = gladys.fake.requests.length;
  await gladys.fake.scanRequest();
  assert.ok(gladys.fake.requests.length > before);
  assert.equal(gladys.fake.discoveredDevices.length, 4);
});

test('a new configuration re-reads the stores and the cards', async () => {
  const { gladys, app } = await setup();
  await gladys.fake.configUpdated({ stores: 'Marché = Mo-Su off' });
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['Marché'],
  );
  assert.equal(app.watcher.status(app.watcher.find('marche')).open, false);
  assert.ok(gladys.fake.widgetRefreshes.length > 0);
});

test('action test_configuration reports every store and the cards', async () => {
  const { gladys } = await setup({
    config: { stores: `${STORES} | Bio = Lu 9h | oops`, loyalty_cards: `${CARDS}; Zoé=abc` },
  });
  const ack = await gladys.fake.action('test_configuration', {});
  assert.equal(ack.success, true);
  const lines = ack.data.message.fr.split('\n');
  assert.equal(lines[0], 'Leclerc : Ouvert, ferme à 20:00.');
  assert.equal(lines[1], 'Pharmacie : Fermé, ouvre lundi à 09:00.');
  assert.match(lines[2], /^Bio : Les horaires ne sont pas compris/);
  assert.equal(lines[3], 'Non compris (Nom = horaires ou Nom = auto attendu) : oops.');
  assert.equal(
    lines[4],
    '2 carte(s) de fidélité : Marie (EAN-13), Paul (Code 128). Non compris : Zoé=abc.',
  );
  assert.ok(ack.data.message.de && ack.data.message.es);
});

test('stores written auto get their hours from OpenStreetMap, near the houses', async () => {
  const { gladys, fetch } = await setup({
    config: {
      stores: 'Leclerc = auto | Boulangerie = auto: Boulangerie Dupont | Bio = 24/7 | Lidl = auto',
    },
  });
  assert.equal(fetch.queries.length, 1);
  assert.equal(gladys.fake.lastState(storeIds(gladys, 'leclerc').feature('open')), 1);
  assert.equal(gladys.fake.lastState(storeIds(gladys, 'bio').feature('open')), 1);

  const lines = (await gladys.fake.action('test_configuration', {})).data.message.fr.split('\n');
  assert.equal(
    lines[0],
    'Leclerc : Ouvert, ferme à 20:00. (OpenStreetMap : E.Leclerc, Bourges · 1,3 km, Mo-Sa 08:30-20:00; PH off)',
  );
  assert.match(
    lines[1],
    /^Boulangerie : Les horaires trouvés sur OpenStreetMap ne sont pas compris/,
  );
  assert.match(lines[3], /^Lidl : Aucun commerce de ce nom .* 10 km de vos maisons/);

  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const id of [undefined, 'leclerc', 'boulangerie', 'lidl']) {
      const store = id && storeIds(gladys, id).device;
      const ack = await gladys.fake.widgetGet('store_hours', { settings: { store }, language });
      assert.deepEqual(validateWidgetContent(ack.data.content), [], `${id} ${language}`);
    }
  }
  const all = await gladys.fake.widgetGet('store_hours', { settings: {}, language: 'fr' });
  assert.deepEqual(
    all.data.content.components[0].items.map((item) => item.value.fr ?? item.value),
    ['Ouvert · ferme à 20:00', 'Horaires non compris', 'Ouvert', 'Horaires introuvables'],
  );
  const one = await gladys.fake.widgetGet('store_hours', {
    settings: { store: storeIds(gladys, 'leclerc').device },
    language: 'fr',
  });
  const items = one.data.content.components.find((component) => component.type === 'status').items;
  assert.deepEqual(items.at(-1).value, 'E.Leclerc, Bourges · 1,3 km');

  const ask = await gladys.fake.sceneAction('is_store_open', {
    device: storeIds(gladys, 'lidl').device,
  });
  assert.equal(ask.success, false);

  // Saving the form again does not ask OpenStreetMap again.
  await gladys.fake.configUpdated({ stores: 'Leclerc = auto | Bio = 24/7' });
  assert.equal(fetch.queries.length, 1);
  assert.equal(gladys.fake.lastState(storeIds(gladys, 'leclerc').feature('open')), 1);
});

test('no store written auto: the houses and OpenStreetMap are left alone', async () => {
  const { fetch } = await setup();
  assert.equal(fetch.queries.length, 0);
});

test('scene action is_store_open, per store', async () => {
  const { gladys } = await setup();
  const ask = (device) => gladys.fake.sceneAction('is_store_open', { device });
  const open = await ask(storeIds(gladys, 'leclerc').device);
  assert.deepEqual(open.data.outputs, { open: true, next_change: '20:00', minutes_to_change: 60 });
  const closed = await ask(storeIds(gladys, 'pharmacie').device);
  assert.equal(closed.data.outputs.open, false);
  assert.equal((await ask('ext:test-integration:store:gone')).success, false);

  const broken = await setup({ config: { stores: 'Bio = n/a' } });
  const ack = await broken.gladys.fake.sceneAction('is_store_open', {
    device: storeIds(broken.gladys, 'bio').device,
  });
  assert.equal(ack.success, false);
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
    for (const store of [undefined, storeIds(gladys, 'leclerc').device]) {
      const ack = await gladys.fake.widgetGet('store_hours', { settings: { store }, language });
      assert.deepEqual(validateWidgetContent(ack.data.content), [], `store ${language}`);
    }
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

test('the store widget: every store at a glance, one in detail', async () => {
  const { gladys } = await setup();
  const all = await gladys.fake.widgetGet('store_hours', { settings: {}, language: 'fr' });
  const [list] = all.data.content.components;
  assert.deepEqual(
    list.items.map((item) => [item.label, item.value, item.color]),
    [
      ['Leclerc', 'Ouvert · ferme à 20:00', 'success'],
      ['Pharmacie', 'Fermé · ouvre lundi à 09:00', 'danger'],
    ],
  );
  const one = await gladys.fake.widgetGet('store_hours', {
    settings: { store: storeIds(gladys, 'leclerc').device },
    language: 'fr',
  });
  assert.equal(one.data.content.components[0].text, 'Leclerc');
  assert.equal(one.data.content.components[1].value, 60);
});

test('the widgets stay valid with no store, no card and unreadable hours', async () => {
  const empty = await setup({ config: {} });
  for (const key of ['store_hours', 'loyalty_card']) {
    const ack = await empty.gladys.fake.widgetGet(key, { settings: {} });
    assert.deepEqual(validateWidgetContent(ack.data.content), [], key);
  }
  const { gladys } = await setup({ config: { stores: 'Bio = oops' } });
  const all = await gladys.fake.widgetGet('store_hours', { settings: {}, language: 'fr' });
  assert.deepEqual(validateWidgetContent(all.data.content), []);
  assert.equal(all.data.content.components[0].items[0].value.fr, 'Horaires non compris');
  const one = await gladys.fake.widgetGet('store_hours', {
    settings: { store: storeIds(gladys, 'bio').device },
    language: 'fr',
  });
  assert.deepEqual(validateWidgetContent(one.data.content), []);
  assert.match(one.data.content.components[1].text.fr, /Les horaires ne sont pas compris/);
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
