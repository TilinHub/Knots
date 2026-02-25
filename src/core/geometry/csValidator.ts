/**
 * A specialized file containing utility functions to rigorously check
 * the mathematical constraints of a CS Diagram as per the protocol.
 */

import type { Point2D } from '../types/cs';
import type { CSDiagramState } from './csProtocol';

const TOL_MET = 1e-4; // metric tolerance
const TOL_LIN = 1e-4; // linear algebraic tolerance
const TOL_GEO = 1e-4; // geometry intersection tolerance

// Vector operations
const vecSub = (p1: Point2D, p2: Point2D): Point2D => ({ x: p1.x - p2.x, y: p1.y - p2.y });
const vecDot = (v1: Point2D, v2: Point2D): number => v1.x * v2.x + v1.y * v2.y;
const vecNorm = (v: Point2D): number => Math.sqrt(v.x * v.x + v.y * v.y);

export function validateCSSpaceMatrix(state: CSDiagramState): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. Metric Checks (Immediate verification on inputs)
    // Distance from tangent point to disk center must be 1.
    state.tangencies.forEach((tangency, id) => {
        const disk = state.disks.get(tangency.diskId);
        if (!disk) {
            errors.push(`Tangency ${id} references unknown disk ${tangency.diskId}`);
            return;
        }

        const distToCenter = vecNorm(vecSub(tangency.point, disk.center));
        if (Math.abs(distToCenter - 1.0) > TOL_MET) {
            errors.push(`Tangency ${id} fails ||p_alpha - c_k|| = 1. Value: ${distToCenter}`);
        }
    });

    // Contact distance must be exactly 2
    state.contacts.forEach((contact) => {
        const d1 = state.disks.get(contact.diskId1);
        const d2 = state.disks.get(contact.diskId2);
        if (!d1 || !d2) return;
        const distToCenter = vecNorm(vecSub(d1.center, d2.center));
        if (Math.abs(distToCenter - 2.0) > TOL_MET) {
            errors.push(`Contact between disks ${d1.id} and ${d2.id} fails ||c_i - c_j|| = 2 . Value: ${distToCenter}`);
        }
    });

    // 2. Local Geometry (F1 Check)
    // n_alpha and t_alpha checks
    state.tangencies.forEach((tangency, id) => {
        // Normal should be p_alpha - c_k, we checked norm = 1 above

        // Tangency should be epsilon * J * n_alpha
        const expectedT = {
            x: tangency.epsilon * -tangency.normal.y,
            y: tangency.epsilon * tangency.normal.x
        };

        if (Math.abs(vecDot(tangency.tangent, expectedT) - 1.0) > TOL_LIN) {
            errors.push(`Tangency ${id} local geometry tangent definition fails.`);
        }

        // Explicit orthogonality
        if (Math.abs(vecDot(tangency.tangent, tangency.normal)) > TOL_LIN) {
            errors.push(`Tangency ${id} is not orthogonal to its normal.`);
        }
    });

    // 3. (C0) Combinatorial Cycle Check
    const outgoingCount = new Map<string, number>();
    const incomingCount = new Map<string, number>();

    state.tangencies.forEach((_, id) => {
        outgoingCount.set(id, 0);
        incomingCount.set(id, 0);
    });

    state.segments.forEach((s) => {
        outgoingCount.set(s.startTangencyId, (outgoingCount.get(s.startTangencyId) || 0) + 1);
        incomingCount.set(s.endTangencyId, (incomingCount.get(s.endTangencyId) || 0) + 1);
    });

    state.arcs.forEach((a) => {
        outgoingCount.set(a.startTangencyId, (outgoingCount.get(a.startTangencyId) || 0) + 1);
        incomingCount.set(a.endTangencyId, (incomingCount.get(a.endTangencyId) || 0) + 1);
    });

    state.tangencies.forEach((_, id) => {
        if (outgoingCount.get(id) !== 1) {
            errors.push(`[C0] Tangency ${id} has ${outgoingCount.get(id)} outgoing pieces. Must be exactly 1.`);
        }
        if (incomingCount.get(id) !== 1) {
            errors.push(`[C0] Tangency ${id} has ${incomingCount.get(id)} incoming pieces. Must be exactly 1.`);
        }
    });


    // 4. (S1) Segment Tangency
    state.segments.forEach((s) => {
        const alpha = state.tangencies.get(s.startTangencyId);
        const beta = state.tangencies.get(s.endTangencyId);
        if (!alpha || !beta) return;

        const vs = vecSub(beta.point, alpha.point);
        const normVs = vecNorm(vs);
        if (normVs < 1e-9) return;

        // Vector vs must be orthogonal to normals n_alpha, n_beta
        if (Math.abs(vecDot(vs, alpha.normal)) > TOL_GEO) {
            errors.push(`[S1] Segment ${s.id} is not tangent at start point.`);
        }

        if (Math.abs(vecDot(vs, beta.normal)) > TOL_GEO) {
            errors.push(`[S1] Segment ${s.id} is not tangent at end point.`);
        }
    });


    return {
        valid: errors.length === 0,
        errors
    };
}
