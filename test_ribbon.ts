(global as any).window = global;
import { findEnvelopePathFromPoints } from './src/core/geometry/contactGraph';
type Point2D = { x: number; y: number };
type ContactDisk = { id: string; center: Point2D; radius: number; regionId: string; };

const disks: ContactDisk[] = [
    { id: '0', center: { x: 0.60, y: -3.78 }, radius: 1.5, regionId: 'default' },
    { id: '1', center: { x: -3.88, y: -1.25 }, radius: 1.5, regionId: 'default' },
    { id: '4', center: { x: -3.65, y: 3.16 }, radius: 1.5, regionId: 'default' },
    { id: '2', center: { x: 0.24, y: 1.27 }, radius: 1.5, regionId: 'default' },
    { id: '3', center: { x: 4.93, y: -0.77 }, radius: 1.5, regionId: 'default' },
];

const sequence = ['0', '1', '4', '3', '0']; // User's assumed explicit sequence missing 2
// Or wait, the sequence must include 2 because the ribbon goes 4->2->3... wait, earlier we saw it goes 4->3.
// Let's assume the user just defined 5 disks but connected 0->1->4->3->0.

// The anchors are exactly at the top of the disks in sequence
const anchors: Point2D[] = sequence.map(id => {
    const d = disks.find(d => d.id === id)!;
    return { x: d.center.x, y: d.center.y + d.radius };
});

const result = findEnvelopePathFromPoints(anchors, disks);
console.log(JSON.stringify(result, null, 2));

