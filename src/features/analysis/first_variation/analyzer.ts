import type { CSDiagram } from './types';
import type { CheckResult } from './checks';
import type { CriticalityResult } from './criticality';
import {
    checkImmediateMetrics, checkCombinatorial, checkSegments, checkArcs, checkAndComputeTangents, checkGlobalIntersections
} from './checks';
import { constructA, constructTc, constructL, constructTw, getRoll } from './matrices';
import { assembleFunctional, reduceFunctional } from './functional';
import { constructGaugeBasis } from './gauge';
import { testCriticality, evaluateQuadratic } from './criticality';
import { rank } from './linearAlgebra';

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
        A: { dims: string; rank: number };
        Tc: { dims: string; rank: number };
        Tw: { dims: string; rank: number };
        L: { dims: string; rank: number };
    };
    vectors: {
        gc: { dims: string; norm: number };
        gw: { dims: string; norm: number };
        gred: { dims: string; norm: number };
    };
    gauge: {
        dims: { U: string; V_Roll: string; W: string; Ug: string };
        checks: {
            AUc: number;
            UtU_I: number;
            WtW_I: number;
            UgtW: number;
        };
    };
    criticality: CriticalityResult | null;
    quadratic?: number;
    error?: string;
}

export function analyzeDiagram(diagram: CSDiagram): AnalysisReport {
    try {
        // 0. Validate Diagram Structure
        if (!diagram) throw new Error("Diagram is undefined");
        if (!diagram.disks) throw new Error("Diagram.disks is undefined");
        if (!diagram.tangencies) throw new Error("Diagram.tangencies is undefined");
        if (!diagram.segments) throw new Error("Diagram.segments is undefined");
        if (!diagram.arcs) throw new Error("Diagram.arcs is undefined");

        // 1. Checks
        let metrics: CheckResult[] = [];
        try {
            metrics = checkImmediateMetrics(diagram);
        } catch (e: any) {
            console.error("Metrics Check Failed", e);
            throw new Error(`Metrics Check Failed: ${e.message}`);
        }

        let tangentRes: { tangents: any, results: CheckResult[] };
        try {
            tangentRes = checkAndComputeTangents(diagram);
        } catch (e: any) {
            console.error("Tangents Check Failed", e);
            throw new Error(`Tangents Check Failed: ${e.message}`);
        }

        let combinatorial: CheckResult;
        try {
            combinatorial = checkCombinatorial(diagram);
        } catch (e: any) {
            console.error("Combinatorial Check Failed", e);
            throw new Error(`Combinatorial Check Failed: ${e.message}`);
        }

        let segmentChecks: CheckResult[];
        try {
            segmentChecks = checkSegments(diagram);
        } catch (e: any) {
            console.error("Segment Checks Failed", e);
            throw new Error(`Segment Checks Failed: ${e.message}`);
        }

        let arcChecks: CheckResult[];
        try {
            arcChecks = checkArcs(diagram);
        } catch (e: any) {
            console.error("Arc Checks Failed", e);
            throw new Error(`Arc Checks Failed: ${e.message}`);
        }

        let globalChecks: CheckResult[];
        try {
            globalChecks = checkGlobalIntersections(diagram);
        } catch (e: any) {
            console.error("Global Checks Failed", e);
            throw new Error(`Global Checks Failed: ${e.message}`);
        }

        // Aggregate geometric checks
        const allMetrics = [
            ...metrics,
            ...tangentRes.results,
            ...segmentChecks,
            ...arcChecks
        ];

        if (!combinatorial.passed) {
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
                    A: { dims: '-', rank: 0 },
                    Tc: { dims: '-', rank: 0 },
                    Tw: { dims: '-', rank: 0 },
                    L: { dims: '-', rank: 0 }
                },
                vectors: {
                    gc: { dims: '-', norm: 0 },
                    gw: { dims: '-', norm: 0 },
                    gred: { dims: '-', norm: 0 }
                },
                gauge: {
                    dims: { U: '-', V_Roll: '-', W: '-', Ug: '-' },
                    checks: { AUc: 0, UtU_I: 0, WtW_I: 0, UgtW: 0 }
                },
                criticality: null,
                error: "Combinatorial check failed (Graph is not a single cycle)"
            };
        }

        // Check for HARD failures (tolerance exceeded)
        const hardFail = allMetrics.some(m => !m.passed);
        if (hardFail) {
            // Even if hard checks fail, we might want to see partial matrices if possible?
            // But usually analysis stops.
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
                    A: { dims: '-', rank: 0 },
                    Tc: { dims: '-', rank: 0 },
                    Tw: { dims: '-', rank: 0 },
                    L: { dims: '-', rank: 0 }
                },
                vectors: {
                    gc: { dims: '-', norm: 0 },
                    gw: { dims: '-', norm: 0 },
                    gred: { dims: '-', norm: 0 }
                },
                gauge: {
                    dims: { U: '-', V_Roll: '-', W: '-', Ug: '-' },
                    checks: { AUc: 0, UtU_I: 0, WtW_I: 0, UgtW: 0 }
                },
                criticality: null,
                error: "Geometric checks failed. Cannot proceed to Criticality."
            };
        }

        // 2. Linear Algebra
        let A, Tc, Tw, L;
        let rankA, rankTc, rankTw, rankL;

        try {
            A = constructA(diagram);
            Tc = constructTc(diagram, tangentRes.tangents);
            Tw = constructTw(diagram);
            L = constructL(diagram, A, Tc);

            // Ranks
            rankA = rank(A, diagram.tolerances.lin);
            rankTc = rank(Tc, diagram.tolerances.lin);
            rankTw = rank(Tw, diagram.tolerances.lin);
            rankL = rank(L, diagram.tolerances.lin);
        } catch (e: any) {
            console.error("Matrix Construction Failed", e);
            throw new Error(`Matrix Construction Failed: ${e.message}`);
        }

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
                A: { dims: `${A.rows}x${A.cols}`, rank: rankA },
                Tc: { dims: `${Tc.rows}x${Tc.cols}`, rank: rankTc },
                Tw: { dims: `${Tw.rows}x${Tw.cols}`, rank: rankTw },
                L: { dims: `${L.rows}x${L.cols}`, rank: rankL }
            },
            vectors: {
                gc: { dims: `${gc.rows}x${gc.cols}`, norm: gc.norm() },
                gw: { dims: `${gw.rows}x${gw.cols}`, norm: gw.norm() },
                gred: { dims: `${gred.rows}x${gred.cols}`, norm: gred.norm() }
            },
            gauge: {
                dims: {
                    U: `${gauge.U.rows}x${gauge.U.cols}`,
                    V_Roll: `${gauge.V_Roll.rows}x${gauge.V_Roll.cols}`,
                    W: `${gauge.W.rows}x${gauge.W.cols}`,
                    Ug: `${gauge.Ug.rows}x${gauge.Ug.cols}`
                },
                checks: gauge.checks
            },
            criticality: crit,
            quadratic: qVal
        };

    } catch (e: any) {
        console.error("Analysis Exception:", e);
        return {
            counts: { N: 0, E: 0, T: 0, S: 0, A: 0 },
            metrics: [],
            combinatorial: { passed: false, value: 0, message: `Exception: ${e.message}` },
            global: [],
            matrices: {
                A: { dims: '-', rank: 0 },
                Tc: { dims: '-', rank: 0 },
                Tw: { dims: '-', rank: 0 },
                L: { dims: '-', rank: 0 }
            },
            vectors: {
                gc: { dims: '-', norm: 0 },
                gw: { dims: '-', norm: 0 },
                gred: { dims: '-', norm: 0 }
            },
            gauge: {
                dims: { U: '-', V_Roll: '-', W: '-', Ug: '-' },
                checks: { AUc: 0, UtU_I: 0, WtW_I: 0, UgtW: 0 }
            },
            criticality: null,
            error: e.message
        };
    }
}
