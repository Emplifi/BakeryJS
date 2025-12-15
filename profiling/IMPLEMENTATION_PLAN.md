# Flame Graph Analysis Implementation Plan

## Overview

This document outlines the implementation plan for automated flame graph analysis tooling in BakeryJS. The goal is to create a system that:

1. Runs the complex flow for an extended period while collecting CPU profiles
2. Parses the profile data to build a call tree
3. Automatically identifies performance hotspots and bottlenecks
4. Generates actionable reports without requiring manual inspection of large files

## Background

### Why Flame Graph Analysis?

Flame graphs visualize CPU time spent in functions, where:
- **Width** represents time spent (wider = more time)
- **Height** represents call stack depth
- **Plateaus** indicate functions where significant time is spent

Manual inspection of flame graphs is impractical for CI/CD pipelines and large profiles. Automated analysis can:
- Detect performance regressions between commits
- Identify hotspots in BakeryJS-specific code
- Focus on TracingModel performance (the primary concern)
- Provide actionable recommendations

### Existing Infrastructure

The benchmarking system already provides:
- Complex flow with 2 generators, 9 mappers, 3 dimensions
- Configurable item counts and run parameters
- Memory tracking and event timing
- Result storage and comparison

## Technical Approach

### Profile Collection Method

We will use Node.js built-in `--cpu-prof` flag for CPU profiling:

```bash
node --cpu-prof --cpu-prof-dir=./profiling/profiles ./benchmarks/run.ts
```

**Advantages:**
- Zero external dependencies
- Reliable V8-native profiling
- Outputs standard `.cpuprofile` JSON format
- Low overhead (~2-5% CPU)

### V8 CPU Profile Format

The `.cpuprofile` format is JSON with this structure:

```json
{
  "nodes": [
    {
      "id": 1,
      "callFrame": {
        "functionName": "processMessage",
        "scriptId": "42",
        "url": "file:///path/to/TracingModel.ts",
        "lineNumber": 150,
        "columnNumber": 10
      },
      "hitCount": 1234,
      "children": [2, 3, 4]
    }
  ],
  "startTime": 1234567890,
  "endTime": 1234567999,
  "samples": [1, 2, 3, 1, 4],
  "timeDeltas": [100, 100, 100]
}
```

### Analysis Algorithm

1. **Parse Profile**: Load JSON and build node map
2. **Calculate Self-Time**: `selfTime = hitCount * sampleInterval`
3. **Calculate Total-Time**: Traverse tree, sum self + children times
4. **Identify Hotspots**: Functions exceeding threshold (e.g., >5% self-time)
5. **Detect Hot Paths**: Call stacks appearing frequently in samples
6. **Filter by Source**: Focus on BakeryJS code, exclude Node.js internals

## Architecture

### Directory Structure

```
profiling/
├── README.md                    # Usage documentation
├── run.ts                       # Main entry point
├── types.ts                     # TypeScript type definitions
├── cli/
│   └── index.ts                 # CLI argument parsing
├── collector/
│   ├── index.ts                 # Profile collection orchestration
│   └── spawner.ts               # Node.js process spawning with --cpu-prof
├── parser/
│   ├── index.ts                 # Profile parsing entry point
│   ├── cpuProfileParser.ts      # V8 CPU profile parser
│   └── callTree.ts              # Call tree data structure
├── analyzer/
│   ├── index.ts                 # Analysis orchestration
│   ├── hotspotDetector.ts       # Hotspot detection algorithms
│   ├── callStackAnalyzer.ts     # Hot call stack detection
│   └── thresholds.ts            # Configurable thresholds
├── reporter/
│   ├── index.ts                 # Report generation orchestration
│   ├── consoleReporter.ts       # Human-readable console output
│   └── jsonReporter.ts          # Machine-readable JSON output
├── profiles/                    # Generated profiles (gitignored)
└── results/                     # Analysis results (gitignored)
```

### Component Responsibilities

#### 1. Collector (`collector/`)
- Spawns Node.js with `--cpu-prof` flag
- Runs benchmark flow for configurable duration
- Manages warmup period before profiling
- Stores profiles with metadata (timestamp, config, git SHA)

#### 2. Parser (`parser/`)
- Parses V8 CPU profile JSON format
- Builds call tree data structure
- Calculates self-time and total-time per node
- Handles edge cases (anonymous functions, native code)

#### 3. Analyzer (`analyzer/`)
- Detects hotspots by self-time (CPU-bound functions)
- Detects bottlenecks by total-time (call tree bottlenecks)
- Identifies hot call stacks (frequently executed paths)
- Filters by source file patterns (BakeryJS vs internals)
- Compares against baseline for regression detection

#### 4. Reporter (`reporter/`)
- Generates human-readable console output
- Generates machine-readable JSON for CI
- Highlights regressions compared to baseline
- Provides actionable recommendations

## Implementation Phases

### Phase 1: Profile Collection Infrastructure
**Estimated Effort: 1-2 days**

1. Create profiling directory structure
2. Implement profile collector that spawns Node.js with `--cpu-prof`
3. Add CLI for running profiling sessions
4. Configure warmup period and collection duration
5. Store profiles with metadata

**Deliverables:**
- `profiling/run.ts` - Main entry point
- `profiling/cli/index.ts` - CLI argument parsing
- `profiling/collector/` - Profile collection logic
- `npm run profile` script

### Phase 2: Profile Parser
**Estimated Effort: 1-2 days**

1. Parse V8 CPU profile JSON format
2. Build call tree data structure
3. Calculate self-time and total-time for each node
4. Handle edge cases (anonymous functions, native code, deoptimizations)

**Deliverables:**
- `profiling/parser/cpuProfileParser.ts` - JSON parsing
- `profiling/parser/callTree.ts` - Call tree data structure
- `profiling/types.ts` - TypeScript interfaces

### Phase 3: Hotspot Analyzer
**Estimated Effort: 2-3 days**

1. Implement hotspot detection by self-time
2. Implement bottleneck detection by total-time
3. Add hot call stack detection
4. Add source file filtering (BakeryJS vs Node.js internals)
5. Implement baseline comparison for regression detection

**Deliverables:**
- `profiling/analyzer/hotspotDetector.ts` - Hotspot algorithms
- `profiling/analyzer/callStackAnalyzer.ts` - Call stack analysis
- `profiling/analyzer/thresholds.ts` - Configurable thresholds

### Phase 4: Report Generator
**Estimated Effort: 1-2 days**

1. Generate human-readable console output
2. Generate JSON report for CI integration
3. Include actionable recommendations
4. Support comparison mode (current vs baseline)

**Deliverables:**
- `profiling/reporter/consoleReporter.ts` - Console output
- `profiling/reporter/jsonReporter.ts` - JSON output
- `npm run profile:analyze` script

### Phase 5: Integration & Polish
**Estimated Effort: 1 day**

1. Add npm scripts for easy usage
2. Update .gitignore for profile files
3. Create baseline profiles for regression testing
4. Add CI integration examples

## CLI Interface

### Profile Collection

```bash
# Run profiling with default settings (complex flow, 30 seconds)
npm run profile

# Run with custom duration
npm run profile -- --duration=60

# Run with specific flow type
npm run profile -- --flow=simple

# Run with custom item counts
npm run profile -- --items=1000 --nested=50

# Include warmup period
npm run profile -- --warmup=5 --duration=30
```

### Profile Analysis

```bash
# Analyze most recent profile
npm run profile:analyze

# Analyze specific profile file
npm run profile:analyze -- --file=./profiling/profiles/CPU.20241214.123456.cpuprofile

# Compare against baseline
npm run profile:analyze -- --baseline=./profiling/baselines/baseline.cpuprofile

# Set custom thresholds
npm run profile:analyze -- --hotspot-threshold=3 --regression-threshold=10

# Output JSON for CI
npm run profile:analyze -- --json --output=./profiling/results/analysis.json
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `--duration` | 30 | Profiling duration in seconds |
| `--warmup` | 5 | Warmup period before profiling starts |
| `--flow` | complex | Flow type: `simple` or `complex` |
| `--items` | 100 | Number of items for first generator |
| `--nested` | 10 | Number of nested items (complex flow only) |
| `--hotspot-threshold` | 5 | Minimum % self-time to flag as hotspot |
| `--regression-threshold` | 10 | Minimum % increase to flag as regression |
| `--top-n` | 10 | Number of top functions to report |
| `--include-internals` | false | Include Node.js internal functions |
| `--json` | false | Output JSON instead of console |
| `--baseline` | - | Baseline profile for comparison |

## Output Format

### Console Output Example

```
╔══════════════════════════════════════════════════════════════════╗
║                    FLAME GRAPH ANALYSIS REPORT                   ║
╠══════════════════════════════════════════════════════════════════╣
║ Profile: CPU.20241214.123456.cpuprofile                          ║
║ Duration: 30.2s | Samples: 30,234 | Sample Rate: 1000Hz          ║
╚══════════════════════════════════════════════════════════════════╝

🔥 TOP HOTSPOTS BY SELF-TIME
┌────┬─────────────────────────────────┬──────────┬─────────┬──────────────────────────┐
│ #  │ Function                        │ Self %   │ Self ms │ Location                 │
├────┼─────────────────────────────────┼──────────┼─────────┼──────────────────────────┤
│ 1  │ TracingModel.updateDimension    │ 12.3%    │ 3,714   │ TracingModel.ts:245      │
│ 2  │ TracingModel.findMessagePath    │ 8.7%     │ 2,627   │ TracingModel.ts:312      │
│ 3  │ MessageStore.get                │ 5.2%     │ 1,570   │ MessageStore.ts:89       │
└────┴─────────────────────────────────┴──────────┴─────────┴──────────────────────────┘

⚠️  POTENTIAL BOTTLENECKS (Total Time)
┌────┬─────────────────────────────────┬──────────┬─────────┬──────────────────────────┐
│ #  │ Function                        │ Total %  │ Total ms│ Location                 │
├────┼─────────────────────────────────┼──────────┼─────────┼──────────────────────────┤
│ 1  │ Flow.processMessage             │ 45.2%    │ 13,651  │ Flow.ts:156              │
│ 2  │ TracingModel.trackMessage       │ 28.4%    │ 8,577   │ TracingModel.ts:78       │
└────┴─────────────────────────────────┴──────────┴─────────┴──────────────────────────┘

📊 BAKERYJS CODE BREAKDOWN
  TracingModel: 35.2% (10,631ms)
  Flow: 12.4% (3,745ms)
  Box: 8.1% (2,446ms)
  Other BakeryJS: 5.3% (1,601ms)
  Node.js Internals: 39.0% (11,778ms)

✅ No regressions detected compared to baseline.
```

### JSON Output Schema

```json
{
  "profile": {
    "filename": "CPU.20241214.123456.cpuprofile",
    "duration_ms": 30200,
    "sample_count": 30234,
    "sample_rate_hz": 1000
  },
  "hotspots": [
    {
      "function": "TracingModel.updateDimension",
      "file": "TracingModel.ts",
      "line": 245,
      "self_time_ms": 3714,
      "self_time_percent": 12.3,
      "total_time_ms": 4521,
      "total_time_percent": 15.0,
      "hit_count": 3714
    }
  ],
  "bottlenecks": [...],
  "breakdown": {
    "TracingModel": { "time_ms": 10631, "percent": 35.2 },
    "Flow": { "time_ms": 3745, "percent": 12.4 }
  },
  "regressions": [],
  "passed": true,
  "timestamp": "2024-12-14T12:34:56.789Z"
}
```

## Success Criteria

1. **Hotspot Detection**: Can identify functions consuming >X% of CPU time
2. **Regression Detection**: Can detect performance regressions vs baseline
3. **Actionable Output**: Provides clear, actionable recommendations
4. **CI Integration**: Works in CI environment with pass/fail exit codes
5. **Low Overhead**: Profiling overhead <5% CPU
6. **No External Dependencies**: Core functionality uses only Node.js built-ins

## Future Enhancements

1. **Memory Profiling**: Add heap snapshot analysis
2. **Trend Analysis**: Track performance over multiple commits
3. **Interactive Viewer**: Web-based flame graph visualization
4. **Automatic Optimization Suggestions**: AI-powered recommendations
5. **Integration with Existing Tools**: Export to Speedscope, Chrome DevTools

