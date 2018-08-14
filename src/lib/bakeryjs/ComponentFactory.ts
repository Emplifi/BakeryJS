import * as fs from 'fs';
import {BoxInterface} from './BoxI';
import ComponentFactoryI from './ComponentFactoryI';
import {PriorityQueueI} from './queue/PriorityQueueI';
import {Message} from './Message';
import {parseComponentName} from './componentNameParser';
import {ServiceProvider} from './ServiceProvider';

const debug = require('debug')('bakeryjs:componentProvider');

export default class ComponentFactory implements ComponentFactoryI {
	private availableComponents: {[s: string]: string} = {};
	private readonly serviceProvider: ServiceProvider;

	public constructor(
		componentsPath: string,
		serviceProvider: ServiceProvider
	) {
		this.findComponents(componentsPath);
		debug(this.availableComponents);
		this.serviceProvider = serviceProvider;
	}

	public async create(
		name: string,
		queue?: PriorityQueueI<Message>
	): Promise<BoxInterface> {
		const box = await import(this.availableComponents[name]);
		return box.default(name, this.serviceProvider, queue);
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
