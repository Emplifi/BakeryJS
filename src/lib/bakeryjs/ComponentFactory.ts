import * as fs from 'fs';
import {join} from 'path';
import {VError} from 'verror';
import {BatchingBoxInterface, BoxInterface} from './BoxI';
import ComponentFactoryI from './ComponentFactoryI';
import {PriorityQueueI} from './queue/PriorityQueueI';
import {Message} from './Message';
import {parseComponentName} from './componentNameParser';
import {ServiceProvider} from './ServiceProvider';

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
		queue?: PriorityQueueI<Message>,
		parameters?: any
	): Promise<BoxInterface | BatchingBoxInterface> {
		if (!this.availableComponents[name]) {
			return Promise.reject(boxNotFoundError(name, this.baseURI));
		}
		try {
			// TODO: (code detail) Is it necessary to always import the file?
			const box = await import(this.availableComponents[name]);
			return new box.default(
				name,
				this.serviceProvider,
				queue,
				parameters
			) as BoxInterface | BatchingBoxInterface;
		} catch (error) {
			return Promise.reject(
				new VError(
					{
						name: 'ComponentLoadError',
						cause:
							error instanceof Error ? error : new Error(error),
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
		for (const file of files) {
			const stat = fs.statSync(join(componentsPath, file));
			if (stat.isDirectory()) {
				if (file !== '.' && file !== '..') {
					this.findComponents(
						join(componentsPath, file),
						join(parentDir, file)
					);
				}
			} else {
				const name = parseComponentName(join(parentDir, file));
				if (!name) {
					continue;
				}
				this.availableComponents[name] = join(componentsPath, file);
			}
		}
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
		queue?: PriorityQueueI<Message>,
		parameters?: any
	): Promise<BoxInterface | BatchingBoxInterface> {
		const futureBoxes = this.factories.map(async (f) => {
			return await f.create(name, queue, parameters).catch((reason) => {
				if (!(reason instanceof Error)) {
					reason = new Error(reason);
				}
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
		const result = resolvedBoxes.find((resp: any) => resp !== undefined);
		if (result) {
			return result;
		}

		return Promise.reject(
			boxNotFoundError(name, this.factories.map((f) => f.baseURI))
		);
	}
}
