declare module 'jsnetworkx' {
	export interface AttributeDict {
		[index: string]: any;
	}

	export interface Edge {
		0: string;
		1: string;
	}

	export interface EdgeWithAttribs extends Edge {
		2: AttributeDict;
	}

	export interface NodeWithAttribs {
		0: string;
		1: AttributeDict;
	}

	export class DiGraph {
		public node: Map<string, AttributeDict>;
		public constructor();
		public addNode(n: string, attribs?: AttributeDict): void;
		public addEdge(u: string, v: string, attribs?: AttributeDict): void;
		public addEdgesFrom(ebunch: Edge[], attribs?: AttributeDict): void;
		public outEdges(u?: string | string[], withData?: false): Edge[];
		public outEdges(
			u: string | string[],
			withData: true
		): EdgeWithAttribs[];
		public inEdges(u?: string | string[], withData?: false): Edge[];
		public inEdges(u: string | string[], withData: true): EdgeWithAttribs[];
		public nodes(optData?: false): string[];
		public nodes(optData: true): NodeWithAttribs[];
	}

	export function topologicalSort(g: DiGraph, optNBunch?: string[]): string[];
}
