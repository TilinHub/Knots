
import { SmoothCSEnvelope } from './core/geometry/CSEnvelope';

const circles = [
    { center: { x: 0, y: 0 }, radius: 1, id: '0' },
    { center: { x: 2.47444, y: 2.84217 }, radius: 1, id: '1' } // Coordinates from screenshot
];

console.log("Testing with coordinates (TS):", circles);
const env = new SmoothCSEnvelope(circles);
const points = env.getEnvelopePoints();

console.log(`Generated ${points.length} points.`);

let hasError = false;
let maxVal = 0;

for (const p of points) {
    maxVal = Math.max(maxVal, Math.abs(p.x), Math.abs(p.y));
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        console.error("Found non-finite point:", p);
        hasError = true;
    }
}

console.log(`Max coordinate value: ${maxVal}`);

if (hasError || maxVal > 1000) {
    console.error("FAIL: Envelope exploded or has invalid values.");
    process.exit(1);
} else {
    console.log("SUCCESS: Envelope generated correctly.");
}
