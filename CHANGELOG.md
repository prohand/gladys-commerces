# Changelog

All notable changes to this integration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/), bumped by the Release workflow.

Describe each change under `## [Unreleased]` as you make it. The Release workflow
moves that section under the version it ships, and the section becomes the notes of
the version's GitHub Release.

## [Unreleased]

### Added

- Product recalls from RappelConso (French open data) that concern E.Leclerc: those
  naming E.Leclerc, and optionally those sold by all retailers; filter by category.
- Store opening hours in the OpenStreetMap syntax, with French public holidays.
- Devices: the store (open, minutes until it opens or closes) and the recalls
  (count, latest recall), with a cloud / unreachable transport badge.
- Scene triggers: a product sold at E.Leclerc is recalled, the store opens soon,
  the store closes soon.
- Scene actions: check a barcode, is the store open.
- Dashboard widgets: store hours, product recalls (with a barcode form).
- Configuration-screen actions: test the configuration, check a barcode.
- English, French, German and Spanish for every text and the documentation.
- CI (Prettier, ESLint, tests on Node 22 and 24, store checks, Docker build),
  multi-arch image build, Release and GitHub releases workflows, Dependabot.
- `SECURITY.md` and `CLAUDE.md`.

[Unreleased]: https://github.com/prohand/gladys-eleclerc/commits/main
