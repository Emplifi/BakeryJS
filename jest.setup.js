// Suppress console output during tests to reduce noise
// Uses jest.spyOn for proper mock management

beforeAll(() => {
	// Mock console methods to suppress output during tests
	jest.spyOn(console, 'log').mockImplementation(() => {});
	jest.spyOn(console, 'error').mockImplementation(() => {});
	jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
	// Restore all mocks
	jest.restoreAllMocks();
});
