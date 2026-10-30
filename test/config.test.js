import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('an empty configuration is the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig({ store_name: '  ', opening_hours: '' }), DEFAULT_CONFIG);
});

test('the notice typed as text is read, clamped to the manifest bounds', () => {
  assert.equal(normalizeConfig({ notice_minutes: '45' }).notice_minutes, 45);
  assert.equal(normalizeConfig({ notice_minutes: 500 }).notice_minutes, 180);
  assert.equal(normalizeConfig({ notice_minutes: 1 }).notice_minutes, 5);
  assert.equal(normalizeConfig({ notice_minutes: 'abc' }).notice_minutes, 30);
  assert.equal(normalizeConfig({ notice_minutes: '' }).notice_minutes, 30);
});

test('texts are trimmed', () => {
  const config = normalizeConfig({ store_name: ' E.Leclerc Albi ', loyalty_cards: ' A=12345678 ' });
  assert.equal(config.store_name, 'E.Leclerc Albi');
  assert.equal(config.loyalty_cards, 'A=12345678');
});
