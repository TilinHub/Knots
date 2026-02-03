
import { SmoothCSEnvelope, Circle } from './core/geometry/CSEnvelope';

const circles: Circle[] = [
    { center: { x: 0, y: 0 }, radius: 1, id: '0' },
    { center: { x: 2.47, y: 0.08 }, radius: 1, id: '1' } // Coordinates from screenshot
];

console.log("Testing with initial coordinates:");
const envelope = new SmoothCSEnvelope(circles);
const points = envelope.getEnvelopePoints();

console.log(`Generated ${points.length} points.`);

// Check for NaN or Infinity
let hasInvalid = false;
points.forEach((p, i) => {
    if (!isFinite(p.x) || !isFinite(p.y)) {
        console.error(`Point ${i} is invalid:`, p);
        hasInvalid = true;
    }
});

if (!hasInvalid) {
    console.log("No invalid numbers found with initial coordinates.");
}

// Test edge case: Overlap transition
console.log("\nTesting overlap transition (dist approx 2):");
// Radius sum = 2. Distance 2.
const circlesTouch: Circle[] = [
    { center: { x: 0, y: 0 }, radius: 1, id: '0' },
    { center: { x: 2.0, y: 0.0001 }, radius: 1, id: '1' }
];
const envTouch = new SmoothCSEnvelope(circlesTouch);
const ptsTouch = envTouch.getEnvelopePoints();
console.log(`Overlap transition points: ${ptsTouch.length}`);
ptsTouch.forEach((p, i) => {
    if (!isFinite(p.x) || !isFinite(p.y)) {
        console.error(`Touch Point ${i} is invalid:`, p);
    }
});

// Test deep overlap
console.log("\nTesting deep overlap:");
const circlesOverlap: Circle[] = [
    { center: { x: 0, y: 0 }, radius: 1, id: '0' },
    { center: { x: 0.5, y: 0.0 }, radius: 1, id: '1' }
];
const envOverlap = new SmoothCSEnvelope(circlesOverlap);
const ptsOverlap = envOverlap.getEnvelopePoints();
console.log(`Deep overlap points: ${ptsOverlap.length}`);
