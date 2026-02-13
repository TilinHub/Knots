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
import { calculateNormal, J, dot } from './geometry';

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
    instanceData?: {
        disks: { id: number, center: { x: number, y: number } }[];
        contacts: { diskA: number, diskB: number }[];
    };
    pdfReport?: {
        // 1.12 Checklist Data
        c: { id: number, p: { x: number, y: number } }[];
        E: { i: number, j: number, dist: number, valid: boolean }[];
        T: {
            id: string,
            alpha: number,
            k: number,
            p: { x: number, y: number },
            n: { x: number, y: number },
            t: { x: number, y: number },
            epsilon: number,
            validDist: boolean
        }[];
        matrices: {
            A_dims: string, A_rank: number,
            Tc_dims: string, Tc_rank: number,
            Tw_dims: string, Tw_rank: number,
            L_dims: string, L_rank: number
        }; // Detailed values can be accessed via main matrices object if needed, but summary here
        S: { alpha: string, beta: string }[];
        A: { alpha: string, beta: string, k: number, sigma: number }[];
        Phi: {
            gc: number[],
            gw: number[]
        };
        Criticality: {
            isCritical: boolean,
            r_norm: number,
            ratio: number,
            Q_red: number | undefined
        };
    };
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

        // 2. Linear Algebra
        let A, Tc, Tw, L;
        let rankA = 0, rankTc = 0, rankTw = 0, rankL = 0;
        let gc, gw, gred;
        let gauge, crit, qVal;

        // Verify Combinatorial Pass (Single Cycle)
        if (combinatorial.passed) {
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

                // 3. Functional
                const func = assembleFunctional(diagram, tangentRes.tangents);
                gc = func.gc;
                gw = func.gw;
                gred = reduceFunctional(gc, gw, Tc);

                // 4. Gauge
                const U_roll = getRoll(diagram);
                gauge = constructGaugeBasis(diagram, U_roll);

                // 5. Criticality
                crit = testCriticality(gred, gauge, diagram);

                // Optional Quadratic
                if (crit) {
                    qVal = evaluateQuadratic(diagram, gauge, crit.r);
                }

            } catch (e: any) {
                console.error("Matrix/Analysis Construction Failed", e);
                // Continue to return what we have? Or throw?
                // Let's re-throw for now, or return partial
                throw new Error(`Analysis Calculation Failed: ${e.message}`);
            }
        }

        // === Construct PDF Report Data ===
        // Need to calculate epsilon_alpha and sigma_a explicitely

        const pdfReport = combinatorial.passed && A && Tc && Tw && L && gc && gw && crit ? {
            c: diagram.disks.map(d => ({ id: d.index, p: d.center })),
            E: diagram.contacts.map(c => {
                const d1 = diagram.disks[c.diskA];
                const d2 = diagram.disks[c.diskB];
                const d = Math.sqrt(Math.pow(d1.center.x - d2.center.x, 2) + Math.pow(d1.center.y - d2.center.y, 2));
                return { i: c.diskA, j: c.diskB, dist: d, valid: Math.abs(d - 2) < diagram.tolerances.met };
            }),
            T: diagram.tangencies.map((t, i) => {
                const k = t.diskIndex;
                const d = diagram.disks[k];
                const n = { x: t.point.x - d.center.x, y: t.point.y - d.center.y }; // Normal
                // tangent t from map
                const tVec = tangentRes.tangents[t.id];

                // epsilon: t = eps * J * n
                // J(n) = (-ny, nx)
                const Jn = { x: -n.y, y: n.x };
                // epsilon = dot(t, Jn) ? Assuming normalized.
                // t and Jn should be approx unit.
                const eps = (tVec.x * Jn.x + tVec.y * Jn.y) > 0 ? 1 : -1;

                const distVal = Math.sqrt(n.x * n.x + n.y * n.y);

                return {
                    id: t.id, alpha: i, k, p: t.point, n, t: tVec, epsilon: eps,
                    validDist: Math.abs(distVal - 1) < diagram.tolerances.met
                };
            }),
            matrices: {
                A_dims: `${A.rows}x${A.cols}`, A_rank: rankA,
                Tc_dims: `${Tc.rows}x${Tc.cols}`, Tc_rank: rankTc,
                Tw_dims: `${Tw.rows}x${Tw.cols}`, Tw_rank: rankTw,
                L_dims: `${L.rows}x${L.cols}`, L_rank: rankL
            },
            S: diagram.segments.map(s => ({ alpha: s.startTangencyId, beta: s.endTangencyId })),
            A: diagram.arcs.map(a => {
                // Sigma_a is always +1 in this implementation?
                // The protocol definition: Arc = (alpha->beta, k, sigma).
                // Our `deltaTheta` implies direction.
                // If deltaTheta > 0 (CCW), usually sigma=+1.
                // If we support CW arcs, check deltaTheta sign?
                // In types.ts, deltaTheta is in (0, 2pi).
                // Implicitly CCW. So sigma = +1.
                return { alpha: a.startTangencyId, beta: a.endTangencyId, k: a.diskIndex, sigma: 1 };
            }),
            Phi: {
                gc: gc.data.flat(),
                gw: gw.data.flat()
            },
            Criticality: {
                isCritical: crit.isCritical,
                r_norm: crit.normR,
                ratio: crit.ratio,
                Q_red: qVal
            }
        } : undefined;

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
                A: { dims: A ? `${A.rows}x${A.cols}` : '-', rank: rankA },
                Tc: { dims: Tc ? `${Tc.rows}x${Tc.cols}` : '-', rank: rankTc },
                Tw: { dims: Tw ? `${Tw.rows}x${Tw.cols}` : '-', rank: rankTw },
                L: { dims: L ? `${L.rows}x${L.cols}` : '-', rank: rankL }
            },
            vectors: {
                gc: { dims: gc ? `${gc.rows}x${gc.cols}` : '-', norm: gc ? gc.norm() : 0 },
                gw: { dims: gw ? `${gw.rows}x${gw.cols}` : '-', norm: gw ? gw.norm() : 0 },
                gred: { dims: gred ? `${gred.rows}x${gred.cols}` : '-', norm: gred ? gred.norm() : 0 }
            },
            gauge: gauge ? {
                dims: {
                    U: `${gauge.U.rows}x${gauge.U.cols}`,
                    V_Roll: `${gauge.V_Roll.rows}x${gauge.V_Roll.cols}`,
                    W: `${gauge.W.rows}x${gauge.W.cols}`,
                    Ug: `${gauge.Ug.rows}x${gauge.Ug.cols}`
                },
                checks: gauge.checks
            } : {
                dims: { U: '-', V_Roll: '-', W: '-', Ug: '-' },
                checks: { AUc: 0, UtU_I: 0, WtW_I: 0, UgtW: 0 }
            },
            criticality: crit || null,
            quadratic: qVal,
            instanceData: {
                disks: diagram.disks.map((d, i) => ({ id: i, center: d.center })),
                contacts: diagram.contacts.map(c => ({ diskA: c.diskA, diskB: c.diskB }))
            },
            pdfReport
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
