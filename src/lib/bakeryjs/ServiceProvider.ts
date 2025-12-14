/**
 * Base interface for services registered in ServiceProvider.
 * Services may optionally implement lifecycle methods.
 *
 * @publicapi
 */
export interface Service {
	initialize?(): Promise<void>
	destroy?(): Promise<void>
}

/**
 * Logger interface for the built-in logging service.
 *
 * @publicapi
 */
export interface Logger extends Service {
	log(message: unknown): void
	error(message: unknown): void
}

/**
 * Container type for services.
 * Services can be any object - the Service interface is a recommended base.
 *
 * @publicapi
 */
export type ServiceContainer = {
	[key: string]: unknown
}

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
	private readonly services: ServiceContainer
	public readonly parameters: unknown

	/** @internalapi */
	public constructor(services: ServiceContainer) {
		this.services = services
	}

	/** @publicapi */
	public get<T = unknown>(name: string): T {
		const service = this.services[name]
		if (service == null) {
			throw new Error(`Service "${name}" was not found.`)
		}

		return service as T
	}

	/** @internalapi */
	public setAllIn(theContainer: ServiceContainer): void {
		Object.assign(this.services, theContainer)
	}

	/** @internalapi */
	public addParameters(params: unknown): ServiceProvider {
		return Object.create(this, { parameters: { value: params } })
	}
}
