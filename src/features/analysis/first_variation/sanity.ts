/**
 * First Variation Protocol - Sanity Check
 * Section 2.20 "Mini ejemplo de sanidad"
 * Implements a "Stadium" curve around two touching disks.
 */

import { checkAndComputeTangents, checkArcs,checkCombinatorial, checkImmediateMetrics, checkSegments } from './checks';
import { evaluateQuadratic,testCriticality } from './criticality';
import { assembleFunctional, reduceFunctional } from './functional';
import { constructGaugeBasis } from './gauge';
import { Matrix } from './linearAlgebra';
import { constructA, constructL, constructTc, getRoll } from './matrices';
import type { CSDiagram, Tolerances } from './types';

function runSanityCheck() {
    console.log("=== RUNNING SANITY CHECK (Stadium Example) ===");

    const tol: Tolerances = {
        met: 1e-6,
        geo: 1e-6,
        lin: 1e-8
    };

    // Construct Stadium
    // D1 at (-1, 0), D2 at (1, 0). Touching at (0, 0).
    const diagram: CSDiagram = {
        tolerances: tol,
        disks: [
            { index: 0, center: { x: -1, y: 0 } },
            { index: 1, center: { x: 1, y: 0 } }
        ],
        contacts: [
            { diskA: 0, diskB: 1 }
        ],
        // Tangencies: alpha, beta, gamma, delta
        // alpha: D1 (-1, -1) -> Starts bottom seg
        // beta: D2 (1, -1) -> Ends bottom seg
        // gamma: D2 (1, 1) -> Starts top seg (Wait, direction?)
        // Let's trace CCW: alpha -> beta -> gamma -> delta -> alpha
        // Seg alpha->beta (Bottom L->R)
        // Arc beta->gamma (D2 Right side)
        // Seg gamma->delta (Top R->L)
        // Arc delta->alpha (D1 Left side)
        tangencies: [
            { id: 'alpha', diskIndex: 0, point: { x: -1, y: -1 } },
            { id: 'beta', diskIndex: 1, point: { x: 1, y: -1 } },
            { id: 'gamma', diskIndex: 1, point: { x: 1, y: 1 } },
            { id: 'delta', diskIndex: 0, point: { x: -1, y: 1 } }
        ],
        segments: [
            { startTangencyId: 'alpha', endTangencyId: 'beta' },
            { startTangencyId: 'gamma', endTangencyId: 'delta' }
        ],
        arcs: [
            { startTangencyId: 'beta', endTangencyId: 'gamma', diskIndex: 1, deltaTheta: Math.PI },
            { startTangencyId: 'delta', endTangencyId: 'alpha', diskIndex: 0, deltaTheta: Math.PI }
        ]
    };

    console.log("1. Checks Geometricos...");
    const metric = checkImmediateMetrics(diagram);
    if (metric.some(r => !r.passed)) {
        console.error("Metric checks failed:", metric.filter(r => !r.passed));
        return;
    }

    const tangentRes = checkAndComputeTangents(diagram);
    if (tangentRes.results.some(r => !r.passed)) {
        console.error("Tangent checks failed:", tangentRes.results.filter(r => !r.passed));
        return;
    }

    const comb = checkCombinatorial(diagram);
    if (!comb.passed) {
        console.error("Combinatorial failed:", comb);
        return;
    }

    const segRes = checkSegments(diagram);
    if (segRes.some(r => !r.passed)) {
        console.error("Segment checks failed:", segRes.filter(r => !r.passed));
        return;
    }

    const arcRes = checkArcs(diagram);
    if (arcRes.some(r => !r.passed)) {
        console.error("Arc checks failed:", arcRes.filter(r => !r.passed));
        return;
    }
    console.log("   -> All Checks PASSED");

    console.log("2. Matrix Construction...");
    const A = constructA(diagram);
    const Tc = constructTc(diagram, tangentRes.tangents);
    const L = constructL(diagram, A, Tc);

    console.log(`   A dims: ${A.rows}x${A.cols}`);
    console.log(`   Tc dims: ${Tc.rows}x${Tc.cols}`);
    console.log(`   L dims: ${L.rows}x${L.cols}`);

    console.log("3. Functional Assembly...");
    const { gc, gw } = assembleFunctional(diagram, tangentRes.tangents);
    console.log(`   gc norm: ${gc.norm()}`);
    console.log(`   gw norm: ${gw.norm()}`);

    console.log("4. Reduction...");
    const gred = reduceFunctional(gc, gw, Tc);
    console.log(`   gred norm: ${gred.norm()}`);

    console.log("5. Gauge Fixing...");
    const U_roll = getRoll(diagram); // Nullspace of A
    console.log(`   Roll(c) dim: ${U_roll.cols}`);

    const gauge = constructGaugeBasis(diagram, U_roll);
    console.log("   Gauge Checks:");
    console.log(`   ||A U|| = ${gauge.checks.AUc}`);
    console.log(`   ||UtU - I|| = ${gauge.checks.UtU_I}`);
    console.log(`   ||WtW - I|| = ${gauge.checks.WtW_I}`);
    console.log(`   ||Ug^T W|| = ${gauge.checks.UgtW}`);

    console.log("6. Criticality Test...");
    const crit = testCriticality(gred, gauge, diagram);
    console.log(`   Result: ${crit.message}`);
    console.log(`   ||r||: ${crit.normR}`);
    console.log(`   Ratio: ${crit.ratio}`);

    // Optional
    console.log("7. Quadratic Test...");
    // Evaluate on random direction in Ug
    const z = Matrix.zeros(gauge.Ug.cols, 1);
    if (z.rows > 0) {
        z.set(0, 0, 1.0); // Perturb in first gauge direction
        const Qval = evaluateQuadratic(diagram, gauge, z);
        console.log(`   Q_red(z=e1) = ${Qval}`);
    } else {
        console.log("   No gauge degrees of freedom.");
    }
}

runSanityCheck();
