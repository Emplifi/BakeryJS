import {parseComponentName} from '../componentNameParser';

type PathTestDefinition = {
	path: string;
	expected: string | null;
};

describe('component name parser', () => {
	const paths: PathTestDefinition[] = [
		{
			path: '_/boxes/generators/processors/test-001.coffee.js.ts',
			expected: 'test-001',
		},
		{
			path: 'test-002.ts',
			expected: 'test-002',
		},
		{
			path: '_/.secret/test-003.ts',
			expected: '.secret/test-003',
		},
		{
			path: '.gitignore',
			expected: null,
		},
		{
			path: '_/',
			expected: null,
		},
	];

	paths.forEach(({path, expected}: PathTestDefinition, index: number) => {
		it(`parses name from component file path #${index}`, () => {
			const name = parseComponentName(path);

			expect(name).toBe(expected);
		});
	});
});
