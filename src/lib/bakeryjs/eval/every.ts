export default function every<T>(arr: T[], evalFunction: (val: T) => boolean) {
	for (let i = 0; i < arr.length; i++) {
		if (!evalFunction(arr[i])) {
			return false;
		}
	}

	return true;
}

export function everyMap<T>(
	map: Map<any, T>,
	evalFunction: (val: T) => boolean
) {
	for (const i of map.values()) {
		if (!evalFunction(i)) {
			return false;
		}
	}

	return true;
}
