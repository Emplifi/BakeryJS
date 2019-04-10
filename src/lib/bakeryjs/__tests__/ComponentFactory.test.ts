import {ServiceProvider} from '../ServiceProvider';
import {ComponentFactory, MultiComponentFactory} from '../ComponentFactory';
import {resolve} from 'path';
import VError = require('verror');

const serviceProvider = new ServiceProvider({
	logger: {
		log: (message: any): void => console.log(message),
	},
});

const componentsDir = resolve(__dirname, '../../../components');
const componentsDirSlash = componentsDir + '/';
const testDataDir = resolve(__dirname, '../../../../test-data') + '/';

describe('Component Factory', () => {
	it('finds all components', async () => {
		const factory = new ComponentFactory(componentsDir, serviceProvider);
		const tickBox = await factory.create('tick');
		expect(tickBox).toBeDefined();

		const tockBox = await factory.create('tock');
		expect(tockBox).toBeDefined();
	});

	it('create builtin box', async () => {
		const factory = new ComponentFactory(
			componentsDirSlash,
			serviceProvider
		);

		const tickBox = await factory.create('tick');
		expect(tickBox).not.toBeUndefined();
	});

	it('create nonexistent box throws', () => {
		const factory = new ComponentFactory(
			componentsDirSlash,
			serviceProvider
		);

		factory.create('fick').catch((reason) => {
			expect.assertions(2);
			expect(reason).toBeInstanceOf(VError);
			expect(reason.name).toBe('BoxNotFound');
		});
	});

	describe('Component Factory -- path without ending slash', () => {
		it('create builtin box', async () => {
			const factory = new ComponentFactory(
				componentsDir,
				serviceProvider
			);

			const tickBox = await factory.create('tick');
			expect(tickBox).not.toBeUndefined();
		});

		it('create nonexistent box throws', () => {
			const factory = new ComponentFactory(
				componentsDir,
				serviceProvider
			);

			factory.create('fick').catch((reason) => {
				expect.assertions(2);
				expect(reason).toBeInstanceOf(VError);
				expect(reason.name).toBe('BoxNotFound');
			});
		});
	});

	describe('double factory', () => {
		it('create a builtin box', async () => {
			const multiFactory = new MultiComponentFactory();
			multiFactory.push(
				new ComponentFactory(componentsDirSlash, serviceProvider)
			);
			multiFactory.push(
				new ComponentFactory(testDataDir, serviceProvider)
			);

			const tickBox = await multiFactory.create('tick');
			expect(tickBox).not.toBeUndefined();
		});

		it('create a user-defined', async () => {
			const multiFactory = new MultiComponentFactory();
			multiFactory.push(
				new ComponentFactory(componentsDirSlash, serviceProvider)
			);
			multiFactory.push(
				new ComponentFactory(testDataDir, serviceProvider)
			);

			const tickBox = await multiFactory.create('helloworld');
			expect(tickBox).not.toBeUndefined();
		});

		it('create nonexistent box throws', () => {
			const factory = new ComponentFactory(
				componentsDirSlash,
				serviceProvider
			);

			factory.create('fick').catch((reason) => {
				expect(reason).toBeInstanceOf(VError);
				expect(reason.name).toBe('BoxNotFound');
			});
		});
	});
});
