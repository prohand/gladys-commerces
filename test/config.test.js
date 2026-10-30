import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('an empty configuration is the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig({ store_name: '  ', opening_hours: '' }), DEFAULT_CONFIG);
});

test('numbers typed as text are read, clamped to the manifest bounds', () => {
  const config = normalizeConfig({ notice_minutes: '45', recall_days: 500, refresh_interval: 1 });
  assert.equal(config.notice_minutes, 45);
  assert.equal(config.recall_days, 90);
  assert.equal(config.refresh_interval, 15);
  assert.equal(normalizeConfig({ recall_days: 'abc' }).recall_days, 30);
  assert.equal(normalizeConfig({ recall_days: '' }).recall_days, 30);
});

test('unknown scopes and categories fall back, a comma list is accepted', () => {
  assert.equal(normalizeConfig({ recall_scope: 'nope' }).recall_scope, 'all');
  assert.deepEqual(normalizeConfig({ recall_categories: ['food', 'nope'] }).recall_categories, [
    'food',
  ]);
  assert.deepEqual(normalizeConfig({ recall_categories: 'food, pets' }).recall_categories, [
    'food',
    'pets',
  ]);
});

test('texts are trimmed', () => {
  assert.equal(normalizeConfig({ store_name: ' E.Leclerc Albi ' }).store_name, 'E.Leclerc Albi');
});
