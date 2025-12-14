import VError from 'verror'
import type { MessageData } from '../Message'

/**
 * Minimal metadata required for error reporting.
 */
export interface BoxMetaInfo {
	requires: string[]
	provides: string[]
	emits?: string[]
}

/**
 * Information about a box for error reporting.
 */
export interface BoxInfo {
	name: string
	meta: BoxMetaInfo
}

/**
 * Processing mode for error context.
 */
export type ProcessingMode = 'mapper' | 'generator' | 'aggregator'

/**
 * Centralized factory for creating box-related errors.
 * Provides consistent error formatting and information across the codebase.
 *
 * @publicapi
 */
export class BoxErrorFactory {
	/**
	 * Creates an error for when a box encounters an exception during processing.
	 *
	 * @param box - Information about the box that failed
	 * @param mode - The processing mode (mapper, generator, aggregator)
	 * @param cause - The original error that was thrown
	 * @param value - The input value being processed when the error occurred
	 */
	public static invocationError(
		box: BoxInfo,
		mode: ProcessingMode,
		cause: Error,
		value?: MessageData
	): VError {
		return new VError(
			{
				name: 'BoxInvocationException',
				cause,
				info: {
					mode,
					box: { name: box.name, meta: box.meta },
					value
				}
			},
			"The box '%s' in a %s mode encountered an exception.",
			box.name,
			mode
		)
	}

	/**
	 * Creates an error for when box parameters fail validation.
	 *
	 * @param schema - The JSON schema that was used for validation
	 * @param parameters - The parameters that failed validation
	 * @param validationErrors - The validation errors from the validator
	 */
	public static validationError(
		schema: object | string,
		parameters: unknown,
		validationErrors: unknown
	): VError {
		return new VError(
			{
				name: 'BoxParametersValidationError',
				info: {
					schema,
					parameters,
					validationErrors
				}
			},
			'Box parameters must conform to the schema defined in the box. Schema: %s, parameters: %s',
			JSON.stringify(schema),
			JSON.stringify(parameters)
		)
	}

	/**
	 * Creates an error for when a generator misbehaves (e.g., emits after resolution).
	 *
	 * @param box - Information about the box that misbehaved
	 * @param description - A description of the misbehavior
	 * @param value - The input value being processed when the error occurred
	 */
	public static misbehaveError(box: BoxInfo, description: string, value?: MessageData): VError {
		return new VError(
			{
				name: 'GeneratorMisbehaveException',
				info: {
					mode: 'generator' as ProcessingMode,
					box: { name: box.name, meta: box.meta },
					value,
					description
				}
			},
			'Generator %s emitted messages after its promise had been resolved.',
			box.name
		)
	}

	/**
	 * Creates an error for when a mapper tries to emit (which is not allowed).
	 *
	 * @param boxName - The name of the box that tried to emit
	 */
	public static inconsistentBoxError(boxName: string): VError {
		return new VError(
			{
				name: 'InconsistentBoxError',
				info: { name: boxName }
			},
			"Box '%s': Can't invoke `emitCallback` unless being a generator/aggregator! Either set metadata filed 'emits' or 'aggregates'.",
			boxName
		)
	}

	/**
	 * Converts an unknown error to an Error instance.
	 * Useful for handling non-Error throws.
	 *
	 * @param error - The unknown error value
	 */
	public static toError(error: unknown): Error {
		return error instanceof Error ? error : new Error(String(error))
	}
}
