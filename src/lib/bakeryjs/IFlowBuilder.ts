import { AsyncPriorityQueue } from 'async';
import { Message } from './Message';
import IComponentFactory from './IComponentFactory';

type SchemaComponent = string | SchemaObject;
export type ConcurrentSchemaComponent = SchemaComponent[];
export type SerialSchemaComponent = ConcurrentSchemaComponent[];
export type SchemaObject = {[key: string]: SerialSchemaComponent};

export default interface IFlowBuilder {
    build(schema: SchemaObject, componentFactory: IComponentFactory): Promise<AsyncPriorityQueue<Message>> | AsyncPriorityQueue<Message>
}
