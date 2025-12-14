import { VError } from 'verror'
import type { BatchingBoxInterface, BoxInterface } from './BoxI'
import type ComponentFactoryI from './ComponentFactoryI'
import type { PriorityQueueI } from './queue/PriorityQueueI'
import type { Message } from './Message'
import type { ServiceProvider } from './ServiceProvider'
import { scanComponentsPath } from './scanComponentsPath'
import Debug from 'debug'

const debug = Debug('bakeryjs:componentProvider')

function boxNotFoundError(name: string, baseURIs: string | string[]): Error {
	const joinedUris = typeof baseURIs == 'string' ? baseURIs : baseURIs.join(',')
	return new VError(
		{
			name: 'BoxNotFound',
			info: {
				requestedBoxName: name,
				factoryBaseUri: baseURIs
			}
		},
		"Box '%s' not found in %s.",
		name,
		joinedUris
	)
}

export class ComponentFactory implements ComponentFactoryI {
	private availableComponents: { [s: string]: string } = {}
	private readonly serviceProvider: ServiceProvider
	public readonly baseURI: string

	public constructor(componentsPath: string, serviceProvider: ServiceProvider) {
		this.baseURI = `file://${componentsPath}`
		this.availableComponents = scanComponentsPath(componentsPath)
		debug(this.availableComponents)
		this.serviceProvider = serviceProvider
	}

	public async create(
		name: string,
		queue?: PriorityQueueI<Message>,
		parameters?: any
	): Promise<BoxInterface | BatchingBoxInterface> {
		if (!this.availableComponents[name]) {
			throw boxNotFoundError(name, this.baseURI)
		}
		try {
			// TODO: (code detail) Is it necessary to always import the file?
			const box = await import(this.availableComponents[name])
			return new box.default(name, this.serviceProvider, queue, parameters) as
				| BoxInterface
				| BatchingBoxInterface
		} catch (error) {
			throw new VError(
				{
					name: 'ComponentLoadError',
					cause: error instanceof Error ? error : new Error(String(error)),
					info: {
						componentName: name
					}
				},
				'Error loading component %s',
				name
			)
		}
	}
}

export class MultiComponentFactory implements ComponentFactoryI {
	protected readonly factories: ComponentFactory[]
	public constructor() {
		this.factories = []
	}

	public push(factory: ComponentFactory) {
		this.factories.unshift(factory)
	}

	public async create(
		name: string,
		queue?: PriorityQueueI<Message>,
		parameters?: any
	): Promise<BoxInterface | BatchingBoxInterface> {
		const futureBoxes = this.factories.map(async factory => {
			try {
				return await factory.create(name, queue, parameters)
			} catch (reason) {
				const error = reason instanceof Error ? reason : new Error(String(reason))
				if (VError.hasCauseWithName(error, 'BoxNotFound')) {
					return
				}

				throw new VError(
					{
						name: 'FactoryException',
						message: 'ComponentFactory.create(%s) failed.',
						info: {
							factoryBaseURI: factory.baseURI,
							requestedBoxName: name
						},
						cause: error
					},
					name
				)
			}
		})

		const resolvedBoxes = await Promise.all(futureBoxes)
		const result = resolvedBoxes.find((resp: any) => resp !== undefined)
		if (result) {
			return result
		}

		throw boxNotFoundError(
			name,
			this.factories.map(f => f.baseURI)
		)
	}
}
