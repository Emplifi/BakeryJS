// Suppress console output during tests to reduce noise
// Original console methods are preserved and can be restored if needed

const originalConsole = {
	log: console.log,
	error: console.error,
	warn: console.warn,
};

beforeAll(() => {
	// Mock console methods to suppress output during tests
	console.log = jest.fn();
	console.error = jest.fn();
	console.warn = jest.fn();
});

afterAll(() => {
	// Restore original console methods
	console.log = originalConsole.log;
	console.error = originalConsole.error;
	console.warn = originalConsole.warn;
});

