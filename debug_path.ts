
// Mock types
interface Point2D { x: number, y: number }
interface ContactDisk { id: string, center: Point2D, radius: number, regionId: string }
interface TangentSegment {
    type: 'LSL' | 'RSR' | 'LSR' | 'RSL';
    start: Point2D;
    end: Point2D;
    length: number;
    startDiskId: string;
    endDiskId: string;
}

// ------------------------------------------------------------------
// COPY OF RELEVANT LOGIC FROM contactGraph.ts
// ------------------------------------------------------------------

function intersectsDisk(p1: Point2D, p2: Point2D, disk: ContactDisk): boolean {
    const cx = disk.center.x;
    const cy = disk.center.y;
    const r = disk.radius;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - cx;
    const fy = p1.y - cy;

    const a = dx * dx + dy * dy;

    if (a < 1e-9) {
        return (fx * fx + fy * fy) < (r * 0.95) ** 2;
    }

    // --- Method 1: Quadratic (Boundary Crossing) ---
    const bCoeff = 2 * (fx * dx + fy * dy);
    const cCoeff = (fx * fx + fy * fy) - r * r;
    const discriminant = bCoeff * bCoeff - 4 * a * cCoeff;

    if (discriminant > 0) {
        const sqrtD = Math.sqrt(discriminant);
        const t1 = (-bCoeff - sqrtD) / (2 * a);
        const t2 = (-bCoeff + sqrtD) / (2 * a);

        const eps = 0.005;
        if ((t1 > eps && t1 < 1 - eps) || (t2 > eps && t2 < 1 - eps)) {
            return true;
        }
    }

    // --- Method 2: Midpoint Inside Check ---
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const midDistSq = (mx - cx) ** 2 + (my - cy) ** 2;
    if (midDistSq < (r * 0.95) ** 2) {
        return true;
    }

    return false;
}

function testPath() {
    // Scenario: 3 Disks in a triangle-ish config
    // Start Disk (Bottom Left)
    const d1: ContactDisk = { id: 'D1', center: { x: 0, y: 100 }, radius: 40, regionId: 'default' };
    // End Disk (Top)
    const d2: ContactDisk = { id: 'D2', center: { x: 100, y: 0 }, radius: 40, regionId: 'default' };
    // Obstacle Disk (Middle) - Placed to graze the path
    // Path from D1 (approx 0,60) to D2 (approx 60,0)?
    const d3: ContactDisk = { id: 'D3', center: { x: 45, y: 45 }, radius: 15, regionId: 'default' };

    const obstacles = [d1, d2, d3];

    // Point A on D1 (Left/Top side)
    const start: Point2D = { x: 0, y: 60 }; // On surface of D1 (bottom)

    // Point B on D2 (Left/Bottom side)
    const end: Point2D = { x: 60, y: 0 }; // On surface of D2

    console.log("Testing Path from", start, "to", end);

    // 1. Direct Line Check
    console.log("1. Checking Direct Line D1->D2 against D3");
    const blocked = intersectsDisk(start, end, d3);
    console.log("   Blocked by D3?", blocked);

    // 2. Tangent Logic Check (Simulated)
    console.log("2. Checking Tangent Departure Robustness");
    // Tangent from Start to End
    const tPt = end;
    const startD = d1;

    // Emulate the robust check loop
    console.log("   Checking if Start->End is blocked by D1 (StartDisk) with robust check...");

    let isBlocked = false;
    const obs = d1; // Start Disk

    const distStart = Math.sqrt(Math.pow(start.x - obs.center.x, 2) + Math.pow(start.y - obs.center.y, 2));
    console.log("   Dist to StartDisk center:", distStart, "Radius:", obs.radius);

    if (Math.abs(distStart - obs.radius) < obs.radius * 0.05) {
        const nx = (start.x - obs.center.x) / distStart;
        const ny = (start.y - obs.center.y) / distStart;
        const dx = tPt.x - start.x;
        const dy = tPt.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        const dot = (nx * dx + ny * dy) / len;
        console.log("   Dot Product:", dot);

        if (dot >= -0.01) {
            console.log("   robust check PASS (continue)");
        } else {
            console.log("   robust check FAIL (check intersectsDisk)");
            if (intersectsDisk(start, tPt, obs)) {
                console.log("   intersectsDisk TRUE -> BLOCKED");
                isBlocked = true;
            }
        }
    }

    // 3. Check Obstacle D3 grazing
    console.log("3. Checking grazing on D3");
    if (intersectsDisk(start, end, d3)) {
        console.log("   D3 blocks direct path");
    } else {
        console.log("   D3 permits direct path");
    }
}

testPath();
