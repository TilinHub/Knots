
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
    // Only sample if path length > 0
    // If length is 0 (point?), return start?

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
                    cth += dTh;
                }
                remaining -= advance;
            }
            if (remaining <= 0.0001) break;
        }
        return { x: cx, y: cy, theta: cth };
    };

    const totalLen = path.length;
    for (let l = 0; l <= totalLen; l += stepSize) {
        points.push(configAt(l));
    }
    // ensure end point
    if (Math.abs(totalLen % stepSize) > 1e-4) {
        points.push(configAt(totalLen));
    }

    return points;
}

/**
 * Calculates Exact Tangent Paths (Bitangents) between two circles of arbitrary radii.
 * Returns standard DubinsPath objects but with specific rhoStart/rhoEnd.
 * param1, param3 are 0 (start/end on Tangent Points). param2 is the line length.
 * start/end configs are set to the tangent points and directions.
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

    if (D < Math.abs(c1.radius - c2.radius)) {
        // One inside other - no tangents
        return [];
    }

    // 1. Outer Tangents (LSL, RSR)
    // Always exist if D > |R1 - R2|

    // Angle offset for Outer Tangents
    // alpha = acos((R1 - R2) / D) if R1 > R2?
    // General form: sin(alpha) = (R1 - R2) / D ? No, constructing trapezoid.
    // Hypotenuse D. Leg (R1 - R2).
    // angle = acos((R1 - R2)/D) is angle between Radius and CenterLine?
    // Let beta = asin((R1 - R2) / D).
    // Tangent points are at phi + beta + PI/2 ?
    // Let's use geometric construction.
    // Normal to tangent makes angle 'theta' with centerline. 
    // cos(theta) = (R1 - R2)/D.
    // theta = acos((R1 - R2)/D).

    // BUT we need to handle signs for R1 < R2.
    // If R1=R2, theta = acos(0) = PI/2. Normal is perp to centerline. Tangent is parallel. Correct.

    const outerTheta = Math.acos((c1.radius - c2.radius) / D);

    if (!isNaN(outerTheta)) {
        // LSL: Top tangent. Normal is at phi + outerTheta?
        // Let's verify.
        // R1 > R2: outerTheta < PI/2.
        // Tangent touches C1 at phi + outerTheta.
        // Touches C2 at phi + outerTheta.
        // Both normals parallel.
        // Tangent direction is perp to normal.
        // Direction = (phi + outerTheta) - PI/2 ??
        // Standard Dubins LSL: "Left Turn" from C1 to C2 implies traveling on the "Left" side of the connection vector?
        // Wait, LSL means CCW circle then Straight then CCW circle.
        // Tangent line goes from Top of C1 to Top of C2.
        // Tangent direction is roughly phi.
        // Tangent point Normal is roughly phi + PI/2.
        // theta is angle of Normal relative to Centreline.
        // So Normal Angle = phi + outerTheta.
        // Correct.

        // LSL
        const nLSL = phi + outerTheta;
        const tLSL_x1 = c1.x + c1.radius * Math.cos(nLSL);
        const tLSL_y1 = c1.y + c1.radius * Math.sin(nLSL);
        const tLSL_x2 = c2.x + c2.radius * Math.cos(nLSL);
        const tLSL_y2 = c2.y + c2.radius * Math.sin(nLSL);

        const LSL_len = Math.sqrt((tLSL_x2 - tLSL_x1) ** 2 + (tLSL_y2 - tLSL_y1) ** 2);
        const LSL_dir = nLSL - Math.PI / 2; // Tangent (path) direction

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

        // RSR (Bottom tangent)
        // Normal Angle = phi - outerTheta.
        const nRSR = phi - outerTheta;
        const tRSR_x1 = c1.x + c1.radius * Math.cos(nRSR);
        const tRSR_y1 = c1.y + c1.radius * Math.sin(nRSR);
        const tRSR_x2 = c2.x + c2.radius * Math.cos(nRSR);
        const tRSR_y2 = c2.y + c2.radius * Math.sin(nRSR);

        const RSR_len = Math.sqrt((tRSR_x2 - tRSR_x1) ** 2 + (tRSR_y2 - tRSR_y1) ** 2);
        // Tangent dir: Normal rotated +PI/2 (since R means "Inner" side?)
        // Wait. R turn = CW.
        // Tangent is "below". Normal points Out.
        // Path direction is "Right" (along phi).
        // Normal is "Down" relative to path.
        // So Path = Normal + PI/2.
        const RSR_dir = nRSR + Math.PI / 2;

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
    }

    // 2. Inner Tangents (LSR, RSL)
    // Exist if D > R1 + R2
    if (D > c1.radius + c2.radius) {
        const innerTheta = Math.acos((c1.radius + c2.radius) / D);

        if (!isNaN(innerTheta)) {
            // LSR: Leaves C1 (Left/Top) -> Enters C2 (Right/Bottom? No, R means CW)
            // LSR Crosses the centerline.
            // Tangent point 1 Normal: phi + innerTheta
            // Tangent point 2 Normal: phi + innerTheta + PI (Opposite side)
            // Wait.
            // Construct cross tangent.
            // Normal 1 angle n1. Normal 2 angle n2.
            // n1 = phi + innerTheta.
            // n2 = phi + innerTheta + PI ? 
            // Or n2 = phi + innerTheta?
            // If we draw it: line goes from Top of C1 to Bottom of C2.
            // Normal on C1 is Up-ish. Normal on C2 is Down-ish.
            // Yes n2 = n1 + PI.

            const nLSR_1 = phi + innerTheta;
            const nLSR_2 = phi + innerTheta + Math.PI; // or -PI

            const tLSR_x1 = c1.x + c1.radius * Math.cos(nLSR_1);
            const tLSR_y1 = c1.y + c1.radius * Math.sin(nLSR_1);
            const tLSR_x2 = c2.x + c2.radius * Math.cos(nLSR_2);
            const tLSR_y2 = c2.y + c2.radius * Math.sin(nLSR_2);

            const LSR_len = Math.sqrt((tLSR_x2 - tLSR_x1) ** 2 + (tLSR_y2 - tLSR_y1) ** 2);
            const LSR_dir = nLSR_1 - Math.PI / 2; // Tangent perp to Normal 1

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

            // RSL
            const nRSL_1 = phi - innerTheta;
            // RSL leaves C1 at Bottom-ish.
            const nRSL_2 = phi - innerTheta + Math.PI;

            const tRSL_x1 = c1.x + c1.radius * Math.cos(nRSL_1);
            const tRSL_y1 = c1.y + c1.radius * Math.sin(nRSL_1);
            const tRSL_x2 = c2.x + c2.radius * Math.cos(nRSL_2);
            const tRSL_y2 = c2.y + c2.radius * Math.sin(nRSL_2);

            const RSL_len = Math.sqrt((tRSL_x2 - tRSL_x1) ** 2 + (tRSL_y2 - tRSL_y1) ** 2);
            const RSL_dir = nRSL_1 + Math.PI / 2;

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

export interface Obstacle {
    x: number;
    y: number;
    radius: number;
}

/**
 * Checks if a Dubins path collides with any of the given obstacles.
 * Uses sampling for robustness.
 */
export function checkPathCollision(path: DubinsPath, obstacles: Obstacle[], stepSize: number = 5): boolean {
    if (obstacles.length === 0) return false;

    // Sample points
    const points = sampleDubinsPath(path, stepSize);

    for (const p of points) {
        for (const obs of obstacles) {
            const distSq = (p.x - obs.x) ** 2 + (p.y - obs.y) ** 2;
            if (distSq < (obs.radius - 1e-3) ** 2) {
                return true;
            }
        }
    }
    return false;
}
