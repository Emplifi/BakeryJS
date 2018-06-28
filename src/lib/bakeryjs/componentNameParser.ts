const REMOVABLE_SUBSTRINGS = [
    '_/',
    'boxes/',
    'generators/',
    'processors/',
    '.coffee',
    '.ts',
    '.js',
];

const parseComponentName = (path: string): string => {
    let name = path;
    for (const removableSubstring of REMOVABLE_SUBSTRINGS) {
        name = name.replace(removableSubstring, '');
    }

    return name;
};

export {
    parseComponentName,
};
