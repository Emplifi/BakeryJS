export class ServiceProvider {
    private readonly services: {[key: string]: any};

    constructor(services: {[key: string]: any}) {
        this.services = services;
    }

    get(name: string): any {
        if (this.services[name] == null) {
            throw new Error(`Service "${name}" was not found.`);
        }

        return this.services[name];
    }
}
