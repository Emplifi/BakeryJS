# BakeryJS Code Quality Analysis

## Executive Summary

This document provides a comprehensive analysis of the `src/lib` directory, evaluating:
1. Design patterns that could improve the codebase
2. Clean code principle violations (SRP, SLAP)
3. Cyclomatic and cognitive complexity issues

The goal is to establish a maximum cyclomatic complexity of **6** per function.

---

## Table of Contents

- [1. Design Pattern Recommendations](#1-design-pattern-recommendations)
- [2. Clean Code Violations](#2-clean-code-violations)
  - [2.1 Single Responsibility Principle (SRP)](#21-single-responsibility-principle-srp)
  - [2.2 Single Layer of Abstraction Principle (SLAP)](#22-single-layer-of-abstraction-principle-slap)
- [3. Complexity Analysis](#3-complexity-analysis)
  - [3.1 Cyclomatic Complexity](#31-cyclomatic-complexity)
  - [3.2 Cognitive Complexity](#32-cognitive-complexity)
- [4. Prioritized Refactoring Recommendations](#4-prioritized-refactoring-recommendations)

---

## 1. Design Pattern Recommendations

### 1.1 Strategy Pattern with Registry (High Priority)

**Current Problem:** `Box.ts` uses conditional logic to dispatch between mapper, generator, and aggregator processing modes.

**Location:** `Box.ts` lines 417-443

```typescript
// Current approach - multiple if/else branches
public async process(msg: Message): Promise<any> {
  const isGenerator: boolean = this.meta.emits.length > 0
  const isAggregator: boolean = this.meta.aggregates
  const isMapper: boolean = !isAggregator && !isGenerator

  if (isAggregator) {
    return await this.processAggregator(msg)
  }
  if (isMapper) {
    return await this.processMapper(msg)
  } else if (isGenerator) {
    await this.processGenerator(msg)
    return true
  }
}
```

**Recommendation:** Implement a registry-based `ProcessingStrategy` pattern that satisfies the **Open/Closed Principle**. Adding a new processing strategy should require only **1-2 file changes** (creating the strategy and optionally registering it).

```typescript
// processingStrategies/ProcessingStrategy.ts
interface ProcessingStrategy {
  process(msg: Message, context: BoxContext): Promise<any>
}

// processingStrategies/ProcessingMode.ts
enum ProcessingMode {
  Mapper = 'mapper',
  Generator = 'generator',
  Aggregator = 'aggregator',
}

// processingStrategies/processingStrategyRegistry.ts
// Registry object keyed by ProcessingMode
const processingStrategyRegistry: Record<ProcessingMode, ProcessingStrategy> = {
  [ProcessingMode.Mapper]: new MapperStrategy(),
  [ProcessingMode.Generator]: new GeneratorStrategy(),
  [ProcessingMode.Aggregator]: new AggregatorStrategy(),
}

// Helper to determine mode from metadata (single location for mode logic)
function getProcessingMode(meta: BoxMeta): ProcessingMode {
  if (meta.aggregates) return ProcessingMode.Aggregator
  if (meta.emits.length > 0) return ProcessingMode.Generator
  return ProcessingMode.Mapper
}

// processingStrategies/MapperStrategy.ts
class MapperStrategy implements ProcessingStrategy { ... }

// processingStrategies/GeneratorStrategy.ts
class GeneratorStrategy implements ProcessingStrategy { ... }

// processingStrategies/AggregatorStrategy.ts
class AggregatorStrategy implements ProcessingStrategy { ... }
```

**Open/Closed Compliance:** To add a new processing mode:
1. Add the new enum value to `ProcessingMode`
2. Create the new strategy file (e.g., `FilterStrategy.ts`)
3. Register it in `processingStrategyRegistry`

This keeps `Box.ts` closed for modification - it only uses the registry lookup.

### 1.2 Decorator Pattern (Medium Priority)

**Current Problem:** Queue wrapping in `BoxEvents.ts` implements decoration informally through `Object.create()` with property shadowing.

**Location:** `BoxEvents.ts` lines 32-58, 60-73

**Recommendation:** Formalize queue decoration:

```typescript
// queue/decorators/TracingQueueDecorator.ts
class TracingQueueDecorator<T extends Message> implements PriorityQueueI<T> {
  constructor(
    private readonly wrapped: PriorityQueueI<T>,
    private readonly emitter: EventEmitter,
    private readonly boxName: string
  ) {}
  
  push(msgs: T | T[], priority?: number): void {
    this.wrapped.push(msgs, priority)
    this.emitTrace(msgs)
  }
}
```

### 1.3 Builder Pattern Enhancement (Medium Priority)

**Current Problem:** `DAGBuilder.build()` is a monolithic 140-line method mixing multiple concerns.

**Location:** `builders/DAGBuilder/builder.ts` lines 137-278

**Recommendation:** Implement a fluent builder with clear stages:

```typescript
class FlowBuilder {
  parseSchema(schema: FlowExplicitDescription): this
  createGraph(): this
  instantiateBoxes(factory: ComponentFactoryI): Promise<this>
  wireQueues(): this
  build(): Flow
}
```

### 1.4 State Pattern (Low Priority)

**Current Problem:** `TracingModel` manages complex state transitions for message tracking with multiple boolean flags and nested maps.

**Location:** `tracingModel.ts`

**Recommendation:** Encapsulate message/dimension states:

```typescript
class MessageState {
  private state: 'pending' | 'processing' | 'complete'
  transition(event: StateEvent): void
  isDone(): boolean
}
```

### 1.5 Additional Pattern Opportunities

| Pattern | Location | Benefit |
|---------|----------|---------|
| Command | Box processing | Enable undo, logging, queuing of operations |
| Facade | Program.ts | Simplify API for flow creation and execution |
| Template Method | Box/BatchingBox | Reduce duplication in process methods |
| Null Object | noopQueue | Already implemented, could be expanded |

---

## 2. Clean Code Violations

### 2.1 Single Responsibility Principle (SRP)

#### 2.1.1 Box.ts - CRITICAL (775 lines)

**Current Responsibilities:**
1. Box class abstraction
2. BatchingBox class abstraction
3. Message processing (mapper, generator, aggregator)
4. Parameter validation with Ajv
5. Error handling and VError wrapping
6. Factory functions (boxFactory, boxSingleFactory, boxBatchingFactory)
7. Type definitions for executive functions
8. noopQueue constant

**Recommended Split:**

```
src/lib/bakeryjs/
├── box/
│   ├── Box.ts                 # Core Box abstraction (~100 lines)
│   ├── BatchingBox.ts         # Batching variant (~100 lines)
│   ├── boxFactory.ts          # Factory functions (~50 lines)
│   ├── types.ts               # Type definitions
│   ├── validation.ts          # Parameter validation
│   └── processors/
│       ├── MapperProcessor.ts
│       ├── GeneratorProcessor.ts
│       └── AggregatorProcessor.ts
```

#### 2.1.2 DAGBuilder/builder.ts - HIGH (280 lines)

**Current Responsibilities:**
1. Schema parsing (`_analyzeRecursive`, `analyzeSchema`)
2. Graph construction
3. Box instantiation coordination
4. Queue creation and wiring
5. Event emission (`emitFlowSchema`)

**Recommended Split:**

```
src/lib/bakeryjs/builders/DAGBuilder/
├── builder.ts           # Orchestration only (~80 lines)
├── SchemaAnalyzer.ts    # Schema parsing (~60 lines)
├── QueueFactory.ts      # Queue creation (~50 lines)
├── GraphWiring.ts       # Queue wiring logic (~60 lines)
└── types.ts             # Local type definitions
```

#### 2.1.3 Program.ts - MODERATE

**Issues:**
- Creates default logger inline (lines 80-87)
- Validation logic embedded in `run()` (lines 155-182)
- Mixes configuration, service setup, and flow execution

**Recommendations:**
- Extract `DefaultLogger` class
- Extract `FlowDescriptionValidator` class
- Consider separating `ProgramConfiguration` from `ProgramRunner`

#### 2.1.4 Flow.ts - MODERATE

**Issues:**
- `analyzeDimensions()` is a separate concern from flow execution
- Constructor does too much (graph setup, tracing, event subscription)

**Recommendations:**
- Extract `DimensionAnalyzer` class
- Use factory method for Flow construction

### 2.2 Single Layer of Abstraction Principle (SLAP)

#### 2.2.1 Box.processGenerator() - Lines 304-382

**Problem:** Mixes high-level flow control with low-level implementation details.

```typescript
// HIGH LEVEL: Create guarded queue
const { guardQueue } = boxEvents(this)
const guardedQ = guardQueue(this.queue)

// LOW LEVEL: Sibling counting and message mapping
siblingsCount += chunk.length
guardedQ.push(
  chunk.map(msg => {
    const parent: Message = value.create()
    parent.setOutput(this.meta.provides, msg)
    return parent
  }),
  priority
)

// HIGH LEVEL: Emit completion event
this.emit('generation_finished', [...])
```

**Recommendation:** Extract to consistent abstraction levels:

```typescript
async processGenerator(value: Message): Promise<any> {
  const context = this.createGeneratorContext(value)
  try {
    await this.executeGenerator(context)
    this.finalizeGeneration(context)
  } catch (error) {
    throw this.wrapGeneratorError(error, context)
  }
}
```

#### 2.2.2 DAGBuilder.build() - Lines 137-278

**Problem:** The reduce callback spans 114 lines with 4+ nesting levels.

**Violations:**
- Graph analysis at one level
- Box instantiation at another
- Queue configuration at another
- Edge wiring at another

**Recommendation:** Decompose into focused methods:

```typescript
async build(schema, componentFactory, drain): Promise<Flow> {
  const graph = this.analyzeSchema(schema)
  const buildOrder = this.determineBuildOrder(graph)
  await this.instantiateBoxes(buildOrder, graph, componentFactory, schema)
  const rootQueue = this.wireQueues(buildOrder, graph, drain)
  return this.createFlow(rootQueue, graph, schema)
}
```

#### 2.2.3 Flow.constructor() - Lines 69-106

**Problem:** Mixes initialization, tracing setup, and event subscription.

```typescript
// Level 1: Graph setup
this.dimensionGraph = this.analyzeDimensions(this.graph)

// Level 2: Tracing model creation with callback
this.tracingModel = new TracingModel(this.graph, this.dimensionGraph, (msgId) => {
  // Level 3: Promise resolution logic
})

// Level 1 again: Event subscription loop
for (const boxWithAttribs of this.graph.nodesIter(true)) {
  // Level 2: Conditional check
  // Level 3: Event handler attachment
}
```

**Recommendation:**

```typescript
constructor(queue: PriorityQueueI<Message>, graph: DiGraph) {
  super()
  this.initializeGraph(queue, graph)
  this.initializeTracingModel()
  this.subscribeToBoxEvents()
}
```

---

## 3. Complexity Analysis

### 3.1 Cyclomatic Complexity

The target is **CC ≤ 6** for all functions. The following functions exceed this threshold:

#### 3.1.1 Critical (CC > 10)

| File | Function | Est. CC | Primary Contributors |
|------|----------|---------|---------------------|
| `DAGBuilder/builder.ts` | `build()` | 12-15 | Nested conditionals for queue count, async reduce, try/catch |
| `Flow.ts` | `analyzeDimensions()` | 10-12 | forEach with ternary chains, nested conditionals |

#### 3.1.2 High (CC 7-10)

| File | Function | Est. CC | Primary Contributors |
|------|----------|---------|---------------------|
| `Box.ts` | `processGenerator()` | 8-10 | Try/catch, error type checking, conditional throws |
| `Box.ts` | `process()` | 8 | isAggregator/isMapper/isGenerator branching |
| `BatchingBox` | `processMapper()` | 8 | Proxy with conditions, try/catch, loop |
| `tracingModel.ts` | `insertNewMsg()` | 7-8 | Loops with conditions, subloop |

#### 3.1.3 Moderate (CC = 7)

| File | Function | Est. CC |
|------|----------|---------|
| `tracingModel.ts` | `checkMsgFinishState()` | 7 |
| `FastPriorityBatchQueue.ts` | `tryProcessNext()` | 7 |
| `BinaryHeap.ts` | `bubbleDown()` | 7 |

### 3.2 Cognitive Complexity

Cognitive complexity measures how hard code is to understand. High cognitive complexity areas:

#### 3.2.1 DAGBuilder.build() - VERY HIGH

**Contributing Factors:**
- 114-line reduce callback
- 4+ nesting levels
- Mixed async/await with Promise chaining
- State tracked across: `graph`, `prevBoxReady`, `boxName`, `returnValue`, `depsQueues`
- Multiple conditional queue creation paths

#### 3.2.2 TracingModel Methods - HIGH

**Contributing Factors:**
- Deep map access: `this.msgStore.get(parentMsgId).get(dimension).get(msgId)`
- Recursive state checking between `checkMsgFinishState` and `checkDimensionFinishState`
- Multiple interconnected data structures (msgStore, dimensionStore)

#### 3.2.3 Box.processGenerator() - HIGH

**Contributing Factors:**
- Proxy.revocable usage requires understanding JavaScript metaprogramming
- Error type checking with string matching
- Nested callbacks for emit function

---

## 4. Prioritized Refactoring Recommendations

### Phase 1: Critical Complexity Reduction (Week 1-2) ✅ COMPLETED

> **Status:** Phase 1 completed on 2024-12-14. All tasks have been implemented and verified with 356 passing tests.

#### 1.1 Split DAGBuilder.build() ✅ COMPLETED

**Target:** Reduce CC from 12-15 to 5-6 per function

**Implementation:** Refactored the monolithic 140+ line `build()` method into 9 focused helper methods:
- `getBuildOrder()` - Determines topological build order
- `initializeBuildContext()` - Creates build context object
- `processBoxInOrder()` - Processes single box in build order
- `instantiateBox()` - Box instantiation logic
- `createOutputQueue()` - Output queue creation
- `setupDependencyQueues()` - Dependency queue wiring
- `wireRootQueue()` - Root queue configuration
- `createJoinedQueue()` - Joined queue for multiple dependencies
- `buildFlow()` - Final flow assembly

All 47 DAGBuilder tests pass.

#### 1.2 Implement Processing Strategy Pattern with Registry ✅ COMPLETED

**Target:** Reduce Box.process() CC from 8 to 2, while satisfying the **Open/Closed Principle**

**Implementation:** Created `src/lib/bakeryjs/processingStrategies/` directory with:
- `ProcessingMode.ts` - Enum and `getProcessingMode()` function
- `ProcessingStrategy.ts` - Interface and `BoxProcessingContext` type
- `MapperStrategy.ts` - Strategy for mapper mode
- `GeneratorStrategy.ts` - Strategy for generator mode
- `AggregatorStrategy.ts` - Strategy for aggregator mode
- `processingStrategyRegistry.ts` - Registry with `getProcessingStrategy()` lookup
- `index.ts` - Re-exports

**Open/Closed Compliance:** To add a new processing mode requires only 2 file changes:
1. Add enum value to `ProcessingMode` and update `getProcessingMode()`
2. Create new strategy and register in `processingStrategyRegistry`

All 29 Box tests pass.

#### 1.3 Split Box.ts File ✅ COMPLETED

**Implementation:** Created `src/lib/bakeryjs/boxCore/` directory with:
- `Box.ts` - Core Box abstraction (~100 lines)
- `BatchingBox.ts` - Batching variant (~140 lines)
- `boxFactory.ts` - Factory functions (boxSingleFactory, boxBatchingFactory, boxFactory)
- `types.ts` - Type definitions (noopQueue, BoxExecutiveDefinition, etc.)
- `validation.ts` - Parameter validation with `validateAndAddParameters()`
- `index.ts` - Re-exports

The original `Box.ts` now re-exports from `boxCore/` for backward compatibility.

All 356 project tests pass.

### Phase 2: SLAP Improvements (Week 2-3) ✅ COMPLETED

#### 2.1 Refactor Flow.analyzeDimensions() ✅ COMPLETED

**Target:** Extract to `DimensionAnalyzer` class with CC ≤ 6 methods

**Implementation:**
- Created new `src/lib/bakeryjs/DimensionAnalyzer.ts` class (130 lines)
- Extracted dimension analysis logic from `Flow.ts` into focused methods:
  - `analyze()` - Main entry point, orchestrates the analysis
  - `initializeDimensionGraph()` - Creates the dimension graph structure
  - `initializeRootNode()` - Sets up the ROOT_NODE
  - `getTopologicalOrder()` - Gets boxes in dependency order
  - `processBoxesInOrder()` - Iterates through boxes
  - `assignBoxDimension()` - Assigns dimension to a single box
  - `getParentDimension()` - Gets parent's dimension from graph
  - `getBoxMeta()` - Retrieves box metadata
  - `calculateDimension()` - Computes dimension based on box type
  - `isGenerator()` - Checks if box is a generator
  - `ensureDimensionNode()` - Creates dimension node if needed
  - `validateAndSetDimension()` - Validates and sets box dimension
  - `validateDimensionMatch()` - Validates dimension consistency
- All methods have CC ≤ 6
- `Flow.ts` reduced from ~223 to ~149 lines

#### 2.2 Refactor TracingModel ✅ COMPLETED

**Target:** Simplify nested map access, reduce method CC

**Implementation:**
- Added helper methods for nested map access:
  - `getMessageTrace()` - Safe access to message trace data
  - `getDimensionMessages()` - Gets messages for a dimension
  - `hasMessage()` - Checks if message exists
  - `hasDimension()` - Checks if dimension exists
  - `getDimensionTrace()` - Gets dimension trace data
  - `hasDimensionTracking()` - Checks dimension tracking existence
  - `isDimensionTracked()` - Checks if dimension is tracked
  - `getBoxDimension()` - Gets box dimension from graph
  - `getDimensionBoxes()` - Gets boxes for a dimension
- Split complex methods into focused helpers:
  - `insertNewMsg()` → `createBoxFulfilledMap()`, `initializeSubDimensions()`, `initializeSingleSubDimension()`, `getSubDimensions()`
  - `checkMsgFinishState()` → `isMessageComplete()`, `markMessageComplete()`, `propagateCompletion()`, `isRootDimension()`, `finishRootJob()`
  - `checkDimensionFinishState()` → `markDimensionComplete()`, `propagateDimensionCompletion()`, `getParentDimension()`
- Added `markBoxAsPassed()` helper for cleaner box state updates
- All refactored methods have improved CC and follow SLAP

All 356 tests pass after Phase 2 implementation.

### Phase 3: Additional Clean Code (Week 3-4) ✅ COMPLETED

#### 3.1 Type Safety Improvements ✅ COMPLETED

**Replaced `any` types with proper interfaces:**

- Created `Service` interface with optional lifecycle methods (`initialize`, `destroy`)
- Created `Logger` interface extending `Service` with `log()` and `error()` methods
- Updated `ServiceContainer` to use `[key: string]: unknown` for flexibility
- Made `ServiceProvider.get()` method generic: `get<T = unknown>(name: string): T`
- Exported `Logger`, `Service`, and `ServiceContainer` types from `src/index.ts`
- Updated all files using `serviceProvider.get('logger')` to use typed access

**Files modified:**
- `src/lib/bakeryjs/ServiceProvider.ts`
- `src/index.ts`
- `src/lib/bakeryjs/Program.ts`
- `src/lib/bakeryjs/boxCore/Box.ts`
- `src/lib/bakeryjs/boxCore/BatchingBox.ts`
- `src/components/_/processors/print.ts`
- `tests/components/_/processors/print.ts`
- `tests/integration/components/processors/logger-processor.ts`
- `tests/integration/components/processors/custom-service-processor.ts`
- `test-data/processors/checksum.ts`
- `src/lib/bakeryjs/__tests__/Box.test.ts`

#### 3.2 Error Handling Standardization ✅ COMPLETED

**Created centralized `BoxErrorFactory` class:**

Location: `src/lib/bakeryjs/errors/BoxErrorFactory.ts`

```typescript
export class BoxErrorFactory {
  public static invocationError(box: BoxInfo, mode: ProcessingMode, cause: Error, value?: MessageData): VError
  public static validationError(schema: object | string, parameters: unknown, validationErrors: unknown): VError
  public static misbehaveError(box: BoxInfo, description: string, value?: MessageData): VError
  public static inconsistentBoxError(boxName: string): VError
  public static toError(error: unknown): Error
}
```

**Files modified:**
- Created `src/lib/bakeryjs/errors/BoxErrorFactory.ts`
- Updated `src/lib/bakeryjs/processingStrategies/MapperStrategy.ts` to use `BoxErrorFactory`
- Updated `src/lib/bakeryjs/processingStrategies/GeneratorStrategy.ts` to use `BoxErrorFactory`
- Updated `src/lib/bakeryjs/boxCore/validation.ts` to use `BoxErrorFactory`

#### 3.3 Remove Dead Code ✅ COMPLETED

- [x] Removed `processAggregator` stub method from `BatchingBox.ts` - inlined the NotImplementedError throw directly in the `process` method
- [x] Removed commented code in `Program.runFlow` (line 136: `// setTimeout(() => flow.process(new Job()),2000);`)
- [x] Removed associated TODO comment in `Program.runFlow`
- [x] Removed unused `AssertionError` import from `BatchingBox.ts`

**Files modified:**
- `src/lib/bakeryjs/boxCore/BatchingBox.ts`
- `src/lib/bakeryjs/Program.ts`

**Verification:**
- All 356 tests pass
- TypeScript compilation passes with no errors
- ESLint/Prettier code-quality checks pass (only pre-existing warnings remain)

### Phase 4: ESLint Complexity Rule Enforcement ✅ COMPLETED

#### 4.1 Fixed ESLint Missing Return Type Warnings ✅ COMPLETED

Fixed 11 ESLint warnings for missing return types across 5 files:

- `ComponentFactory.ts` - Added return type to `push()` method
- `every.ts` - Added return types to `every()` and `everyMap()` functions
- `boxFactory.ts` - Added return types to `processValue()` methods
- `joinedQueue.ts` - Added return types to `push()`, `length`, and `size` getters
- `Flow.test.ts` - Added return type to mock debug function

#### 4.2 Refactored High-Complexity Functions ✅ COMPLETED

**Program.run() - Reduced from CC 9 to ≤6:**
- Extracted `validateFlowDescription()` helper method
- Extracted `executeFlowWithLogging()` helper method
- Created `debugLog()` helper function to simplify debug.enabled checks

**BinaryHeap.bubbleDown() - Reduced from CC 13 to ≤6:**
- Extracted `isChildLarger()` helper method
- Extracted `findLargestIndex()` helper method
- Extracted `swap()` helper method

**scanComponentsPath() - Reduced from CC 8 to ≤6:**
- Extracted `isValidDirectory()` helper function
- Extracted `processDirectory()` helper function
- Extracted `processFile()` helper function

**Files modified:**
- `src/lib/bakeryjs/Program.ts`
- `src/lib/bakeryjs/queue/BinaryHeap.ts`
- `src/lib/bakeryjs/scanComponentsPath.ts`
- `src/lib/bakeryjs/ComponentFactory.ts`
- `src/lib/bakeryjs/eval/every.ts`
- `src/lib/bakeryjs/boxCore/boxFactory.ts`
- `src/lib/bakeryjs/builders/DAGBuilder/joinedQueue.ts`
- `src/lib/bakeryjs/__tests__/Flow.test.ts`

#### 4.3 Added ESLint Complexity Rule ✅ COMPLETED

Added complexity rule to `eslint.config.mjs` for src/ files only:

```javascript
// Complexity rule for src/ files only (enforces max cyclomatic complexity of 6)
{
  files: ['src/**/*.ts'],
  rules: {
    complexity: ['error', { max: 6 }]
  }
}
```

The rule is scoped to `src/` files to avoid breaking benchmarks, profiling, and test utilities which have higher complexity due to their nature.

**Verification:**
- All 356 tests pass
- TypeScript compilation passes with no errors
- ESLint/Prettier code-quality checks pass with 0 errors and 0 warnings
- All src/ files now comply with max cyclomatic complexity of 6

---

## 5. Metrics Tracking

### ESLint Complexity Rule (Implemented)

```javascript
// eslint.config.mjs - Complexity rule for src/ files
{
  files: ['src/**/*.ts'],
  rules: {
    complexity: ['error', { max: 6 }]
  }
}
```

### Summary Table

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Max Cyclomatic Complexity | 15 | 6 | 6 ✅ |
| ESLint Warnings | 11 | 0 | 0 ✅ |
| ESLint Errors | 0 | 0 | 0 ✅ |

---

## Appendix: File-by-File Summary

| File | Lines (Before) | Lines (After) | Status |
|------|----------------|---------------|--------|
| `Box.ts` (old) | 775 | 22 (facade) | ✅ Refactored to Strategy Pattern |
| `boxCore/Box.ts` | - | 115 | ✅ New core implementation |
| `boxCore/BatchingBox.ts` | - | 148 | ✅ New batching implementation |
| `boxCore/boxFactory.ts` | - | 94 | ✅ New factory |
| `boxCore/types.ts` | - | 94 | ✅ New types |
| `boxCore/validation.ts` | - | 29 | ✅ New validation |
| `processingStrategies/*` | - | ~150 | ✅ New strategy pattern |
| `DAGBuilder/builder.ts` | 280 | 280 | ✅ Refactored |
| `tracingModel.ts` | 399 | 546 | ✅ Refactored with helpers |
| `Flow.ts` | 223 | 148 | ✅ Simplified |
| `FastPriorityQueue.ts` | 317 | 316 | ✅ Good |
| `Program.ts` | 214 | 222 | ✅ Refactored with helpers |
| `BinaryHeap.ts` | ~180 | 216 | ✅ Refactored with helpers |
| `scanComponentsPath.ts` | ~40 | 53 | ✅ Refactored with helpers |
| `ComponentFactory.ts` | 121 | 120 | ✅ Good |
| `Message.ts` | 108 | 107 | ✅ Good |
| `FlowCatalog.ts` | 48 | 47 | ✅ Good |
| `ServiceProvider.ts` | 42 | 69 | ✅ Type-safe |
| `FlowFactory.ts` | 24 | 23 | ✅ Good |
| `FlowSchemaReader.ts` | 22 | 21 | ✅ Good |

