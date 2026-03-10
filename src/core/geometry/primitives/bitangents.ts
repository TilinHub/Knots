/**
 * bitangents.ts — Shared bitangent geometry primitives.
 *
 * Single source of truth for all bitangent computations.
 * Both contactGraph.ts and ElasticEnvelope.ts import from here.
 */

import type { Point2D } from '../../types/cs';
import type { TangentType } from '../envelope/contactGraph';

export interface DiskLike {
    id: string;
    center: Point2D;
    radius: number;
}

export interface BitangentSegment {
    type: TangentType;
    start: Point2D;
    end: Point2D;
    length: number;
    startDiskId: string;
    endDiskId: string;
}

/** Helper to get point on circle */
const pOnC = (c: Point2D, r: number, angle: number): Point2D => ({
    x: c.x + r * Math.cos(angle),
    y: c.y + r * Math.sin(angle),
});

/**
 * Computes all 4 bitangent segments between two disks.
 * Used by: contactGraph (graph building), ElasticEnvelope (reconstruction).
 */
export function calculateAllBitangents(d1: DiskLike, d2: DiskLike): BitangentSegment[] {
    const segments: BitangentSegment[] = [];
    const dx = d2.center.x - d1.center.x;
    const dy = d2.center.y - d1.center.y;
    const D = Math.sqrt(dx * dx + dy * dy);
    const phi = Math.atan2(dy, dx);

    if (D < 1e-9) return []; // Coincident centers

    const EPSILON = 1e-4;

    // 1. Outer Tangents (LSL, RSR)
    if (D >= Math.abs(d1.radius - d2.radius) - EPSILON) {
        const val = (d1.radius - d2.radius) / D;
        const clampedVal = Math.max(-1, Math.min(1, val));
        const gamma = Math.acos(clampedVal);

        if (!isNaN(gamma)) {
            // RSR: Top Tangent (alpha = phi + gamma)
            const alphaRSR = phi + gamma;
            const p1RSR = pOnC(d1.center, d1.radius, alphaRSR);
            const p2RSR = pOnC(d2.center, d2.radius, alphaRSR);
            segments.push({
                type: 'RSR',
                start: p1RSR,
                end: p2RSR,
                length: Math.sqrt((p2RSR.x - p1RSR.x) ** 2 + (p2RSR.y - p1RSR.y) ** 2),
                startDiskId: d1.id,
                endDiskId: d2.id,
            });

            // LSL: Bottom Tangent (alpha = phi - gamma)
            const alphaLSL = phi - gamma;
            const p1LSL = pOnC(d1.center, d1.radius, alphaLSL);
            const p2LSL = pOnC(d2.center, d2.radius, alphaLSL);
            segments.push({
                type: 'LSL',
                start: p1LSL,
                end: p2LSL,
                length: Math.sqrt((p2LSL.x - p1LSL.x) ** 2 + (p2LSL.y - p1LSL.y) ** 2),
                startDiskId: d1.id,
                endDiskId: d2.id,
            });
        }
    }

    // 2. Inner Tangents (LSR, RSL)
    if (D > 1e-9) {
        const val = (d1.radius + d2.radius) / D;
        const clampedVal = Math.max(-1, Math.min(1, val));
        const beta = Math.acos(clampedVal); // Safe acos

        if (!isNaN(beta)) {
            // LSR (Bottom Start -> Top End)
            const alpha1LSR = phi - beta;
            const alpha2LSR = phi - beta + Math.PI;
            const p1LSR = pOnC(d1.center, d1.radius, alpha1LSR);
            const p2LSR = pOnC(d2.center, d2.radius, alpha2LSR);
            segments.push({
                type: 'LSR',
                start: p1LSR,
                end: p2LSR,
                length: Math.sqrt((p2LSR.x - p1LSR.x) ** 2 + (p2LSR.y - p1LSR.y) ** 2),
                startDiskId: d1.id,
                endDiskId: d2.id,
            });

            // RSL (Top Start -> Bottom End)
            const alpha1RSL = phi + beta;
            const alpha2RSL = phi + beta + Math.PI;
            const p1RSL = pOnC(d1.center, d1.radius, alpha1RSL);
            const p2RSL = pOnC(d2.center, d2.radius, alpha2RSL);
            segments.push({
                type: 'RSL',
                start: p1RSL,
                end: p2RSL,
                length: Math.sqrt((p2RSL.x - p1RSL.x) ** 2 + (p2RSL.y - p1RSL.y) ** 2),
                startDiskId: d1.id,
                endDiskId: d2.id,
            });
        }
    }

    return segments;
}

/**
 * Computes a single specific bitangent type between two disks.
 * Returns null if geometry is degenerate or type is impossible.
 */
export function calculateBitangent(
    d1: DiskLike,
    d2: DiskLike,
    type: TangentType
): BitangentSegment | null {
    const dx = d2.center.x - d1.center.x;
    const dy = d2.center.y - d1.center.y;
    const D = Math.sqrt(dx * dx + dy * dy);
    const phi = Math.atan2(dy, dx);

    if (D < 1e-9) return null; // Coincident centers

    const EPSILON = 1e-4;

    if (type === 'LSL' || type === 'RSR') {
        // Outer tangents
        if (D < Math.abs(d1.radius - d2.radius) - EPSILON) return null;

        const val = (d1.radius - d2.radius) / D;
        const gamma = Math.acos(Math.max(-1, Math.min(1, val)));
        if (isNaN(gamma)) return null;

        const alpha = type === 'RSR' ? phi + gamma : phi - gamma;
        const p1 = pOnC(d1.center, d1.radius, alpha);
        const p2 = pOnC(d2.center, d2.radius, alpha);

        return {
            type,
            start: p1,
            end: p2,
            length: Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2),
            startDiskId: d1.id,
            endDiskId: d2.id,
        };
    } else if (type === 'LSR' || type === 'RSL') {
        // Inner tangents
        if (D < 1e-9) return null; // Coincident centers

        const val = (d1.radius + d2.radius) / D;
        const beta = Math.acos(Math.max(-1, Math.min(1, val))); // Safe acos even if overlapping
        if (isNaN(beta)) return null;

        let alpha1: number, alpha2: number;
        if (type === 'LSR') {
            alpha1 = phi - beta;
            alpha2 = phi - beta + Math.PI;
        } else {
            // RSL
            alpha1 = phi + beta;
            alpha2 = phi + beta + Math.PI;
        }

        const p1 = pOnC(d1.center, d1.radius, alpha1);
        const p2 = pOnC(d2.center, d2.radius, alpha2);

        return {
            type,
            start: p1,
            end: p2,
            length: Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2),
            startDiskId: d1.id,
            endDiskId: d2.id,
        };
    }

    return null; // For PTD/DTP types
}
