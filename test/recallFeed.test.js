import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../src/config.js';
import { recallIds } from '../src/devices/index.js';
import { fileMemory, RecallFeed, recallEvent, title } from '../src/leclerc/recallFeed.js';
import { parseRecall } from '../src/leclerc/recalls.js';
import { fakeClock, memoryOf, v1Record, v2Record } from './helpers/fixtures.js';

async function setup({ recalls, memory = memoryOf([]), config = {} }) {
  const gladys = createFakeGladys();
  await gladys.connect();
  const list = { current: recalls };
  const feed = new RecallFeed({
    gladys,
    memory,
    now: fakeClock('2026-10-30T10:00:00Z'),
    fetch: async () => {
      if (list.current instanceof Error) throw list.current;
      return list.current.map(parseRecall);
    },
  });
  feed.configure(normalizeConfig(config));
  return { gladys, feed, list, ids: recallIds(gladys) };
}

test('publishes the count and the latest recall that concern the store', async () => {
  const { gladys, feed, ids } = await setup({
    recalls: [v2Record(), v1Record(), v2Record({ numero_fiche: 'x', distributeurs: 'Auchan' })],
  });
  await feed.refresh();
  assert.equal(gladys.fake.lastState(ids.feature('count')), 2);
  assert.equal(gladys.fake.lastState(ids.feature('last')), 'Marque Repère – Yaourt nature 4x125 g');
  assert.deepEqual(gladys.fake.transports.at(-1), {
    device_external_id: ids.device,
    transport: 'cloud',
  });
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(feed.published, 3);
});

test('fires the trigger once per new recall, never for a recall already seen', async () => {
  const { gladys, feed, list } = await setup({ recalls: [v2Record()], memory: memoryOf([]) });
  await feed.refresh();
  assert.equal(gladys.fake.sceneEvents.length, 1);
  assert.equal(gladys.fake.sceneEvents[0].key, 'product_recalled');
  assert.deepEqual(gladys.fake.sceneEvents[0].data, recallEvent(parseRecall(v2Record())));

  await feed.refresh();
  assert.equal(gladys.fake.sceneEvents.length, 1, 'same recall, no new event');

  list.current = [v2Record({ numero_fiche: 'new' }), v2Record()];
  await feed.refresh();
  assert.equal(gladys.fake.sceneEvents.length, 2);
});

test('the very first run takes what is published as history', async () => {
  const memory = memoryOf(null);
  const { gladys, feed } = await setup({ recalls: [v2Record(), v1Record()], memory });
  await feed.refresh();
  assert.equal(gladys.fake.sceneEvents.length, 0);
  assert.deepEqual([...memory.saved].sort(), ['2026-09-0042', '2026-10-0001']);
});

test('a recall outside the scope counts as seen: widening the scope replays nothing', async () => {
  const { gladys, feed } = await setup({
    recalls: [v1Record()],
    config: { recall_scope: 'leclerc' },
  });
  await feed.refresh();
  assert.equal(gladys.fake.sceneEvents.length, 0);
  feed.configure(normalizeConfig({ recall_scope: 'all' }));
  await feed.refresh();
  assert.equal(gladys.fake.sceneEvents.length, 0);
});

test('RappelConso down: unreachable badge, disconnected status, the error goes up', async () => {
  const { gladys, feed, ids } = await setup({ recalls: new Error('boom') });
  await assert.rejects(feed.refresh(), /boom/);
  assert.deepEqual(gladys.fake.transports.at(-1), {
    device_external_id: ids.device,
    transport: 'unreachable',
  });
  assert.equal(gladys.fake.connectionStatus.connected, false);
});

test('the event data stays flat and within the core limits', () => {
  const data = recallEvent(parseRecall(v2Record({ motif_rappel: 'x'.repeat(5000) })));
  for (const value of Object.values(data)) {
    assert.equal(typeof value, 'string');
    assert.ok(value.length <= 1000);
  }
  assert.equal(data.sold_at, 'leclerc');
  assert.equal(recallEvent(parseRecall(v1Record())).sold_at, 'all_retailers');
});

test('the title does not repeat a brand the product name already holds', () => {
  assert.equal(
    title(parseRecall(v2Record({ libelle: 'Marque Repère yaourt' }))),
    'Marque Repère yaourt',
  );
});

test('the file memory survives a restart, and a missing file reads as a first run', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eleclerc-'));
  const memory = fileMemory(directory);
  assert.equal(await memory.load(), null);
  await memory.save(new Set(['a', 'b']));
  assert.deepEqual([...(await memory.load())], ['a', 'b']);
  assert.match(await readFile(join(directory, 'recalls-seen.json'), 'utf8'), /"a"/);
  // An unwritable place is logged, never thrown.
  await fileMemory('/nonexistent/dir').save(new Set(['a']));
});
