import {join} from 'path';
import * as fs from 'fs';
import {parseComponentName} from './componentNameParser';

type ComponentsMap = {[componentName: string]: string};

// TODO: Make async
function scanComponentsPath(
	componentsPath: string,
	parentDir: string = '',
	availableComponents: ComponentsMap = {}
): ComponentsMap {
	const files = fs.readdirSync(componentsPath);
	for (const file of files) {
		const filePath = join(componentsPath, file);
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			if (file !== '.' && file !== '..') {
				scanComponentsPath(
					filePath,
					join(parentDir, file),
					availableComponents
				);
			}
		} else {
			const name = parseComponentName(join(parentDir, file));
			if (!name) {
				continue;
			}
			availableComponents[name] = filePath;
		}
	}
	return availableComponents;
}

export {scanComponentsPath};
