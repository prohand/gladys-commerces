import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('an empty configuration is the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig({ stores: '  ', loyalty_cards: '' }), DEFAULT_CONFIG);
});

test('the notice typed as text is read, clamped to the manifest bounds', () => {
  assert.equal(normalizeConfig({ notice_minutes: '45' }).notice_minutes, 45);
  assert.equal(normalizeConfig({ notice_minutes: 500 }).notice_minutes, 180);
  assert.equal(normalizeConfig({ notice_minutes: 1 }).notice_minutes, 5);
  assert.equal(normalizeConfig({ notice_minutes: 'abc' }).notice_minutes, 30);
  assert.equal(normalizeConfig({ notice_minutes: '' }).notice_minutes, 30);
});

test('texts are trimmed', () => {
  const config = normalizeConfig({ stores: ' A = 24/7 ', loyalty_cards: ' A=12345678 ' });
  assert.equal(config.stores, 'A = 24/7');
  assert.equal(config.loyalty_cards, 'A=12345678');
});

test('the lists of the houses and of the kinds: default when never saved, else as saved', () => {
  assert.deepEqual(normalizeConfig().search_houses, []);
  assert.deepEqual(normalizeConfig().discover_kinds, DEFAULT_CONFIG.discover_kinds);
  assert.deepEqual(normalizeConfig({ discover_kinds: [] }).discover_kinds, []);
  assert.deepEqual(normalizeConfig({ discover_kinds: ['bakery', 'nope', 3] }).discover_kinds, [
    'bakery',
  ]);
  assert.deepEqual(normalizeConfig({ search_houses: ['maison'] }).search_houses, ['maison']);
});
