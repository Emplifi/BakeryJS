import {join} from 'path';
import {scanComponentsPath} from 'bakeryjs/scanComponentsPath';

const componentsPath = join(__dirname, 'components');

describe('.scanComponentsPath', () => {
	it('finds all components in a directory', () => {
		const result = scanComponentsPath(componentsPath);
		expect(result).toEqual(
			expect.objectContaining({
				tick: join(componentsPath, '_/generators/tick.ts'),
				tock: join(componentsPath, '_/generators/tock.ts'),
				print: join(componentsPath, '_/processors/print.ts'),
			})
		);
	});
});
