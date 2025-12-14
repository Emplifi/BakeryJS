import {ServiceProvider} from '../ServiceProvider';

describe('ServiceProvider', () => {
	describe('constructor and get', () => {
		it('retrieves a registered service', () => {
			const mockLogger = {log: jest.fn(), error: jest.fn()};
			const serviceProvider = new ServiceProvider({
				logger: mockLogger,
			});

			const retrieved = serviceProvider.get('logger');
			expect(retrieved).toBe(mockLogger);
		});

		it('retrieves multiple registered services', () => {
			const mockLogger = {log: jest.fn()};
			const mockDb = {query: jest.fn()};
			const mockCache = {get: jest.fn(), set: jest.fn()};

			const serviceProvider = new ServiceProvider({
				logger: mockLogger,
				db: mockDb,
				cache: mockCache,
			});

			expect(serviceProvider.get('logger')).toBe(mockLogger);
			expect(serviceProvider.get('db')).toBe(mockDb);
			expect(serviceProvider.get('cache')).toBe(mockCache);
		});

		it('throws error for missing service', () => {
			const serviceProvider = new ServiceProvider({
				logger: {log: jest.fn()},
			});

			expect(() => serviceProvider.get('nonexistent')).toThrow(
				'Service "nonexistent" was not found.'
			);
		});

		it('throws error when services object is empty', () => {
			const serviceProvider = new ServiceProvider({});

			expect(() => serviceProvider.get('anything')).toThrow(
				'Service "anything" was not found.'
			);
		});

		it('handles null service value as missing', () => {
			const serviceProvider = new ServiceProvider({
				nullService: null,
			});

			expect(() => serviceProvider.get('nullService')).toThrow(
				'Service "nullService" was not found.'
			);
		});

		it('handles undefined service value as missing', () => {
			const serviceProvider = new ServiceProvider({
				undefinedService: undefined,
			});

			expect(() => serviceProvider.get('undefinedService')).toThrow(
				'Service "undefinedService" was not found.'
			);
		});
	});

	describe('setAllIn', () => {
		it('adds new services to container', () => {
			const serviceProvider = new ServiceProvider({
				logger: {log: jest.fn()},
			});

			const newDb = {query: jest.fn()};
			serviceProvider.setAllIn({db: newDb});

			expect(serviceProvider.get('db')).toBe(newDb);
			// Original service still available
			expect(serviceProvider.get('logger')).toBeDefined();
		});

		it('overwrites existing services', () => {
			const originalLogger = {log: jest.fn(), error: jest.fn()};
			const serviceProvider = new ServiceProvider({
				logger: originalLogger,
			});

			const newLogger = {
				log: jest.fn(),
				error: jest.fn(),
				warn: jest.fn(),
			};
			serviceProvider.setAllIn({logger: newLogger});

			expect(serviceProvider.get('logger')).toBe(newLogger);
			expect(serviceProvider.get('logger')).not.toBe(originalLogger);
		});

		it('adds multiple services at once', () => {
			const serviceProvider = new ServiceProvider({});

			serviceProvider.setAllIn({
				db: {query: jest.fn()},
				cache: {get: jest.fn()},
				logger: {log: jest.fn()},
			});

			expect(serviceProvider.get('db')).toBeDefined();
			expect(serviceProvider.get('cache')).toBeDefined();
			expect(serviceProvider.get('logger')).toBeDefined();
		});
	});

	describe('addParameters', () => {
		it('creates new instance with parameters', () => {
			const serviceProvider = new ServiceProvider({
				logger: {log: jest.fn()},
			});

			const params = {name: 'test', count: 42};
			const withParams = serviceProvider.addParameters(params);

			expect(withParams.parameters).toEqual(params);
		});

		it('preserves access to original services', () => {
			const mockLogger = {log: jest.fn()};
			const serviceProvider = new ServiceProvider({
				logger: mockLogger,
			});

			const withParams = serviceProvider.addParameters({value: 123});

			expect(withParams.get('logger')).toBe(mockLogger);
		});

		it('returns different instance than original', () => {
			const serviceProvider = new ServiceProvider({
				logger: {log: jest.fn()},
			});

			const withParams = serviceProvider.addParameters({x: 1});

			expect(withParams).not.toBe(serviceProvider);
		});

		it('original instance does not have parameters', () => {
			const serviceProvider = new ServiceProvider({
				logger: {log: jest.fn()},
			});

			serviceProvider.addParameters({x: 1});

			expect(serviceProvider.parameters).toBeUndefined();
		});

		it('can chain multiple addParameters calls', () => {
			const serviceProvider = new ServiceProvider({
				logger: {log: jest.fn()},
			});

			const first = serviceProvider.addParameters({a: 1});
			const second = first.addParameters({b: 2});

			expect(second.parameters).toEqual({b: 2});
			expect(first.parameters).toEqual({a: 1});
		});
	});
});
