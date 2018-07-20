export class ServiceProvider {
	private readonly services: {[key: string]: any};

	public constructor(services: {[key: string]: any}) {
		this.services = services;
	}

	public get(name: string): any {
		if (this.services[name] == null) {
			throw new Error(`Service "${name}" was not found.`);
		}

		return this.services[name];
	}
}
