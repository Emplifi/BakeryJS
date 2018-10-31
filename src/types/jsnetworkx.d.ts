declare module 'jsnetworkx' {
	export interface AttributeDict {
		[index: string]: any;
	}

	export interface Edge {
		0: string;
		1: string;
		2?: AttributeDict;
	}

	export class DiGraph {
		public constructor();
		public addNode(n: string, attribs?: AttributeDict): void;
		public addEdge(u: string, v: string, attribs?: AttributeDict): void;
		public addEdgesFrom(ebunch: Edge[], attribs?: AttributeDict): void;
		public outEdges(u?: string, withData?: boolean): Edge[];
		public inEdges(u?: string, withData?: boolean): Edge[];
	}

	export function topologicalSort(g: DiGraph, optNBunch?: string[]): string[];
}
