export type ServiceContainer = {
	[key: string]: any;
};

export class ServiceProvider {
	private readonly services: ServiceContainer;

	public constructor(services: ServiceContainer) {
		this.services = services;
	}

	public get(name: string): any {
		if (this.services[name] == null) {
			throw new Error(`Service "${name}" was not found.`);
		}

		return this.services[name];
	}

	public setAllIn(theContainer: ServiceContainer): void {
		Object.assign(this.services, theContainer);
	}
}
