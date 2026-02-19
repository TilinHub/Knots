
import { buildBoundedCurvatureGraph, type EnvelopePathResult,findEnvelopePath } from '../../../core/geometry/contactGraph';
import { calculateRollingPosition, findNextCollision } from '../../../core/geometry/rolling';
import type { CSDiagram,CSDisk } from '../../../core/types/cs';

/**
 * Calculates the "Energy" of the configuration, defined as the length of the envelope
 * wrapping the given sequence of disks.
 */
export function calculateEnergy(disks: CSDisk[], sequence: string[]): number {
    // Convert CSDisk to ContactDisk format (geometric radius usually 1)
    const contactDisks = disks.map(d => ({
        id: d.id,
        center: d.center,
        radius: 1, // Start with 1, or use d.radius if geometric
        visualRadius: d.visualRadius,
        regionId: 'temp', // Added to satisfy ContactDisk interface
        color: d.color || 'blue'
    }));

    const graph = buildBoundedCurvatureGraph(contactDisks, true); // Check collisions
    const pathRes = findEnvelopePath(graph, sequence);

    // Sum lengths
    let total = 0;
    for (const seg of pathRes.path) {
        total += seg.length;
    }
    return total;
}

/**
 * Result of a rolling operation
 */
export interface RollingStepResult {
    finalDisks: CSDisk[];
    finalTheta: number;
    stoppedReason: 'collision' | 'minima' | 'max_steps';
    energyDelta: number;
}

/**
 * Rolls a disk to a local perimeter minimum.
 * 
 * @param disks Current state of all disks
 * @param rollingId ID of the disk to roll
 * @param pivotId ID of the disk to pivot around
 * @param direction 1 (CCW) or -1 (CW) - Initial direction preference
 * @param diskSequence The sequence defining the knot (for energy calc)
 */
export function rollDiskToMinimum(
    disks: CSDisk[],
    rollingId: string,
    pivotId: string,
    direction: 1 | -1,
    diskSequence: string[]
): RollingStepResult {
    const rollingIdx = disks.findIndex(d => d.id === rollingId);
    const pivotIdx = disks.findIndex(d => d.id === pivotId);

    if (rollingIdx === -1 || pivotIdx === -1) {
        throw new Error("Disk not found");
    }

    const currentDisks = disks.map(d => ({ ...d })); // Clone
    const pivot = currentDisks[pivotIdx];
    const rolling = currentDisks[rollingIdx];
    const others = currentDisks.filter(d => d.id !== rollingId && d.id !== pivotId);

    // Initial State
    const currentTheta = Math.atan2(rolling.center.y - pivot.center.y, rolling.center.x - pivot.center.x);
    const currentEnergy = calculateEnergy(currentDisks, diskSequence);

    // Find limit in the chosen direction
    const collision = findNextCollision(pivot, rolling, others, currentTheta, direction);

    // Defines the interval [currentTheta, limitTheta]
    // If no collision, we can roll 2PI? Usually there is a collision or we wrap around.
    // For safety, limit to PI.
    let limitTheta = currentTheta + direction * Math.PI;
    if (collision) {
        // If collision is very close, we might be stuck or this is the other contact.
        // findNextCollision handles small epsilons but let's be sure.
        limitTheta = collision.theta;
        // Collision result theta is absolute. 
        // We need to ensure we travel in 'direction' to reach it.
    }

    // "Binary Search" or "Golden Section Search" for minimum on the arc
    // Parameter t in [0, 1] mapping to angle
    const getAngle = (t: number) => {
        // Linear interpolate angles? 
        // Problem: Cyclic angles.
        // It's easier to work with angular displacement.
        const delta = limitTheta - currentTheta;
        // Normalize delta to be consistent with direction
        // If direction is 1, delta should be positive (or handle wrap)
        // Actually findNextCollision return absolute theta.
        // Let's compute displacement `dTheta`
        let dTheta = 0;
        if (direction === 1) {
            dTheta = (limitTheta - currentTheta);
            while (dTheta < 0) dTheta += 2 * Math.PI;
            // If dTheta is huge (e.g. > PI), maybe we picked the long way? 
            // No, findNextCollision usually finds nearest.
        } else {
            dTheta = (currentTheta - limitTheta); // Positive magnitude
            while (dTheta < 0) dTheta += 2 * Math.PI;
            dTheta = -dTheta; // Negative step
        }

        return currentTheta + t * dTheta;
    };

    // Sampling to find minimum
    // Simple approach: Sample 10 points, pick best, refine.
    let bestT = 0;
    let minE = currentEnergy;

    const steps = 20;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const ang = getAngle(t);

        const pos = calculateRollingPosition(pivot, rolling, ang);

        // Update temporary disks
        const tempDisks = currentDisks.map(d => {
            if (d.id === rollingId) return { ...d, center: pos };
            return d;
        });

        const e = calculateEnergy(tempDisks, diskSequence);
        if (e < minE) {
            minE = e;
            bestT = t;
        }
    }

    // Refinement?
    // If bestT is 1, we hit collision.
    // If bestT is 0, we stay.
    // If 0 < bestT < 1, we found a local minimum in between (slack).

    // Move to bestT
    const bestAngle = getAngle(bestT);
    const finalPos = calculateRollingPosition(pivot, rolling, bestAngle);

    currentDisks[rollingIdx].center = finalPos;

    let stoppedReason: 'collision' | 'minima' | 'max_steps' = 'minima';
    if (bestT >= 0.99) stoppedReason = 'collision';

    // If we simply rolled to collision, we are likely not at a "Minima" of energy in the open space,
    // but at a boundary minimum.

    return {
        finalDisks: currentDisks,
        finalTheta: bestAngle,
        stoppedReason,
        energyDelta: minE - currentEnergy
    };
}
