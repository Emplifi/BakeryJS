import {ServiceProvider} from '../../../src/lib/bakeryjs/ServiceProvider';
import {
	ComponentFactory,
	MultiComponentFactory,
} from '../../../src/lib/bakeryjs/ComponentFactory';
import VError = require('verror');

const serviceProvider = new ServiceProvider({
	logger: {
		log: (message: any): void => console.log(message),
	},
});

describe('Component Factory', () => {
	it('create builtin box', async () => {
		const factory = new ComponentFactory(
			`${__dirname}/../../../src/components/`,
			serviceProvider
		);

		const tickBox = await factory.create('tick');
		expect(tickBox).not.toBe(undefined);
	});

	it('create nonexistent box throws', () => {
		const factory = new ComponentFactory(
			`${__dirname}/../../../src/components/`,
			serviceProvider
		);

		factory.create('fick').catch((reason) => {
			expect.assertions(2);
			expect(reason).toBeInstanceOf(VError);
			expect(reason.name).toBe('BoxNotFound');
		});
	});

	describe('double factory', async () => {
		it('create a builtin box', async () => {
			const multiFactory = new MultiComponentFactory();
			multiFactory.push(
				new ComponentFactory(
					`${__dirname}/../../../src/components/`,
					serviceProvider
				)
			);
			multiFactory.push(
				new ComponentFactory(
					`${__dirname}/../../../test-data/`,
					serviceProvider
				)
			);

			const tickBox = await multiFactory.create('tick');
			expect(tickBox).not.toBe(undefined);
		});

		it('create a user-defined', async () => {
			const multiFactory = new MultiComponentFactory();
			multiFactory.push(
				new ComponentFactory(
					`${__dirname}/../../../src/components/`,
					serviceProvider
				)
			);
			multiFactory.push(
				new ComponentFactory(
					`${__dirname}/../../../test-data/`,
					serviceProvider
				)
			);

			const tickBox = await multiFactory.create('helloworld');
			expect(tickBox).not.toBe(undefined);
		});

		it('create nonexistent box throws', () => {
			const factory = new ComponentFactory(
				`${__dirname}/../../../src/components/`,
				serviceProvider
			);

			factory.create('fick').catch((reason) => {
				expect.assertions(2);
				expect(reason).toBeInstanceOf(VError);
				expect(reason.name).toBe('BoxNotFound');
			});
		});
	});
});
