# BakeryJS Coverage Improvement Plan

## Current Coverage Summary

| Metric | Coverage | Previous |
|--------|----------|----------|
| Statements | **91.00%** | 83.14% |
| Branches | **84.34%** | 78.36% |
| Functions | **92.35%** | 82.19% |
| Lines | **90.74%** | 82.90% |

**✅ Overall branch coverage target of 80% has been achieved!**

---

## Risk-Prioritized Coverage Gaps

### 🔴 CRITICAL PRIORITY (High Risk, High Impact)

#### 1. **Box.ts** - 94.91% statements, **86.95% branches** ✅ PHASE 1 COMPLETE
- **Complexity**: HIGH (documented as Priority 1 in CODEBASE_ANALYSIS.md)
- **Why Critical**: This is THE fundamental processing unit - all data flows through boxes
- **Remaining Uncovered Lines**: 258, 275, 341, 433, 566, 644 (defensive code paths)
- **Phase 1 Improvements**:
  - Added tests for generator misbehavior (emitting after promise resolves)
  - Added tests for BatchingBox parameter validation error paths
  - Added tests for BatchingBox aggregator NotImplementedError
  - Added tests for BatchingBox error handling and non-Error conversion
  - Added tests for generator non-Error throw conversion
- **Status**: Branch coverage improved from 71.73% to **86.95%** ✅

#### 2. **Program.ts** - 92.18% statements, **68.75% branches** ✅ PHASE 1 COMPLETE
- **Complexity**: HIGH (Main entry point)
- **Why Critical**: User-facing API, job validation using AJV schemas
- **Remaining Uncovered Lines**: 128, 185, 189, 200, 210 (debug logs and unreachable defensive code)
- **Phase 1 Improvements**:
  - Added tests for flow execution by name from catalog
  - Added tests for non-existent flow name error handling
  - Added tests for unrecognized flow description validation
- **Status**: Branch coverage improved from 62.5% to **68.75%** (remaining branches are debug-only code paths)
- **Note**: Remaining uncovered branches are debug console.log statements (lines 128, 185, 189, 200) and unreachable defensive code (line 210)

#### 3. **tracingModel.ts** - 95.06% statements, **80.95% branches** ✅ PHASE 1 COMPLETE
- **Complexity**: VERY HIGH (documented)
- **Why Critical**: Determines job completion detection - if this fails, jobs may hang or complete prematurely
- **Remaining Uncovered Lines**: 120, 295, 354, 373 (defensive code for edge cases)
- **Phase 1 Improvements**:
  - Added tests for dimension complete before any children pass through
  - Added tests for children completing before dimension marked complete
  - Added tests for same message passing multiple boxes in same dimension
  - Added tests for experimental tracing disabled (env variable path)
  - Added tests for nested generator dimensions (2 levels deep)
  - Added tests for waiting for all nested dimensions to complete
- **Status**: Branch coverage improved from 76.19% to **80.95%** ✅

---

### 🟠 HIGH PRIORITY (Medium Risk, Medium-High Impact)

#### 4. **Flow.ts** - 98.43% statements, **88.23% branches** ✅ PHASE 2 COMPLETE
- **Previous Uncovered Lines**: 82, 156, 171
- **Risk**: Core execution engine - controls message flow
- **Phase 2 Improvements**:
  - Added tests for generator dimension analysis (emits new dimensions)
  - Added tests for aggregator dimension analysis (reduces dimensions)
  - Added tests for error path when box has no parent edge
- **Status**: Branch coverage improved from 76.47% to **88.23%** ✅
- **Remaining Uncovered**: Line 82 (defensive code - "Resolving callback not registered")

#### 5. **stats.ts** - 96.15% statements, **85.71% branches** ✅ PHASE 2 COMPLETE
- **Previous Uncovered Lines**: 50-65 (the `sampleStats` class decorator)
- **Risk**: Monitoring/observability - production debugging depends on this
- **Phase 2 Improvements**:
  - Added tests for sampleStats class decorator wrapping AQueue subclass
  - Added tests for queue_stats event emission at intervals
  - Added tests for task_finish event subscription
  - Added tests for timer unref behavior
- **Status**: Functions coverage improved from 42.85% to **85.71%** ✅
- **Remaining Uncovered**: Line 65 (box_timing event callback in async context)

#### 6. **FlowSchemaReader.ts** - 100% coverage ✅ PHASE 2 COMPLETE
- **Previous Uncovered Lines**: 15-19 (error handling for missing flow)
- **Risk**: Flow retrieval - error paths untested
- **Status**: Already at 100% coverage from existing tests

#### 7. **FlowCatalog.ts** - 100% statements, **100% branches** ✅ PHASE 3 COMPLETE
- **Previous Uncovered Lines**: 42-43 (debug.enabled branch)
- **Risk**: Flow retrieval - debug logging path untested
- **Phase 3 Improvements**:
  - Added test for debug mode enabled (visualBuilder.build and console.log)
- **Status**: Branch coverage improved from 0% to **100%** ✅

---

### 🟡 MEDIUM PRIORITY (Low-Medium Risk)

#### 8. **ComponentFactory.ts** - 100% statements, **100% branches** ✅ PHASE 3 COMPLETE
- **Previous Uncovered Lines**: 58, 94-105 (error handling edge cases)
- **Risk**: Factory with some edge cases in conditional logic
- **Phase 3 Improvements**:
  - Added tests for FactoryException thrown when factory throws non-BoxNotFound error
  - Added tests for handling non-Error objects thrown from factory
  - Added tests for component loading errors with non-existent paths
- **Status**: Branch coverage improved from 77.77% to **100%** ✅

#### 9. **DAGBuilder/builder.ts** - 96.55% statements, **90% branches** ✅ PHASE 3 COMPLETE
- **Previous Uncovered Lines**: 54, 210, 237-248, 268
- **Risk**: DAG construction edge cases
- **Phase 3 Improvements**:
  - Added tests for empty process array error handling
  - Added tests for empty row error handling
  - Added tests for batching box with default timeout
  - Added tests for default concurrency handling
- **Status**: Branch coverage improved from 86.66% to **90%** ✅
- **Remaining Uncovered**: Defensive code paths (lines 54, 210, 268) - type guards that are practically unreachable

---

## Recommended Action Plan

> **Important**: For each step below, the goal is to ensure **comprehensive logical/practical scenario coverage**, not just to increase coverage metrics. Before writing any new tests:
> 1. **Examine the source file** to understand the logic, edge cases, and error paths
> 2. **Review existing test files** to see what scenarios are already covered
> 3. **Identify gaps in practical scenarios** (e.g., error conditions, edge cases, async behavior, boundary conditions)
> 4. **Prioritize tests that validate real-world behavior** over tests that simply execute uncovered lines

---

### Phase 1: Critical ✅ COMPLETE

#### Step 1: Box.ts - Error handling and BatchingBox edge cases ✅
- **Source file**: `src/lib/bakeryjs/Box.ts`
- **Test file**: `src/lib/bakeryjs/__tests__/Box.test.ts`
- **Result**: Branch coverage improved from 71.73% to **86.95%**
- **Tests Added**:
  - Generator misbehavior (emitting after promise resolves)
  - BatchingBox parameter validation error paths
  - BatchingBox aggregator NotImplementedError
  - BatchingBox error handling and non-Error conversion
  - Generator non-Error throw conversion
- **Remaining Uncovered**: Defensive code paths (lines 258, 275, 341, 433, 566, 644)

#### Step 2: Program.ts - Validation and error paths ✅
- **Source file**: `src/lib/bakeryjs/Program.ts`
- **Test file**: `tests/program.test.ts`
- **Result**: Branch coverage improved from 62.5% to **68.75%**
- **Tests Added**:
  - Flow execution by name from catalog
  - Non-existent flow name error handling
  - Unrecognized flow description validation
- **Remaining Uncovered**: Debug console.log statements (lines 128, 185, 189, 200) and unreachable defensive code (line 210)

#### Step 3: tracingModel.ts - Complex dimension scenarios ✅
- **Source file**: `src/lib/bakeryjs/tracingModel.ts`
- **Test file**: `src/lib/bakeryjs/__tests__/tracingModel.test.ts`
- **Result**: Branch coverage improved from 76.19% to **80.95%**
- **Tests Added**:
  - Dimension complete before any children pass through
  - Children completing before dimension marked complete
  - Same message passing multiple boxes in same dimension
  - Experimental tracing disabled (env variable path)
  - Nested generator dimensions (2 levels deep)
  - Waiting for all nested dimensions to complete
- **Remaining Uncovered**: Defensive code for edge cases (lines 120, 295, 354, 373)

---

### Phase 2: Important ✅ COMPLETE

#### Step 4: Flow.ts - Branch coverage improvement ✅
- **Source file**: `src/lib/bakeryjs/Flow.ts`
- **Test file**: `src/lib/bakeryjs/__tests__/Flow.test.ts`
- **Result**: Branch coverage improved from 76.47% to **88.23%**
- **Tests Added**:
  - Generator dimension analysis (emits new dimensions)
  - Aggregator dimension analysis (reduces dimensions)
  - Error path when box has no parent edge
- **Remaining Uncovered**: Line 82 (defensive code - "Resolving callback not registered")

#### Step 5: stats.ts - sampleStats decorator ✅
- **Source file**: `src/lib/bakeryjs/stats.ts`
- **Test file**: `src/lib/bakeryjs/__tests__/MemoryPriorityQueue.test.ts`
- **Result**: Functions coverage improved from 42.85% to **85.71%**
- **Tests Added**:
  - sampleStats class decorator wrapping AQueue subclass
  - queue_stats event emission at intervals using Jest fake timers
  - task_finish event subscription setup
  - Timer unref behavior verification
- **Remaining Uncovered**: Line 65 (box_timing event callback in async context)

#### Step 6: FlowSchemaReader.ts - Already Complete ✅
- **Source file**: `src/lib/bakeryjs/FlowSchemaReader.ts`
- **Status**: Already at 100% coverage from existing tests
- **Note**: Error handling path was already tested by existing test infrastructure

---

### Phase 3: Cleanup ✅ COMPLETE

#### Step 7: FlowCatalog.ts - Debug mode branch ✅
- **Source file**: `src/lib/bakeryjs/FlowCatalog.ts`
- **Test file**: `src/lib/bakeryjs/__tests__/Flow.test.ts`
- **Result**: Branch coverage improved from 0% to **100%**
- **Tests Added**:
  - Debug mode enabled (visualBuilder.build and console.log)
- **Technique**: Used Jest module mocking with `jest.doMock` and dynamic imports to mock the debug module

#### Step 8: ComponentFactory.ts - Error handling edge cases ✅
- **Source file**: `src/lib/bakeryjs/ComponentFactory.ts`
- **Test file**: `src/lib/bakeryjs/__tests__/ComponentFactory.test.ts`
- **Result**: Branch coverage improved from 77.77% to **100%**
- **Tests Added**:
  - FactoryException thrown when factory throws non-BoxNotFound error
  - Handling of non-Error objects thrown from factory
  - Component loading errors with non-existent paths

#### Step 9: DAGBuilder/builder.ts - Remaining branches ✅
- **Source file**: `src/lib/bakeryjs/builders/DAGBuilder/builder.ts`
- **Test file**: `src/lib/bakeryjs/builders/DAGBuilder/__tests__/builder.test.ts`
- **Result**: Branch coverage improved from 86.66% to **90%**
- **Tests Added**:
  - Empty process array error handling
  - Empty row error handling
  - Batching box with default timeout
  - Default concurrency handling for batching and single boxes
- **Remaining Uncovered**: Defensive code paths (lines 54, 210, 268) - type guards that are practically unreachable

---

## Coverage Target Recommendations

| Module | Previous Branches | Current Branches | Target | Status |
|--------|------------------|------------------|--------|--------|
| Box.ts | 71.73% | **86.95%** | 85% | ✅ Exceeded |
| Program.ts | 62.5% | **68.75%** | 80% | ⚠️ Limited by debug code |
| tracingModel.ts | 76.19% | **80.95%** | 85% | ⚠️ Close, defensive code remaining |
| Flow.ts | 76.47% | **88.23%** | 85% | ✅ Exceeded |
| stats.ts | 42.85% (funcs) | **85.71%** | 85% | ✅ Met target |
| FlowSchemaReader.ts | 40% | **100%** | 100% | ✅ Complete |
| FlowCatalog.ts | 0% | **100%** | 100% | ✅ Complete |
| ComponentFactory.ts | 77.77% | **100%** | 85% | ✅ Exceeded |
| DAGBuilder/builder.ts | 86.66% | **90%** | 90% | ✅ Met target |
| Overall | 77.40% | **84.34%** | 80% | ✅ **Target Achieved!** |

**Notes on Program.ts**: The remaining uncovered branches are debug console.log statements that only execute when the DEBUG environment variable is set. These are intentionally not tested as they don't affect production behavior.

**Notes on tracingModel.ts**: The remaining uncovered lines are defensive code paths that handle edge cases like undefined keys in maps and race conditions. These are difficult to trigger in normal operation and represent good defensive programming practices.

**Notes on DAGBuilder/builder.ts**: The remaining uncovered lines (54, 210, 268) are defensive type guards that protect against undefined values after array access. These are practically unreachable in normal operation but provide TypeScript type safety.

---

## Alignment with CODEBASE_ANALYSIS.md

This plan aligns with the priority system documented in `CODEBASE_ANALYSIS.md`:
- **Priority 1** core processing modules (Box, TracingModel) have the highest risk
- **Priority 4** orchestration modules (Program, Flow) are key user-facing APIs
- Improving coverage in these areas provides the highest risk reduction

