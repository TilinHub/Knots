import { findEnvelopePathFromPoints, buildBoundedCurvatureGraph } from './src/core/geometry/contactGraph';

const R = 50;
const obstacles = [
    { id: 'disk-0', center: { x: -174.5, y: -124 }, radius: R, regionId: 'r' },
    { id: 'disk-1', center: { x: 9.5, y: -3.5 }, radius: R, regionId: 'r' },
    { id: 'disk-2', center: { x: 131, y: -95 }, radius: R, regionId: 'r' },
    { id: 'disk-3', center: { x: -177, y: 57 }, radius: R, regionId: 'r' },
];

const anchors = [
    { x: -177, y: 107 }, // Top of disk 3
    { x: 131, y: -145 }, // Bottom of disk 2
];

console.log("Running fallback test...");
const res = findEnvelopePathFromPoints(anchors, obstacles);
console.log("Path segments:", res.path.length);
if (res.path.length > 0) {
    for (const s of res.path) {
        if (s.type === 'ARC') {
            console.log(`ARC on ${s.diskId}: start ${s.startAngle.toFixed(2)} end ${s.endAngle.toFixed(2)} len ${s.length.toFixed(2)}`);
        } else {
            console.log(`TANGENT ${s.type} from ${s.startDiskId} to ${s.endDiskId} len: ${s.length.toFixed(2)}`);
        }
    }
} else {
    console.log("NO PATH FOUND");
}
