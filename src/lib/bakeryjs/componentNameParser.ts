const REMOVABLE_SUBSTRINGS = [
	'_/',
	'boxes/',
	'generators/',
	'processors/',
	'.coffee',
	'.ts',
	'.js',
];

const MODULE_REGEXP = new RegExp('(?:/|^)[^./][^/]+.(?:coffee|js|ts)$');

const parseComponentName = (path: string): string | null => {
	if (!MODULE_REGEXP.test(path)) {
		return null;
	}

	let name = path;
	for (const removableSubstring of REMOVABLE_SUBSTRINGS) {
		name = name.replace(removableSubstring, '');
	}

	return name;
};

export {parseComponentName};
