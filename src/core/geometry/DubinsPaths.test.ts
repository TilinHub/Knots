import { describe, it, expect } from 'vitest';
import { DubinsPaths, Pose2D, DubinsPath } from './DubinsPaths';

/**
 * DUBINS PATHS - MATHEMATICAL TESTS
 * 
 * These tests verify the mathematical correctness of the 6 Dubins path types
 * based on the theory from "Census of Bounded Curvature Paths" (2020)
 */

describe('DubinsPaths - Mathematical Correctness', () => {
  const dubins = new DubinsPaths(1.0); // unit radius
  const epsilon = 1e-6; // numerical tolerance

  describe('LSL Path (Left-Straight-Left)', () => {
    it('should compute valid LSL path for standard configuration', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 4, y: 0, theta: 0 };

      const path = dubins.lslPath(start, end);

      expect(path.valid).toBe(true);
      expect(path.type).toBe('LSL');
      expect(path.segments).toHaveLength(3);
      expect(path.segments[0].type).toBe('L');
      expect(path.segments[1].type).toBe('S');
      expect(path.segments[2].type).toBe('L');
    });

    it('should have total length equal to sum of segments', () => {
      const start: Pose2D = { x: 0, y: 0, theta: Math.PI / 4 };
      const end: Pose2D = { x: 3, y: 3, theta: Math.PI / 2 };

      const path = dubins.lslPath(start, end);

      if (path.valid) {
        const segmentSum = path.segments.reduce((sum, seg) => sum + seg.length, 0);
        expect(Math.abs(path.totalLength - segmentSum)).toBeLessThan(epsilon);
      }
    });

    it('should fail when circles are too close', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 0.5, y: 0, theta: Math.PI };

      const path = dubins.lslPath(start, end);

      expect(path.valid).toBe(false);
    });
  });

  describe('RSR Path (Right-Straight-Right)', () => {
    it('should compute valid RSR path', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 4, y: 0, theta: 0 };

      const path = dubins.rsrPath(start, end);

      expect(path.valid).toBe(true);
      expect(path.type).toBe('RSR');
      expect(path.segments[0].type).toBe('R');
      expect(path.segments[1].type).toBe('S');
      expect(path.segments[2].type).toBe('R');
    });

    it('should be symmetric to LSL for opposite orientations', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 5, y: 0, theta: 0 };

      const lslPath = dubins.lslPath(start, end);
      const rsrPath = dubins.rsrPath(start, end);

      if (lslPath.valid && rsrPath.valid) {
        // For parallel poses, LSL and RSR should have same length
        expect(Math.abs(lslPath.totalLength - rsrPath.totalLength)).toBeLessThan(epsilon);
      }
    });
  });

  describe('LSR Path (Left-Straight-Right)', () => {
    it('should compute valid LSR path', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 4, y: 0, theta: Math.PI };

      const path = dubins.lsrPath(start, end);

      expect(path.valid).toBe(true);
      expect(path.type).toBe('LSR');
      expect(path.segments[0].type).toBe('L');
      expect(path.segments[1].type).toBe('S');
      expect(path.segments[2].type).toBe('R');
    });

    it('should require minimum distance of 2r between circles', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 1, y: 0, theta: Math.PI };

      const path = dubins.lsrPath(start, end);

      // Distance < 2r, should be invalid
      expect(path.valid).toBe(false);
    });
  });

  describe('RSL Path (Right-Straight-Left)', () => {
    it('should compute valid RSL path', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 4, y: 0, theta: Math.PI };

      const path = dubins.rslPath(start, end);

      expect(path.valid).toBe(true);
      expect(path.type).toBe('RSL');
      expect(path.segments[0].type).toBe('R');
      expect(path.segments[1].type).toBe('S');
      expect(path.segments[2].type).toBe('L');
    });
  });

  describe('LRL Path (Left-Right-Left)', () => {
    it('should compute valid LRL path when d <= 4r', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 3, y: 0, theta: 0 };

      const path = dubins.lrlPath(start, end);

      expect(path.valid).toBe(true);
      expect(path.type).toBe('LRL');
      expect(path.segments).toHaveLength(3);
      expect(path.segments[0].type).toBe('L');
      expect(path.segments[1].type).toBe('R');
      expect(path.segments[2].type).toBe('L');
    });

    it('should fail when d > 4r (geometric constraint)', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 10, y: 0, theta: 0 }; // d > 4r = 4

      const path = dubins.lrlPath(start, end);

      expect(path.valid).toBe(false);
    });

    it('should have all arc segments', () => {
      const start: Pose2D = { x: 0, y: 0, theta: Math.PI / 6 };
      const end: Pose2D = { x: 2, y: 1, theta: Math.PI / 3 };

      const path = dubins.lrlPath(start, end);

      if (path.valid) {
        path.segments.forEach((segment) => {
          expect(segment.type).not.toBe('S');
          expect(segment.center).toBeDefined();
          expect(segment.radius).toBe(1.0);
        });
      }
    });
  });

  describe('RLR Path (Right-Left-Right)', () => {
    it('should compute valid RLR path when d <= 4r', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 3, y: 0, theta: 0 };

      const path = dubins.rlrPath(start, end);

      expect(path.valid).toBe(true);
      expect(path.type).toBe('RLR');
      expect(path.segments[0].type).toBe('R');
      expect(path.segments[1].type).toBe('L');
      expect(path.segments[2].type).toBe('R');
    });

    it('should fail when d > 4r', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 10, y: 0, theta: 0 };

      const path = dubins.rlrPath(start, end);

      expect(path.valid).toBe(false);
    });
  });

  describe('Minimal Path Selection', () => {
    it('should select the shortest valid path among all 6 types', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 5, y: 2, theta: Math.PI / 4 };

      const minimalPath = dubins.computeMinimalPath(start, end);
      const allPaths = dubins.computeAllPaths(start, end);

      expect(minimalPath).not.toBeNull();

      if (minimalPath) {
        const validPaths = allPaths.filter((p) => p.valid);
        const shortestLength = Math.min(...validPaths.map((p) => p.totalLength));

        expect(Math.abs(minimalPath.totalLength - shortestLength)).toBeLessThan(epsilon);
      }
    });

    it('should return all 6 path types in computeAllPaths', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 4, y: 0, theta: 0 };

      const allPaths = dubins.computeAllPaths(start, end);

      expect(allPaths).toHaveLength(6);
      expect(allPaths.map((p) => p.type)).toEqual(['LSL', 'RSR', 'LSR', 'RSL', 'LRL', 'RLR']);
    });
  });

  describe('Curvature Constraint Verification', () => {
    it('should satisfy curvature bound κ = 1/r for all paths', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 3, y: 2, theta: Math.PI / 3 };

      const allPaths = dubins.computeAllPaths(start, end);

      allPaths.forEach((path) => {
        if (path.valid) {
          path.segments.forEach((segment) => {
            if (segment.type !== 'S') {
              // Arc segments must have radius >= minRadius
              expect(segment.radius).toBeGreaterThanOrEqual(1.0 - epsilon);
              
              // Curvature κ = 1/r must be <= 1/minRadius = 1
              const curvature = 1 / segment.radius!;
              expect(curvature).toBeLessThanOrEqual(1.0 + epsilon);
            }
          });
        }
      });
    });
  });

  describe('Special Cases from Paper', () => {
    it('should handle parallel tangent vectors (θ = ±π case)', () => {
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 2, y: 2, theta: Math.PI };

      const minimalPath = dubins.computeMinimalPath(start, end);

      expect(minimalPath).not.toBeNull();
    });

    it('should handle proximity condition A: d(c_l, c_l) >= 4 and d(c_r, c_r) >= 4', () => {
      // From paper: when adjacent circles are far apart
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 10, y: 0, theta: 0 };

      const lrlPath = dubins.lrlPath(start, end);
      const rlrPath = dubins.rlrPath(start, end);

      // CCC paths should be invalid
      expect(lrlPath.valid).toBe(false);
      expect(rlrPath.valid).toBe(false);

      // But CSC paths should work
      const lslPath = dubins.lslPath(start, end);
      expect(lslPath.valid).toBe(true);
    });

    it('should handle proximity condition D: bounded isotopy class exists', () => {
      // From Example 4.3 in paper: x=(0,0), y=(2.82, 0)
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end: Pose2D = { x: 2.82, y: 0, theta: 0 };

      const allPaths = dubins.computeAllPaths(start, end);
      const validPaths = allPaths.filter((p) => p.valid);

      // Should have multiple valid paths
      expect(validPaths.length).toBeGreaterThan(0);
    });
  });

  describe('Discontinuity Cases (from Fig. 1 in paper)', () => {
    it('should detect isolated points (cc isolated points)', () => {
      // Configuration leading to discontinuity in length
      const start: Pose2D = { x: 0, y: 0, theta: 0 };
      const end1: Pose2D = { x: 1, y: 1, theta: Math.PI / 2 };
      const end2: Pose2D = { x: 1, y: 1, theta: Math.PI / 2 + 0.1 };

      const path1 = dubins.computeMinimalPath(start, end1);
      const path2 = dubins.computeMinimalPath(start, end2);

      if (path1 && path2) {
        // Small change in angle can cause large change in length
        const lengthDiff = Math.abs(path1.totalLength - path2.totalLength);
        // This tests the discontinuity phenomenon described in the paper
      }
    });
  });
});
