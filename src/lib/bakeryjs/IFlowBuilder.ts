import { AsyncPriorityQueue } from 'async';
import { Message } from './Message';
import IComponentProvider from './IComponentProvider';

type SchemaComponent = string | SchemaObject;
export type SchemaParallelComponent = SchemaComponent[];
export type ProcessSchema = SchemaParallelComponent[];
interface ISchemaObject {
    [key: string]: ProcessSchema;
}
export type SchemaObject = ISchemaObject;

export default interface IFlowBuilder {
    build(schema: SchemaObject, componentProvider: IComponentProvider): Promise<AsyncPriorityQueue<Message>> | AsyncPriorityQueue<Message>
    buildVisual(schema: SchemaObject): Promise<void> | void
}
