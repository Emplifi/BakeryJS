import { DiGraph } from 'sb-jsnetworkx'
import { TracingModel } from '../tracingModel'
import { ROOT_NODE } from '../builders/DAGBuilder/builder'

/**
 * Helper to create a simple box graph for testing.
 * Creates a linear flow: ROOT_NODE -> boxA -> boxB
 */
function createSimpleBoxGraph(): DiGraph {
	const graph = new DiGraph()
	const rootDimension: string[] = []

	// Add nodes with dimension attribute
	graph.addNode(ROOT_NODE, { dimension: rootDimension })
	graph.addNode('boxA', { dimension: rootDimension })
	graph.addNode('boxB', { dimension: rootDimension })

	// Add edges (reversed direction for tracing - pointing upward)
	graph.addEdge('boxA', ROOT_NODE)
	graph.addEdge('boxB', 'boxA')

	return graph
}

/**
 * Helper to create a simple dimension graph for testing.
 * Just the root dimension with boxes.
 */
function createSimpleDimGraph(): DiGraph {
	const graph = new DiGraph()
	const rootDimension: string[] = []

	// Root dimension contains boxA and boxB
	graph.addNode(rootDimension, { boxes: ['boxA', 'boxB'] })

	return graph
}

// Shared dimension references - MUST use same array references across graphs
// because JavaScript Maps use reference equality for object keys
const SHARED_ROOT_DIM: string[] = []
const SHARED_DIM1: string[] = ['dim1']

/**
 * Helper to create a box graph with a generator.
 * ROOT_NODE -> generator -> childBox
 * The generator emits dimension ['dim1']
 *
 * Note: The generator is in the root dimension, childBox is in dim1.
 * ROOT_NODE is also in root dimension.
 */
function createGeneratorBoxGraph(): DiGraph {
	const graph = new DiGraph()

	graph.addNode(ROOT_NODE, { dimension: SHARED_ROOT_DIM })
	graph.addNode('generator', { dimension: SHARED_ROOT_DIM })
	graph.addNode('childBox', { dimension: SHARED_DIM1 })

	// Edges point upward (from child to parent)
	graph.addEdge('generator', ROOT_NODE)
	graph.addEdge('childBox', 'generator')

	return graph
}

/**
 * Helper to create a dimension graph with a sub-dimension.
 *
 * Root dimension [] contains: ROOT_NODE, generator
 * Child dimension ['dim1'] contains: childBox
 *
 * Edge from ['dim1'] -> [] (child to parent)
 */
function createGeneratorDimGraph(): DiGraph {
	const graph = new DiGraph()

	// Root dimension includes ROOT_NODE and generator
	graph.addNode(SHARED_ROOT_DIM, { boxes: [ROOT_NODE, 'generator'] })
	// Child dimension includes childBox
	graph.addNode(SHARED_DIM1, { boxes: ['childBox'] })

	// Edge from child dimension to parent dimension
	graph.addEdge(SHARED_DIM1, SHARED_ROOT_DIM)

	return graph
}

// The special parent ID used for root messages (no parent)
const ROOT_PARENT = '-'

describe('TracingModel', () => {
	describe('Simple linear flow', () => {
		it('calls jobDone when message passes through all boxes', () => {
			const boxGraph = createSimpleBoxGraph()
			const dimGraph = createSimpleDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job1'

			// Message passes through boxA
			tracing.addMsg(jobId, ROOT_PARENT, 'boxA')
			expect(jobDoneMock).not.toHaveBeenCalled()

			// Message passes through boxB - now complete
			tracing.addMsg(jobId, ROOT_PARENT, 'boxB')
			expect(jobDoneMock).toHaveBeenCalledWith(jobId)
			expect(jobDoneMock).toHaveBeenCalledTimes(1)
		})

		it('handles messages passing boxes in any order', () => {
			const boxGraph = createSimpleBoxGraph()
			const dimGraph = createSimpleDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job2'

			// Message passes through boxB first (out of order)
			tracing.addMsg(jobId, ROOT_PARENT, 'boxB')
			expect(jobDoneMock).not.toHaveBeenCalled()

			// Then boxA - now complete
			tracing.addMsg(jobId, ROOT_PARENT, 'boxA')
			expect(jobDoneMock).toHaveBeenCalledWith(jobId)
		})

		it('tracks multiple jobs independently', () => {
			const boxGraph = createSimpleBoxGraph()
			const dimGraph = createSimpleDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const job1 = '/job1'
			const job2 = '/job2'

			// Job1 passes boxA
			tracing.addMsg(job1, ROOT_PARENT, 'boxA')
			// Job2 passes both boxes
			tracing.addMsg(job2, ROOT_PARENT, 'boxA')
			tracing.addMsg(job2, ROOT_PARENT, 'boxB')

			// Only job2 should be done
			expect(jobDoneMock).toHaveBeenCalledWith(job2)
			expect(jobDoneMock).toHaveBeenCalledTimes(1)

			// Job1 completes
			tracing.addMsg(job1, ROOT_PARENT, 'boxB')
			expect(jobDoneMock).toHaveBeenCalledWith(job1)
			expect(jobDoneMock).toHaveBeenCalledTimes(2)
		})
	})

	describe('Generator flow with dimensions', () => {
		it('waits for child dimension to complete before job is done', () => {
			const boxGraph = createGeneratorBoxGraph()
			const dimGraph = createGeneratorDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job1'
			const childId = '/job1/child1'

			// Job first enters at ROOT_NODE (like Flow.process does)
			tracing.addMsg(jobId, ROOT_PARENT, ROOT_NODE)
			expect(jobDoneMock).not.toHaveBeenCalled()

			// Job passes through generator (root dimension)
			tracing.addMsg(jobId, ROOT_PARENT, 'generator')
			expect(jobDoneMock).not.toHaveBeenCalled()

			// Child message passes through childBox (child dimension)
			tracing.addMsg(childId, jobId, 'childBox')
			expect(jobDoneMock).not.toHaveBeenCalled()

			// Mark dimension as complete (all children generated)
			tracing.setDimensionComplete(jobId, 'childBox')
			expect(jobDoneMock).toHaveBeenCalledWith(jobId)
		})

		it('handles multiple children in dimension', () => {
			const boxGraph = createGeneratorBoxGraph()
			const dimGraph = createGeneratorDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job1'
			const child1 = '/job1/child1'
			const child2 = '/job1/child2'

			// Job first enters at ROOT_NODE
			tracing.addMsg(jobId, ROOT_PARENT, ROOT_NODE)

			// Job passes through generator
			tracing.addMsg(jobId, ROOT_PARENT, 'generator')

			// First child passes through
			tracing.addMsg(child1, jobId, 'childBox')
			expect(jobDoneMock).not.toHaveBeenCalled()

			// Second child passes through
			tracing.addMsg(child2, jobId, 'childBox')
			expect(jobDoneMock).not.toHaveBeenCalled()

			// Mark dimension as complete
			tracing.setDimensionComplete(jobId, 'childBox')
			expect(jobDoneMock).toHaveBeenCalledWith(jobId)
		})

		it('does not complete if dimension not marked complete', () => {
			const boxGraph = createGeneratorBoxGraph()
			const dimGraph = createGeneratorDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job1'
			const childId = '/job1/child1'

			// Job first enters at ROOT_NODE
			tracing.addMsg(jobId, ROOT_PARENT, ROOT_NODE)

			// Job passes through generator
			tracing.addMsg(jobId, ROOT_PARENT, 'generator')

			// Child passes through
			tracing.addMsg(childId, jobId, 'childBox')

			// Don't call setDimensionComplete
			expect(jobDoneMock).not.toHaveBeenCalled()
		})
	})

	describe('setDimensionComplete', () => {
		it('is idempotent - can be called multiple times', () => {
			const boxGraph = createGeneratorBoxGraph()
			const dimGraph = createGeneratorDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job1'
			const childId = '/job1/child1'

			// Job first enters at ROOT_NODE
			tracing.addMsg(jobId, ROOT_PARENT, ROOT_NODE)
			tracing.addMsg(jobId, ROOT_PARENT, 'generator')
			tracing.addMsg(childId, jobId, 'childBox')

			// Call setDimensionComplete multiple times
			tracing.setDimensionComplete(jobId, 'childBox')
			tracing.setDimensionComplete(jobId, 'childBox')

			// Should only call jobDone once
			expect(jobDoneMock).toHaveBeenCalledTimes(1)
		})
	})

	describe('Edge cases', () => {
		it('handles dimension complete before any children pass through', () => {
			const boxGraph = createGeneratorBoxGraph()
			const dimGraph = createGeneratorDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job1'

			// Job passes through root dimension boxes
			tracing.addMsg(jobId, ROOT_PARENT, ROOT_NODE)
			tracing.addMsg(jobId, ROOT_PARENT, 'generator')

			// Mark dimension as complete before any children - simulates empty generation
			tracing.setDimensionComplete(jobId, 'childBox')

			// Should complete since there are no children to wait for
			expect(jobDoneMock).toHaveBeenCalledWith(jobId)
		})

		it('handles children completing before dimension marked complete', () => {
			const boxGraph = createGeneratorBoxGraph()
			const dimGraph = createGeneratorDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job1'
			const child1 = '/job1/child1'
			const child2 = '/job1/child2'

			// Job enters root
			tracing.addMsg(jobId, ROOT_PARENT, ROOT_NODE)
			tracing.addMsg(jobId, ROOT_PARENT, 'generator')

			// Both children complete
			tracing.addMsg(child1, jobId, 'childBox')
			tracing.addMsg(child2, jobId, 'childBox')

			// Not done yet - dimension not marked complete
			expect(jobDoneMock).not.toHaveBeenCalled()

			// Now mark complete
			tracing.setDimensionComplete(jobId, 'childBox')
			expect(jobDoneMock).toHaveBeenCalledWith(jobId)
		})

		it('handles same message passing multiple boxes in same dimension', () => {
			// Create a flow with two boxes in the same dimension
			const boxGraph = new DiGraph()
			const rootDim: string[] = []

			boxGraph.addNode(ROOT_NODE, { dimension: rootDim })
			boxGraph.addNode('boxA', { dimension: rootDim })
			boxGraph.addNode('boxB', { dimension: rootDim })

			boxGraph.addEdge('boxA', ROOT_NODE)
			boxGraph.addEdge('boxB', 'boxA')

			const dimGraph = new DiGraph()
			dimGraph.addNode(rootDim, { boxes: [ROOT_NODE, 'boxA', 'boxB'] })

			const jobDoneMock = jest.fn()
			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job1'

			// Message passes through boxes - should track same message
			tracing.addMsg(jobId, ROOT_PARENT, 'boxA')
			expect(jobDoneMock).not.toHaveBeenCalled()

			tracing.addMsg(jobId, ROOT_PARENT, ROOT_NODE)
			expect(jobDoneMock).not.toHaveBeenCalled()

			tracing.addMsg(jobId, ROOT_PARENT, 'boxB')
			expect(jobDoneMock).toHaveBeenCalledWith(jobId)
		})
	})

	describe('Experimental tracing disabled', () => {
		const originalEnv = process.env.BAKERYJS_DISABLE_EXPERIMENTAL_TRACING

		afterEach(() => {
			if (originalEnv === undefined) {
				delete process.env.BAKERYJS_DISABLE_EXPERIMENTAL_TRACING
			} else {
				process.env.BAKERYJS_DISABLE_EXPERIMENTAL_TRACING = originalEnv
			}
		})

		it('uses done flag instead of delete when experimental tracing disabled', () => {
			process.env.BAKERYJS_DISABLE_EXPERIMENTAL_TRACING = 'true'

			const boxGraph = createSimpleBoxGraph()
			const dimGraph = createSimpleDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job1'

			// Message passes through all boxes
			tracing.addMsg(jobId, ROOT_PARENT, 'boxA')
			tracing.addMsg(jobId, ROOT_PARENT, 'boxB')

			// Should still call jobDone
			expect(jobDoneMock).toHaveBeenCalledWith(jobId)
		})
	})

	describe('Nested dimensions', () => {
		// Shared dimension references for nested tests
		const NESTED_ROOT_DIM: string[] = []
		const NESTED_CHILD_DIM = ['dim1']
		const NESTED_GRANDCHILD_DIM = ['dim1', 'dim2']

		function createNestedDimGraph(): DiGraph {
			// Create a flow with nested dimensions:
			// root [] -> child ['dim1'] -> grandchild ['dim1', 'dim2']
			const dimGraph = new DiGraph()

			dimGraph.addNode(NESTED_ROOT_DIM, { boxes: [ROOT_NODE, 'generator1'] })
			dimGraph.addNode(NESTED_CHILD_DIM, { boxes: ['childBox', 'generator2'] })
			dimGraph.addNode(NESTED_GRANDCHILD_DIM, { boxes: ['grandchildBox'] })

			dimGraph.addEdge(NESTED_CHILD_DIM, NESTED_ROOT_DIM)
			dimGraph.addEdge(NESTED_GRANDCHILD_DIM, NESTED_CHILD_DIM)

			return dimGraph
		}

		function createNestedBoxGraph(): DiGraph {
			const boxGraph = new DiGraph()

			boxGraph.addNode(ROOT_NODE, { dimension: NESTED_ROOT_DIM })
			boxGraph.addNode('generator1', { dimension: NESTED_ROOT_DIM })
			boxGraph.addNode('childBox', { dimension: NESTED_CHILD_DIM })
			boxGraph.addNode('generator2', { dimension: NESTED_CHILD_DIM })
			boxGraph.addNode('grandchildBox', { dimension: NESTED_GRANDCHILD_DIM })

			boxGraph.addEdge('generator1', ROOT_NODE)
			boxGraph.addEdge('childBox', 'generator1')
			boxGraph.addEdge('generator2', 'childBox')
			boxGraph.addEdge('grandchildBox', 'generator2')

			return boxGraph
		}

		it('handles nested generator dimensions', () => {
			const boxGraph = createNestedBoxGraph()
			const dimGraph = createNestedDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job1'
			const child1 = '/job1/child1'
			const grandchild1 = '/job1/child1/grandchild1'

			// Job passes through root
			tracing.addMsg(jobId, ROOT_PARENT, ROOT_NODE)
			tracing.addMsg(jobId, ROOT_PARENT, 'generator1')

			// Child passes through child dimension
			tracing.addMsg(child1, jobId, 'childBox')
			tracing.addMsg(child1, jobId, 'generator2')

			// Grandchild passes through grandchild dimension
			tracing.addMsg(grandchild1, child1, 'grandchildBox')

			// Mark grandchild dimension complete
			tracing.setDimensionComplete(child1, 'grandchildBox')

			// Mark child dimension complete
			tracing.setDimensionComplete(jobId, 'childBox')

			// Job should be done
			expect(jobDoneMock).toHaveBeenCalledWith(jobId)
		})

		it('waits for all nested dimensions to complete', () => {
			const boxGraph = createNestedBoxGraph()
			const dimGraph = createNestedDimGraph()
			const jobDoneMock = jest.fn()

			const tracing = new TracingModel(boxGraph, dimGraph, jobDoneMock)

			const jobId = '/job1'
			const child1 = '/job1/child1'
			const grandchild1 = '/job1/child1/grandchild1'

			// Job passes through root
			tracing.addMsg(jobId, ROOT_PARENT, ROOT_NODE)
			tracing.addMsg(jobId, ROOT_PARENT, 'generator1')

			// Child passes through child dimension
			tracing.addMsg(child1, jobId, 'childBox')
			tracing.addMsg(child1, jobId, 'generator2')

			// Grandchild passes through grandchild dimension
			tracing.addMsg(grandchild1, child1, 'grandchildBox')

			// Mark child dimension complete but NOT grandchild
			tracing.setDimensionComplete(jobId, 'childBox')

			// Job should NOT be done - grandchild dimension not complete
			expect(jobDoneMock).not.toHaveBeenCalled()

			// Now mark grandchild dimension complete
			tracing.setDimensionComplete(child1, 'grandchildBox')

			// Job should now be done
			expect(jobDoneMock).toHaveBeenCalledWith(jobId)
		})
	})
})
