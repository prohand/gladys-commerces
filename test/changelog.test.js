import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollChangelog } from '../.github/scripts/changelog-release.mjs';

const REPO = 'https://github.com/prohand/gladys-horaires-commerces';

test('the first release moves Unreleased under the version and links its tag', () => {
  const text = `# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Everything.\n\n[Unreleased]: ${REPO}/commits/main\n`;
  assert.equal(
    rollChangelog(text, '1.0.0', '2026-11-01'),
    `# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-11-01\n\n### Added\n\n- Everything.\n\n` +
      `[Unreleased]: ${REPO}/compare/v1.0.0...HEAD\n[1.0.0]: ${REPO}/releases/tag/v1.0.0\n`,
  );
});

test('a later release compares with the previous tag; an empty one says so', () => {
  const text = `## [Unreleased]\n\n## [1.0.0] - 2026-11-01\n\n- x\n\n[Unreleased]: ${REPO}/compare/v1.0.0...HEAD\n`;
  const rolled = rollChangelog(text, '1.0.1', '2026-11-02');
  assert.match(
    rolled,
    /## \[1\.0\.1\] - 2026-11-02\n\n- Maintenance release, no functional change\./,
  );
  assert.match(rolled, /\[1\.0\.1\]: .*\/compare\/v1\.0\.0\.\.\.v1\.0\.1/);
});

test('a version already in the changelog is left alone', () => {
  const text = `## [Unreleased]\n\n## [1.0.0] - 2026-11-01\n`;
  assert.equal(rollChangelog(text, '1.0.0', '2026-11-02'), text);
});
