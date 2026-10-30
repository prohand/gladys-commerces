import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../src/config.js';
import { storeIds } from '../src/devices/index.js';
import { describeStatus, parseStores, StoreWatcher, storeSlug } from '../src/shops/stores.js';
import { parseOpeningHours, storeStatus } from '../src/shops/hours.js';
import { fakeClock } from './helpers/fixtures.js';

const STORES = 'Leclerc = Mo-Sa 08:30-20:00; PH off | Boulangerie = Tu-Su 07:00-19:30';

async function setup(config = {}, iso = '2026-10-30T18:00:00Z') {
  const gladys = createFakeGladys();
  await gladys.connect();
  const clock = fakeClock(iso);
  const watcher = new StoreWatcher({ gladys, now: clock });
  watcher.configure(normalizeConfig({ stores: STORES, ...config }));
  return { gladys, watcher, clock, leclerc: storeIds(gladys, 'leclerc') };
}

test('stores: names, hours, separators; a store keeps its hours error', () => {
  const { stores, errors } = parseStores(
    'Leclerc = Mo-Sa 08:30-20:00 | Pharmacie Centrale=Lu-Ve 9h\nDéchetterie = We,Sa 09:00-12:00 | auto | = 24/7',
  );
  assert.deepEqual(
    stores.map((store) => [store.id, store.name, Boolean(store.schedule), Boolean(store.error)]),
    [
      ['leclerc', 'Leclerc', true, false],
      ['pharmacie-centrale', 'Pharmacie Centrale', false, true],
      ['dechetterie', 'Déchetterie', true, false],
    ],
  );
  assert.deepEqual(errors, ['auto', '= 24/7']);
});

test('stores: a duplicate name is dropped, ten at most', () => {
  assert.equal(parseStores('A = 24/7 | a = 24/7').stores.length, 1);
  const many = Array.from({ length: 12 }, (_, i) => `S${i} = 24/7`).join(' | ');
  const { stores, errors } = parseStores(many);
  assert.equal(stores.length, 10);
  assert.deepEqual(errors, ['S10', 'S11']);
  assert.deepEqual(parseStores(''), { stores: [], errors: [] });
});

test('the store id is its name, plain', () => {
  assert.equal(storeSlug('  Boulangerie Ô Délices!  '), 'boulangerie-o-delices');
  assert.equal(storeSlug('***'), '');
});

test('publishes open and the minutes until it changes, for every store', async () => {
  // Friday 19:00 in Paris.
  const { gladys, watcher, leclerc } = await setup();
  await watcher.tick();
  assert.equal(gladys.fake.lastState(leclerc.feature('open')), 1);
  assert.equal(gladys.fake.lastState(leclerc.feature('next_change')), 60);
  const bakery = storeIds(gladys, 'boulangerie');
  assert.equal(gladys.fake.lastState(bakery.feature('next_change')), 30);
});

test('"closes soon" fires once per store, inside the notice, never on the first tick', async () => {
  const { gladys, watcher, clock, leclerc } = await setup({ notice_minutes: 30 });
  await watcher.tick(); // 19:00, primes (the bakery is already inside its window)
  assert.equal(gladys.fake.sceneEvents.length, 0);
  clock.advance(31);
  await watcher.tick(); // 19:31: Leclerc closes in 29 minutes
  assert.deepEqual(gladys.fake.sceneEvents, [
    {
      key: 'store_closing_soon',
      data: { device: leclerc.device, store_name: 'Leclerc', time: '20:00', minutes_left: 29 },
    },
  ]);
  clock.advance(1);
  await watcher.tick();
  assert.equal(gladys.fake.sceneEvents.length, 1, 'announced once');

  // Saturday 06:35: the bakery opens at 07:00, Leclerc at 08:30.
  clock.set('2026-10-31T05:35:00Z');
  await watcher.tick();
  assert.equal(gladys.fake.sceneEvents.at(-1).key, 'store_opening_soon');
  assert.equal(gladys.fake.sceneEvents.at(-1).data.store_name, 'Boulangerie');
});

test('saving the configuration again does not announce twice', async () => {
  const { gladys, watcher, clock } = await setup();
  await watcher.tick();
  clock.advance(31);
  await watcher.tick();
  watcher.configure(normalizeConfig({ stores: STORES }));
  await watcher.tick();
  assert.equal(gladys.fake.sceneEvents.length, 1);
});

test('a store whose hours cannot be read publishes nothing', async () => {
  const { gladys, watcher } = await setup({ stores: 'Bio = Lu-Ve 9h-18h' });
  await watcher.tick();
  assert.equal(watcher.status(watcher.stores[0]), null);
  assert.match(watcher.stores[0].error.message, /not a day/);
  assert.equal(gladys.fake.states.length, 0);
});

test('a store is found by its id or its device', async () => {
  const { watcher, leclerc } = await setup();
  assert.equal(watcher.find(leclerc.device).name, 'Leclerc');
  assert.equal(watcher.find('boulangerie').name, 'Boulangerie');
  assert.equal(watcher.find('nope'), undefined);
});

test('the status reads as a sentence in every language', () => {
  const status = storeStatus(
    parseOpeningHours('Mo-Sa 08:30-20:00'),
    new Date('2026-10-31T20:00:00Z'), // Saturday 21:00
    'Europe/Paris',
  );
  assert.deepEqual(describeStatus(status), {
    en: 'Closed, opens on Monday at 08:30.',
    fr: 'Fermé, ouvre lundi à 08:30.',
    de: 'Geschlossen, öffnet am Montag um 08:30.',
    es: 'Cerrado, abre el lunes a las 08:30.',
  });
});
