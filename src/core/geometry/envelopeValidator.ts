/**
 * Envelope Geometric Validator
 * 
 * Standalone validation module for envelope paths.
 * Detects self-intersections and disk penetrations.
 * 
 * Usage (browser console):
 *   import { runEnvelopeValidation } from './envelopeValidator';
 *   runEnvelopeValidation(path, disks);
 * 
 * Regression suite:
 *   import { runRegressionSuite } from './envelopeValidator';
 *   runRegressionSuite();
 */

import type { ContactDisk } from '../types/contactGraph';
import type { Point2D } from '../types/cs';
import type { ArcSegment,EnvelopeSegment, TangentSegment } from './contactGraph';
import { computeOuterContour } from './outerFace';

// ── Segment-Segment intersection (strict interior, no endpoints) ──

function segmentsIntersect(
    a1: Point2D, a2: Point2D,
    b1: Point2D, b2: Point2D
): boolean {
    const d1x = a2.x - a1.x, d1y = a2.y - a1.y;
    const d2x = b2.x - b1.x, d2y = b2.y - b1.y;
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return false; // parallel

    const dx = b1.x - a1.x, dy = b1.y - a1.y;
    const t = (dx * d2y - dy * d2x) / cross;
    const u = (dx * d1y - dy * d1x) / cross;

    // Strict interior: exclude endpoints with epsilon
    const eps = 0.005;
    return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
}

// ── Sample points along a segment (for disk-penetration check) ──

function sampleTangent(seg: TangentSegment, count: number): Point2D[] {
    const pts: Point2D[] = [];
    for (let i = 0; i <= count; i++) {
        const t = i / count;
        pts.push({
            x: seg.start.x + t * (seg.end.x - seg.start.x),
            y: seg.start.y + t * (seg.end.y - seg.start.y)
        });
    }
    return pts;
}

function sampleArc(seg: ArcSegment, count: number): Point2D[] {
    const pts: Point2D[] = [];
    const PI2 = 2 * Math.PI;
    let delta = seg.endAngle - seg.startAngle;

    if (seg.chirality === 'L') {
        // CCW: delta should be positive
        while (delta <= 0) delta += PI2;
    } else {
        // CW: delta should be negative
        while (delta >= 0) delta -= PI2;
    }

    for (let i = 0; i <= count; i++) {
        const t = i / count;
        const angle = seg.startAngle + t * delta;
        pts.push({
            x: seg.center.x + seg.radius * Math.cos(angle),
            y: seg.center.y + seg.radius * Math.sin(angle)
        });
    }
    return pts;
}

// ── Convert any segment to polyline for robust intersection testing ──

function segmentToPolyline(seg: EnvelopeSegment, samplesPerSegment: number = 20): Point2D[] {
    if (seg.type === 'ARC') {
        return sampleArc(seg as ArcSegment, samplesPerSegment);
    }
    return sampleTangent(seg as TangentSegment, samplesPerSegment);
}

// ── Public API ──

export interface ValidationResult {
    valid: boolean;
    selfIntersections: number;
    diskPenetrations: number;
    issues: string[];
}

/**
 * Validates that no two segments in the path cross each other.
 * Uses polyline sampling to handle arc-arc and arc-tangent crossings,
 * not just tangent-tangent.
 */
export function validateNoSelfIntersection(
    path: EnvelopeSegment[],
    samplesPerSegment: number = 30
): { count: number; issues: string[] } {
    // Convert each segment to a polyline
    const polylines: Point2D[][] = path.map(seg => segmentToPolyline(seg, samplesPerSegment));

    let count = 0;
    const issues: string[] = [];

    for (let i = 0; i < polylines.length; i++) {
        for (let j = i + 2; j < polylines.length; j++) { // skip adjacent
            const polyA = polylines[i];
            const polyB = polylines[j];

            let found = false;
            for (let a = 0; a < polyA.length - 1 && !found; a++) {
                for (let b = 0; b < polyB.length - 1 && !found; b++) {
                    if (segmentsIntersect(polyA[a], polyA[a + 1], polyB[b], polyB[b + 1])) {
                        count++;
                        issues.push(
                            `Segment #${i} crosses Segment #${j} ` +
                            `(sub-segments ${a} and ${b})`
                        );
                        found = true; // one report per pair
                    }
                }
            }
        }
    }

    return { count, issues };
}

/**
 * Validates that all sampled points on the path stay outside every disk
 * (distance to center >= radius - epsilon).
 */
export function validateCurveOutsideDisks(
    path: EnvelopeSegment[],
    disks: ContactDisk[],
    samplesPerSegment: number = 20,
    epsilon: number = 0.5
): { count: number; issues: string[] } {
    let count = 0;
    const issues: string[] = [];

    path.forEach((seg, idx) => {
        const points = seg.type === 'ARC'
            ? sampleArc(seg as ArcSegment, samplesPerSegment)
            : sampleTangent(seg as TangentSegment, samplesPerSegment);

        for (const pt of points) {
            for (const disk of disks) {
                // Skip the disk this segment belongs to (arcs are ON the disk)
                if (seg.type === 'ARC' && (seg as ArcSegment).diskId === disk.id) continue;
                // Skip endpoint disks for tangent segments (they touch the boundary)
                if (seg.type !== 'ARC') {
                    const ts = seg as TangentSegment;
                    if (ts.startDiskId === disk.id || ts.endDiskId === disk.id) continue;
                }

                const dist = Math.sqrt(
                    (pt.x - disk.center.x) ** 2 + (pt.y - disk.center.y) ** 2
                );
                if (dist < disk.radius - epsilon) {
                    count++;
                    issues.push(
                        `Seg #${idx} penetrates disk ${disk.id} ` +
                        `(dist=${dist.toFixed(2)}, radius=${disk.radius.toFixed(2)})`
                    );
                    return; // one report per segment is enough
                }
            }
        }
    });

    return { count, issues };
}

/**
 * Validates that computeOuterContour is deterministic:
 * same input produces the exact same output.
 */
export function validateDeterminism(
    disks: ContactDisk[],
    runs: number = 5
): { deterministic: boolean; issues: string[] } {
    const results: string[] = [];
    for (let i = 0; i < runs; i++) {
        const path = computeOuterContour(disks);
        results.push(JSON.stringify(path));
    }

    const allSame = results.every(r => r === results[0]);
    return {
        deterministic: allSame,
        issues: allSame ? [] : ['computeOuterContour produced different results on identical inputs']
    };
}

/**
 * Combined validation.
 */
export function runEnvelopeValidation(
    path: EnvelopeSegment[],
    disks: ContactDisk[]
): ValidationResult {
    const selfCheck = validateNoSelfIntersection(path);
    const diskCheck = validateCurveOutsideDisks(path, disks);

    const valid = selfCheck.count === 0 && diskCheck.count === 0;
    const issues = [...selfCheck.issues, ...diskCheck.issues];

    if (valid) {
        console.log('%c✓ Envelope validation PASSED', 'color: green; font-weight: bold');
    } else {
        console.warn(
            `%c✗ Envelope validation FAILED: ${selfCheck.count} self-intersections, ${diskCheck.count} disk penetrations`,
            'color: red; font-weight: bold'
        );
        issues.forEach(i => console.warn(`  · ${i}`));
    }

    return {
        valid,
        selfIntersections: selfCheck.count,
        diskPenetrations: diskCheck.count,
        issues
    };
}

// ══════════════════════════════════════════════════════════════════
// REGRESSION SUITE
// ══════════════════════════════════════════════════════════════════

/**
 * 4-disk regression fixture: diamond arrangement where disks are touching.
 * This is the configuration that caused crossings with the old algorithm.
 * Disk radius = 50, arranged in a diamond pattern.
 */
const FIXTURE_4_DISK_DIAMOND: ContactDisk[] = [
    { id: 'd0', center: { x: 0, y: 100 }, radius: 50, regionId: 'r', color: 'blue' },
    { id: 'd1', center: { x: 100, y: 0 }, radius: 50, regionId: 'r', color: 'blue' },
    { id: 'd2', center: { x: 0, y: -100 }, radius: 50, regionId: 'r', color: 'blue' },
    { id: 'd3', center: { x: -100, y: 0 }, radius: 50, regionId: 'r', color: 'blue' },
];

/**
 * 4-disk tight cluster: disks overlapping in a square arrangement.
 */
const FIXTURE_4_DISK_TIGHT: ContactDisk[] = [
    { id: 'd0', center: { x: -30, y: 30 }, radius: 50, regionId: 'r', color: 'blue' },
    { id: 'd1', center: { x: 30, y: 30 }, radius: 50, regionId: 'r', color: 'blue' },
    { id: 'd2', center: { x: 30, y: -30 }, radius: 50, regionId: 'r', color: 'blue' },
    { id: 'd3', center: { x: -30, y: -30 }, radius: 50, regionId: 'r', color: 'blue' },
];

/**
 * Seeded pseudo-random number generator (Mulberry32).
 */
function mulberry32(seed: number): () => number {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/**
 * Generate a random disk layout.
 */
function generateRandomLayout(
    rng: () => number,
    numDisks: number,
    spread: number = 200,
    minRadius: number = 20,
    maxRadius: number = 60
): ContactDisk[] {
    const disks: ContactDisk[] = [];
    for (let i = 0; i < numDisks; i++) {
        disks.push({
            id: `rand_${i}`,
            center: {
                x: (rng() - 0.5) * spread * 2,
                y: (rng() - 0.5) * spread * 2
            },
            radius: minRadius + rng() * (maxRadius - minRadius),
            regionId: 'r',
            color: 'blue'
        });
    }
    return disks;
}

/**
 * Run the full regression suite.
 * Tests:
 *   1. 4-disk diamond fixture
 *   2. 4-disk tight cluster fixture
 *   3. 100 seeded random layouts (4-8 disks, seed 42)
 *   4. Determinism checks
 * 
 * Usage (browser console):
 *   import { runRegressionSuite } from './envelopeValidator';
 *   runRegressionSuite();
 */
export function runRegressionSuite(): {
    passed: boolean;
    total: number;
    failures: { name: string; issues: string[] }[];
} {
    const failures: { name: string; issues: string[] }[] = [];
    let total = 0;

    function testLayout(name: string, disks: ContactDisk[]) {
        total++;
        const path = computeOuterContour(disks);
        const result = runEnvelopeValidation(path, disks);
        if (!result.valid) {
            failures.push({ name, issues: result.issues });
        }
    }

    function testDeterminism(name: string, disks: ContactDisk[]) {
        total++;
        const det = validateDeterminism(disks);
        if (!det.deterministic) {
            failures.push({ name: `${name} (determinism)`, issues: det.issues });
        }
    }

    // Fixed fixtures
    testLayout('4-disk diamond', FIXTURE_4_DISK_DIAMOND);
    testDeterminism('4-disk diamond', FIXTURE_4_DISK_DIAMOND);
    testLayout('4-disk tight cluster', FIXTURE_4_DISK_TIGHT);
    testDeterminism('4-disk tight cluster', FIXTURE_4_DISK_TIGHT);

    // Regression: Disjoint disks with large interior disk
    // This case previously caused the hull to penetrate the center disk.
    const FIXTURE_DISJOINT_WITH_LARGE_INNER: ContactDisk[] = [
        { id: 'left', center: { x: -100, y: 0 }, radius: 20, regionId: 'r', color: 'blue' },
        { id: 'right', center: { x: 100, y: 0 }, radius: 20, regionId: 'r', color: 'blue' },
        { id: 'center', center: { x: 0, y: 0 }, radius: 50, regionId: 'r', color: 'red' },
    ];
    testLayout('Disjoint + Large Inner', FIXTURE_DISJOINT_WITH_LARGE_INNER);
    testDeterminism('Disjoint + Large Inner', FIXTURE_DISJOINT_WITH_LARGE_INNER);

    // Seeded random layouts
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
        const numDisks = 4 + Math.floor(rng() * 5); // 4-8 disks
        const disks = generateRandomLayout(rng, numDisks);
        testLayout(`random_seed42_#${i} (${numDisks} disks)`, disks);
    }

    const passed = failures.length === 0;

    if (passed) {
        console.log(
            `%c✓ Regression suite PASSED: ${total}/${total} tests`,
            'color: green; font-weight: bold; font-size: 14px'
        );
    } else {
        console.error(
            `%c✗ Regression suite FAILED: ${failures.length}/${total} tests failed`,
            'color: red; font-weight: bold; font-size: 14px'
        );
        failures.forEach(f => {
            console.error(`  ✗ ${f.name}`);
            f.issues.forEach(issue => console.error(`    · ${issue}`));
        });
    }

    return { passed, total, failures };
}
