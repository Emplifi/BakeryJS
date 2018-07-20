import IComponentFactory from './IComponentFactory';
import {IPriorityQueue} from './queue/IPriorityQueue';
import {Message} from './Message';

// eslint-disable-next-line typescript/no-use-before-define
type SchemaComponent = string | SchemaObject;
export type ConcurrentSchemaComponent = SchemaComponent[];
export type SerialSchemaComponent = ConcurrentSchemaComponent[];
export type SchemaObject = {[key: string]: SerialSchemaComponent};

// TODO: (code detail) Why I won't get Flow, if I run `build` of IFlowBuilder?
export default interface IFlowBuilder {
	build(
		schema: SchemaObject,
		componentFactory: IComponentFactory
	): Promise<IPriorityQueue<Message>> | IPriorityQueue<Message>;
}
