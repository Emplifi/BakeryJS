import * as fs from 'fs';
import {IBox} from './IBox';
import IComponentFactory from './IComponentFactory';
import {MessageData} from './Message';
import {parseComponentName} from './componentNameParser';
const debug = require('debug')('bakeryjs:componentProvider');

export default class ComponentFactory implements IComponentFactory {
    private availableComponents:{[s: string]: string} = {};
    private readonly services: {[key: string]: any};

    constructor(componentsPath: string, services: {[key: string]: any}) {
        this.findComponents(componentsPath);
        debug(this.availableComponents);
        this.services = services;
    }

    public async create(name: string): Promise<IBox<MessageData, MessageData>> {
        const box = await import(this.availableComponents[name]);
        return box.default(name, Object.assign({}, this.services));
    }

    private findComponents(componentsPath: string, parentDir: string = ''): void {
        const files = fs.readdirSync(componentsPath);
        files.forEach( (file: string): void => {
            if (fs.statSync(`${componentsPath}${file}`).isDirectory()) {
                if (file !== '.' && file !== '..') {
                    this.findComponents(`${componentsPath}${file}/`, `${parentDir}${file}/`);
                }
            } else {
                const name = parseComponentName(`${parentDir}${file}`);
                if (name == null) {
                    return;
                }
                this.availableComponents[name] = `${componentsPath}${file}`;
            }
        })
    }
}
