# Changelog

All notable changes to BakeryJS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-14

This is the first stable major release of BakeryJS, representing a complete modernization of the codebase with significant performance improvements and updated tooling.

### ⚠️ Breaking Changes

- **Node.js 24+ required** - Minimum version increased from 8.11 to 24.0.0
- **npm 11+ required** - Minimum version for package manager
- **TypeScript 5.x** - Compilation target updated to ES2020
- **ESLint flat config** - `.eslintrc.json` replaced with `eslint.config.mjs`

### Added

- Custom `FastPriorityQueue` implementation replacing `better-queue` with O(log n) operations
- CPU profiling infrastructure for performance analysis
- Comprehensive benchmarking system for TracingModel performance
- Integration test suite for end-to-end validation
- Code quality script (`npm run code-quality`) for unified formatting, linting, and type checking
- Coverage script with enhanced Jest coverage configuration
- Cyclomatic complexity enforcement (maximum 6) across source files
- Modern ES import syntax with `import type` for type-only imports
- Nullish coalescing (`??`) for safer default values

### Changed

- **Dependencies modernized:**
  - TypeScript: 3.9.10 → 5.9.3
  - Jest: 25.5.4 → 29.7.0
  - ESLint: 7.30.0 → 9.39.2
  - Prettier: 2.2.1 → 3.7.4
  - AJV: 6.12.6 → 8.17.1
  - ts-node: 8.x → 10.9.2
  - nodemon: 2.x → 3.1.11
  - typedoc: 0.20.x → 0.28.15
- **ES target:** ES2017 → ES2020
- **Test suite:** Improved reliability and developer experience
- **Coverage:** Branch coverage improved from 77% to 84%

### Removed

- `better-queue` dependency (replaced with custom FastPriorityQueue)
- `async` library (was unused in codebase)
- `@types/async` (no longer needed)
- `@types/better-queue` (no longer needed)
- `eslint-plugin-typescript` (deprecated, superseded by @typescript-eslint)
- `typescript-eslint-parser` (deprecated, superseded by @typescript-eslint)
- MilanBuilder (experimental, unused)

### Performance

- **Queue throughput:** ~693 msgs/sec → ~63,254 msgs/sec (**91× improvement**)
- **Memory usage:** ~2.37 GB → ~1.33 GB for 1M items (**44% reduction**)
- **Algorithmic complexity:** O(n log n) per insert → O(log n) per insert
- **Throughput degradation:** Eliminated (was causing severe slowdown under load)

### Developer Experience

- 272 tests passing with comprehensive coverage
- Enhanced TypeScript strict mode with `noUncheckedIndexedAccess`
- Modern Jest configuration with proper ts-jest integration
- Unified code quality checks in single command

---

## [0.1.2] - 2021-07-01

### Changed

- Updated jsnetworkx dependency to sb-fork

### Security

- Bumped ws from 7.2.5 to 7.5.0

---

## [0.1.1] - 2021-04-19

### Fixed

- Fixed incorrect import path

---

## [0.1.0] - 2021-01-27

### Changed

- Set `USE_EXPERIMENTAL_TRACING` as default behavior

---

## [0.0.3] - 2020-08-19

### Changed

- Silenced all visual logging unless debug mode is enabled

---

## [0.0.1] - 2020-01-28

### Added

- Initial stable release
- Flow-based programming model with boxes and flows
- Priority queue support with batching
- DAG-based flow builder
- TypeScript support
- Jest test suite

---

## Pre-1.0 Beta Releases

For historical beta releases (v0.0.1-beta.1 through v0.0.1-beta.19), see the git history.

[1.0.0]: https://github.com/Socialbakers/BakeryJS/compare/v0.1.2...v1.0.0
[0.1.2]: https://github.com/Socialbakers/BakeryJS/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Socialbakers/BakeryJS/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Socialbakers/BakeryJS/compare/v0.0.3...v0.1.0
[0.0.3]: https://github.com/Socialbakers/BakeryJS/compare/v0.0.1...v0.0.3
[0.0.1]: https://github.com/Socialbakers/BakeryJS/releases/tag/v0.0.1

