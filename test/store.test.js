import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../src/config.js';
import { storeIds } from '../src/devices/index.js';
import { describeStatus, StoreWatcher } from '../src/leclerc/store.js';
import { parseOpeningHours, storeStatus } from '../src/leclerc/hours.js';
import { fakeClock } from './helpers/fixtures.js';

async function setup(config = {}, iso = '2026-10-30T18:00:00Z') {
  const gladys = createFakeGladys();
  await gladys.connect();
  const clock = fakeClock(iso);
  const store = new StoreWatcher({ gladys, now: clock });
  store.configure(normalizeConfig(config));
  return { gladys, store, clock, ids: storeIds(gladys) };
}

test('publishes open and the minutes until it closes', async () => {
  // 19:00 in Paris, closes at 20:00.
  const { gladys, store, ids } = await setup();
  await store.tick();
  assert.equal(gladys.fake.lastState(ids.feature('open')), 1);
  assert.equal(gladys.fake.lastState(ids.feature('next_change')), 60);
});

test('"closes soon" fires once, inside the notice, and never on the first tick', async () => {
  const { gladys, store, clock } = await setup({ notice_minutes: 30 });
  await store.tick(); // 19:00, primes
  clock.advance(31);
  await store.tick(); // 19:31: 29 minutes left
  assert.deepEqual(gladys.fake.sceneEvents, [
    {
      key: 'store_closing_soon',
      data: { store_name: 'E.Leclerc', time: '20:00', minutes_left: 29 },
    },
  ]);
  clock.advance(1);
  await store.tick();
  assert.equal(gladys.fake.sceneEvents.length, 1, 'announced once');

  // Closed at 20:00; the next opening is Saturday 08:30.
  clock.set('2026-10-31T07:05:00Z'); // 08:05 in Paris
  await store.tick();
  assert.equal(gladys.fake.sceneEvents.at(-1).key, 'store_opening_soon');
  assert.equal(gladys.fake.sceneEvents.at(-1).data.minutes_left, 25);
});

test('a restart inside the notice window does not announce again', async () => {
  const { gladys, store } = await setup({}, '2026-10-30T18:45:00Z');
  await store.tick();
  assert.equal(gladys.fake.sceneEvents.length, 0);
});

test('hours that cannot be read: no state, the error is kept for the screens', async () => {
  const { gladys, store } = await setup({ opening_hours: 'Lu-Ve 9h-18h' });
  await store.tick();
  assert.equal(store.status(), null);
  assert.match(store.error.message, /not a day/);
  assert.equal(gladys.fake.states.length, 0);
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
