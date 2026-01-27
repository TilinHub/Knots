
export type Point = { x: number; y: number };
export type Config = { x: number; y: number; theta: number };

export type DubinsType = 'LSL' | 'RSR' | 'LSR' | 'RSL' | 'RLR' | 'LRL';

export interface DubinsPath {
    type: DubinsType;
    length: number;
    // Lengths of the three segments (t, p, q) * rho
    param1: number;
    param2: number;
    param3: number;
    rho: number;
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
 * Helper to sample points along a Dubins path for rendering.
 */
export function sampleDubinsPath(path: DubinsPath, stepSize: number = 2): Point[] {
    const points: Point[] = [];
    const totalLen = path.length;

    let currentX = path.start.x;
    let currentY = path.start.y;
    let currentTh = path.start.theta;

    // We actually need to reconstruct the path logic to sample correctly.
    // Or simpler: just generate the 3 primitives.
    // 1. Arc/Straight
    // 2. Straight/Arc
    // 3. Arc

    // Types mapping to operations: L = +rho, R = -rho, S = straight
    const signs = {
        'LSL': [1, 0, 1],
        'RSR': [-1, 0, -1],
        'LSR': [1, 0, -1],
        'RSL': [-1, 0, 1],
        'RLR': [-1, 1, -1], // Wait, RLR is Arc Arc Arc. Middle is Turn? 
        'LRL': [1, -1, 1]
    };

    // Correct mapping: 0 = Straight. 
    // RLR: Middle is Left turn? No. R(Start) L(Middle) R(End).
    // So signs: [ -1, 1, -1 ]

    const s = signs[path.type];
    const lens = [path.param1, path.param2, path.param3];

    points.push({ x: currentX, y: currentY });

    // We sample by integrating steps
    let dist = 0;
    while (dist < totalLen) {
        dist += stepSize;
        if (dist > totalLen) dist = totalLen;

        // Find which segment we are in
        let d = dist;
        let segIdx = 0;
        let segDist = 0;

        if (d <= lens[0]) {
            segIdx = 0;
            segDist = d;
        } else if (d <= lens[0] + lens[1]) {
            segIdx = 1;
            segDist = d - lens[0];
            // Need to advance start to end of seg 0
        } else {
            segIdx = 2;
            segDist = d - (lens[0] + lens[1]);
        }

        // We can't jump states easily without accumulated state.
        // It's better to implement a function `configAt(dist)`
    }

    // Re-implementation of sample using robust generator
    const configAt = (l: number): Config => {
        let cx = path.start.x;
        let cy = path.start.y;
        let cth = path.start.theta;

        let remaining = l;

        for (let i = 0; i < 3; i++) {
            const segLen = lens[i];
            const type = s[i]; // 1 (Left), -1 (Right), 0 (Straight)

            const advance = Math.min(remaining, segLen);

            if (type === 0) {
                // Straight
                cx += advance * Math.cos(cth);
                cy += advance * Math.sin(cth);
            } else {
                // Turn
                // phi = advance / rho
                // new x = cx + rho * sin(th + phi) - rho * sin(th) ... check math
                // Easy way: 
                // dx = \int cos(th + k*s) ds = ...
                // If Left (k=1/rho): sin(th + s/rho) - sin(th)
                // If Right (k=-1/rho): ...

                const curv = type / path.rho; // +1/rho or -1/rho
                const dTh = advance * curv;

                // standard circle integration
                // x(t) = x0 + (sin(th0 + k*t) - sin(th0)) / k
                // y(t) = y0 - (cos(th0 + k*t) - cos(th0)) / k

                cx += (Math.sin(cth + dTh) - Math.sin(cth)) / curv;
                cy -= (Math.cos(cth + dTh) - Math.cos(cth)) / curv;
                cth += dTh;
            }

            remaining -= advance;
            if (remaining <= 0.0001) break;
        }
        return { x: cx, y: cy, theta: cth };
    };

    // fill points
    for (let l = 0; l <= totalLen; l += stepSize) {
        points.push(configAt(l));
    }
    // ensure end point
    if (Math.abs(path.length % stepSize) > 1e-4) {
        points.push(configAt(path.length));
    }

    return points;
}
