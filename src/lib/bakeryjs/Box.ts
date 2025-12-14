/**
 * Box module - re-exports from the box/ directory for backward compatibility.
 *
 * The Box implementation has been split into smaller, focused modules:
 * - box/Box.ts - Core Box abstraction
 * - box/BatchingBox.ts - Batching variant
 * - box/boxFactory.ts - Factory functions
 * - box/types.ts - Type definitions
 * - box/validation.ts - Parameter validation
 *
 * @module Box
 */

// Re-export everything from the box directory for backward compatibility
export {
	boxFactory,
	noopQueue,
	BoxExecutiveDefinition,
	BoxExecutiveBatchDefinition,
	BoxFactorySignature,
	BatchingBoxFactorySignature
} from './boxCore'
