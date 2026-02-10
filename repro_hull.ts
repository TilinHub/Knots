
import { computeDiskHull, computeHullMetrics } from './src/core/geometry/diskHull';

const disks = [
    { id: '0', x: -1.67, y: -1.70, r: 1 },
    { id: '1', x: 0.10, y: 1.38, r: 1 },
    { id: '2', x: 1.39, y: -2.09, r: 1 },
    { id: '3', x: 0.02, y: -0.62, r: 1 },
];

const hull = computeDiskHull(disks);
const metrics = computeHullMetrics(hull);

console.log('Hull Disks:', hull.hullDisks.map(d => d.id));
console.log('Metrics:', metrics);
console.log('Tangent Length:', metrics.tangentLength);
console.log('Arc Length:', metrics.arcLength);
