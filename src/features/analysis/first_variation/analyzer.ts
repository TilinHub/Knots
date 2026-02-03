/**
 * Analyzer Facade
 * Runs the full First Variation Protocol pipeline and returns a report.
 */

import type { CSDiagram } from './types';
import type { CheckResult } from './checks';
import type { CriticalityResult } from './criticality';
import {
    checkImmediateMetrics, checkCombinatorial, checkSegments, checkArcs, checkAndComputeTangents
} from './checks';
import { constructA, constructTc, constructL, getRoll } from './matrices';
import { assembleFunctional, reduceFunctional } from './functional';
import { constructGaugeBasis } from './gauge';
import { testCriticality } from './criticality';

export interface AnalysisReport {
    metrics: CheckResult[];
    combinatorial: CheckResult;
    criticality: CriticalityResult | null;
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

        // Aggregate geometric checks
        const allMetrics = [
            ...metrics,
            ...tangentRes.results,
            ...segmentChecks,
            ...arcChecks
        ];

        if (!combinatorial.passed) {
            return {
                metrics: allMetrics,
                combinatorial,
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
                metrics: allMetrics,
                combinatorial,
                criticality: null,
                error: "Geometric checks failed. Cannot proceed to Criticality."
            };
        }

        // 2. Linear Algebra
        const A = constructA(diagram);
        const Tc = constructTc(diagram, tangentRes.tangents);
        // const L = constructL(diagram, A, Tc); // Not strictly needed for criticality if using reduced form? 
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

        return {
            metrics: allMetrics,
            combinatorial,
            criticality: crit
        };

    } catch (e: any) {
        return {
            metrics: [],
            combinatorial: { passed: false, value: 0, message: "Exception" },
            criticality: null,
            error: e.message
        };
    }
}
