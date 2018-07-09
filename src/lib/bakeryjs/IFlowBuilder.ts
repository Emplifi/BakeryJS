import IComponentFactory from './IComponentFactory';
import {IPriorityQueue} from './queue/IPriorityQueue';
import {Message} from './Message';

type SchemaComponent = string | SchemaObject;
export type ConcurrentSchemaComponent = SchemaComponent[];
export type SerialSchemaComponent = ConcurrentSchemaComponent[];
export type SchemaObject = {[key: string]: SerialSchemaComponent};

export default interface IFlowBuilder {
    build(schema: SchemaObject, componentFactory: IComponentFactory): Promise<IPriorityQueue<Message>> | IPriorityQueue<Message>
}
