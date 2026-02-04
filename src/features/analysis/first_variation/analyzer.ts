/**
 * Analyzer Facade
 * Runs the full First Variation Protocol pipeline and returns a report.
 */

import type { CSDiagram } from './types';
import type { CheckResult } from './checks';
import type { CriticalityResult } from './criticality';
import {
    checkImmediateMetrics, checkCombinatorial, checkSegments, checkArcs, checkAndComputeTangents, checkGlobalIntersections
} from './checks';
import { constructA, constructTc, constructL, getRoll } from './matrices';
import { assembleFunctional, reduceFunctional } from './functional';
import { constructGaugeBasis } from './gauge';
import { testCriticality, evaluateQuadratic } from './criticality';

export interface AnalysisReport {
    counts: {
        N: number;
        E: number;
        T: number;
        S: number;
        A: number;
    };
    metrics: CheckResult[];
    combinatorial: CheckResult;
    global: CheckResult[];
    matrices: {
        A_dims: string;
        Tc_dims: string;
        L_dims: string;
    };
    criticality: CriticalityResult | null;
    quadratic?: number;
    error?: string;
}

export function analyzeDiagram(diagram: CSDiagram): AnalysisReport {
    try {
        // 1. Checks
        const metrics = checkImmediateMetrics(diagram);
        const tangentRes = checkAndComputeTangents(diagram);
        const combinatorial = checkCombinatorial(diagram);

        const segmentChecks = checkSegments(diagram);
        const arcChecks = checkArcs(diagram);
        const globalChecks = checkGlobalIntersections(diagram);

        // Aggregate geometric checks
        const allMetrics = [
            ...metrics,
            ...tangentRes.results,
            ...segmentChecks,
            ...arcChecks
        ];

        if (!combinatorial.passed) {
            return {
                counts: { N: 0, E: 0, T: 0, S: 0, A: 0 },
                metrics: allMetrics,
                combinatorial,
                global: globalChecks,
                matrices: { A_dims: '-', Tc_dims: '-', L_dims: '-' },
                criticality: null,
                error: "Combinatorial check failed (Graph is not a single cycle)"
            };
        }

        // If metric checks fail badly, we might want to stop?
        // Let's try to proceed to criticality even if loose checks fail, 
        // but maybe warn? 
        // The Protocol says "Chequeos duros: si alguno falla, la corrida no vale."
        // So strictly we should stop.
        // For UI, let's return null criticality if Hard Checks fail.

        // Check for HARD failures (tolerance exceeded)
        // We can filter `allMetrics` for `!passed`
        const hardFail = allMetrics.some(m => !m.passed);
        if (hardFail) {
            return {
                counts: { N: 0, E: 0, T: 0, S: 0, A: 0 },
                metrics: allMetrics,
                combinatorial,
                global: globalChecks,
                matrices: { A_dims: '-', Tc_dims: '-', L_dims: '-' },
                criticality: null,
                error: "Geometric checks failed. Cannot proceed to Criticality."
            };
        }

        // 2. Linear Algebra
        const A = constructA(diagram);
        const Tc = constructTc(diagram, tangentRes.tangents);
        const L = constructL(diagram, A, Tc); // Strictly construct L per requirement
        // PDF 2.13 Reduccion: g_red = g_c - Tc^T g_w.
        // PDF 2.14 Gauge: U from Roll(c) = ker A.
        // So we need A and Tc.

        // 3. Functional
        const { gc, gw } = assembleFunctional(diagram, tangentRes.tangents);
        const gred = reduceFunctional(gc, gw, Tc);

        // 4. Gauge
        const U_roll = getRoll(diagram);
        const gauge = constructGaugeBasis(diagram, U_roll);

        // 5. Criticality
        const crit = testCriticality(gred, gauge, diagram);

        // Optional Quadratic
        let qVal: number | undefined = undefined;
        if (crit) {
            qVal = evaluateQuadratic(diagram, gauge, crit.r);
        }

        return {
            counts: {
                N: diagram.disks.length,
                E: diagram.contacts.length,
                T: diagram.tangencies.length,
                S: diagram.segments.length,
                A: diagram.arcs.length
            },
            metrics: allMetrics,
            combinatorial,
            global: globalChecks,
            matrices: {
                A_dims: `${A.rows}x${A.cols}`,
                Tc_dims: `${Tc.rows}x${Tc.cols}`,
                L_dims: `${L.rows}x${L.cols}`
            },
            criticality: crit,
            quadratic: qVal
        };

    } catch (e: any) {
        return {
            counts: { N: 0, E: 0, T: 0, S: 0, A: 0 },
            metrics: [],
            combinatorial: { passed: false, value: 0, message: "Exception" },
            global: [],
            matrices: { A_dims: '-', Tc_dims: '-', L_dims: '-' },
            criticality: null,
            error: e.message
        };
    }
}
