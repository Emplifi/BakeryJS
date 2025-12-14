# BakeryJS Flow Benchmarking System

## Overview

This benchmarking system is designed to measure the performance characteristics of BakeryJS flows, with a particular focus on understanding how the **TracingModel** scales as flow complexity increases.

### Purpose

The primary goal is to validate or refute the hypothesis that:

> **The TracingModel becomes a performance bottleneck as flows grow in complexity.**

The TracingModel (`src/lib/bakeryjs/tracingModel.ts`) is responsible for tracking message progress through flows for job completion detection. It uses nested data structures (`DefinedMap`) to track:
- Messages across dimensions
- Box completion states
- Parent-child message relationships
- Dimension completion status

As flows become more complex with multiple generators and nested sub-flows, the TracingModel must manage increasingly complex state tracking, which may impact performance.

---

## Architecture

### Flow Types

#### 1. Simple Flow (`simpleFlow.ts`)
A minimal flow to establish baseline performance:

```
[job] → [generator (N items)] → [mapper1] → [mapper2] → [drain]
```

- **1 generator**: Produces N messages
- **2 mappers**: Simple transformations
- **1 dimension**: Root dimension only

#### 2. Complex Flow (`complexFlow.ts`)
A deeply nested flow to stress-test the TracingModel:

```
[job] → [gen1 (N items)] → [mapper1] → [mapper2] → [mapper3]
                              ↓
                         [gen2 (M items)] → [mapper4] → [mapper5]
                                               ↓
                          [parallel: mapper6, mapper7, mapper8]
                                               ↓
                                          [mapper9]
```

- **2 generators**: Creates nested dimensions
- **9 mappers**: Including parallel processing stages
- **3 dimensions**: Root, gen1's dimension, gen2's dimension

---

## Implementation Plan

### Phase 1: Infrastructure Setup

1. **Create directory structure**
   - `benchmarks/` - Root directory
   - `benchmarks/components/` - Benchmark-specific boxes
   - `benchmarks/components/generators/` - Generator boxes
   - `benchmarks/components/processors/` - Mapper boxes
   - `benchmarks/flows/` - Flow definitions
   - `benchmarks/results/` - Benchmark output

2. **Create box components**
   - `configurable-generator.ts` - Generator with configurable item count
   - `timed-mapper.ts` - Mapper with optional artificial delay
   - `nested-generator.ts` - Second-level generator for complex flow

### Phase 2: Flow Implementation

1. **Simple Flow** (`flows/simpleFlow.ts`)
   - Linear flow with single generator
   - Configurable message count (10, 100, 1000, 10000)

2. **Complex Flow** (`flows/complexFlow.ts`)
   - Two-stage generator pattern
   - Multiple parallel mapper stages
   - Configurable message counts at each level

### Phase 3: Benchmark Runner

1. **Statistics collection**
   - Total execution time
   - Time per message
   - Memory usage (heap snapshots)
   - Event timing (using Program events: 'sent', 'run')

2. **Output formats**
   - Console summary
   - JSON file for further analysis
   - Comparison table between runs

### Phase 4: Analysis

1. **Run matrix**
   | Flow Type | Messages (N) | Messages (M) | Expected TracingModel Load |
   |-----------|--------------|--------------|----------------------------|
   | Simple    | 10           | -            | Low                        |
   | Simple    | 100          | -            | Low                        |
   | Simple    | 1000         | -            | Medium                     |
   | Simple    | 10000        | -            | High                       |
   | Complex   | 10           | 5            | Medium                     |
   | Complex   | 100          | 10           | High                       |
   | Complex   | 100          | 100          | Very High                  |
   | Complex   | 1000         | 10           | Very High                  |

2. **Metrics to compare**
   - Execution time scaling (linear vs non-linear)
   - Memory growth patterns
   - Time spent in TracingModel operations

---

## Usage

### Running Benchmarks

```bash
# Run all benchmarks
npm run benchmark

# Run only simple flow benchmarks
npm run benchmark:simple

# Run only complex flow benchmarks
npm run benchmark:complex

# Run with detailed event timeline
npm run benchmark:verbose

# Run with custom options
npm run benchmark -- --items=1000
npm run benchmark -- --flow=simple --items=500 --runs=3

# Compare with/without TracingModel optimization
BAKERYJS_DISABLE_EXPERIMENTAL_TRACING=1 npm run benchmark
```

### Interpreting Results

Results are output to `benchmarks/results/` as JSON files with timestamps:

```json
{
  "flowType": "complex",
  "config": { "n": 100, "m": 10 },
  "metrics": {
    "totalTimeMs": 1234,
    "messagesProcessed": 1100,
    "avgTimePerMessageMs": 1.12,
    "memoryUsedMB": 45.2,
    "peakMemoryMB": 52.1
  },
  "eventTimings": {
    "firstSent": 5,
    "lastSent": 1200,
    "drainComplete": 1234
  }
}
```

---

## Directory Structure

```
benchmarks/
├── README.md                                    # This documentation
├── run.ts                                       # Main benchmark runner
├── types.ts                                     # TypeScript type definitions
├── components/
│   ├── generators/
│   │   ├── configurable-generator.ts            # First-level generator (N items)
│   │   └── nested-generator.ts                  # Second-level generator (M items per parent)
│   └── processors/
│       ├── mapper1.ts through mapper9.ts        # Passthrough mappers for flow stages
│       └── timed-mapper.ts                      # Mapper with optional delay
├── flows/
│   ├── simpleFlow.ts                            # Simple flow definition
│   └── complexFlow.ts                           # Complex flow definition
└── results/                                     # Benchmark output (JSON files)
```

## Files

| File | Description |
|------|-------------|
| `README.md` | This documentation |
| `run.ts` | Main benchmark runner - parses CLI args, executes flows, collects metrics |
| `types.ts` | TypeScript interfaces for configs, metrics, and results |
| `components/generators/configurable-generator.ts` | Generator that emits N items (configurable via parameter) |
| `components/generators/nested-generator.ts` | Generator that emits M items per parent message |
| `components/processors/mapper1.ts - mapper9.ts` | Minimal passthrough mappers for flow stages |
| `components/processors/timed-mapper.ts` | Mapper with optional artificial delay |
| `flows/simpleFlow.ts` | Creates simple 1-generator, 2-mapper flow |
| `flows/complexFlow.ts` | Creates complex 2-generator, 9-mapper nested flow |

---

## Technical Notes

### TracingModel Complexity Analysis

The TracingModel's complexity is primarily driven by:

1. **Message Store** (`MsgStore`): Nested `DefinedMap` structure
   - Access pattern: `parentMsgId → dimension → msgId → MsgTrace`
   - Operations are O(1) for individual lookups

2. **Dimension Store** (`DimensionStore`): Tracks dimension completion
   - Access pattern: `msgId → dimension → DimensionTrace`
   
3. **Completion Checking** (`checkMsgFinishState`, `checkDimensionFinishState`):
   - Called after every message event
   - Traverses nested structures to verify completion
   - Potentially O(n) where n = messages in dimension

### Hypothesized Bottlenecks

1. **Recursive completion checks**: Each message completion triggers parent checks
2. **Map operations with array keys**: Dimension arrays use reference equality
3. **Event handler overhead**: `msg_finished` and `generation_finished` events
4. **Memory allocation**: Creating new `DefinedMap` instances for each dimension

---

## Expected Outcomes

### If TracingModel IS a bottleneck:
- Non-linear time scaling as message count increases
- Disproportionate slowdown in complex flows vs simple flows
- High memory usage from nested map structures

### If TracingModel is NOT a bottleneck:
- Linear time scaling with message count
- Similar per-message overhead in simple and complex flows
- Memory usage proportional to active messages only

---

## Step-by-Step Implementation Plan

### Step 1: Setup (Completed)
1. ✅ Create `benchmarks/` directory
2. ✅ Create `benchmarks/types.ts` with TypeScript interfaces
3. ✅ Create `benchmarks/README.md` documentation

### Step 2: Component Implementation (Completed)
1. ✅ Create `configurable-generator.ts` - Generator with `itemCount` parameter
2. ✅ Create `nested-generator.ts` - Generator that creates M children per parent
3. ✅ Create `mapper1.ts` through `mapper9.ts` - Passthrough mappers
4. ✅ Create `timed-mapper.ts` - Mapper with optional delay

### Step 3: Flow Definitions (Completed)
1. ✅ Create `simpleFlow.ts` with `createSimpleFlow(itemCount)` function
2. ✅ Create `complexFlow.ts` with `createComplexFlow(itemCount, nestedItemCount)` function

### Step 4: Benchmark Runner (Completed)
1. ✅ Create `run.ts` with CLI argument parsing
2. ✅ Implement `runBenchmark()` function with metrics collection
3. ✅ Implement event timing capture (sent, run events)
4. ✅ Implement memory tracking
5. ✅ Implement results formatting and JSON export

### Step 5: Execution and Analysis (To Do)
1. Run benchmarks with various configurations
2. Compare simple vs complex flow performance
3. Test with `BAKERYJS_DISABLE_EXPERIMENTAL_TRACING=1` flag
4. Analyze scaling behavior (linear vs non-linear)
5. Document findings

---

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--flow=<type>` | Flow type: `simple`, `complex`, or `all` | `all` |
| `--items=<n>` | Number of items for first generator | `100` |
| `--nested=<m>` | Number of nested items per parent | `10` |
| `--runs=<n>` | Number of runs per configuration | `1` |
| `--verbose` | Include detailed event timeline | `false` |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BAKERYJS_DISABLE_EXPERIMENTAL_TRACING` | Set to `1` to disable optimized tracing cleanup |

---

## NPM Scripts

The following npm scripts are available for running benchmarks:

| Script | Description |
|--------|-------------|
| `npm run benchmark` | Run all benchmarks (simple + complex flows) |
| `npm run benchmark:simple` | Run only simple flow benchmarks |
| `npm run benchmark:complex` | Run only complex flow benchmarks |
| `npm run benchmark:verbose` | Run all benchmarks with detailed event timeline |

---

## Quick Start

```bash
# Navigate to the project root
cd /path/to/BakeryJS

# Run the default benchmark suite
npm run benchmark

# Run only simple flow with 1000 items
npm run benchmark -- --items=1000

# Run complex flow with 50 parent items × 20 nested items
npm run benchmark:complex -- --items=50 --nested=20

# Run with verbose output for debugging
npm run benchmark:verbose -- --items=10

# Compare with experimental tracing disabled
BAKERYJS_DISABLE_EXPERIMENTAL_TRACING=1 npm run benchmark
```

