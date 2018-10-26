import ComponentFactoryI from './ComponentFactoryI';
import {PriorityQueueI} from './queue/PriorityQueueI';
import {Message} from './Message';

// eslint-disable-next-line typescript/no-use-before-define
export type SchemaComponent = string | SchemaObject;
export type ConcurrentSchemaComponent = SchemaComponent[];
export type SerialSchemaComponent = ConcurrentSchemaComponent[];
export type SchemaObject = {[key: string]: SerialSchemaComponent};
export type FlowExplicitDescription = {
	[key: string]: SerialSchemaComponent | {[key: string]: any} | undefined;
	process: SerialSchemaComponent;
	parameters?: {[key: string]: any};
};

// TODO: export this automatically from type SchemaObject
export const SchemaObjectValidation = {
	type: 'object',
	$id: 'bakeryjs/flowbuilder',
	title: 'Flow defined by processing steps',
	required: ['process'],
	properties: {
		parameters: {
			type: 'object',
			title:
				'Set of parameters passed to particular boxes.  Key is a box identifier, value is arbitrary.',
			patternProperties: {
				'^.*$': {title: 'Arbitrary parameter value'},
			},
		},
		process: {
			$id: 'process',
			type: 'array',
			title: 'Series of sets of boxes. Each set is executed in parallel.',
			minItems: 1,
			items: {
				type: 'array',
				title:
					'Set of boxes to be run in parallel consuming outputs of boxes of previous stage',
				minItems: 1,
				items: {
					oneOf: [
						{type: 'string', title: 'name of the box'},
						{
							type: 'object',
							title: 'generator and boxes processing its output',
							patternProperties: {
								'^.*$': {
									$ref: 'process',
								},
							},
						},
					],
				},
			},
		},
	},
};

// TODO: (code detail) Why I won't get Flow, if I run `build` of FlowBuilderI?
export default interface FlowBuilderI {
	build(
		schema: FlowExplicitDescription,
		componentFactory: ComponentFactoryI,
		drain?: PriorityQueueI<Message>
	): Promise<PriorityQueueI<Message>> | PriorityQueueI<Message>;
}
