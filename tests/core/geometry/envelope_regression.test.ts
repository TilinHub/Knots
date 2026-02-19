
import { computeRobustConvexHull } from '../../../src/core/geometry/robustHull';
import { CSDisk } from '../../../src/core/types/cs';

// Mock CSDisk factory
const createDisk = (id: string, x: number, y: number, r: number): CSDisk => ({
    id,
    center: { x, y },
    visualRadius: r,
    radius: r,
    kind: 'disk',
});

// Reproduce the user's 3-disk configuration (approximate from screenshot)
// Disk 0: (-1.07, 0.20), r=1.5
// Disk 1: (2.00, 0.00), r=1.5
// Disk 2: (4.65, 0.07), r=1.5
const disks = [
    createDisk('0', -1.07, 0.20, 1.5),
    createDisk('1', 2.00, 0.00, 1.5),
    createDisk('2', 4.65, 0.07, 1.5)
];

console.log("Running envelope regression test...");

try {
    const result = computeRobustConvexHull(disks);
    console.log("Result:", result);

    if ('ok' in result) {
        if (result.ok) {
            console.log("SUCCESS: Path found");
        } else {
            console.error("FAILURE: Result not ok", result);
            process.exit(1);
        }


    }

} catch (e) {
    console.error("CRASH:", e);
    process.exit(1);
}
