import { IBox } from './types/Box';
import { Message } from './Message';
import {statSync,readdirSync} from 'fs';

export default class ComponentProvider {
    private availableComponents:{[s: string]: string} = {};
    private boxes: {[key: string]: IBox<Message, Object>} = {};

    constructor(componentsPath: string) {
        this.findComponents(componentsPath);
        console.log(this.availableComponents);
    }

    public async getComponent(name: string): Promise<IBox<Message, Object>> {
        if (this.boxes[name]) {
            return this.boxes[name]
        }
        const box = await import(this.availableComponents[name]);
        this.boxes[name] = box.default(name);

        return this.boxes[name];
    }

    private findComponents(componentsPath: string, parentDir: string = ''): void {
        const files = readdirSync(componentsPath);
        files.forEach( (file: string) => {
            if (statSync(`${componentsPath}${file}`).isDirectory()) {
                if (file !== '.' && file !== '..') {
                    const child: string = `${file}/`;
                    this.findComponents(`${componentsPath}${file}/`, `${parentDir}${child}`);
                }
            } else {
                this.availableComponents[
                    `${parentDir}${file}`
                        .replace('boxes/', '')
                        .replace('_/', '')
                        .replace('processors/', '')
                        .replace('generators/', '')
                        .replace('.coffee', '')
                        .replace('.ts', '')
                ] = `${componentsPath}${file}`;
            }
        })
    }
}
