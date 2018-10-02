export type ServiceContainer = {
	[key: string]: any;
};

/**
 * Container for both built-in and user-defined services.
 *
 * # The built-in services
 * 1. logger, with methods `log(message)` and `error(message)`.
 *
 * @publicapi
 */
export class ServiceProvider {
	/** @internalapi */
	private readonly services: ServiceContainer;

	/** @internalapi */
	public constructor(services: ServiceContainer) {
		this.services = services;
	}

	/** @publicapi */
	public get(name: string): any {
		if (this.services[name] == null) {
			throw new Error(`Service "${name}" was not found.`);
		}

		return this.services[name];
	}

	/** @internalapi */
	public setAllIn(theContainer: ServiceContainer): void {
		Object.assign(this.services, theContainer);
	}
}
