// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The store indexer validates the manifest on its own, but nothing there can
// know which handlers the code registers or which keys it fires: these tests
// keep both sides in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, LIMITS } from '../src/config.js';
import { ACTIONS } from '../src/capabilities/actions.js';
import { BALANCE_MODES, SCENE_ACTIONS, SCENE_TRIGGERS } from '../src/capabilities/scenes.js';
import { CARD_WIDGET_ACTIONS, WIDGET_KEYS } from '../src/capabilities/widgets.js';
import { MAX_BALANCE } from '../src/devices/index.js';
import { parseCards } from '../src/shops/cards.js';
import { parseStores } from '../src/shops/stores.js';
import { LANGUAGES } from '../src/i18n.js';

const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('../gladys-assistant-integration.json'));
const pkg = JSON.parse(await read('../package.json'));

test('version, image and cover agree with package.json and with each other', () => {
  // The repository is named once, by the image: renaming it means replacing
  // `<owner>/<repo>` in the manifest, package.json and the docs links.
  const [, owner, repo, tag] = /^ghcr\.io\/([^/]+)\/([^:]+):(.+)$/.exec(manifest.docker_image);
  assert.equal(tag, pkg.version);
  assert.equal(manifest.version, pkg.version);
  assert.equal(pkg.name, repo);
  assert.ok(
    manifest.cover_image.startsWith(`https://raw.githubusercontent.com/${owner}/${repo}/`),
    manifest.cover_image,
  );
  const docs = manifest.config_schema[0].links.find((link) => link.url.includes('/docs/'));
  assert.ok(docs.url.startsWith(`https://github.com/${owner}/${repo}/`), docs.url);
});

test('a local integration, for France, on Gladys 5.3 or later', () => {
  // The states are computed in the container: the only call out is the
  // OpenStreetMap lookup of the stores written `auto`, near the houses.
  assert.deepEqual(manifest.transports, ['local']);
  assert.equal(manifest.location, true);
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
    'climate', 'lighting', 'energy', 'security', 'multimedia', 'appliances', 'environment',
    'protocols', 'network', 'notifications', 'assistants', 'services', 'transport', 'vehicles',
    'servers', 'leisure',
  ]; // prettier-ignore
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
});

/** A placeholder without its "e.g." in front. */
const example = (field, language) =>
  field.placeholder[language].replace(/^(e\.g\.|ex\.|z\. B\.|p\. ej\.)\s+/, '');

test('the examples of the placeholders are read as they are meant', () => {
  const stores = manifest.config_schema.find((f) => f.key === 'stores');
  const cards = manifest.config_schema.find((f) => f.key === 'loyalty_cards');
  for (const language of LANGUAGES) {
    const parsed = parseStores(example(stores, language));
    assert.deepEqual(parsed.errors, [], language);
    assert.equal(parsed.stores.length, 2, language);
    assert.deepEqual(
      parsed.stores.map((store) => [Boolean(store.search), Boolean(store.schedule)]),
      [
        [true, false],
        [false, true],
      ],
      language,
    );
    const read = parseCards(example(cards, language));
    assert.deepEqual(read.errors, [], language);
    assert.deepEqual(
      read.cards.map((card) => card.name),
      ['Leclerc Marie', 'Carrefour'],
      language,
    );
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
  for (const trigger of manifest.scene_triggers) {
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
  const balance = manifest.scene_actions.find((a) => a.key === SCENE_ACTIONS.set_loyalty_balance);
  const mode = balance.fields.find((f) => f.key === 'mode');
  assert.deepEqual(mode.options.map((o) => o.value).sort(), Object.values(BALANCE_MODES).sort());
  const amount = balance.fields.find((f) => f.key === 'amount');
  assert.deepEqual([amount.min, amount.max], [-MAX_BALANCE, MAX_BALANCE]);
});

test('the widgets are the ones the code renders', () => {
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGET_KEYS).sort(),
  );
  assert.deepEqual(Object.values(CARD_WIDGET_ACTIONS), ['set_balance']);
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
    if (field.source !== undefined) {
      assert.equal(field.source, 'devices');
      assert.equal(field.options, undefined, `${field.key}: source and options together`);
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
  assert.ok(texts.length > 40, `only ${texts.length} texts found`);
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
    assert.ok(!/rappel ?conso/i.test(text), `docs/${language}.md still talks about recalls`);
    // The examples of the docs are read as they are written.
    const [stores, cards] = [...text.matchAll(/```\n(.+)\n```/g)].map((match) => match[1]);
    const parsedStores = parseStores(stores);
    assert.deepEqual(parsedStores.errors, [], `docs/${language}.md stores example`);
    assert.equal(parsedStores.stores.filter((store) => store.schedule).length, 3, language);
    assert.deepEqual(parseCards(cards).errors, [], `docs/${language}.md cards example`);
    assert.equal(parseCards(cards).cards.length, 2, language);
  }
});
