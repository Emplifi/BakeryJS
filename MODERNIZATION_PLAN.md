# BakeryJS Modernization Plan

## Executive Summary

This document outlines a comprehensive plan to modernize the BakeryJS codebase. The project currently uses outdated dependencies and configurations dating back to 2019. Now that comprehensive unit tests are in place (207 tests passing), we can safely modernize the infrastructure.

---

## Phase 0: Version Validation and Research

**Purpose**: Before executing any modernization steps, validate that all target package versions are current and accurate. This phase ensures we have up-to-date information from authoritative sources (npm registry, Node.js release schedule) rather than relying on potentially outdated training data.

### 0.1 Validation Methodology

For each package/library/dependency:
1. **Query npm registry** to verify the latest stable version
2. **Check for deprecation notices** on the npm package page
3. **Review release dates** to ensure versions are current
4. **Identify any breaking changes** documented in changelogs
5. **Verify Node.js LTS schedule** from official Node.js release page

### 0.2 Verified Package Versions (as of December 2025)

| Package | Plan Version | Verified Latest | Source | Status |
|---------|-------------|-----------------|--------|--------|
| typescript | 5.9.3 | 5.9.3 | npmjs.com | ✅ Confirmed |
| jest | 30.2.0 | 30.2.0 | npmjs.com | ✅ Confirmed |
| ts-jest | 29.4.6 | 29.4.6 | npmjs.com | ✅ Confirmed |
| eslint | 9.39.2 | 9.39.2 | npmjs.com | ✅ Confirmed |
| @typescript-eslint/eslint-plugin | 8.49.0 | 8.49.0 | npmjs.com | ✅ Confirmed |
| @typescript-eslint/parser | 8.49.0 | 8.49.0 | npmjs.com | ✅ Confirmed |
| prettier | 3.7.4 | 3.7.4 | npmjs.com | ✅ Confirmed |
| ajv | 8.17.1 | 8.17.1 | npmjs.com | ✅ Confirmed |
| async | 3.2.6 | 3.2.6 | npmjs.com | ✅ Confirmed |
| ts-node | ^10 | 10.9.2 | npmjs.com | ✅ Confirmed (stable) |
| @types/node | 24.x | 22.x - 24.x | npmjs.com | ⚠️ Use Node-compatible types |
| @types/jest | 30.x | 29.x | npmjs.com | ⚠️ Use 29.x with Jest 30 |

### 0.3 Node.js LTS Schedule Validation

| Version | Status (Dec 2025) | EOL Date |
|---------|-------------------|----------|
| Node.js 18 | End of Life | April 2025 |
| Node.js 20 | Maintenance LTS | April 2026 |
| Node.js 22 | Active LTS | April 2027 |
| Node.js 24 | Current LTS | April 2028 |

**Recommendation**: Target Node.js 22+ as minimum, with Node.js 24 as the preferred version for new development.

### 0.4 Items Requiring Version Check Before Each Phase

Before executing each phase, run these validation steps:

```bash
# Check latest version of a package
npm view <package-name> version

# Check all outdated packages after installation
npm outdated

# Verify installed versions
npm list --depth=0
```

### 0.5 Deprecation Warnings

The following deprecated packages should be removed during modernization:

| Package | Reason |
|---------|--------|
| eslint-plugin-typescript | Superseded by @typescript-eslint/eslint-plugin |
| typescript-eslint-parser | Superseded by @typescript-eslint/parser |
| @types/async | async v3+ includes built-in TypeScript types |

### 0.6 Pre-Modernization Checklist

- [ ] Verify Node.js 22+ is installed (`node --version`)
- [ ] Ensure npm 9+ is available (`npm --version`)
- [ ] Run `npm outdated` to see current state
- [ ] Back up current `package-lock.json`
- [ ] Commit all current work before starting modernization

---

## Current State Analysis

### Environment
- **Current Node.js minimum**: 8.11 (package.json)
- **Running Node.js**: 22.18.0
- **TypeScript**: 3.9.10 → target 5.x
- **ESLint**: 7.x with legacy config format

### Outdated Dependencies Summary

| Category | Package | Current | Latest | Breaking? |
|----------|---------|---------|--------|-----------|
| **TypeScript** | typescript | 3.9.10 | 5.9.3 | Yes |
| **Testing** | jest | 25.5.4 | 30.2.0 | Yes |
| **Testing** | ts-jest | 25.5.1 | 29.4.6 | Yes |
| **Linting** | eslint | 7.30.0 | 9.39.2 | Yes |
| **Linting** | @typescript-eslint/* | 1.13.0 | 8.49.0 | Yes |
| **Formatting** | prettier | 2.2.1 | 3.7.4 | Yes |
| **Runtime** | ajv | 6.12.6 | 8.17.1 | Yes |
| **Runtime** | async | 2.6.2 | 3.2.6 | Yes |
| **Types** | @types/node | 14.x | 25.x | Yes |
| **Types** | @types/jest | 26.x | 30.x | Yes |

---

## Phase 1: TypeScript Modernization

> **⚠️ Dependency**: This phase requires TypeScript 5.x to be installed first (Phase 3).
> Execute Phase 3 before Phase 1. See [Implementation Order](#implementation-order).

### 1.1 Update tsconfig.json

**Goal**: Modernize TypeScript compilation to ES2020+ with stricter type checking.

**Changes to `tsconfig.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "CommonJS",
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "build",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "baseUrl": "./",
    "paths": {
      "bakeryjs": ["src/index.ts"],
      "bakeryjs/*": ["src/lib/bakeryjs/*"]
    }
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "build"]
}
```

**New Features Enabled**:
- `noFallthroughCasesInSwitch`: Catch missing break statements
- `noUncheckedIndexedAccess`: Add undefined to index signatures
- `declarationMap`: Better IDE navigation
- `forceConsistentCasingInFileNames`: Prevent case-sensitivity issues
- `skipLibCheck`: Faster compilation
- `resolveJsonModule`: Import JSON files

**Removed**:
- `experimentalDecorators` and `emitDecoratorMetadata` (not used in codebase)
- Commented-out options (cleanup)

### 1.2 Update tsconfig.build.json

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "**/node_modules/*", "**/__tests__/*"],
  "compilerOptions": {
    "sourceMap": false
  }
}
```

---

## Phase 2: Node.js Version Update

### 2.1 Update package.json engines

```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

### 2.2 Create .nvmrc

```
20
```

**Rationale**: Node.js 18 is the current LTS, Node.js 20 is the active LTS. Setting minimum to 18 ensures ES2020+ features and modern npm features.

---

## Phase 3: TypeScript and Type Definitions Update

### 3.1 Update TypeScript to 5.x

```bash
npm install --save-dev typescript@^5.7.0
```

### 3.2 Update Type Definitions

```bash
npm install --save-dev \
  @types/node@^20 \
  @types/jest@^29 \
  @types/better-queue@^3.8.6 \
  @types/verror@^1.10.11
```

**Note**: Remove `@types/async` - the `async` library itself includes types in v3.

### 3.3 Code Changes for TypeScript 5.x

- Review any `any` types that can be replaced with `unknown`
- Update type assertions where needed
- Fix any new strict mode errors

---

## Phase 4: Jest and Testing Infrastructure Update

### 4.1 Update Jest to 29.x

**Note**: While Jest 30.x is available, Jest 29.x is recommended for stability and better ecosystem compatibility. The @types/jest package currently only supports up to 29.x.

```bash
npm install --save-dev jest@^29 ts-jest@^29 @types/jest@^29
```

### 4.2 Update jest.config.js

The current config uses deprecated `ts-jest/utils`. Update to:

```javascript
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.{js,ts}'],
  coverageReporters: ['text', 'lcov'],
  moduleNameMapper: {
    '^bakeryjs$': '<rootDir>/src/index.ts',
    '^bakeryjs/(.*)$': '<rootDir>/src/lib/bakeryjs/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/(build|docs|node_modules)/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
};
```

### 4.3 Update jest.setup.js

Convert to TypeScript or keep as JS with modern patterns:

```javascript
// jest.setup.js
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});
```

---

## Phase 5: ESLint Modernization

### 5.1 Remove Deprecated Packages

```bash
npm uninstall eslint-plugin-typescript typescript-eslint-parser
```

### 5.2 Update ESLint Packages

```bash
npm install --save-dev \
  eslint@^9 \
  @typescript-eslint/eslint-plugin@^8 \
  @typescript-eslint/parser@^8 \
  eslint-config-prettier@^10 \
  eslint-plugin-jest@^29 \
  eslint-plugin-prettier@^5
```

### 5.3 Migrate to Flat Config

Create new `eslint.config.mjs` (ESLint 9 flat config format):

**Note**: Use `.mjs` extension since the project uses CommonJS. Alternatively, add `"type": "module"` to package.json and use `.js`.

```javascript
// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';
import jest from 'eslint-plugin-jest';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
      }],
      '@typescript-eslint/explicit-member-accessibility': 'warn',
      '@typescript-eslint/member-ordering': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['**/*.test.ts', '**/__tests__/**'],
    plugins: { jest },
    ...jest.configs['flat/recommended'],
    rules: {
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/valid-expect': 'error',
    },
  },
  {
    ignores: ['build/**', 'node_modules/**', 'docs/**'],
  }
);
```

### 5.4 Remove Old ESLint Config

Delete `.eslintrc.json` after migration is complete.

### 5.5 Update package.json Scripts

```json
{
  "scripts": {
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint --fix src/ tests/"
  }
}
```

---

## Phase 6: Prettier Update

### 6.1 Update Prettier

```bash
npm install --save-dev prettier@^3
```

### 6.2 Review Configuration

Current `.prettierrc.json` is mostly compatible. Consider updating:

```json
{
  "semi": true,
  "arrowParens": "always",
  "singleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": false,
  "useTabs": true,
  "printWidth": 80,
  "tabWidth": 4
}
```

**Changes**:
- `trailingComma`: `"es5"` → `"all"` (ES2020 supports trailing commas everywhere)

---

## Phase 7: Runtime Dependencies Update

### 7.1 Update Safe Dependencies (Non-Breaking)

```bash
npm install better-queue@^3.8.12 debug@^4.4.3 verror@^1.10.1
```

### 7.2 Update AJV (Breaking Changes)

AJV 8.x has significant API changes:

```bash
npm install ajv@^8
```

**Required Code Changes**:

In `src/lib/bakeryjs/Program.ts`:
```typescript
// Old (v6)
import ajv from 'ajv';
const validator = new ajv({ schemas: [...] });

// New (v8)
import Ajv from 'ajv';
const ajv = new Ajv({ schemas: [...] });
```

In `src/lib/bakeryjs/Box.ts`:
```typescript
// Old (v6)
import ajv from 'ajv';
const ajvValidator = new ajv();

// New (v8)
import Ajv from 'ajv';
const ajv = new Ajv();
```

### 7.3 Update Async Library (Breaking Changes)

```bash
npm install async@^3
```

**Note**: Review usage in codebase. The async library v3 drops support for Node < 10 and has some API changes.

### 7.4 Keep sb-jsnetworkx

No update available. Consider:
- Documenting this dependency
- Evaluating alternatives if maintenance becomes an issue

---

## Phase 8: Other Tooling Updates

### 8.1 Update ts-node

```bash
npm install --save-dev ts-node@^10
```

### 8.2 Update nodemon

```bash
npm install --save-dev nodemon@^3
```

### 8.3 Update typedoc

```bash
npm install --save-dev typedoc@^0.28
```

Update doc script if needed:
```json
{
  "scripts": {
    "doc": "typedoc --out ./docs/ src/"
  }
}
```

### 8.4 Update json5

```bash
npm install --save-dev json5@^2.2.3
```

---

## Phase 9: Code Modernization

### 9.1 Replace require() with ES Imports

**Current Pattern**:
```typescript
const debug = require('debug')('bakeryjs:Program');
import VError = require('verror');
```

**Updated Pattern**:
```typescript
import Debug from 'debug';
const debug = Debug('bakeryjs:Program');

import VError from 'verror';
```

### 9.2 Update Type Imports

Use `import type` where appropriate:

```typescript
import type { BoxMeta, BatchingBoxMeta } from './BoxI';
```

### 9.3 Replace `any` with Stricter Types

Review and update:
- Function parameters with `any`
- Generic types with `any`
- Event handler types

### 9.4 Use Modern Syntax

- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Use `Object.entries()` / `Object.fromEntries()` where appropriate
- Use `Array.prototype.at()` for negative indexing

---

## Phase 10: Cleanup and Documentation

### 10.1 Remove Deprecated Files

- Delete old `.eslintrc.json` after migration
- Remove any unused configuration files

### 10.2 Update package.json Metadata

```json
{
  "name": "bakeryjs",
  "version": "0.2.0",
  "description": "FBP-inspired data processing library for Node.js",
  "main": "build/index.js",
  "types": "build/index.d.ts",
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "scripts": {
    "build": "tsc -b tsconfig.build.json",
    "build:watch": "tsc -b tsconfig.build.json --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint --fix src/ tests/",
    "format": "prettier --write 'src/**/*.ts' 'tests/**/*.ts'",
    "format:check": "prettier --check 'src/**/*.ts' 'tests/**/*.ts'",
    "doc": "typedoc --out ./docs/ src/",
    "code-quality": "npm run lint && npm run format:check && npm run test",
    "prepare": "npm run build"
  }
}
```

### 10.3 Update README.md

- Update Node.js version requirements
- Update installation instructions
- Document breaking changes

---

## Implementation Order

Execute phases in this order to minimize disruption:

```
1. Node.js Version (Phase 2)
   └── Update engines and add .nvmrc
   └── No code dependencies, safe first step

2. TypeScript + Types (Phase 3)
   └── Update compiler and type definitions
   └── MUST come before tsconfig changes (Phase 1)

3. TypeScript Config (Phase 1)
   └── Now safe to use TS 4.1+ options like noUncheckedIndexedAccess
   └── Requires TypeScript 5.x to be installed first

4. Jest Update (Phase 4)
   └── Update testing infrastructure
   └── Run tests to verify: npm test

5. ESLint Migration (Phase 5)
   └── Biggest change - migrate to flat config
   └── Fix new linting errors

6. Prettier Update (Phase 6)
   └── Update and reformat codebase

7. Runtime Dependencies (Phase 7)
   └── AJV and async updates require code changes
   └── Run tests after each change

8. Other Tooling (Phase 8)
   └── ts-node, nodemon, typedoc

9. Code Modernization (Phase 9)
   └── Incremental improvements

10. Cleanup (Phase 10)
    └── Final cleanup and version bump
```

**⚠️ Critical Note**: Phase 1 (TypeScript Config) uses `noUncheckedIndexedAccess` which requires TypeScript 4.1+. TypeScript must be upgraded (Phase 3) BEFORE applying tsconfig changes (Phase 1).

---

## Verification Checklist

After each phase:

- [ ] `npm run build` succeeds
- [ ] `npm test` passes (207 tests)
- [ ] `npm run lint` passes (or only warnings)
- [ ] No new TypeScript errors

Final verification:

- [ ] Clean install: `rm -rf node_modules && npm install`
- [ ] Full test suite passes
- [ ] Build produces valid output
- [ ] Example project still works

---

## Rollback Strategy

If issues arise:

1. Use git to revert changes
2. Keep old configuration files until migration is verified
3. Test incrementally after each phase

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| AJV v8 breaking changes | High | Careful code review, tests |
| ESLint flat config migration | Medium | Gradual migration, test linting |
| Jest 29 compatibility | Medium | Run test suite immediately |
| TypeScript 5 stricter checks | Low | Fix errors incrementally |

---

## Estimated Effort

| Phase | Estimated Time | Complexity |
|-------|---------------|------------|
| Phase 1-2 | 30 minutes | Low |
| Phase 3 | 1 hour | Low |
| Phase 4 | 1-2 hours | Medium |
| Phase 5 | 2-3 hours | High |
| Phase 6 | 30 minutes | Low |
| Phase 7 | 2-3 hours | High |
| Phase 8 | 30 minutes | Low |
| Phase 9 | 2-4 hours | Medium |
| Phase 10 | 1 hour | Low |

**Total Estimated Time**: 10-15 hours

---

## Success Criteria

- All 207 tests pass
- No build errors
- ESLint reports no errors (warnings acceptable)
- TypeScript compilation succeeds
- Code uses modern ES2020+ features
- All dependencies are up-to-date (or documented if pinned)

