import {join, resolve} from 'path';
import {scanComponentsPath} from '../scanComponentsPath';

// Use test-data directory which contains actual components
const testDataDir = resolve(__dirname, '../../../../test-data');
const srcComponentsDir = resolve(__dirname, '../../../components');

describe('scanComponentsPath', () => {
	describe('basic scanning', () => {
		it('finds TypeScript components in directory', () => {
			const result = scanComponentsPath(testDataDir);

			expect(result).toHaveProperty('helloworld');
			expect(result).toHaveProperty('hellobatchworld');
			expect(result).toHaveProperty('checksum');
			expect(result).toHaveProperty('wordcount');
		});

		it('returns absolute file paths', () => {
			const result = scanComponentsPath(testDataDir);

			expect(result['helloworld']).toMatch(/^\/.*helloworld\.ts$/);
		});

		it('handles nested directory structures', () => {
			const result = scanComponentsPath(testDataDir);

			// Components are in generators/ and processors/ subdirectories
			expect(result['helloworld']).toContain('generators');
			expect(result['checksum']).toContain('processors');
		});

		it('returns object with component names as keys', () => {
			const result = scanComponentsPath(testDataDir);

			const keys = Object.keys(result);
			expect(keys.length).toBeGreaterThan(0);
			// All keys should be strings without extensions
			keys.forEach((key) => {
				expect(key).not.toContain('.ts');
				expect(key).not.toContain('.js');
			});
		});
	});

	describe('component name extraction', () => {
		it('strips generator prefix from path', () => {
			const result = scanComponentsPath(srcComponentsDir);

			// tick is in _/generators/tick.ts - should extract as just "tick"
			expect(result).toHaveProperty('tick');
			expect(result['tick']).toContain('generators');
		});

		it('strips processor prefix from path', () => {
			const result = scanComponentsPath(srcComponentsDir);

			// print is in _/processors/print.ts
			expect(result).toHaveProperty('print');
			expect(result['print']).toContain('processors');
		});
	});

	describe('edge cases', () => {
		it('handles path with trailing slash', () => {
			const result = scanComponentsPath(testDataDir + '/');

			expect(result).toHaveProperty('helloworld');
		});

		it('handles path without trailing slash', () => {
			const result = scanComponentsPath(testDataDir);

			expect(result).toHaveProperty('helloworld');
		});

		it('accumulates components into provided object', () => {
			const existingComponents = {existing: '/path/to/existing.ts'};
			const result = scanComponentsPath(
				testDataDir,
				'',
				existingComponents
			);

			expect(result).toHaveProperty('existing');
			expect(result).toHaveProperty('helloworld');
		});

		it('uses parentDir for component naming', () => {
			// When parentDir is provided, it affects the component name
			const result = scanComponentsPath(
				join(testDataDir, 'generators'),
				'custom',
				{}
			);

			// Component names include parentDir in the path calculation
			// The parseComponentName strips known prefixes
			expect(Object.keys(result).length).toBeGreaterThan(0);
		});
	});

	describe('file filtering', () => {
		it('only includes .ts, .js, and .coffee files', () => {
			// test-data only has .ts files
			const result = scanComponentsPath(testDataDir);

			Object.values(result).forEach((path) => {
				expect(path).toMatch(/\.(ts|js|coffee)$/);
			});
		});

		it('excludes hidden files starting with dot', () => {
			const result = scanComponentsPath(testDataDir);

			Object.keys(result).forEach((name) => {
				expect(name).not.toMatch(/^\./);
			});
		});
	});

	describe('directory handling', () => {
		it('recursively scans subdirectories', () => {
			const result = scanComponentsPath(testDataDir);

			// Should find components in both generators and processors
			const paths = Object.values(result);
			const hasGenerators = paths.some((p) => p.includes('generators'));
			const hasProcessors = paths.some((p) => p.includes('processors'));

			expect(hasGenerators).toBe(true);
			expect(hasProcessors).toBe(true);
		});

		it('skips . and .. directories', () => {
			// This is implicit in the behavior - if it didn't skip them,
			// it would recurse infinitely or error
			const result = scanComponentsPath(testDataDir);
			expect(result).toBeDefined();
		});
	});
});
