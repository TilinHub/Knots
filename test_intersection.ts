type Point2D = { x: number; y: number };
type ContactDisk = { id: string; center: Point2D; radius: number; };

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
        return fx * fx + fy * fy < (r * 0.95) ** 2;
    }

    // --- Method 1: Quadratic (Boundary Crossing) ---
    const bCoeff = 2 * (fx * dx + fy * dy);
    const cCoeff = fx * fx + fy * fy - r * r;
    const discriminant = bCoeff * bCoeff - 4 * a * cCoeff;

    console.log(`Checking Disk ${disk.id}`);
    console.log({ discriminant, a, bCoeff, cCoeff });

    if (discriminant > 0) {
        const sqrtD = Math.sqrt(discriminant);
        const t1 = (-bCoeff - sqrtD) / (2 * a);
        const t2 = (-bCoeff + sqrtD) / (2 * a);

        const segmentLenSq = a;
        const segmentLen = Math.sqrt(segmentLenSq);
        const chordLen = (t2 - t1) * segmentLen;

        console.log({ t1, t2, chordLen });

        if (chordLen < r * 0.15) {
            console.log('grazing');
            return false; // Grazing
        }

        const eps = 0.005;
        if ((t1 > eps && t1 < 1 - eps) || (t2 > eps && t2 < 1 - eps)) {
            console.log('Strict True condition met');
            return true;
        }
        if (t1 < eps && t2 > 1 - eps) {
            console.log('Fully Inside condition met');
            return true;
        }
    }

    // --- Method 2: Midpoint Inside Check ---
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const midDistSq = (mx - cx) ** 2 + (my - cy) ** 2;
    console.log({ midDistSq, threshold: (r * 0.95) ** 2 });
    if (midDistSq < (r * 0.95) ** 2) {
        return true;
    }

    return false;
}

const cx1 = -3.88, cy1 = -1.25, r = 1.5;
const disk1 = { id: 'disk1', center: { x: cx1, y: cy1 }, radius: r };
const end = { x: cx1, y: cy1 + r }; // Top of disk 1
const cx2 = 0.24, cy2 = 1.27;

// Let's create a point t.pt on Disk 2
const tpt = { x: cx2, y: cy2 + r };

console.log('Result:', intersectsDisk(tpt, end, disk1));
