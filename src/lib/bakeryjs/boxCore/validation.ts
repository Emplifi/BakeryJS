import Ajv from 'ajv'
import type { ServiceProvider } from '../ServiceProvider'
import { BoxErrorFactory } from '../errors/BoxErrorFactory'

/**
 * Validates box parameters against a JSON schema and returns the updated service provider.
 *
 * @param schema - The JSON schema to validate against
 * @param parameters - The parameters to validate
 * @param serviceProvider - The current service provider
 * @returns The updated service provider with parameters added
 * @throws BoxParametersValidationError if validation fails
 */
export function validateAndAddParameters(
	schema: object | string | undefined,
	parameters: unknown,
	serviceProvider: ServiceProvider
): ServiceProvider {
	if (!schema || !parameters) {
		return serviceProvider
	}

	const ajvValidator = new Ajv()
	if (ajvValidator.validate(schema, parameters)) {
		return serviceProvider.addParameters(parameters)
	}

	throw BoxErrorFactory.validationError(schema, parameters, ajvValidator.errors)
}
