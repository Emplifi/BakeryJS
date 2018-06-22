import { AsyncPriorityQueue } from 'async';
import ComponentProvider from './ComponentProvider';
import { Message } from './Message';

type SchemaComponent = string | SchemaObject;
export type SchemaParallelComponent = SchemaComponent[];
export type ProcessSchema = SchemaParallelComponent[];
interface ISchemaObject {
    [key: string]: ProcessSchema;
}
export type SchemaObject = ISchemaObject;

export default interface IFlowBuilder {
    build(schema: SchemaObject, componentProvider: ComponentProvider): Promise<AsyncPriorityQueue<Message>> | AsyncPriorityQueue<Message>;
    buildVisual(schema: SchemaObject, parent: string): Promise<void> | void;
}
