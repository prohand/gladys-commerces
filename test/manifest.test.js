// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The store indexer validates the manifest on its own, but nothing there can
// know which handlers the code registers or which keys it fires: these tests
// keep both sides in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, LIMITS, RECALL_SCOPES } from '../src/config.js';
import { ACTIONS } from '../src/capabilities/actions.js';
import { SCENE_ACTIONS, SCENE_TRIGGERS, SOLD_AT } from '../src/capabilities/scenes.js';
import { RECALL_WIDGET_ACTIONS, WIDGET_KEYS } from '../src/capabilities/widgets.js';
import { recallEvent } from '../src/leclerc/recallFeed.js';
import { parseRecall, RECALL_CATEGORIES } from '../src/leclerc/recalls.js';
import { LANGUAGES } from '../src/i18n.js';
import { v2Record } from './helpers/fixtures.js';

const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('../gladys-assistant-integration.json'));
const pkg = JSON.parse(await read('../package.json'));

test('version and image tag agree with package.json', () => {
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/prohand/gladys-eleclerc:${pkg.version}`);
  assert.match(
    manifest.cover_image,
    /^https:\/\/raw\.githubusercontent\.com\/prohand\/gladys-eleclerc\//,
  );
});

test('a cloud integration, for France, on Gladys 5.3 or later', () => {
  // RappelConso is read on the internet; the hours are computed locally but
  // reach nothing on the LAN: there is no local channel to prefer.
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.countries, ['FR']);
  assert.equal(manifest.gladys_version, '>=5.3.0');
});

test('name, description, categories and keywords follow the store rules', () => {
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  for (const language of LANGUAGES) {
    const { length } = manifest.description[language];
    assert.ok(length >= 10 && length <= 100, `description.${language}: ${length}`);
  }
  const vocabulary = [
    'climate',
    'lighting',
    'energy',
    'security',
    'multimedia',
    'appliances',
    'environment',
    'protocols',
    'network',
    'notifications',
    'assistants',
    'services',
    'transport',
    'vehicles',
    'servers',
    'leisure',
  ];
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
  for (const category of manifest.categories) {
    assert.ok(vocabulary.includes(category), category);
  }
  assert.ok(manifest.keywords.length >= 1 && manifest.keywords.length <= 10);
  for (const keyword of manifest.keywords) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword);
  }
});

test('every stored config key has its default and bounds in the code', () => {
  for (const field of manifest.config_schema) {
    if (field.type === 'section') {
      assert.equal(field.default, undefined);
      assert.ok(!(field.key in DEFAULT_CONFIG), `section ${field.key} stores nothing`);
      continue;
    }
    assert.ok(field.key in DEFAULT_CONFIG, `config key "${field.key}" missing in DEFAULT_CONFIG`);
    if (field.default !== undefined) {
      assert.deepEqual(DEFAULT_CONFIG[field.key], field.default, field.key);
    }
    if (field.type === 'number') {
      assert.deepEqual(LIMITS[field.key], [field.min, field.max], field.key);
    }
  }
  assert.deepEqual(
    manifest.config_schema
      .find((f) => f.key === 'recall_scope')
      .options.map((o) => o.value)
      .sort(),
    Object.values(RECALL_SCOPES).sort(),
  );
});

test('every category option is a category the code knows, and the other way round', () => {
  const lists = [
    manifest.config_schema.find((f) => f.key === 'recall_categories'),
    manifest.scene_triggers
      .find((t) => t.key === 'product_recalled')
      .fields.find((f) => f.key === 'category'),
  ];
  for (const field of lists) {
    assert.deepEqual(
      field.options.map((o) => o.value),
      Object.keys(RECALL_CATEGORIES),
    );
    for (const option of field.options) {
      assert.deepEqual(option.label, RECALL_CATEGORIES[option.value].label);
    }
  }
});

test('the manifest actions are the ones the code handles', () => {
  assert.deepEqual(
    manifest.actions.map((action) => action.key).sort(),
    Object.values(ACTIONS).sort(),
  );
});

test('the scene triggers are the ones the code fires, with the data they declare', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(SCENE_TRIGGERS).sort(),
  );
  const recalled = manifest.scene_triggers.find((t) => t.key === SCENE_TRIGGERS.PRODUCT_RECALLED);
  const declared = [...recalled.fields, ...recalled.variables].map((f) => f.key).sort();
  assert.deepEqual(Object.keys(recallEvent(parseRecall(v2Record()))).sort(), declared);
  assert.deepEqual(
    recalled.fields
      .find((f) => f.key === 'sold_at')
      .options.map((o) => o.value)
      .sort(),
    Object.values(SOLD_AT).sort(),
  );
  for (const key of [SCENE_TRIGGERS.STORE_OPENING_SOON, SCENE_TRIGGERS.STORE_CLOSING_SOON]) {
    const trigger = manifest.scene_triggers.find((t) => t.key === key);
    assert.deepEqual(trigger.variables.map((v) => v.key).sort(), [
      'minutes_left',
      'store_name',
      'time',
    ]);
  }
});

test('the scene actions are the ones the code handles', () => {
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
});

test('the widgets are the ones the code renders', () => {
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGET_KEYS).sort(),
  );
  assert.deepEqual(Object.values(RECALL_WIDGET_ACTIONS).sort(), ['check_barcode', 'refresh']);
  for (const widget of manifest.widgets) {
    for (const language of LANGUAGES) {
      assert.ok(widget.label[language].length >= 3 && widget.label[language].length <= 30);
      assert.ok(widget.description[language].length <= 100);
    }
  }
});

const FIELD_TYPES = ['string', 'number', 'boolean', 'select', 'multi_select', 'secret', 'section'];

test('every field uses a type the store accepts', () => {
  const fields = [
    ...manifest.config_schema,
    ...manifest.actions.flatMap((a) => a.fields ?? []),
    ...manifest.widgets.flatMap((w) => w.settings ?? []),
    ...manifest.scene_triggers.flatMap((t) => t.fields ?? []),
    ...manifest.scene_actions.flatMap((a) => a.fields ?? []),
  ];
  for (const field of fields) {
    assert.ok(FIELD_TYPES.includes(field.type), `${field.key}: ${field.type}`);
    assert.match(field.key, /^[a-z0-9_]+$/);
    if (field.placeholder !== undefined) {
      assert.ok(['string', 'number', 'secret'].includes(field.type), field.key);
    }
    if (field.min !== undefined || field.max !== undefined) {
      assert.equal(field.type, 'number', field.key);
    }
  }
});

/** Every multi-language object of the manifest, with where it sits. */
function multiLanguageTexts(node, path = 'manifest') {
  if (Array.isArray(node)) {
    return node.flatMap((child, index) => multiLanguageTexts(child, `${path}[${index}]`));
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }
  const keys = Object.keys(node);
  if (keys.includes('en') && keys.every((key) => /^[a-z]{2}$/.test(key))) {
    return [{ path, text: node }];
  }
  return keys.flatMap((key) => multiLanguageTexts(node[key], `${path}.${key}`));
}

test('every text of the manifest is in English, French, German and Spanish', () => {
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 80, `only ${texts.length} texts found`);
  for (const { path, text } of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), path);
    for (const language of LANGUAGES) {
      assert.ok(text[language].trim().length > 0, `${path}.${language}`);
    }
  }
});

test('the user documentation exists in the four languages', async () => {
  for (const language of LANGUAGES) {
    const text = await read(`../docs/${language}.md`);
    // The same sections everywhere: the scene keys are named as is.
    for (const key of [...Object.values(SCENE_TRIGGERS), ...Object.values(SCENE_ACTIONS)]) {
      assert.ok(text.includes(key), `docs/${language}.md does not name ${key}`);
    }
  }
});
