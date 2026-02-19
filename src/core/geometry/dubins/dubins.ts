import { checkDubinsPathCollision } from './collision';

export type Point = { x: number; y: number };
export type Config = { x: number; y: number; theta: number };

export type DubinsType = 'LSL' | 'RSR' | 'LSR' | 'RSL' | 'RLR' | 'LRL';

export interface DubinsPath {
    type: DubinsType;
    length: number;
    // Lengths of the three segments (t, p, q) * (respective rho)
    // Actually, for consistency: 
    // param1: Arc length 1
    // param2: Straight length (or Arc 2)
    // param3: Arc length 3
    param1: number;
    param2: number;
    param3: number;
    rho: number; // Legacy or max rho
    rhoStart?: number; // Specific rho for first segment
    rhoEnd?: number;   // Specific rho for last segment
    start: Config;
    end: Config;
    groupId?: string; // For multi-hop paths
    startDiskId?: string;
    endDiskId?: string;
}

export interface StoredDubinsPath {
    id: string;
    startDiskId: string;
    endDiskId: string;
    type: DubinsType;
}

const TwoPi = 2 * Math.PI;

function mod2pi(theta: number): number {
    return theta - TwoPi * Math.floor(theta / TwoPi);
}

/**
 * Standard Dubins solvers.
 * Based on the classic construction where we normalize to (0,0,0) -> (d, alpha, beta).
 */
function LSL(alpha: number, beta: number, d: number): { t: number, p: number, q: number } | null {
    const sa = Math.sin(alpha);
    const sb = Math.sin(beta);
    const ca = Math.cos(alpha);
    const cb = Math.cos(beta);
    const c_ab = Math.cos(alpha - beta);

    const tmp0 = d + sa - sb;
    const p_sq = 2 + (d * d) - (2 * c_ab) + (2 * d * (sa - sb));

    if (p_sq < 0) return null;

    const tmp1 = Math.atan2((cb - ca), tmp0);
    const t = mod2pi(-alpha + tmp1);
    const p = Math.sqrt(p_sq);
    const q = mod2pi(beta - tmp1);

    return { t, p, q };
}

function RSR(alpha: number, beta: number, d: number): { t: number, p: number, q: number } | null {
    const sa = Math.sin(alpha);
    const sb = Math.sin(beta);
    const ca = Math.cos(alpha);
    const cb = Math.cos(beta);
    const c_ab = Math.cos(alpha - beta);

    const tmp0 = d - sa + sb;
    const p_sq = 2 + (d * d) - (2 * c_ab) + (2 * d * (sb - sa));

    if (p_sq < 0) return null;

    const tmp1 = Math.atan2((ca - cb), tmp0);
    const t = mod2pi(alpha - tmp1);
    const p = Math.sqrt(p_sq);
    const q = mod2pi(-beta + tmp1);

    return { t, p, q };
}

function LSR(alpha: number, beta: number, d: number): { t: number, p: number, q: number } | null {
    const sa = Math.sin(alpha);
    const sb = Math.sin(beta);
    const ca = Math.cos(alpha);
    const cb = Math.cos(beta);
    const c_ab = Math.cos(alpha - beta);

    const p_sq = -2 + (d * d) + (2 * c_ab) + (2 * d * (sa + sb));

    if (p_sq < 0) return null;

    const p = Math.sqrt(p_sq);
    const tmp2 = Math.atan2((-ca - cb), (d + sa + sb)) - Math.atan2(-2, p);
    const t = mod2pi(-alpha + tmp2);
    const q = mod2pi(-mod2pi(beta) + tmp2);

    return { t, p, q };
}

function RSL(alpha: number, beta: number, d: number): { t: number, p: number, q: number } | null {
    const sa = Math.sin(alpha);
    const sb = Math.sin(beta);
    const ca = Math.cos(alpha);
    const cb = Math.cos(beta);
    const c_ab = Math.cos(alpha - beta);

    const p_sq = (d * d) - 2 + (2 * c_ab) - (2 * d * (sa + sb));

    if (p_sq < 0) return null;

    const p = Math.sqrt(p_sq);
    const tmp2 = Math.atan2((ca + cb), (d - sa - sb)) - Math.atan2(2, p);
    const t = mod2pi(alpha - tmp2);
    const q = mod2pi(beta - tmp2);

    return { t, p, q };
}

function RLR(alpha: number, beta: number, d: number): { t: number, p: number, q: number } | null {
    const sa = Math.sin(alpha);
    const sb = Math.sin(beta);
    const ca = Math.cos(alpha);
    const cb = Math.cos(beta);
    const c_ab = Math.cos(alpha - beta);

    const tmp_rlr = (6.0 - d * d + 2.0 * c_ab + 2.0 * d * (sa - sb)) / 8.0;

    if (Math.abs(tmp_rlr) > 1.0) return null;

    const p = mod2pi(TwoPi - Math.acos(tmp_rlr));
    const t = mod2pi(alpha - Math.atan2(ca - cb, d - sa + sb) + mod2pi(p / 2.0));
    const q = mod2pi(alpha - beta - t + mod2pi(p));

    return { t, p, q };
}

function LRL(alpha: number, beta: number, d: number): { t: number, p: number, q: number } | null {
    const sa = Math.sin(alpha);
    const sb = Math.sin(beta);
    const ca = Math.cos(alpha);
    const cb = Math.cos(beta);
    const c_ab = Math.cos(alpha - beta);

    const tmp_lrl = (6.0 - d * d + 2.0 * c_ab + 2.0 * d * (-sa + sb)) / 8.0;

    if (Math.abs(tmp_lrl) > 1.0) return null;

    const p = mod2pi(TwoPi - Math.acos(tmp_lrl));
    const t = mod2pi(-alpha - Math.atan2(ca - cb, d + sa - sb) + p / 2.0);
    const q = mod2pi(mod2pi(beta) - alpha - t + mod2pi(p));

    return { t, p, q };
}

const Solvers = { LSL, RSR, LSR, RSL, RLR, LRL };

/**
 * Calculates all possible Dubins paths between start and end.
 */
export function calculateDubinsPaths(start: Config, end: Config, rho: number): DubinsPath[] {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const th1 = start.theta;
    const th2 = end.theta;

    const D = Math.sqrt(dx * dx + dy * dy);
    const d = D / rho; // Normalized distance

    // Transform to standard coord system: start at (0,0,0)
    // The relative angle of end position is theta = atan2(dy, dx)
    // We rotate the coordinate system so that the vector (start->end) is along X axis?
    // Actually the standard form assumes we compute alpha and beta based on the baseline.

    const th = Math.atan2(dy, dx);
    const alpha = mod2pi(th1 - th);
    const beta = mod2pi(th2 - th);

    const paths: DubinsPath[] = [];

    (Object.keys(Solvers) as DubinsType[]).forEach(type => {
        const solver = Solvers[type];
        const res = solver(alpha, beta, d);
        if (res) {
            paths.push({
                type,
                length: (res.t + res.p + res.q) * rho,
                param1: res.t * rho,
                param2: res.p * rho,
                param3: res.q * rho,
                rho,
                start,
                end
            });
        }
    });

    return paths.sort((a, b) => a.length - b.length);
}

/**
 * Helper to sample points.
 * Updated to support unequal radii if params > 0.
 */
export function sampleDubinsPath(path: DubinsPath, stepSize: number = 2): Point[] {
    const points: Point[] = [];
    const totalLen = path.length;

    // Use radii if available, else rho
    const r1 = path.rhoStart ?? path.rho;
    const r3 = path.rhoEnd ?? path.rho;

    // Generator
    const configAt = (l: number): Config => {
        let cx = path.start.x;
        let cy = path.start.y;
        let cth = path.start.theta;
        let remaining = l;

        // Segments logic
        // For standard Dubins, param1,2,3 are arc lengths (rho * t).
        // For Bitangents, param2 is Straight Length.
        // And signs depend on type.

        const lens = [path.param1, path.param2, path.param3];
        const signs = {
            'LSL': [1, 0, 1],
            'RSR': [-1, 0, -1],
            'LSR': [1, 0, -1],
            'RSL': [-1, 0, 1],
            'RLR': [-1, 1, -1],
            'LRL': [1, -1, 1]
        };
        const s = signs[path.type] || [0, 0, 0];

        for (let i = 0; i < 3; i++) {
            const segLen = lens[i];
            const type = s[i];
            const advance = Math.min(remaining, segLen);

            if (advance > 0) {
                if (type === 0) {
                    // Straight
                    cx += advance * Math.cos(cth);
                    cy += advance * Math.sin(cth);
                } else {
                    // Turn
                    // Use r1 (first seg) or r3 (last seg)?
                    // Standard Dubins uses 1 rho.
                    // Bitangents (LSL, RSR, etc) skip middle turn (param2 is straight).
                    // So Turn 1 is Index 0 (uses r1). Turn 2 is Index 2 (uses r3).
                    const r = (i === 0) ? r1 : r3;
                    const curv = type / r; // +1/r or -1/r
                    const dTh = advance * curv;

                    // x(t) = x0 + (sin(th0 + kt) - sin(th0))/k
                    // y(t) = y0 - (cos(th0 + kt) - cos(th0))/k
                    cx += (Math.sin(cth + dTh) - Math.sin(cth)) / curv;
                    cy -= (Math.cos(cth + dTh) - Math.cos(cth)) / curv;
                    cth += dTh; // Update theta
                }
                remaining -= advance;
            }
            if (remaining <= 0.0001) break;
        }
        return { x: cx, y: cy, theta: cth };
    };


    for (let l = 0; l <= totalLen; l += stepSize) {
        points.push(configAt(l));
    }
    // ensure end point
    if (Math.abs(path.length % stepSize) > 1e-4) {
        points.push(configAt(path.length));
    }

    return points;
}

/**
 * Calculates Exact Tangent Paths (Bitangents) between two circles of arbitrary radii.
 * Implements logic from Gieseanw tutorial.
 * Returns standard DubinsPath objects.
 */
export function calculateBitangentPaths(
    c1: { x: number, y: number, radius: number },
    c2: { x: number, y: number, radius: number }
): DubinsPath[] {
    const paths: DubinsPath[] = [];
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const D = Math.sqrt(dx * dx + dy * dy);
    const phi = Math.atan2(dy, dx);

    // Safety checks
    if (D < 1e-9) return [];

    // 1. Outer Tangents (LSL, RSR)
    // Condition: D > |r1 - r2|
    if (D >= Math.abs(c1.radius - c2.radius)) {
        // Angle gamma for normal offset
        const gamma = Math.acos((c1.radius - c2.radius) / D);

        if (!isNaN(gamma)) {
            // LSL: Top Tangent is actually RSR (Right-Right) geometry (Center Right)
            // Wait, Top Tangent (alpha > 0) going East. Center (0,0) is Right.
            // So Top Tangent is RSR.
            // But usually we map "Outer Top" to LSL in standard derivation?
            // Standard: LSL connects touches at (alpha1, alpha2).
            // If we swap types, we fix consistency.

            // 1. Top Tangent (Original LSL block) -> RSR
            const alpha1_RSR = phi + gamma;
            const alpha2_RSR = phi + gamma;

            const tRSR_x1 = c1.x + c1.radius * Math.cos(alpha1_RSR);
            const tRSR_y1 = c1.y + c1.radius * Math.sin(alpha1_RSR);
            const tRSR_x2 = c2.x + c2.radius * Math.cos(alpha2_RSR);
            const tRSR_y2 = c2.y + c2.radius * Math.sin(alpha2_RSR);

            // Direction: Alpha - PI/2 generates Correct Heading for Top Tangent
            // But RSR requires Heading = Radius + PI/2?
            // Let's stick to the geometry that works: Heading matches line vector.
            const RSR_dir = alpha1_RSR - Math.PI / 2;
            const RSR_len = Math.sqrt((tRSR_x2 - tRSR_x1) ** 2 + (tRSR_y2 - tRSR_y1) ** 2);

            paths.push({
                type: 'RSR',
                length: RSR_len,
                param1: 0,
                param2: RSR_len,
                param3: 0,
                rho: c1.radius,
                rhoStart: c1.radius,
                rhoEnd: c2.radius,
                start: { x: tRSR_x1, y: tRSR_y1, theta: RSR_dir },
                end: { x: tRSR_x2, y: tRSR_y2, theta: RSR_dir }
            });

            // 2. Bottom Tangent (Original RSR block) -> LSL
            const alpha1_LSL = phi - gamma;
            const alpha2_LSL = phi - gamma;

            const tLSL_x1 = c1.x + c1.radius * Math.cos(alpha1_LSL);
            const tLSL_y1 = c1.y + c1.radius * Math.sin(alpha1_LSL);
            const tLSL_x2 = c2.x + c2.radius * Math.cos(alpha2_LSL);
            const tLSL_y2 = c2.y + c2.radius * Math.sin(alpha2_LSL);

            // Direction: Alpha + PI/2 generates Correct Heading for Bottom Tangent
            const LSL_dir = alpha1_LSL + Math.PI / 2;
            const LSL_len = Math.sqrt((tLSL_x2 - tLSL_x1) ** 2 + (tLSL_y2 - tLSL_y1) ** 2);

            paths.push({
                type: 'LSL',
                length: LSL_len,
                param1: 0,
                param2: LSL_len,
                param3: 0,
                rho: c1.radius,
                rhoStart: c1.radius,
                rhoEnd: c2.radius,
                start: { x: tLSL_x1, y: tLSL_y1, theta: LSL_dir },
                end: { x: tLSL_x2, y: tLSL_y2, theta: LSL_dir }
            });
        }
    }

    // 2. Inner Tangents (LSR, RSL)
    // Condition: D > r1 + r2
    if (D >= c1.radius + c2.radius) {
        const beta = Math.acos((c1.radius + c2.radius) / D);

        if (!isNaN(beta)) {
            // LSR (Left Start, Right End)
            // Normal 1: phi + beta
            // Normal 2: phi + beta + PI
            const alpha1_LSR = phi + beta;
            const alpha2_LSR = phi + beta + Math.PI;

            const tLSR_x1 = c1.x + c1.radius * Math.cos(alpha1_LSR);
            const tLSR_y1 = c1.y + c1.radius * Math.sin(alpha1_LSR);
            const tLSR_x2 = c2.x + c2.radius * Math.cos(alpha2_LSR);
            const tLSR_y2 = c2.y + c2.radius * Math.sin(alpha2_LSR);

            // Dir 1 (L): Normal - PI/2
            const LSR_dir = alpha1_LSR - Math.PI / 2;
            const LSR_len = Math.sqrt((tLSR_x2 - tLSR_x1) ** 2 + (tLSR_y2 - tLSR_y1) ** 2);

            paths.push({
                type: 'LSR',
                length: LSR_len,
                param1: 0,
                param2: LSR_len,
                param3: 0,
                rho: c1.radius,
                rhoStart: c1.radius,
                rhoEnd: c2.radius,
                start: { x: tLSR_x1, y: tLSR_y1, theta: LSR_dir },
                end: { x: tLSR_x2, y: tLSR_y2, theta: LSR_dir }
            });

            // RSL (Right Start, Left End)
            // Normal 1: phi - beta
            // Normal 2: phi - beta + PI
            const alpha1_RSL = phi - beta;
            const alpha2_RSL = phi - beta + Math.PI;

            const tRSL_x1 = c1.x + c1.radius * Math.cos(alpha1_RSL);
            const tRSL_y1 = c1.y + c1.radius * Math.sin(alpha1_RSL);
            const tRSL_x2 = c2.x + c2.radius * Math.cos(alpha2_RSL);
            const tRSL_y2 = c2.y + c2.radius * Math.sin(alpha2_RSL);

            // Dir 1 (R): Normal + PI/2
            const RSL_dir = alpha1_RSL + Math.PI / 2;
            const RSL_len = Math.sqrt((tRSL_x2 - tRSL_x1) ** 2 + (tRSL_y2 - tRSL_y1) ** 2);

            paths.push({
                type: 'RSL',
                length: RSL_len,
                param1: 0,
                param2: RSL_len,
                param3: 0,
                rho: c1.radius,
                rhoStart: c1.radius,
                rhoEnd: c2.radius,
                start: { x: tRSL_x1, y: tRSL_y1, theta: RSL_dir },
                end: { x: tRSL_x2, y: tRSL_y2, theta: RSL_dir }
            });
        }
    }

    return paths;
}

// Helper to normalize angle
const normalize = (angle: number) => angle - 2 * Math.PI * Math.floor(angle / (2 * Math.PI));

/**
 * Calculates the Single Valid Fixed-Center path for the given configurations.
 * Respects the Heading (Theta) of start and end to determine if we are traveling "Left" (CCW) or "Right" (CW).
 */
/**
 * Generalized Dubins Solver for Unequal Radii.
 * Calculates path between two specific configurations (x,y,theta),
 * respecting specific turning radii r1 and r2.
 * 
 * Strategy:
 * 1. Compute all 4 standard bitangent candidates (LSL, RSR, LSR, RSL) geometrically between the two fixed circles.
 * 2. For each candidate, check if the "Departure Chirality" matches the Start Config Heading.
 *    - Start Heading "Left" (CCW) -> Path must start with L.
 *    - Start Heading "Right" (CW) -> Path must start with R.
 * 3. Check if "Arrival Chirality" matches End Config Heading.
 *    - End Heading "Left" (CCW) -> Path must end with L.
 * 1. Compute all 4 standard bitangent candidates (LSL, RSR, LSR, RSL) geometrically.
 * 2. Filter candidates based on Heading Alignment.
 *    - The path's start tangent must align with start.theta.
 *    - The path's end tangent must align with end.theta.
 * 3. Return valid paths.
 */
export function calculateGeneralizedDubinsPaths(
    start: Config,
    end: Config,
    c1: { x: number, y: number, radius: number },
    c2: { x: number, y: number, radius: number }
): DubinsPath[] {
    const paths: DubinsPath[] = [];
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const D = Math.sqrt(dx * dx + dy * dy);
    const phi = Math.atan2(dy, dx);

    // Safety
    if (D < 1e-9) return [];

    // Helper: Point on circle
    const pOnC = (c: { x: number, y: number, radius: number }, angle: number) => ({
        x: c.x + c.radius * Math.cos(angle),
        y: c.y + c.radius * Math.sin(angle)
    });

    // Helper: Check alignment
    // Returns true if the path direction matches the config heading
    const isAligned = (pathDir: number, configTheta: number) => {
        const dx = Math.cos(pathDir);
        const dy = Math.sin(pathDir);
        const ux = Math.cos(configTheta);
        const uy = Math.sin(configTheta);
        // Dot product > 0.5 implies within 60 degrees. 
        // Generous tolerance for manual rotation.
        return (dx * ux + dy * uy) > 0.5;
    };

    const startAng = Math.atan2(start.y - c1.y, start.x - c1.x);
    const endAng = Math.atan2(end.y - c2.y, end.x - c2.x);

    // Define the 4 geometric solvers for bitangents
    const solvers: Record<string, () => { alpha1: number, alpha2: number } | null> = {
        'LSL': () => {
            // LSL: Bottom Tangent (if phi=0). alpha = phi - gamma
            if (D < Math.abs(c1.radius - c2.radius)) return null;
            const gamma = Math.acos((c1.radius - c2.radius) / D);
            if (isNaN(gamma)) return null;
            const alpha = phi - gamma;
            return { alpha1: alpha, alpha2: alpha };
        },
        'RSR': () => {
            // RSR: Top Tangent (if phi=0). alpha = phi + gamma
            if (D < Math.abs(c1.radius - c2.radius)) return null;
            const gamma = Math.acos((c1.radius - c2.radius) / D);
            if (isNaN(gamma)) return null;
            const alpha = phi + gamma;
            return { alpha1: alpha, alpha2: alpha };
        },
        'LSR': () => {
            // LSR: C1 Bottom -> C2 Top. alpha1 = phi - beta
            // Wait.
            // LSL = Bottom. RSR = Top.
            // LSR = Left(Start) -> Right(End).
            // Left=CCW=Bottom. Right=CW=Top. (Relative to connection line?)
            // No.
            // "Left Turn" means Center is Left.
            // At Bottom (0,-r), Heading East (0). Center (0,0) is Left.
            // So L = Bottom.
            // At Top (0,r), Heading East (0). Center (0,0) is Right.
            // So R = Top.
            // LSR = Bottom(C1) -> Top(C2).
            // Tangent angle at Bottom C1 is approx -PI/2.
            // Tangent angle at Top C2 is approx PI/2.
            // alpha1 should be phi - beta.

            if (D < c1.radius + c2.radius) return null;
            const beta = Math.acos((c1.radius + c2.radius) / D);
            if (isNaN(beta)) return null;
            const alpha1 = phi - beta;
            const alpha2 = phi - beta + Math.PI;
            return { alpha1, alpha2 };
        },
        'RSL': () => {
            // RSL: C1 Top -> C2 Bottom.
            // R = Top. L = Bottom.
            // alpha1 should be phi + beta.

            if (D < c1.radius + c2.radius) return null;
            const beta = Math.acos((c1.radius + c2.radius) / D);
            if (isNaN(beta)) return null;
            const alpha1 = phi + beta;
            const alpha2 = phi + beta + Math.PI; // Note: Parallel lines? No, cross tangents.
            // For inner tangents, if alpha1 is angle on C1, alpha2 on C2 is alpha1 + PI (if radii equal and on axis).
            // Yes.
            return { alpha1, alpha2 };
        }
    };

    // Attempt all 4 types
    Object.keys(solvers).forEach(type => {
        const solver = solvers[type];
        const res = solver();
        if (res) {
            const { alpha1, alpha2 } = res;

            // Determine expected departure/arrival directions based on Type
            const startType = type[0];
            const endType = type[2];

            // Expected Tangent Direction at Start/End Position to follow the circle
            // For 'L' (CCW), Tangent = PosAngle + PI/2.
            // For 'R' (CW), Tangent = PosAngle - PI/2.
            const perfectStartTheta = startAng + (startType === 'L' ? Math.PI / 2 : -Math.PI / 2);
            const perfectEndTheta = endAng + (endType === 'L' ? Math.PI / 2 : -Math.PI / 2);

            // Strict Alignment Check using the Perfect Theta vs User Theta
            // We use the User Theta ONLY to filter availability (intent).
            if (!isAligned(perfectStartTheta, start.theta) || !isAligned(perfectEndTheta, end.theta)) {
                return;
            }

            // Calculate lengths
            // Arc 1
            let arc1Len = 0;
            if (startType === 'L') {
                arc1Len = normalize(alpha1 - startAng) * c1.radius;
            } else {
                arc1Len = normalize(startAng - alpha1) * c1.radius;
            }

            // Arc 2
            let arc2Len = 0;
            if (endType === 'L') {
                arc2Len = normalize(endAng - alpha2) * c2.radius;
            } else {
                arc2Len = normalize(alpha2 - endAng) * c2.radius;
            }

            // Straight
            const t1 = pOnC(c1, alpha1);
            const t2 = pOnC(c2, alpha2);
            const straightLen = Math.sqrt((t2.x - t1.x) ** 2 + (t2.y - t1.y) ** 2);

            // Use Perfect Thetas for the Path Object to ensure it strictly follows the circle
            const cleanStart = { ...start, theta: perfectStartTheta };
            const cleanEnd = { ...end, theta: perfectEndTheta };

            paths.push({
                type: type as DubinsType,
                length: arc1Len + straightLen + arc2Len,
                param1: arc1Len,
                param2: straightLen,
                param3: arc2Len,
                rho: c1.radius,
                rhoStart: c1.radius,
                rhoEnd: c2.radius,
                start: cleanStart, // Use enforced tangent
                end: cleanEnd      // Use enforced tangent
            });
        }
    });

    // If multiple valid paths (unlikely with strict heading), sort by length
    return paths.sort((a, b) => a.length - b.length);
}

export interface Obstacle {
    x: number;
    y: number;
    radius: number;
}


/**
 * Checks if a Dubins path collides with any of the given obstacles.
 * Uses robust analytic geometry (Arc-Circle and Line-Circle intersection).
 * The stepSize parameter is ignored as analytic check is exact.
 */


export function checkPathCollision(path: DubinsPath, obstacles: Obstacle[], stepSize: number = 5): boolean {
    return checkDubinsPathCollision(path, obstacles);
}

