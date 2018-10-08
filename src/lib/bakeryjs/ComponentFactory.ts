import * as fs from 'fs';
import {BoxInterface} from './BoxI';
import ComponentFactoryI from './ComponentFactoryI';
import {PriorityQueueI} from './queue/PriorityQueueI';
import {Message} from './Message';
import {parseComponentName} from './componentNameParser';
import {ServiceProvider} from './ServiceProvider';
import VError = require('verror');

const debug = require('debug')('bakeryjs:componentProvider');

function boxNotFoundError(name: string, baseURIs: string | string[]): Error {
	const joinedUris =
		typeof baseURIs == 'string' ? baseURIs : baseURIs.join(',');
	return new VError(
		{
			name: 'BoxNotFound',
			info: {
				requestedBoxName: name,
				factoryBaseUri: baseURIs,
			},
		},
		"Box '%s' not found in %s.",
		name,
		joinedUris
	);
}

export class ComponentFactory implements ComponentFactoryI {
	private availableComponents: {[s: string]: string} = {};
	private readonly serviceProvider: ServiceProvider;
	public readonly baseURI: string;

	public constructor(
		componentsPath: string,
		serviceProvider: ServiceProvider
	) {
		this.baseURI = `file://${componentsPath}`;
		this.findComponents(componentsPath);
		debug(this.availableComponents);
		this.serviceProvider = serviceProvider;
	}

	public async create(
		name: string,
		queue?: PriorityQueueI<Message>
	): Promise<BoxInterface> {
		if (!this.availableComponents[name]) {
			return Promise.reject(boxNotFoundError(name, this.baseURI));
		}
		try {
			// TODO: (code detail) Is it necessary to always import the file?
			const box = await import(this.availableComponents[name]);
			return new box.default(this.serviceProvider, queue) as BoxInterface;
		} catch (error) {
			return Promise.reject(
				new VError(
					{
						name: 'ComponentLoadError',
						cause: error,
						info: {
							componentName: name,
						},
					},
					'Error loading component %s',
					name
				)
			);
		}
	}

	private findComponents(
		componentsPath: string,
		parentDir: string = ''
	): void {
		const files = fs.readdirSync(componentsPath);
		files.forEach(
			(file: string): void => {
				if (fs.statSync(`${componentsPath}${file}`).isDirectory()) {
					if (file !== '.' && file !== '..') {
						this.findComponents(
							`${componentsPath}${file}/`,
							`${parentDir}${file}/`
						);
					}
				} else {
					const name = parseComponentName(`${parentDir}${file}`);
					if (name == null) {
						return;
					}
					this.availableComponents[name] = `${componentsPath}${file}`;
				}
			}
		);
	}
}

export class MultiComponentFactory implements ComponentFactoryI {
	protected readonly factories: ComponentFactory[];
	public constructor() {
		this.factories = [];
	}

	public push(factory: ComponentFactory) {
		this.factories.unshift(factory);
	}

	public async create(
		name: string,
		queue?: PriorityQueueI<Message>
	): Promise<BoxInterface> {
		const futureBoxes = this.factories.map(async (f) => {
			return await f.create(name, queue).catch((reason) => {
				if (VError.hasCauseWithName(reason, 'BoxNotFound')) {
					return;
				}

				throw new VError(
					{
						name: 'FactoryException',
						message: 'ComponentFactory.create(%s) failed.',
						info: {
							factoryBaseURI: f.baseURI,
							requestedBoxName: name,
						},
						cause: reason,
					},
					name
				);
			});
		});

		const resolvedBoxes = await Promise.all(futureBoxes);
		const result = resolvedBoxes.find(
			(resp: void | BoxInterface) => resp !== undefined
		);
		if (result) {
			return result;
		}

		return Promise.reject(
			boxNotFoundError(name, this.factories.map((f) => f.baseURI))
		);
	}
}
