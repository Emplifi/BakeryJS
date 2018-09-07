import ComponentFactoryI from './ComponentFactoryI';
import {PriorityQueueI} from './queue/PriorityQueueI';
import {Message} from './Message';

// eslint-disable-next-line typescript/no-use-before-define
export type SchemaComponent = string | SchemaObject;
export type ConcurrentSchemaComponent = SchemaComponent[];
export type SerialSchemaComponent = ConcurrentSchemaComponent[];
export type SchemaObject = {[key: string]: SerialSchemaComponent};

// TODO: (code detail) Why I won't get Flow, if I run `build` of FlowBuilderI?
export default interface FlowBuilderI {
	build(
		schema: SchemaObject,
		componentFactory: ComponentFactoryI,
		drain?: PriorityQueueI<Message>
	): Promise<PriorityQueueI<Message>> | PriorityQueueI<Message>;
}
