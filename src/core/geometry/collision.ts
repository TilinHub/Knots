import type { DubinsPath, Obstacle, Point, Config } from './dubins';

const EPSILON = 1e-5;

// Helper: Normalize angle to [-PI, PI]
function normalizeAngle(theta: number): number {
    let a = theta;
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a <= -Math.PI) a += 2 * Math.PI;
    return a;
}

// Helper: Check if angle is within an arc range (taking direction into account)
function isAngleInArc(angle: number, startAngle: number, endAngle: number, isCCW: boolean): boolean {
    const a = normalizeAngle(angle);
    const s = normalizeAngle(startAngle);
    let e = normalizeAngle(endAngle);

    if (Math.abs(s - e) < EPSILON) return false; // Empty arc

    // Transform to standard range [0, len]
    let diff = e - s;
    if (isCCW) {
        if (diff < 0) diff += 2 * Math.PI;
    } else {
        if (diff > 0) diff -= 2 * Math.PI;
    }

    let angDiff = a - s;
    if (isCCW) {
        if (angDiff < 0) angDiff += 2 * Math.PI;
    } else {
        if (angDiff > 0) angDiff -= 2 * Math.PI;
    }

    // Check if angDiff is between 0 and diff
    if (isCCW) {
        return angDiff >= -EPSILON && angDiff <= diff + EPSILON;
    } else {
        // Clockwise: diff is negative. angDiff should be between diff and 0.
        // i.e., diff <= angDiff <= 0
        return angDiff <= EPSILON && angDiff >= diff - EPSILON;
    }
}

// Check Segment (Line) - Circle Collision
function checkSegmentCircleCollision(p1: Point, p2: Point, obs: Obstacle): boolean {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    const len = Math.sqrt(lenSq);

    if (len < EPSILON) {
        const distSq = (p1.x - obs.x) ** 2 + (p1.y - obs.y) ** 2;
        return distSq < (obs.radius - EPSILON) ** 2;
    }

    // Projection of obs center onto line
    // t = ((cx-x1)(x2-x1) + (cy-y1)(y2-y1)) / len^2
    const t = ((obs.x - p1.x) * dx + (obs.y - p1.y) * dy) / lenSq;

    // Clamped t for segment
    const tClamped = Math.max(0, Math.min(1, t));

    const closestX = p1.x + tClamped * dx;
    const closestY = p1.y + tClamped * dy;

    const distSq = (closestX - obs.x) ** 2 + (closestY - obs.y) ** 2;

    return distSq < (obs.radius - EPSILON) ** 2;
}

// Check Arc - Circle Collision
function checkArcCircleCollision(
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    isCCW: boolean,
    obs: Obstacle
): boolean {
    const distCentersSq = (center.x - obs.x) ** 2 + (center.y - obs.y) ** 2;
    const distCenters = Math.sqrt(distCentersSq);

    // 1. Check if Obstacle strictly inside Path Loop (not intersecting, but contained)
    // If Path Circle fully encloses Obstacle: Dist + R_obs < R_path
    // This implies the WHOLE obstacle is inside the turning circle.
    // If the path *wraps around* the obstacle, is it a collision?
    // In Dubins context, usually we consider the path as a 1D curve.
    // However, if the path curve itself doesn't touch the obstacle disk, 
    // but the obstacle is "inside" the loop, it's valid (e.g. going around a pillar).
    // So we DON'T count "Obstacle inside Path Circle" as collision, typically.

    // 2. Check if Path Loop strictly inside Obstacle
    // Dist + R_path < R_obs
    // If true, the entire path arc is inside the obstacle. Collision!
    if (distCenters + radius < obs.radius - EPSILON) {
        return true;
    }

    // 3. Check Intersections
    // Two circles: C1(r1), C2(r2), Dist d.
    // Intersect if |r1 - r2| <= d <= r1 + r2

    if (distCenters > radius + obs.radius - EPSILON) {
        // Too far apart
        return false;
    }
    if (distCenters < Math.abs(radius - obs.radius) + EPSILON) {
        // One inside another (handled above for 'Path inside Obs', 
        // implies 'Obs inside Path' here which is valid/non-collision for 1D path)
        return false;
    }

    // Calculate intersection points
    const a = (radius * radius - obs.radius * obs.radius + distCentersSq) / (2 * distCenters);
    const h = Math.sqrt(Math.max(0, radius * radius - a * a));

    // P2 = C1 + a * (C2 - C1) / d
    const x2 = center.x + a * (obs.x - center.x) / distCenters;
    const y2 = center.y + a * (obs.y - center.y) / distCenters;

    // Intersection points
    const x3_1 = x2 + h * (obs.y - center.y) / distCenters;
    const y3_1 = y2 - h * (obs.x - center.x) / distCenters;
    const x3_2 = x2 - h * (obs.y - center.y) / distCenters;
    const y3_2 = y2 + h * (obs.x - center.x) / distCenters;

    // Check if points are on the specific arc
    const theta1 = Math.atan2(y3_1 - center.y, x3_1 - center.x);
    if (isAngleInArc(theta1, startAngle, endAngle, isCCW)) return true;

    const theta2 = Math.atan2(y3_2 - center.y, x3_2 - center.x);
    if (isAngleInArc(theta2, startAngle, endAngle, isCCW)) return true;

    // 4. Check Endpoints?
    // If arc is fully inside obstacle, intersections might be invalid/none? 
    // Already covered by "Path Loop inside Obstacle".
    // What if Arc is short and completely INSIDE obstacle, but the circles intersect?
    // e.g. a small arc segment that lies entirely within the intersection overlap area.
    // Line-Circle check handles "both ends inside".
    // For Arc: check if Start Point is inside?
    // The previous checks might miss if the arc segment is 'floating' inside the obstacle 
    // without crossing boundaries?
    // Actually, checking if Start Point or End Point is inside is a good safety check.

    const startX = center.x + radius * Math.cos(startAngle);
    const startY = center.y + radius * Math.sin(startAngle);
    if ((startX - obs.x) ** 2 + (startY - obs.y) ** 2 < (obs.radius - EPSILON) ** 2) return true;

    // We don't strictly need End Point check if we check segments sequentially,
    // but safe to add.

    return false;
}

export function checkDubinsPathCollision(path: DubinsPath, obstacles: Obstacle[]): boolean {
    if (obstacles.length === 0) return false;

    // Reconstruct Geometry

    // Segment lengths
    const len1 = path.param1;
    const len2 = path.param2;
    const len3 = path.param3;

    // Radii
    const r1 = path.rhoStart ?? path.rho;
    const r2 = path.rho; // Used if middle is arc (CCC)
    const r3 = path.rhoEnd ?? path.rho;

    const types = path.type.split(''); // ['L', 'S', 'L']

    let currentConfig: Config = { ...path.start };

    // --- SEGMENT 1 ---
    if (len1 > EPSILON) {
        const type = types[0];
        if (type === 'S') {
            // Should not happen for Dubins first segment, but generic handling
            const nextX = currentConfig.x + len1 * Math.cos(currentConfig.theta);
            const nextY = currentConfig.y + len1 * Math.sin(currentConfig.theta);

            for (const obs of obstacles) {
                if (checkSegmentCircleCollision({ x: currentConfig.x, y: currentConfig.y }, { x: nextX, y: nextY }, obs)) return true;
            }
            currentConfig = { x: nextX, y: nextY, theta: currentConfig.theta };
        } else {
            // Arc
            const isCCW = (type === 'L');
            const dir = isCCW ? 1 : -1;
            // Center
            const cx = currentConfig.x - r1 * Math.sin(currentConfig.theta) * dir;
            const cy = currentConfig.y + r1 * Math.cos(currentConfig.theta) * dir;

            const startAngle = Math.atan2(currentConfig.y - cy, currentConfig.x - cx);
            const endAngle = startAngle + dir * (len1 / r1);

            for (const obs of obstacles) {
                if (checkArcCircleCollision({ x: cx, y: cy }, r1, startAngle, endAngle, isCCW, obs)) return true;
            }

            // Update user Config
            const newTheta = currentConfig.theta + dir * (len1 / r1);
            const endX = cx + r1 * Math.cos(endAngle);
            const endY = cy + r1 * Math.sin(endAngle);
            currentConfig = { x: endX, y: endY, theta: newTheta };
        }
    }

    // --- SEGMENT 2 ---
    if (len2 > EPSILON) {
        const type = types[1];
        if (type === 'S') {
            const nextX = currentConfig.x + len2 * Math.cos(currentConfig.theta);
            const nextY = currentConfig.y + len2 * Math.sin(currentConfig.theta);

            for (const obs of obstacles) {
                if (checkSegmentCircleCollision({ x: currentConfig.x, y: currentConfig.y }, { x: nextX, y: nextY }, obs)) return true;
            }
            currentConfig = { x: nextX, y: nextY, theta: currentConfig.theta };
        } else {
            // Arc (CCC) - rare in this app but handled
            const isCCW = (type === 'L');
            const dir = isCCW ? 1 : -1;
            // Radius? Standard Dubins uses rho. 
            // Bitangent paths (CSC) use Straight middle.
            // If we have CCC, assume rho (r2).
            const cx = currentConfig.x - r2 * Math.sin(currentConfig.theta) * dir;
            const cy = currentConfig.y + r2 * Math.cos(currentConfig.theta) * dir;

            const startAngle = Math.atan2(currentConfig.y - cy, currentConfig.x - cx);
            const endAngle = startAngle + dir * (len2 / r2);

            for (const obs of obstacles) {
                if (checkArcCircleCollision({ x: cx, y: cy }, r2, startAngle, endAngle, isCCW, obs)) return true;
            }

            const newTheta = currentConfig.theta + dir * (len2 / r2);
            const endX = cx + r2 * Math.cos(endAngle);
            const endY = cy + r2 * Math.sin(endAngle);
            currentConfig = { x: endX, y: endY, theta: newTheta };
        }
    }

    // --- SEGMENT 3 ---
    if (len3 > EPSILON) {
        const type = types[2];
        if (type === 'S') {
            const nextX = currentConfig.x + len3 * Math.cos(currentConfig.theta);
            const nextY = currentConfig.y + len3 * Math.sin(currentConfig.theta);
            for (const obs of obstacles) {
                if (checkSegmentCircleCollision({ x: currentConfig.x, y: currentConfig.y }, { x: nextX, y: nextY }, obs)) return true;
            }
        } else {
            const isCCW = (type === 'L');
            const dir = isCCW ? 1 : -1;
            const cx = currentConfig.x - r3 * Math.sin(currentConfig.theta) * dir;
            const cy = currentConfig.y + r3 * Math.cos(currentConfig.theta) * dir;

            const startAngle = Math.atan2(currentConfig.y - cy, currentConfig.x - cx);
            const endAngle = startAngle + dir * (len3 / r3);

            for (const obs of obstacles) {
                if (checkArcCircleCollision({ x: cx, y: cy }, r3, startAngle, endAngle, isCCW, obs)) return true;
            }
        }
    }

    return false;
}
