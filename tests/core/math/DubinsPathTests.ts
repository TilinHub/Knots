/**
 * Dubins Path Test Suite
 *
 * Test cases for all 6 Dubins path types based on theoretical foundations
 * from "Census of Bounded Curvature Paths" paper
 */

import { DubinsPathCalculator } from './DubinsPath';
import type { Pose2D, DubinsPath } from './DubinsPath';

/**
 * Test configuration and utilities
 */
export class DubinsPathTests {
  private calculator: DubinsPathCalculator;

  constructor(minRadius: number = 1.0) {
    this.calculator = new DubinsPathCalculator(minRadius);
  }

  /**
   * Run all test cases
   */
  public runAllTests(): TestResults {
    const results: TestResults = {
      passed: 0,
      failed: 0,
      tests: [],
    };

    // Test CSC paths
    results.tests.push(this.testLSL());
    results.tests.push(this.testRSR());
    results.tests.push(this.testLSR());
    results.tests.push(this.testRSL());

    // Test CCC paths
    results.tests.push(this.testLRL());
    results.tests.push(this.testRLR());

    // Test optimal path selection
    results.tests.push(this.testOptimalPath());

    // Test edge cases
    results.tests.push(this.testParallelPoses());
    results.tests.push(this.testClosePoints());
    results.tests.push(this.testOppositeDirections());

    // Count results
    results.passed = results.tests.filter((t) => t.passed).length;
    results.failed = results.tests.filter((t) => !t.passed).length;

    return results;
  }

  /**
   * Test LSL path
   * Configuration: Left circles are far apart, external tangent exists
   */
  private testLSL(): TestResult {
    const start: Pose2D = {
      position: { x: 0, y: 0 },
      theta: 0, // pointing right
    };

    const end: Pose2D = {
      position: { x: 5, y: 2 },
      theta: Math.PI / 4, // pointing northeast
    };

    const path = this.calculator.computeLSL(start, end);

    const passed =
      path !== null &&
      path.type === 'LSL' &&
      path.segments.length === 3 &&
      path.segments[0].type === 'L' &&
      path.segments[1].type === 'S' &&
      path.segments[2].type === 'L' &&
      path.totalLength > 0;

    return {
      name: 'LSL Path',
      passed,
      message: passed ? 'LSL path computed correctly' : 'LSL path failed',
      path,
    };
  }

  /**
   * Test RSR path
   */
  private testRSR(): TestResult {
    const start: Pose2D = {
      position: { x: 0, y: 0 },
      theta: 0,
    };

    const end: Pose2D = {
      position: { x: 5, y: -2 },
      theta: -Math.PI / 4, // pointing southeast
    };

    const path = this.calculator.computeRSR(start, end);

    const passed =
      path !== null &&
      path.type === 'RSR' &&
      path.segments.length === 3 &&
      path.segments[0].type === 'R' &&
      path.segments[1].type === 'S' &&
      path.segments[2].type === 'R';

    return {
      name: 'RSR Path',
      passed,
      message: passed ? 'RSR path computed correctly' : 'RSR path failed',
      path,
    };
  }

  /**
   * Test LSR path
   * Start turning left, end turning right
   */
  private testLSR(): TestResult {
    const start: Pose2D = {
      position: { x: 0, y: 0 },
      theta: 0,
    };

    const end: Pose2D = {
      position: { x: 4, y: 0 },
      theta: Math.PI, // pointing left (opposite direction)
    };

    const path = this.calculator.computeLSR(start, end);

    const passed =
      path !== null &&
      path.type === 'LSR' &&
      path.segments[0].type === 'L' &&
      path.segments[1].type === 'S' &&
      path.segments[2].type === 'R';

    return {
      name: 'LSR Path',
      passed,
      message: passed ? 'LSR path computed correctly' : 'LSR path failed',
      path,
    };
  }

  /**
   * Test RSL path
   */
  private testRSL(): TestResult {
    const start: Pose2D = {
      position: { x: 0, y: 0 },
      theta: 0,
    };

    const end: Pose2D = {
      position: { x: 4, y: 0 },
      theta: Math.PI,
    };

    const path = this.calculator.computeRSL(start, end);

    const passed =
      path !== null &&
      path.type === 'RSL' &&
      path.segments[0].type === 'R' &&
      path.segments[1].type === 'S' &&
      path.segments[2].type === 'L';

    return {
      name: 'RSL Path',
      passed,
      message: passed ? 'RSL path computed correctly' : 'RSL path failed',
      path,
    };
  }

  /**
   * Test LRL path
   * Classic three-circle configuration
   */
  private testLRL(): TestResult {
    const start: Pose2D = {
      position: { x: 0, y: 0 },
      theta: 0,
    };

    const end: Pose2D = {
      position: { x: 3, y: 0 },
      theta: 0, // same direction
    };

    const path = this.calculator.computeLRL(start, end);

    const passed =
      path !== null &&
      path.type === 'LRL' &&
      path.segments.length === 3 &&
      path.segments[0].type === 'L' &&
      path.segments[1].type === 'R' &&
      path.segments[2].type === 'L';

    return {
      name: 'LRL Path',
      passed,
      message: passed ? 'LRL path computed correctly' : 'LRL path failed',
      path,
    };
  }

  /**
   * Test RLR path
   */
  private testRLR(): TestResult {
    const start: Pose2D = {
      position: { x: 0, y: 0 },
      theta: 0,
    };

    const end: Pose2D = {
      position: { x: 3, y: 0 },
      theta: 0,
    };

    const path = this.calculator.computeRLR(start, end);

    const passed =
      path !== null &&
      path.type === 'RLR' &&
      path.segments[0].type === 'R' &&
      path.segments[1].type === 'L' &&
      path.segments[2].type === 'R';

    return {
      name: 'RLR Path',
      passed,
      message: passed ? 'RLR path computed correctly' : 'RLR path failed',
      path,
    };
  }

  /**
   * Test optimal path selection
   * Should choose shortest among valid paths
   */
  private testOptimalPath(): TestResult {
    const start: Pose2D = {
      position: { x: 0, y: 0 },
      theta: 0,
    };

    const end: Pose2D = {
      position: { x: 5, y: 1 },
      theta: Math.PI / 6,
    };

    const optimalPath = this.calculator.computeOptimalPath(start, end);
    const allPaths = this.calculator.computeAllPaths(start, end);

    if (!optimalPath || allPaths.length === 0) {
      return {
        name: 'Optimal Path Selection',
        passed: false,
        message: 'No valid paths found',
        path: null,
      };
    }

    // Check that optimal path is indeed shortest
    const isOptimal = allPaths.every((p) => optimalPath.totalLength <= p.totalLength + 1e-6);

    return {
      name: 'Optimal Path Selection',
      passed: isOptimal,
      message: isOptimal
        ? `Optimal path (${optimalPath.type}) has length ${optimalPath.totalLength.toFixed(3)}`
        : 'Optimal path is not shortest',
      path: optimalPath,
      allPaths,
    };
  }

  /**
   * Test parallel poses
   * Example from paper: poses with parallel tangent vectors
   */
  private testParallelPoses(): TestResult {
    const start: Pose2D = {
      position: { x: 0, y: 0 },
      theta: 0,
    };

    const end: Pose2D = {
      position: { x: 10, y: 0 },
      theta: 0, // parallel
    };

    const path = this.calculator.computeOptimalPath(start, end);

    // Should prefer straight line (LSL or RSR with minimal arcs)
    const passed = path !== null && path.totalLength > 0;

    return {
      name: 'Parallel Poses',
      passed,
      message: passed
        ? `Parallel poses handled: ${path.type} with length ${path.totalLength.toFixed(3)}`
        : 'Failed to handle parallel poses',
      path,
    };
  }

  /**
   * Test close points
   * Points very close together may have limited path options
   */
  private testClosePoints(): TestResult {
    const start: Pose2D = {
      position: { x: 0, y: 0 },
      theta: 0,
    };

    const end: Pose2D = {
      position: { x: 1.5, y: 0.5 },
      theta: Math.PI / 2,
    };

    const allPaths = this.calculator.computeAllPaths(start, end);

    // Some paths may not be valid for close configurations
    const passed = allPaths.length > 0;

    return {
      name: 'Close Points',
      passed,
      message: passed
        ? `Found ${allPaths.length} valid paths for close points`
        : 'No valid paths for close points',
      allPaths,
    };
  }

  /**
   * Test opposite directions
   * Start and end pointing opposite directions
   */
  private testOppositeDirections(): TestResult {
    const start: Pose2D = {
      position: { x: 0, y: 0 },
      theta: 0, // pointing right
    };

    const end: Pose2D = {
      position: { x: 3, y: 0 },
      theta: Math.PI, // pointing left
    };

    const path = this.calculator.computeOptimalPath(start, end);

    const passed = path !== null;

    return {
      name: 'Opposite Directions',
      passed,
      message: passed
        ? `Opposite directions: ${path.type} with length ${path.totalLength.toFixed(3)}`
        : 'Failed opposite directions',
      path,
    };
  }

  /**
   * Generate example paths for visualization
   * Returns a set of interesting configurations
   */
  public generateExamplePaths(): ExamplePath[] {
    const examples: ExamplePath[] = [];

    // Example 1: Simple LSL
    examples.push({
      name: 'Simple LSL',
      description: 'Basic left-straight-left configuration',
      start: { position: { x: 0, y: 0 }, theta: 0 },
      end: { position: { x: 8, y: 3 }, theta: Math.PI / 4 },
      expectedType: 'LSL',
    });

    // Example 2: Simple RSR
    examples.push({
      name: 'Simple RSR',
      description: 'Basic right-straight-right configuration',
      start: { position: { x: 0, y: 0 }, theta: 0 },
      end: { position: { x: 8, y: -3 }, theta: -Math.PI / 4 },
      expectedType: 'RSR',
    });

    // Example 3: U-turn (LRL)
    examples.push({
      name: 'U-Turn LRL',
      description: 'Three circle path for U-turn maneuver',
      start: { position: { x: 0, y: 0 }, theta: 0 },
      end: { position: { x: 2, y: 0 }, theta: 0 },
      expectedType: 'LRL',
    });

    // Example 4: Opposite directions
    examples.push({
      name: 'Opposite Directions',
      description: 'Poses pointing opposite ways',
      start: { position: { x: 0, y: 0 }, theta: 0 },
      end: { position: { x: 5, y: 0 }, theta: Math.PI },
      expectedType: 'LSR',
    });

    // Example 5: Perpendicular
    examples.push({
      name: 'Perpendicular',
      description: 'Poses at right angles',
      start: { position: { x: 0, y: 0 }, theta: 0 },
      end: { position: { x: 4, y: 4 }, theta: Math.PI / 2 },
      expectedType: 'LSL',
    });

    // Compute actual paths
    return examples.map((ex) => ({
      ...ex,
      path: this.calculator.computeOptimalPath(ex.start, ex.end),
      allPaths: this.calculator.computeAllPaths(ex.start, ex.end),
    }));
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  path?: DubinsPath | null;
  allPaths?: DubinsPath[];
}

export interface TestResults {
  passed: number;
  failed: number;
  tests: TestResult[];
}

export interface ExamplePath {
  name: string;
  description: string;
  start: Pose2D;
  end: Pose2D;
  expectedType: string;
  path?: DubinsPath | null;
  allPaths?: DubinsPath[];
}

/**
 * Console-friendly test runner
 */
export function runDubinsTests(): void {
  console.log('\n=== DUBINS PATH TESTS ===\n');

  const tester = new DubinsPathTests(1.0);
  const results = tester.runAllTests();

  results.tests.forEach((test) => {
    const icon = test.passed ? '✓' : '✗';
    console.log(`${icon} ${test.name}: ${test.message}`);

    if (test.path) {
      console.log(`  Length: ${test.path.totalLength.toFixed(3)}`);
    }
  });

  console.log(`\n${results.passed} passed, ${results.failed} failed\n`);

  // Generate examples
  console.log('\n=== EXAMPLE PATHS ===\n');
  const examples = tester.generateExamplePaths();

  examples.forEach((ex) => {
    console.log(`${ex.name}: ${ex.description}`);
    if (ex.path) {
      console.log(`  Type: ${ex.path.type}, Length: ${ex.path.totalLength.toFixed(3)}`);
      console.log(`  Valid alternatives: ${ex.allPaths?.length || 0}`);
    }
    console.log('');
  });
}
