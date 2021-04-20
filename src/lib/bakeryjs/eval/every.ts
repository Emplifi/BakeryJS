export default function every<T>(arr: T[], evalFunction: (val: T) => Boolean) {
	for (let i = 0; i < arr.length; i++) {
		if (!evalFunction(arr[i])) {
			return false;
		}
	}

	return true;
}
