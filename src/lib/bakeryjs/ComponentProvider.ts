import * as fs from 'fs';
import { Message } from './Message';
const debug = require('debug')('bakeryjs:componentProvider');
import {IBox} from './IBox';
import IComponentProvider from './IComponentProvider';
import {parseComponentName} from './componentNameParser';

export default class ComponentProvider implements IComponentProvider {
    private availableComponents:{[s: string]: string} = {};
    private boxes: {[key: string]: IBox<Message, Message>} = {};

    constructor(componentsPath: string) {
        this.findComponents(componentsPath);
        debug(this.availableComponents);
    }

    public async getComponent(name: string): Promise<IBox<Message, Message>> {
        if (this.boxes[name]) {
            return this.boxes[name]
        }
        const box = await import(this.availableComponents[name]);
        this.boxes[name] = box.default(name);

        return this.boxes[name];
    }

    private findComponents(componentsPath: string, parentDir: string = ''): void {
        const files = fs.readdirSync(componentsPath);
        files.forEach( (file: string) => {
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
