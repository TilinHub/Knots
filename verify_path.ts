
import { checkDubinsPathCollision } from './src/core/geometry/dubins';
import { calculateBitangentPaths } from './src/core/geometry/dubins';
import { Obstacle } from './src/core/geometry/dubins';

// Mock data based on screenshot
const disks = [
    { id: '2', x: -88.72, y: -62.37, radius: 40 }, // Start
    { id: '3', x: 0.43, y: -17.08, radius: 40 }, // Obstacle
    { id: '0', x: 122.01, y: -20.92, radius: 40 }, // Obstacle
    { id: '1', x: 262.02, y: 168.39, radius: 40 }, // End
];

const startDisk = disks[0]; // 2
const endDisk = disks[3];   // 1
const obstacles = [disks[1], disks[2]]; // 3, 0

console.log('--- Testing Collision ---');

// Calculate Paths
const c1 = { x: startDisk.x, y: startDisk.y, radius: startDisk.radius };
const c2 = { x: endDisk.x, y: endDisk.y, radius: endDisk.radius };

const paths = calculateBitangentPaths(c1, c2);
console.log(`Calculated ${paths.length} bitangent paths.`);

paths.forEach(p => {
    console.log(`Path Type: ${p.type}, Length: ${p.length.toFixed(2)}`);
    const hit = checkDubinsPathCollision(p, obstacles);
    console.log(`  Collision Detected: ${hit}`);
});
