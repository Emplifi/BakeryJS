declare module 'jsnetworkx' {
	export interface AttributeDict {
		[index: string]: any;
	}

	export type Node = number | string | object;

	export interface Edge {
		0: Node;
		1: Node;
	}

	export interface EdgeWithAttribs extends Edge {
		2: AttributeDict;
	}

	export interface NodeWithAttribs {
		0: Node;
		1: AttributeDict;
	}

	export class DiGraph {
		public node: Map<Node, AttributeDict>;
		public constructor();
		public addNode(n: Node, attribs?: AttributeDict): void;
		public addEdge(u: Node, v: Node, attribs?: AttributeDict): void;
		public addEdgesFrom(ebunch: Edge[], attribs?: AttributeDict): void;
		public outEdges(u?: Node | Node[], withData?: false): Edge[];
		public outEdges(u: Node | Node[], withData: true): EdgeWithAttribs[];
		public inEdges(u?: Node | Node[], withData?: false): Edge[];
		public inEdges(u: Node | Node[], withData: true): EdgeWithAttribs[];
		public nodes(optData?: false): Node[];
		public nodes(optData: true): NodeWithAttribs[];
		public hasNode(n: Node): boolean;
		public nodesIter(optData?: false): Iterable<Node>;
		public nodesIter(optData: true): Iterable<NodeWithAttribs>;
	}

	export function topologicalSort(g: DiGraph, optNBunch?: Node[]): Node[];
}
