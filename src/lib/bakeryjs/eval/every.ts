export default function every<T>(arr: T[], evalFunction: (val: T) => boolean): boolean {
	for (let i = 0; i < arr.length; i++) {
		const item = arr[i]
		if (item !== undefined && !evalFunction(item)) {
			return false
		}
	}

	return true
}

export function everyMap<T>(map: Map<unknown, T>, evalFunction: (val: T) => boolean): boolean {
	for (const i of map.values()) {
		if (!evalFunction(i)) {
			return false
		}
	}

	return true
}
