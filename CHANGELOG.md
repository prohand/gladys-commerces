# Changelog

All notable changes to this integration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/), bumped by the Release workflow.

Describe each change under `## [Unreleased]` as you make it. The Release workflow
moves that section under the version it ships, and the section becomes the notes of
the version's GitHub Release.

## [Unreleased]

### Added

- Opening hours of several shops in the OpenStreetMap syntax, with French public
  holidays: one device per shop (open, minutes until it opens or closes).
- Loyalty cards of any brand: one device per card with its balance, entered by the
  user; the card's barcode (EAN-13 or Code 128) on the dashboard.
- Scene triggers: a shop opens soon, a shop closes soon (filter: the shop).
- Scene actions: is a shop open, update a loyalty card balance (set or add).
- Dashboard widgets: shop hours (all shops, or one in detail), loyalty card
  (barcode, balance, update form).
- Configuration-screen action: test the configuration.
- English, French, German and Spanish for every text and the documentation.
- CI (Prettier, ESLint, tests on Node 22 and 24, store checks, Docker build),
  multi-arch image build, Release and GitHub releases workflows, Dependabot.
- `SECURITY.md` and `CLAUDE.md`.

[Unreleased]: https://github.com/prohand/gladys-commerces/commits/main
