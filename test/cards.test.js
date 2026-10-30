import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../src/config.js';
import { cardIds } from '../src/devices/index.js';
import { fileStorage, formatNumber, parseCards, Wallet } from '../src/shops/cards.js';
import { fakeClock, MARIE, memoryStorage, PAUL } from './helpers/fixtures.js';

test('cards: names, separators, spaces and dashes', () => {
  const { cards, errors } = parseCards(`Marie = 2 900123 456785; Paul: ${PAUL}\n4006-3813-3393-1`);
  assert.deepEqual(cards, [
    { number: MARIE, name: 'Marie' },
    { number: PAUL, name: 'Paul' },
    { number: '4006381333931', name: 'Card •••• 3931' },
  ]);
  assert.deepEqual(errors, []);
});

test('cards: what is not a number is reported, duplicates are dropped', () => {
  const { cards, errors } = parseCards(`Marie=${MARIE}; Marie bis=${MARIE}; Paul=abc; 123`);
  assert.equal(cards.length, 1);
  assert.deepEqual(errors, ['Paul=abc', '123']);
  assert.deepEqual(parseCards(''), { cards: [], errors: [] });
});

test('at most twenty cards', () => {
  const text = Array.from(
    { length: 22 },
    (_, i) => `C${i}=10000${String(i).padStart(4, '0')}`,
  ).join(';');
  const { cards, errors } = parseCards(text);
  assert.equal(cards.length, 20);
  assert.equal(errors.length, 2);
});

test('numbers are grouped for reading', () => {
  assert.equal(formatNumber(MARIE), '2 900123 456785');
  assert.equal(formatNumber(PAUL), '1234 5678 9012 345');
});

async function wallet(balances = {}) {
  const gladys = createFakeGladys();
  await gladys.connect();
  const storage = memoryStorage(balances);
  const instance = new Wallet({ gladys, storage, now: fakeClock('2026-10-30T10:00:00Z') });
  instance.configure(normalizeConfig({ loyalty_cards: `Marie=${MARIE}; Paul=${PAUL}` }));
  return { gladys, storage, wallet: instance };
}

test('a balance set is kept, rounded to the cent, and published', async () => {
  const { gladys, storage, wallet: cards } = await wallet();
  const marie = cards.find(MARIE);
  assert.equal(await cards.setBalance(marie, '12.345'), 12.35);
  assert.deepEqual(storage.balances[MARIE], {
    balance: 12.35,
    updated_at: '2026-10-30T10:00:00.000Z',
  });
  assert.equal(gladys.fake.lastState(cardIds(gladys, MARIE).feature('balance')), 12.35);
  assert.ok(gladys.fake.widgetRefreshes.length > 0);
  await assert.rejects(cards.setBalance(marie, -1), /between 0 and/);
  await assert.rejects(cards.setBalance(marie, 'abc'), /between 0 and/);
});

test('a card is found by its number or its device', async () => {
  const { gladys, wallet: cards } = await wallet();
  assert.equal(cards.find(cardIds(gladys, PAUL).device).name, 'Paul');
  assert.equal(cards.find('nope'), undefined);
});

test('the known balances are published again at start', async () => {
  const { gladys, wallet: cards } = await wallet({ [PAUL]: { balance: 4.2, updated_at: 'x' } });
  await cards.publishAll();
  assert.equal(gladys.fake.lastState(cardIds(gladys, PAUL).feature('balance')), 4.2);
  assert.equal(gladys.fake.lastState(cardIds(gladys, MARIE).feature('balance')), undefined);
});

test('the file storage survives a restart; a missing file is empty', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eleclerc-'));
  const storage = fileStorage(directory);
  assert.deepEqual(await storage.load(), {});
  await storage.save({ [MARIE]: { balance: 3 } });
  assert.deepEqual(await storage.load(), { [MARIE]: { balance: 3 } });
});
