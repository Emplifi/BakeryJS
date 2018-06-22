import { AsyncPriorityQueue } from 'async';
import { Message } from './Message';
import IComponentProvider from './IComponentProvider';

type SchemaComponent = string | SchemaObject;
export type ConcurrentSchemaComponent = SchemaComponent[];
export type SerialSchemaComponent = ConcurrentSchemaComponent[];
export type SchemaObject = {[key: string]: SerialSchemaComponent};

export default interface IFlowBuilder {
    build(schema: SchemaObject, componentProvider: IComponentProvider): Promise<AsyncPriorityQueue<Message>> | AsyncPriorityQueue<Message>
    buildVisual(schema: SchemaObject): Promise<void> | void
}
