import { join } from 'path'
import * as fs from 'fs'
import { parseComponentName } from './componentNameParser'

type ComponentsMap = { [componentName: string]: string }

function isValidDirectory(file: string): boolean {
	return file !== '.' && file !== '..'
}

function processDirectory(
	filePath: string,
	parentDir: string,
	file: string,
	availableComponents: ComponentsMap
): void {
	if (isValidDirectory(file)) {
		scanComponentsPath(filePath, join(parentDir, file), availableComponents)
	}
}

function processFile(
	filePath: string,
	parentDir: string,
	file: string,
	availableComponents: ComponentsMap
): void {
	const name = parseComponentName(join(parentDir, file))
	if (name) {
		availableComponents[name] = filePath
	}
}

// TODO: Make async
function scanComponentsPath(
	componentsPath: string,
	parentDir: string = '',
	availableComponents: ComponentsMap = {}
): ComponentsMap {
	const files = fs.readdirSync(componentsPath)
	for (const file of files) {
		const filePath = join(componentsPath, file)
		const stat = fs.statSync(filePath)
		if (stat.isDirectory()) {
			processDirectory(filePath, parentDir, file, availableComponents)
		} else {
			processFile(filePath, parentDir, file, availableComponents)
		}
	}
	return availableComponents
}

export { scanComponentsPath }
