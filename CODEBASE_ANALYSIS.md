# BakeryJS Codebase Analysis

## Overview

BakeryJS is a **Flow-Based Programming (FBP)** inspired Node.js framework for handling common data processing needs. It enables developers to divide complex data processing tasks into smaller, reusable components called "Boxes" (black boxes containing business logic) that are connected into data flows.

The framework runs boxes asynchronously, handles different processing speeds between components, provides observability through event emission, and supports both single-message and batch processing modes.

**Project Status**: Initial Public Beta (version 0.1.2)

---

## Architecture

### High-Level Data Flow

```
Job → Program → FlowCatalog → FlowFactory → DAGBuilder → Flow
                                              ↓
                    ComponentFactory → Boxes (Generators/Processors)
                                              ↓
                              Messages flow through Priority Queues
                                              ↓
                                           Drain
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Program** | Main entry point; loads components, builds data flows from job descriptions |
| **Component/Box** | Single piece of logic that can require, provide, and emit messages |
| **Generator** | Box that creates new messages (e.g., reads from queue, ticks timer) |
| **Processor** | Box that receives and transforms messages (enriches, converts, derives) |
| **Message** | Object exchanged between components with immutable fields |
| **Data Flow** | Configuration of components that exchange data |
| **Job** | Work unit containing data flow definition and optional parameters |

---

## Directory Structure

```
src/
├── index.ts                    # Public API exports
├── components/                 # Built-in components
│   └── _/
│       ├── generators/         # Built-in generators (tick, tock)
│       └── processors/         # Built-in processors (print)
├── flows/
│   └── flows.ts               # Predefined flow definitions
├── lib/bakeryjs/              # Core library
│   ├── Program.ts             # Main entry point
│   ├── Box.ts                 # Box/BatchingBox implementation & boxFactory
│   ├── BoxI.ts                # Box interfaces and metadata types
│   ├── BoxEvents.ts           # Event handling for boxes
│   ├── Message.ts             # Message/DataMessage implementation
│   ├── Flow.ts                # Flow execution and dimension analysis
│   ├── FlowCatalog.ts         # Flow retrieval and building
│   ├── FlowFactory.ts         # Creates flows from schemas
│   ├── FlowSchemaReader.ts    # Reads flow schemas from files
│   ├── FlowBuilderI.ts        # Flow builder interface & schema types
│   ├── Job.ts                 # Job wrapper
│   ├── ComponentFactory.ts    # Component loading and instantiation
│   ├── ServiceProvider.ts     # Dependency injection container
│   ├── scanComponentsPath.ts  # Component discovery
│   ├── componentNameParser.ts # Parse component names from paths
│   ├── tracingModel.ts        # Message tracing through flow
│   ├── stats.ts               # Statistics and event emission
│   ├── builders/              # Flow building strategies
│   │   ├── DAGBuilder/        # DAG-based flow builder (primary)
│   │   ├── MilanBuilder.ts    # Alternative serial/parallel builder
│   │   ├── VisualBuilder.ts   # Visual output interface
│   │   └── DefaultVisualBuilder.ts  # ASCII visual representation
│   ├── queue/                 # Queue implementations
│   │   ├── PriorityQueueI.ts  # Queue interface
│   │   └── MemoryPriorityQueue.ts  # In-memory priority queues
│   └── eval/
│       └── every.ts           # Utility functions
├── types/
│   └── sb-jsnetworkx.d.ts     # Type definitions for graph library
tests/                          # Integration tests
test-data/                      # Test components (generators, processors)
example/                        # Example project with documentation
```

---

## Core Modules Deep Dive

### 1. Program (`src/lib/bakeryjs/Program.ts`)

The **Program** class is the main entry point for BakeryJS applications.

**Responsibilities:**
- Initialize and manage service providers
- Set up component factories with user-defined paths
- Create and manage the flow catalog
- Validate job definitions using AJV schemas
- Execute flows and handle drain callbacks
- Emit runtime events (`run`, `sent`, `queue_in`, etc.)

**Key Methods:**
- `constructor(serviceContainer, userConf)` - Initialize with services and component paths
- `run(flowDesc, drainCallback?, jobInitialValue?)` - Execute a flow
- `runFlow(flow, jobInitialValue?)` - Run an already-built flow
- `on(eventName, callback)` - Subscribe to events

### 2. Box System (`src/lib/bakeryjs/Box.ts`, `BoxI.ts`)

The **Box** is the fundamental processing unit.

**Box Types:**
| Type | Description | Metadata |
|------|-------------|----------|
| **Mapper** | 1:1 message transformation | `emits: [], aggregates: false` |
| **Generator** | 1:N message creation | `emits: ['dimension'], aggregates: false` |
| **Aggregator** | N:1 message aggregation | `aggregates: true` (not yet implemented) |

**Box Metadata (`BoxMeta`):**
```typescript
type BoxMeta = {
  provides: string[];      // Fields this box adds to messages
  requires: string[];      // Fields this box needs from messages
  emits: string[];         // Dimension name if generator
  aggregates: boolean;     // Whether box aggregates
  concurrency?: number;    // Max concurrent executions
  parameters?: object;     // Runtime parameter schema
};
```

**BatchingBoxMeta** extends this with:
```typescript
batch: {
  maxSize: number;         // Maximum batch size
  timeoutSeconds?: number; // Batch collection timeout
};
```

**`boxFactory` Function:**
The primary way to create custom boxes. Returns a box class definition.

### 3. Message System (`src/lib/bakeryjs/Message.ts`)

**DataMessage** class represents data flowing through the flow.

**Features:**
- Unique ID generation (hierarchical with parent references)
- Parent-child relationships for dimension tracking
- Immutable field storage (once written, cannot be overwritten)
- Input filtering based on `requires`
- Output filtering based on `provides`
- Prototype chain for efficient memory usage

### 4. Flow System

#### Flow (`src/lib/bakeryjs/Flow.ts`)
Represents an executable data flow.

**Responsibilities:**
- Manage the DAG of connected boxes
- Analyze and validate dimensions
- Track message progress through `TracingModel`
- Emit events for job lifecycle

#### FlowCatalog (`src/lib/bakeryjs/FlowCatalog.ts`)
Manages flow retrieval and building.

#### FlowFactory (`src/lib/bakeryjs/FlowFactory.ts`)
Creates Flow instances from schema descriptions.

### 5. DAGBuilder (`src/lib/bakeryjs/builders/DAGBuilder/builder.ts`)

**Primary flow builder** that constructs a Directed Acyclic Graph from flow schema.

**Process:**
1. Parse schema recursively to build graph structure
2. Topologically sort boxes (dependencies first)
3. Instantiate boxes with appropriate output queues
4. Create queue connections (Tee for fanout, QZip for join)
5. Return complete Flow

### 6. Queue System (`src/lib/bakeryjs/queue/`)

**Components:**
- `PriorityQueueI` - Interface for priority queues
- `MemoryPrioritySingleQueue` - Single message processing
- `MemoryPriorityBatchQueue` - Batch message processing
- `Tee` - Splits one queue into multiple outputs
- `QZip` - Joins multiple queues into one (waits for all branches)

Uses `better-queue` library under the hood.

### 7. Component Loading

#### ComponentFactory (`src/lib/bakeryjs/ComponentFactory.ts`)
Loads box definitions from file system.

#### MultiComponentFactory
Chains multiple factories, searching in order.

#### scanComponentsPath (`src/lib/bakeryjs/scanComponentsPath.ts`)
Recursively scans directories for component files.

### 8. TracingModel (`src/lib/bakeryjs/tracingModel.ts`)

Tracks message progress through the flow for job completion detection.

**Features:**
- Tracks messages across dimensions
- Detects when all boxes in a dimension are complete
- Handles nested dimensions (generators within generators)
- Invokes callback when job is fully processed

### 9. ServiceProvider (`src/lib/bakeryjs/ServiceProvider.ts`)

Simple dependency injection container for services.

**Built-in Services:**
- `logger` - with `log()` and `error()` methods

---

## Flow Schema Format

Flows are defined as nested arrays representing serial and parallel execution:

```typescript
{
  process: [
    // Each array = serial stage (runs after previous completes)
    [
      // Items in array = parallel boxes
      'boxA',
      'boxB',
      {
        // Generator with its own sub-flow
        generatorBox: [
          ['processorC'],
          ['processorD', 'processorE']
        ]
      }
    ],
    ['boxF']  // Runs after all of stage 1
  ],
  parameters: {
    boxA: { /* runtime params */ }
  }
}
```

---

## Event System

BakeryJS emits events for observability:

| Event | Description | Parameters |
|-------|-------------|------------|
| `run` | Flow execution started | `timestamp` |
| `sent` | Message sent between boxes | `timestamp, source, target, batchSize` |
| `queue_in` | Message entered queue | `timestamp, source, target, batchSize` |
| `queue_out` | Message left queue | `timestamp, source, target, batchSize` |

---

## Testing Patterns

The codebase uses **Jest** for testing with the following patterns:

1. **Unit Tests** (`src/lib/bakeryjs/__tests__/`)
   - Box.test.ts - Tests Mapper and Generator box types
   - Message.test.ts - Tests message creation and data flow
   - Flow.test.ts - Tests flow job enqueueing
   - ComponentFactory.test.ts - Tests component loading
   - MemoryPriorityQueue.test.ts - Tests queue implementations
   - componentNameParser.test.ts - Tests path parsing

2. **Integration Tests** (`tests/`)
   - program.test.ts - Full program execution tests
   - regressions.test.ts - Regression tests for specific bugs
   - scanComponentsPath.int.test.ts - Component discovery tests

3. **Queue Tests** (`src/lib/bakeryjs/builders/DAGBuilder/__tests__/`)
   - joinedQueue.test.ts - Tests Tee and QZip queue operations

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `ajv` | JSON Schema validation for flow definitions |
| `async` | Async utilities |
| `better-queue` | Priority queue implementation |
| `sb-jsnetworkx` | Graph library for DAG operations |
| `verror` | Enhanced error handling |

---

## Modules for Detailed Analysis

The following modules should be examined more thoroughly to create detailed analyses with testing scenarios:

### Priority 1: Core Processing

#### 1. Box System (`src/lib/bakeryjs/Box.ts`, `BoxI.ts`)
**Complexity**: High
**Testing Focus**:
- Mapper box: input/output transformation, field filtering
- Generator box: message emission, dimension creation
- BatchingBox: batch collection, timeout handling, size limits
- Error handling in processValue functions
- Concurrency limits
- Parameter injection and validation

**Testing Scenarios**:
- Box with missing required fields
- Box providing duplicate fields
- Generator emitting zero, one, many messages
- Batch timeout before size reached
- Batch size reached before timeout
- Concurrent execution limits
- Error propagation from processValue

---

#### 2. Message System (`src/lib/bakeryjs/Message.ts`)
**Complexity**: Medium
**Testing Focus**:
- Message ID generation and uniqueness
- Parent-child relationships
- Field immutability
- getInput/setOutput filtering
- Prototype chain behavior

**Testing Scenarios**:
- Create message with various data types
- Attempt to overwrite existing field
- Access non-existent field
- Parent message reference integrity
- Deep nesting of parent-child relationships
- Memory efficiency with large message chains

---

#### 3. TracingModel (`src/lib/bakeryjs/tracingModel.ts`)
**Complexity**: Very High
**Testing Focus**:
- Dimension tree construction
- Message state tracking
- Job completion detection
- Nested dimension handling
- Race conditions in async processing

**Testing Scenarios**:
- Simple linear flow completion
- Parallel branches completion
- Generator with sub-flow completion
- Multiple generators at same level
- One dimension completes before another starts
- Message processing order variations
- Partial failure scenarios

---

### Priority 2: Flow Building

#### 4. DAGBuilder (`src/lib/bakeryjs/builders/DAGBuilder/builder.ts`)
**Complexity**: High
**Testing Focus**:
- Schema parsing and validation
- Topological sorting
- Queue connection creation
- Tee/QZip placement
- Error handling for invalid schemas

**Testing Scenarios**:
- Simple linear flow
- Parallel boxes at same level
- Generator with nested sub-flow
- Multiple generators in parallel
- Deep nesting of generators
- Invalid schema (cycles, missing boxes)
- Empty flow handling

---

#### 5. Queue System (`src/lib/bakeryjs/queue/`, `builders/DAGBuilder/joinedQueue.ts`)
**Complexity**: Medium
**Testing Focus**:
- Priority ordering
- Batch collection
- Tee fanout behavior
- QZip join synchronization
- Queue length tracking

**Testing Scenarios**:
- Messages with different priorities
- Batch size boundary conditions
- Tee to multiple queues with failures
- QZip with out-of-order arrivals
- QZip with priority preservation
- Queue backpressure handling

---

### Priority 3: Component Management

#### 6. ComponentFactory (`src/lib/bakeryjs/ComponentFactory.ts`)
**Complexity**: Medium
**Testing Focus**:
- Component discovery
- Module loading (JS, TS, CoffeeScript)
- Error handling for missing components
- MultiComponentFactory chaining

**Testing Scenarios**:
- Load valid component
- Load non-existent component
- Load malformed component
- Multiple factories with overlapping names
- Path with/without trailing slash
- Nested directory structures

---

#### 7. ServiceProvider (`src/lib/bakeryjs/ServiceProvider.ts`)
**Complexity**: Low
**Testing Focus**:
- Service registration
- Service retrieval
- Parameter injection

**Testing Scenarios**:
- Register and retrieve service
- Access non-existent service
- Override existing service
- Parameter merging

---


### Priority 4: Flow Execution

#### 8. Flow (`src/lib/bakeryjs/Flow.ts`)
**Complexity**: High
**Testing Focus**:
- Job processing
- Dimension analysis
- Event emission
- Drain callback invocation

**Testing Scenarios**:
- Process single job
- Process multiple jobs concurrently
- Job with initial values
- Drain callback receives all messages
- Event emission timing and order

---

#### 9. Program (`src/lib/bakeryjs/Program.ts`)
**Complexity**: High
**Testing Focus**:
- Initialization with various configurations
- Flow schema validation
- Job execution lifecycle
- Event emission

**Testing Scenarios**:
- Initialize with single component path
- Initialize with multiple component paths
- Run valid flow
- Run invalid flow (schema validation)
- Drain callback integration
- Event subscription and emission

---

### Priority 5: Utilities

#### 10. FlowSchemaReader (`src/lib/bakeryjs/FlowSchemaReader.ts`)
**Complexity**: Low
**Testing Focus**:
- File reading
- JSON parsing
- Error handling

**Testing Scenarios**:
- Read valid schema file
- Read non-existent file
- Read malformed JSON

---

#### 11. componentNameParser (`src/lib/bakeryjs/componentNameParser.ts`)
**Complexity**: Low
**Testing Focus**:
- Path parsing rules
- Extension stripping
- Directory prefix removal

**Testing Scenarios**:
- Various file extensions (.js, .ts, .coffee)
- Nested directory paths
- Hidden files (should be ignored)
- Invalid file patterns

---

## Recommended Testing Strategy

### Unit Testing Approach
1. **Isolation**: Mock dependencies (queues, service providers)
2. **Edge Cases**: Focus on boundary conditions
3. **Error Paths**: Test all error handling branches
4. **Async Behavior**: Use proper async/await patterns

### Integration Testing Approach
1. **End-to-End Flows**: Test complete job execution
2. **Component Combinations**: Test various box type combinations
3. **Timing Scenarios**: Test race conditions and ordering
4. **Resource Cleanup**: Verify proper cleanup after execution

### Performance Testing Considerations
1. **Message Throughput**: Measure messages/second
2. **Memory Usage**: Track message chain memory
3. **Queue Backpressure**: Test under load
4. **Batch Efficiency**: Compare batch vs single processing

---

## Known Limitations

1. **Aggregator boxes** are defined in types but not fully implemented
2. **MilanBuilder** cannot use BatchingBox (throws AssertionError)
3. **scanComponentsPath** is synchronous (TODO in code)
4. No built-in persistence for queues (memory only)
5. No distributed processing support

---

## Implementation Progress

### Priority 1: Core Processing - COMPLETED ✅

All Priority 1 modules have been thoroughly analyzed and comprehensive unit tests have been implemented.

#### Box System Tests (`src/lib/bakeryjs/__tests__/Box.test.ts`)
**Status**: ✅ Complete (22 tests passing)

**Test Coverage**:
- Basic Mapper box functionality (input/output transformation)
- Generator box message emission
- Parameter validation and injection
- BatchingBox batch collection and timeout handling
- Error handling in processValue functions
- Generator edge cases (empty yields, multiple yields)
- Aggregator error handling (not implemented - throws error)
- Box without queue (direct processing)
- Box metadata validation

**Key Findings**:
- Box constructor accepts 4 parameters: `(name, serviceProvider, queue?, parameters?)`
- The 4th parameter (parameters) is not reflected in TypeScript types but is used at runtime
- Aggregator boxes throw "Aggregator not implemented" error
- BatchingBox requires `batch.maxSize` in metadata

#### Message System Tests (`src/lib/bakeryjs/__tests__/Message.test.ts`)
**Status**: ✅ Complete (32 tests passing)

**Test Coverage**:
- Message ID generation and uniqueness
- Hierarchical ID structure (parent/child relationships)
- `create()` method for child message creation
- `export()` method for data extraction
- Field immutability (cannot overwrite existing fields)
- `getInput()` filtering based on requires
- `setOutput()` filtering based on provides
- Prototype chain behavior for memory efficiency
- Edge cases (empty data, special characters, deep nesting)

**Key Findings**:
- `export()` method exists on `DataMessage` but not on `Message` interface
- Message IDs follow pattern: `/parentId/randomString`
- Root messages use `-` as parent ID
- Fields are stored in prototype chain for memory efficiency

#### TracingModel Tests (`src/lib/bakeryjs/__tests__/tracingModel.test.ts`)
**Status**: ✅ Complete (7 tests passing)

**Test Coverage**:
- Simple linear flow completion detection
- Message processing order independence
- Multiple job tracking
- Generator flow with child dimensions
- Multiple children in dimension
- Dimension completion marking
- `setDimensionComplete` idempotency

**Key Findings**:
- TracingModel uses `DefinedMap` which throws on missing keys
- Root messages must use `'-'` as parent ID (not their own ID)
- Dimension arrays must use same object references across box graph and dimension graph (JavaScript Map uses reference equality)
- `ROOT_NODE` constant (`'_root_'`) must be included in root dimension boxes
- Dimension graph edges point from child dimension to parent dimension

**Technical Notes for TracingModel Testing**:
```typescript
// Shared dimension references are REQUIRED
const SHARED_ROOT_DIM: string[] = [];
const SHARED_DIM1: string[] = ['dim1'];

// Root messages use '-' as parent
tracing.addMsg(jobId, '-', ROOT_NODE);

// Child messages use parent message ID
tracing.addMsg(childId, jobId, 'childBox');
```

---

## Conclusion

BakeryJS provides a solid foundation for flow-based data processing with well-separated concerns. The modular architecture allows for testing individual components in isolation while the integration tests verify end-to-end behavior.

The modules listed above represent the core functionality that should be thoroughly tested to ensure reliability. Priority 1 modules (Box, Message, TracingModel) are critical for correct operation and have now been thoroughly tested with 61 unit tests covering core functionality, edge cases, and error handling.

---

## Next Phase Prompt: Priority 2 - Flow Building Modules

### Objective

Perform comprehensive analysis and testing implementation for Priority 2 modules: DAGBuilder and Queue System. These modules are responsible for constructing and managing the data flow infrastructure.

### Prerequisites

1. Review the Priority 1 implementation progress section above
2. Review existing tests in:
   - `src/lib/bakeryjs/builders/DAGBuilder/__tests__/joinedQueue.test.ts`
   - `src/lib/bakeryjs/__tests__/MemoryPriorityQueue.test.ts`

### Target Modules

#### 1. DAGBuilder (`src/lib/bakeryjs/builders/DAGBuilder/builder.ts`)

**Analysis Focus**:
- Schema parsing and recursive structure handling
- Topological sorting algorithm
- Queue connection creation (Tee for fanout, QZip for join)
- Box instantiation with appropriate output queues
- Error handling for invalid schemas

**Testing Scenarios to Implement**:
- Simple linear flow (A → B → C)
- Parallel boxes at same level (A → [B, C] → D)
- Generator with nested sub-flow
- Multiple generators in parallel
- Deep nesting of generators (3+ levels)
- Invalid schema handling (cycles, missing boxes)
- Empty flow handling
- Schema with parameters

#### 2. Queue System

**Files**:
- `src/lib/bakeryjs/queue/PriorityQueueI.ts` - Interface
- `src/lib/bakeryjs/queue/MemoryPriorityQueue.ts` - Implementation
- `src/lib/bakeryjs/builders/DAGBuilder/joinedQueue.ts` - Tee and QZip

**Analysis Focus**:
- Priority ordering behavior
- Batch collection mechanics
- Tee fanout behavior (one input → multiple outputs)
- QZip join synchronization (multiple inputs → one output)
- Queue length tracking and backpressure

**Testing Scenarios to Implement**:
- Messages with different priorities
- Batch size boundary conditions (exactly at limit, one over)
- Batch timeout before size reached
- Tee to multiple queues
- QZip with out-of-order arrivals
- QZip with priority preservation
- Queue pause/resume behavior
- Error propagation through queues

### Deliverables

1. **Deep Analysis**: Document code structure, behavior, and integration points
2. **Test Implementation**: Extend existing test files with comprehensive scenarios
3. **Documentation Update**: Update this file with Priority 2 implementation progress
4. **Next Phase Prompt**: Write prompt for Priority 3 (Component Management)

### Technical Notes from Priority 1

- Use `jest.fn()` for mocking callbacks
- Use `async/await` with proper `expect().resolves` or `expect().rejects`
- Mock ServiceProvider with minimal implementation: `{ get: () => ({ log: jest.fn(), error: jest.fn() }) }`
- For queue testing, use `better-queue` events: `'task_finish'`, `'drain'`
- DiGraph from `sb-jsnetworkx` uses reference equality for array keys

### Execution Notes

- Run tests frequently: `npm test -- --testPathPattern="<pattern>"`
- All 95 existing tests should continue to pass
- Focus on edge cases and error paths
- Document any unexpected behavior or bugs found

---

## Priority 2 Implementation Progress

### Status: ✅ COMPLETE

**Test Count**: 130 total tests (up from 95)
- DAGBuilder tests: 14 new tests
- joinedQueue tests: 15 new tests (22 total)
- MemoryPriorityQueue tests: 7 new tests (9 total)

### DAGBuilder Analysis

**File**: `src/lib/bakeryjs/builders/DAGBuilder/builder.ts`

**Key Findings**:

1. **Schema Parsing**: The `analyzeSchema()` function creates a DiGraph from flow schemas using `_analyzeRecursive()` to handle nested generator sub-flows.

2. **Edge Direction**: Edges are REVERSED in the graph (from requiring box to providing box). This allows topological sort to give consumers first.

3. **ROOT_NODE Constant**: `'_root_'` serves as the entry point marker in box graphs.

4. **Queue Creation**:
   - Terminal boxes receive the drain queue directly
   - Fanout (one box → multiple boxes) uses `Tee` class
   - Join (multiple boxes → one box) uses `QZip` class
   - Single connections use `MemoryPrioritySingleQueue` or `MemoryPriorityBatchQueue`

5. **Box Instantiation**: Boxes are created in topological order (terminal boxes first) with their output queues already configured.

### Queue System Analysis

**Files**:
- `src/lib/bakeryjs/queue/PriorityQueueI.ts` - Interface definition
- `src/lib/bakeryjs/queue/MemoryPriorityQueue.ts` - Implementation
- `src/lib/bakeryjs/builders/DAGBuilder/joinedQueue.ts` - Tee and QZip

**Key Findings**:

1. **PriorityQueueI Interface**:
   - `push(data, priority?)` - Add item with optional priority
   - `length` - Current queue size
   - `target` - Destination box name
   - `source` - Source box name (set once, throws on second set)

2. **AQueue Base Class**:
   - Wraps `better-queue` library
   - Handles priority ordering
   - Supports both single and batch processing modes

3. **MemoryPrioritySingleQueue**:
   - Processes one message at a time
   - Supports concurrency configuration

4. **MemoryPriorityBatchQueue**:
   - Collects messages into batches
   - Configurable batch size and timeout
   - Flushes on size limit or timeout

5. **Tee Class**:
   - Pushes to all output queues simultaneously
   - Throws AssertionError if created with 0 queues
   - Propagates errors from any output queue

6. **QZip Class**:
   - Uses message ID to track arrivals from each input
   - Outputs only when all inputs have received the message
   - Priority is the maximum across all inputs
   - Uses internal `FakeQueue` class for input tracking

### Tests Implemented

#### DAGBuilder Tests (`builder.test.ts`)

| Test | Description |
|------|-------------|
| ROOT_NODE constant | Verifies constant value is "_root_" |
| Simple linear flow | Creates boxes in correct topological order |
| Terminal box receives drain | Verifies drain queue assignment |
| Returns Flow with input queue | Validates Flow object structure |
| Parallel boxes (fanout) | Tests Tee creation for parallel boxes |
| Parameters passing | Verifies box parameters are passed correctly |
| No parameters when not specified | Confirms undefined when not in schema |
| Generator with sub-flow | Tests nested generator processing |
| Nested sub-flows | Tests 3+ level deep nesting |
| Batching boxes | Verifies batch queue creation |
| Error: box not found | Tests factory error handling |
| Join scenario | Tests QZip creation for join |
| Multiple generators in parallel | Tests parallel generator handling |
| Single box flow | Tests minimal flow case |

#### joinedQueue Tests (Extended)

| Test | Description |
|------|-------------|
| Tee into 3 queues | Tests fanout to 3 outputs |
| Tee into 5 queues with priority | Tests priority propagation |
| Tee has length of 0 | Verifies length property |
| Tee has empty target | Verifies target property |
| Tee source can be set | Tests source property |
| Tee into 1 queue works | Tests single output case |
| Zip of 3 queues | Tests 3-way join |
| Zip priority uses max | Verifies max priority selection |
| Zip handles undefined priorities | Tests undefined priority handling |
| Zip tracks length correctly | Verifies length tracking |
| Zip reports correct size | Tests size property |
| QZip throws when inputs < 2 | Tests validation |
| QZip handles batch messages | Tests batch message handling |
| QZip input queues have correct target | Verifies target propagation |

#### MemoryPriorityQueue Tests (Extended)

| Test | Description |
|------|-------------|
| Processes multiple jobs sequentially | Tests sequential processing |
| Handles array push | Tests batch push |
| Has correct target property | Verifies target |
| Batches up to maxSize | Tests batch size limit |
| Has correct target property (batch) | Verifies batch target |
| Source can be set once | Tests source property |
| Source throws on second set | Tests immutability |

### Technical Notes

1. **Mock ComponentFactory Pattern**:
```typescript
const factory = {
  create: async (name, queue, params) => {
    const boxFn = boxRegistry.get(name);
    if (!boxFn) throw new Error(`Box ${name} not found`);
    return boxFn();
  }
};
```

2. **Mock Box Pattern**:
```typescript
function createMockMapperBox(name: string): BoxInterface {
  const emitter = new EventEmitter();
  return {
    name,
    meta: { requires: [], provides: [], emits: [], aggregates: false },
    process: jest.fn().mockResolvedValue(undefined),
    on: emitter.on.bind(emitter),
    emit: emitter.emit.bind(emitter),
  } as unknown as BoxInterface;
}
```

3. **QZip Priority Aggregation**: Uses `Math.max()` across all input priorities, treating undefined as -Infinity.

---

## Next Phase Prompt: Priority 3 - Component Management

### Objective

Perform comprehensive analysis and testing implementation for Priority 3 modules: ComponentFactory, MultiComponentFactory, ServiceProvider, and component scanning utilities. These modules are responsible for loading, instantiating, and managing box components.

### Prerequisites

1. Review the Priority 1 and Priority 2 implementation progress sections above
2. Review existing tests in:
   - `tests/program.test.ts` (uses ComponentFactory)
   - `tests/regressions.test.ts` (integration tests)

### Target Modules

#### 1. ComponentFactory (`src/lib/bakeryjs/ComponentFactory.ts`)

**Analysis Focus**:
- Box loading from file system
- Parameter validation against JSON schema
- Box instantiation with ServiceProvider
- Error handling for missing/invalid boxes

**Testing Scenarios to Implement**:
- Load valid box component
- Load box with parameters
- Parameter validation against schema
- Invalid parameter rejection
- Missing box file handling
- Box with dependencies

#### 2. MultiComponentFactory (`src/lib/bakeryjs/MultiComponentFactory.ts`)

**Analysis Focus**:
- Multiple component path management
- Component resolution order
- Fallback behavior

**Testing Scenarios to Implement**:
- Load from primary path
- Fallback to secondary path
- Component not found in any path
- Path priority ordering

#### 3. ServiceProvider (`src/lib/bakeryjs/ServiceProvider.ts`)

**Analysis Focus**:
- Service registration and retrieval
- Lazy initialization
- Service lifecycle

**Testing Scenarios to Implement**:
- Register and retrieve service
- Lazy service initialization
- Service not found handling
- Service override behavior

#### 4. Component Scanning (`src/lib/bakeryjs/scanComponentsPath.ts`)

**Analysis Focus**:
- Directory traversal
- Component discovery
- Metadata extraction

**Testing Scenarios to Implement**:
- Scan directory with components
- Handle nested directories
- Skip non-component files
- Empty directory handling

### Deliverables

1. **Deep Analysis**: Document code structure, behavior, and integration points
2. **Test Implementation**: Extend existing test files with comprehensive scenarios
3. **Documentation Update**: Update this file with Priority 3 implementation progress
4. **Next Phase Prompt**: Write prompt for Priority 4 (Program and Flow)

### Technical Notes from Priority 1 & 2

- Use `jest.fn()` for mocking callbacks
- Use `async/await` with proper `expect().resolves` or `expect().rejects`
- Mock ServiceProvider with minimal implementation: `{ get: () => ({ log: jest.fn(), error: jest.fn() }) }`
- For file system testing, consider using `jest.mock('fs')` or test-data directory
- ComponentFactory uses dynamic `import()` for loading boxes

### Execution Notes

- Run tests frequently: `npm test -- --testPathPattern="<pattern>"`
- All 130 existing tests should continue to pass
- Focus on edge cases and error paths
- Document any unexpected behavior or bugs found

---

## Priority 3 Implementation Progress

### Status: ✅ COMPLETE

**Test Count**: 172 total tests (up from 130)
- ComponentFactory tests: 22 tests (extended from 8)
- ServiceProvider tests: 14 new tests
- scanComponentsPath tests: 14 new tests

### ComponentFactory Analysis

**File**: `src/lib/bakeryjs/ComponentFactory.ts`

**Key Findings**:

1. **Box Loading**: Uses dynamic `import()` to load box modules from file system. The module must export a `default` function (boxFactory result).

2. **URI Construction**: Converts file paths to `file://` URIs for dynamic import. Handles both trailing slash and non-trailing slash paths.

3. **Component Scanning**: Calls `scanComponentsPath()` at construction time to build a map of component names to file paths.

4. **Error Handling**:
   - `BoxNotFound` error when component doesn't exist in any factory
   - `ComponentLoadError` wraps any error during box instantiation (including parameter validation)
   - Uses VError for error chaining with info properties

5. **MultiComponentFactory**: Chains multiple factories using `unshift()` so last pushed factory is searched first. Aggregates all factory URIs in BoxNotFound error.

### ServiceProvider Analysis

**File**: `src/lib/bakeryjs/ServiceProvider.ts`

**Key Findings**:

1. **Simple DI Container**: Stores services in a plain object with string keys.

2. **get() Method**: Returns service by key, returns undefined if not found (no error thrown).

3. **setAllIn() Method**: Copies all services from another ServiceProvider using `Object.assign()`.

4. **addParameters() Method**: Creates a new ServiceProvider with prototype chain to parent. Child inherits parent services but can override.

5. **No Lazy Initialization**: Services are stored directly, no factory pattern.

### scanComponentsPath Analysis

**File**: `src/lib/bakeryjs/scanComponentsPath.ts`

**Key Findings**:

1. **Synchronous Scanning**: Uses `fs.readdirSync()` and `fs.statSync()` for directory traversal.

2. **Recursive**: Recursively scans subdirectories, building component map.

3. **File Filtering**: Only includes `.ts`, `.js`, and `.coffee` files.

4. **Component Naming**: Uses `parseComponentName()` to extract component name from path, stripping known prefixes like `_/generators/` and `_/processors/`.

5. **Accumulator Pattern**: Accepts optional `components` object to accumulate results into.

### Tests Implemented

#### ComponentFactory Tests (`ComponentFactory.test.ts`)

| Test | Description |
|------|-------------|
| finds all components | Verifies component scanning at construction |
| create builtin box | Creates box from components directory |
| create nonexistent box throws | Tests BoxNotFound error |
| create builtin box (no slash) | Tests path without trailing slash |
| create nonexistent box throws (no slash) | Tests error without trailing slash |
| create a builtin box (multi) | Tests MultiComponentFactory with builtin |
| create a user-defined (multi) | Tests MultiComponentFactory with test-data |
| create nonexistent box throws (multi) | Tests MultiComponentFactory error |
| includes all factory URIs in BoxNotFound error | Verifies error info contains all paths |
| resolves from first factory when component exists in both | Tests priority order |
| throws BoxNotFound when no factories registered | Tests empty MultiComponentFactory |
| push adds factory to front (unshift behavior) | Verifies unshift behavior |
| passes queue and parameters through to created box | Tests parameter passing |
| handles single factory | Tests single factory in MultiComponentFactory |
| passes parameters to box constructor | Tests parameter passing |
| throws ComponentLoadError for invalid parameters | Tests parameter validation |
| creates box with queue | Tests queue passing |
| creates box without queue | Tests optional queue |
| BoxNotFound includes component name in error info | Tests error info |
| BoxNotFound error message includes box name | Tests error message |
| has file:// prefix | Tests baseURI format |
| contains components path | Tests baseURI content |

#### ServiceProvider Tests (`ServiceProvider.test.ts`)

| Test | Description |
|------|-------------|
| creates empty provider | Tests constructor |
| creates provider with initial services | Tests constructor with services |
| returns undefined for non-existent service | Tests get() miss |
| returns service by key | Tests get() hit |
| returns undefined for empty key | Tests edge case |
| copies all services from source | Tests setAllIn() |
| overwrites existing services | Tests setAllIn() override |
| handles empty source provider | Tests setAllIn() edge case |
| creates child with access to parent services | Tests addParameters() inheritance |
| child can override parent services | Tests addParameters() override |
| parent doesn't see child services | Tests isolation |
| multiple levels of inheritance | Tests deep inheritance |
| child has own properties | Tests hasOwnProperty |
| empty parameters creates valid child | Tests edge case |

#### scanComponentsPath Tests (`scanComponentsPath.test.ts`)

| Test | Description |
|------|-------------|
| finds TypeScript components in directory | Tests basic scanning |
| returns absolute file paths | Tests path format |
| handles nested directory structures | Tests recursion |
| returns object with component names as keys | Tests key format |
| strips generator prefix from path | Tests name extraction |
| strips processor prefix from path | Tests name extraction |
| handles path with trailing slash | Tests edge case |
| handles path without trailing slash | Tests edge case |
| accumulates components into provided object | Tests accumulator |
| uses parentDir for component naming | Tests parentDir parameter |
| only includes .ts, .js, and .coffee files | Tests file filtering |
| excludes hidden files starting with dot | Tests filtering |
| recursively scans subdirectories | Tests recursion |
| skips . and .. directories | Tests safety |

### Technical Notes

1. **Mock Queue Pattern**:
```typescript
function createMockQueue(): PriorityQueueI<Message> {
  return {
    push: jest.fn(),
    length: 0,
    source: '__test',
    target: '__test',
  } as unknown as PriorityQueueI<Message>;
}
```

2. **VError Info Extraction**:
```typescript
const info = VError.info(error);
expect(info.componentName).toBe('boxname');
```

3. **ComponentLoadError Wrapping**: Box constructor validation errors are wrapped in ComponentLoadError with cause chain.

---

## Next Phase Prompt: Priority 4 - Program and Flow

### Objective

Perform comprehensive analysis and testing implementation for Priority 4 modules: Program, Flow, FlowCatalog, and FlowFactory. These modules are responsible for orchestrating the entire data processing pipeline.

### Prerequisites

1. Review the Priority 1, 2, and 3 implementation progress sections above
2. Review existing tests in:
   - `tests/program.test.ts` (integration tests)
   - `tests/regressions.test.ts` (regression tests)
   - `src/lib/bakeryjs/__tests__/Flow.test.ts` (existing Flow tests)

### Target Modules

#### 1. Program (`src/lib/bakeryjs/Program.ts`)

**Analysis Focus**:
- Job validation using AJV schemas
- Flow execution lifecycle
- Event emission and observability
- Error handling and propagation
- Drain callback management

**Testing Scenarios to Implement**:
- Valid job execution
- Invalid job schema rejection
- Flow execution with drain callback
- Event emission during processing
- Error handling during flow execution
- Multiple job execution
- Job with parameters

#### 2. Flow (`src/lib/bakeryjs/Flow.ts`)

**Analysis Focus**:
- Message processing through boxes
- Dimension analysis for parallel execution
- Input queue management
- Completion detection

**Testing Scenarios to Implement**:
- Process single message
- Process batch of messages
- Parallel box execution
- Sequential box execution
- Flow completion detection
- Error propagation

#### 3. FlowCatalog (`src/lib/bakeryjs/FlowCatalog.ts`)

**Analysis Focus**:
- Flow registration and retrieval
- Flow building from schemas
- Caching behavior

**Testing Scenarios to Implement**:
- Register and retrieve flow
- Build flow from schema
- Flow not found handling
- Flow caching

#### 4. FlowFactory (`src/lib/bakeryjs/FlowFactory.ts`)

**Analysis Focus**:
- Flow creation from schemas
- Builder selection
- Configuration passing

**Testing Scenarios to Implement**:
- Create flow from valid schema
- Invalid schema handling
- Builder configuration

### Deliverables

1. **Deep Analysis**: Document code structure, behavior, and integration points
2. **Test Implementation**: Extend existing test files with comprehensive scenarios
3. **Documentation Update**: Update this file with Priority 4 implementation progress
4. **Final Summary**: Document overall test coverage and recommendations

### Technical Notes from Priority 1, 2 & 3

- Use `jest.fn()` for mocking callbacks
- Use `async/await` with proper `expect().resolves` or `expect().rejects`
- Mock ServiceProvider: `{ get: () => ({ log: jest.fn(), error: jest.fn() }) }`
- Mock ComponentFactory: `{ create: async (name, queue, params) => mockBox }`
- Use VError for error chain inspection
- Program uses AJV for job schema validation

### Execution Notes

- Run tests frequently: `npm test -- --testPathPattern="<pattern>"`
- All 172 existing tests should continue to pass
- Focus on edge cases and error paths
- Document any unexpected behavior or bugs found

---

## Priority 4 Implementation Progress

### Status: ✅ COMPLETE

**Date**: 2025-12-12

### Summary

Priority 4 focused on comprehensive analysis and testing of the orchestration layer modules: Program, Flow, FlowCatalog, and FlowFactory. These modules are responsible for the entire data processing pipeline in BakeryJS.

### Test Count

- **Before Priority 4**: 172 tests
- **After Priority 4**: 207 tests
- **New tests added**: 35 tests

### Modules Analyzed and Tested

#### 1. Flow (`src/lib/bakeryjs/Flow.ts`) - ✅ Complete

**Analysis Findings**:
- Extends EventEmitter for event-based communication
- Contains queue (PriorityQueueI), graph (DiGraph), dimensionGraph, tracingModel, jobPromises
- Constructor subscribes to box 'msg_finished' and 'generation_finished' events
- `process()` creates DataMessage from Job, pushes to queue, returns Promise resolved by TracingModel callback
- `analyzeDimensions()` analyzes box graph to extract dimension structure
- Emits 'task_finish' when job completes

**Tests Implemented** (in `src/lib/bakeryjs/__tests__/Flow.test.ts`):
- Constructor tests: creates flow, extends EventEmitter, subscribes to box events
- Process tests: enqueues job, pushes with priority, returns promise, includes job values
- Task finish event emission
- Destroy method
- Type guards: hasFlow, hasProcess

#### 2. FlowFactory (`src/lib/bakeryjs/FlowFactory.ts`) - ✅ Complete

**Analysis Findings**:
- Simple delegation class
- Contains componentFactory and builder
- `create()` delegates to builder.build()

**Tests Implemented** (in `src/lib/bakeryjs/__tests__/Flow.test.ts`):
- Constructor with componentFactory and builder
- Create delegates to builder.build with schema and componentFactory
- Passes drain queue to builder
- Returns flow from builder

#### 3. FlowCatalog (`src/lib/bakeryjs/FlowCatalog.ts`) - ✅ Complete

**Analysis Findings**:
- Simple orchestration class (no caching - contrary to initial assumption)
- Contains flowSchemaReader, flowFactory, visualBuilder
- `getFlow()` gets schema from reader and delegates to `buildFlow()`
- `buildFlow()` delegates to flowFactory.create()

**Tests Implemented** (in `src/lib/bakeryjs/__tests__/Flow.test.ts`):
- Constructor with required dependencies
- getFlow reads schema from flowSchemaReader
- getFlow builds flow from retrieved schema
- getFlow passes drain queue to builder
- buildFlow builds flow directly from schema
- buildFlow passes drain queue when building directly

#### 4. Program (`src/lib/bakeryjs/Program.ts`) - ✅ Complete

**Analysis Findings**:
- Main entry point for BakeryJS applications
- Takes `serviceContainer` and `userConf` with `componentPaths`
- Uses AJV for job validation against schemas
- Creates MultiComponentFactory with built-in + user component paths
- Creates FlowCatalog with FlowSchemaReader, ComponentFactory, DAGBuilder, and DefaultVisualBuilder
- Key methods: `constructor`, `on()`, `runFlow()`, `run()`
- Uses VError for error handling with MultiError for validation errors

**Tests Implemented** (in `tests/program.test.ts`):
- Constructor tests: empty service container, custom service container, multiple component paths
- Event listener registration: sent events, run events
- Validation tests: empty process array, missing process property, invalid nested structure
- Drain callback tests: calls drain for each output, runs without drain
- runFlow with initial value

### Key Technical Insights

1. **Flow-Based Programming (FBP)**: Data flows through connected "Boxes" (components)
2. **DiGraph**: Directed acyclic graph from sb-jsnetworkx for box relationships
3. **TracingModel**: Tracks message completion through dimensions
4. **ROOT_NODE constant**: `'_root_'` serves as entry point marker
5. **Dimensions**: Generators create new dimensions; aggregators reduce them
6. **Message Events**: 'msg_finished', 'generation_finished' from boxes
7. **AJV**: JSON Schema validation for flow/job definitions
8. **VError**: Enhanced error handling with cause chains and info

### Mock Patterns Used

```typescript
// Mock box instance with event emitter behavior
function createMockBox(name: string, dimension: string[] = []): BoxInterface {
	const emitter = new EventEmitter();
	const meta: BoxMeta = {
		provides: [],
		requires: [],
		emits: [],
		aggregates: false,
	};
	return {
		name,
		meta,
		process: jest.fn().mockResolvedValue(undefined),
		on: emitter.on.bind(emitter),
		emit: emitter.emit.bind(emitter),
		onClean: [],
	} as unknown as BoxInterface;
}

// Mock FlowSchemaReader
const mockSchemaReader = {
	getFlowSchema: jest.fn().mockResolvedValue({process: [['boxA']]}),
};

// Mock FlowBuilder
const mockBuilder = {
	build: jest.fn().mockResolvedValue(mockFlow),
};

// Mock VisualBuilder
const mockVisualBuilder = {
	build: jest.fn(),
};
```

### Files Modified

1. `src/lib/bakeryjs/__tests__/Flow.test.ts` - Extended with 24 new tests for Flow, FlowFactory, and FlowCatalog
2. `tests/program.test.ts` - Extended with 11 new tests for Program

### Verification

- All 207 tests pass
- Lint passes with only pre-existing warnings (no new errors)
- Code quality maintained
