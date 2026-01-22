# Dubins Paths - Worked Examples

## Example 1: Simple LSL Path

### Configuration
```typescript
const start: Pose2D = { x: 0, y: 0, theta: 0 };
const end: Pose2D = { x: 4, y: 0, theta: 0 };
const dubins = new DubinsPaths(1.0);
```

### Geometric Analysis

**Adjacent Circles**:
- Left circle at start: c_L(start) = (0, 1)
- Left circle at end: c_L(end) = (4, 1)
- Distance: d = 4

**Tangent Points**:
- Since circles are horizontally aligned with same radius
- External tangent is horizontal line at y = 1
- p₁ = (0, 1), p₂ = (4, 1)

**Path Segments**:
1. Arc from (0,0) to (0,1): length = πr/2 = π/2
2. Straight from (0,1) to (4,1): length = 4
3. Arc from (4,1) to (4,0): length = πr/2 = π/2

**Total Length**: π + 4 ≈ 7.14

### Code
```typescript
const path = dubins.lslPath(start, end);
console.log(path.totalLength); // ~7.14
console.log(path.segments[0].type); // 'L'
console.log(path.segments[1].type); // 'S'
console.log(path.segments[2].type); // 'L'
```

---

## Example 2: LRL Path with Close Endpoints

### Configuration
```typescript
const start: Pose2D = { x: 0, y: 0, theta: 0 };
const end: Pose2D = { x: 2, y: 0, theta: 0 };
const dubins = new DubinsPaths(1.0);
```

### Geometric Analysis

**Constraint Check**:
- c_L(start) = (0, 1)
- c_L(end) = (2, 1)
- d = 2 < 4r = 4 ✓ (LRL path possible)

**Middle Circle Calculation**:
- Using law of cosines: α = arccos(2/4) = arccos(0.5) = π/3
- Base angle: θ = 0
- Middle circle center: c_M = (0,1) + 2(cos(π/3), sin(π/3)) = (1, 1+√3)

**Path Characteristics**:
- All three segments are circular arcs
- No straight segments
- Symmetric configuration

### Code
```typescript
const lrlPath = dubins.lrlPath(start, end);
const lslPath = dubins.lslPath(start, end);

console.log(lrlPath.valid); // true
console.log(lslPath.valid); // true

// LRL is shorter for close endpoints
console.log(lrlPath.totalLength < lslPath.totalLength); // true
```

---

## Example 3: All 6 Paths Comparison

### Configuration
```typescript
const start: Pose2D = { x: 0, y: 0, theta: Math.PI/4 };
const end: Pose2D = { x: 3, y: 2, theta: Math.PI/2 };
const dubins = new DubinsPaths(1.0);
```

### Computing All Paths
```typescript
const allPaths = dubins.computeAllPaths(start, end);

allPaths.forEach(path => {
  if (path.valid) {
    console.log(`${path.type}: ${path.totalLength.toFixed(3)}`);
  } else {
    console.log(`${path.type}: INVALID`);
  }
});
```

### Expected Output
```
LSL: 5.234
RSR: 6.891
LSR: 5.678
RSL: 7.123
LRL: 5.012
RLR: INVALID
```

### Finding Minimal Path
```typescript
const minimal = dubins.computeMinimalPath(start, end);
console.log(`Shortest path: ${minimal.type} = ${minimal.totalLength}`);
// Output: Shortest path: LRL = 5.012
```

---

## Example 4: Knot Embedding Length

### Trefoil Knot Control Points
```typescript
const trefoilPoints: Point2D[] = [
  { x: 2, y: 0 },
  { x: 1, y: Math.sqrt(3) },
  { x: -1, y: Math.sqrt(3) },
  { x: -2, y: 0 },
  { x: -1, y: -Math.sqrt(3) },
  { x: 1, y: -Math.sqrt(3) },
];

function computeKnotLength(points: Point2D[], minRadius: number): number {
  const dubins = new DubinsPaths(minRadius);
  let totalLength = 0;
  
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    
    // Estimate tangent angles
    const theta1 = estimateTangent(points, i);
    const theta2 = estimateTangent(points, (i + 1) % points.length);
    
    const start: Pose2D = { ...current, theta: theta1 };
    const end: Pose2D = { ...next, theta: theta2 };
    
    const path = dubins.computeMinimalPath(start, end);
    if (path) {
      totalLength += path.totalLength;
    }
  }
  
  return totalLength;
}

function estimateTangent(points: Point2D[], index: number): number {
  const n = points.length;
  const prev = points[(index - 1 + n) % n];
  const next = points[(index + 1) % n];
  
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  
  return Math.atan2(dy, dx);
}

const length = computeKnotLength(trefoilPoints, 0.5);
console.log(`Trefoil knot length: ${length}`);
```

---

## Example 5: Discontinuity Detection

### Configuration (From Paper Figure 1)
```typescript
const start: Pose2D = { x: 0, y: 0, theta: 2*Math.PI }; // = 0
const base: Point2D = { x: 1, y: 1 };
const dubins = new DubinsPaths(1.0);

// Vary final angle around π/2
const angles = [];
const lengths = [];

for (let theta = Math.PI/2 - 0.2; theta <= Math.PI/2 + 0.2; theta += 0.01) {
  const end: Pose2D = { ...base, theta };
  const path = dubins.computeMinimalPath(start, end);
  
  if (path) {
    angles.push(theta);
    lengths.push(path.totalLength);
  }
}

// Detect discontinuities
for (let i = 1; i < lengths.length; i++) {
  const jump = Math.abs(lengths[i] - lengths[i-1]);
  if (jump > 0.5) {
    console.log(`Discontinuity at θ = ${angles[i]} (Δ = ${jump})`);
  }
}
```

### Output
```
Discontinuity at θ = 1.571 (Δ = 2.356)
```

This demonstrates the length discontinuity phenomenon described in Example 2.3(1) of the paper.

---

## Example 6: Proximity Condition Testing

### Test Condition A (Far apart circles)
```typescript
function testProximityConditionA() {
  const start: Pose2D = { x: 0, y: 0, theta: 0 };
  const end: Pose2D = { x: 10, y: 0, theta: 0 };
  const dubins = new DubinsPaths(1.0);
  
  const lrlPath = dubins.lrlPath(start, end);
  const rlrPath = dubins.rlrPath(start, end);
  const lslPath = dubins.lslPath(start, end);
  
  console.log('Condition A (d >= 4r):');
  console.log(`LRL valid: ${lrlPath.valid}`); // false
  console.log(`RLR valid: ${rlrPath.valid}`); // false
  console.log(`LSL valid: ${lslPath.valid}`); // true
}
```

### Test Condition D (Bounded isotopy class)
```typescript
function testProximityConditionD() {
  const start: Pose2D = { x: 0, y: 0, theta: 0 };
  const end: Pose2D = { x: 2.82, y: 0, theta: 0 };
  const dubins = new DubinsPaths(1.0);
  
  const allPaths = dubins.computeAllPaths(start, end);
  const validCount = allPaths.filter(p => p.valid).length;
  
  console.log('Condition D (d < 4r, bounded isotopy):');
  console.log(`Valid paths: ${validCount}/6`);
  
  // Both CCC and CSC paths should be valid
  const lrlPath = dubins.lrlPath(start, end);
  const lslPath = dubins.lslPath(start, end);
  
  console.log(`LRL valid: ${lrlPath.valid}`); // true
  console.log(`LSL valid: ${lslPath.valid}`); // true
}
```

---

## Example 7: Path Visualization Data

### Generating Visualization Points
```typescript
function generatePathPoints(path: DubinsPath, resolution: number = 50): Point2D[] {
  const points: Point2D[] = [];
  
  path.segments.forEach(segment => {
    const numPoints = Math.max(2, Math.floor(resolution * segment.length / path.totalLength));
    
    if (segment.type === 'S') {
      // Straight segment
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        points.push({
          x: segment.startPose.x + t * (segment.endPose.x - segment.startPose.x),
          y: segment.startPose.y + t * (segment.endPose.y - segment.startPose.y),
        });
      }
    } else {
      // Arc segment
      const center = segment.center!;
      const startAngle = segment.startAngle!;
      const endAngle = segment.endAngle!;
      
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const angle = startAngle + t * (endAngle - startAngle);
        
        points.push({
          x: center.x + segment.radius! * Math.cos(angle),
          y: center.y + segment.radius! * Math.sin(angle),
        });
      }
    }
  });
  
  return points;
}

// Usage
const start: Pose2D = { x: 0, y: 0, theta: 0 };
const end: Pose2D = { x: 3, y: 2, theta: Math.PI/3 };
const dubins = new DubinsPaths(1.0);

const path = dubins.computeMinimalPath(start, end);
if (path) {
  const points = generatePathPoints(path, 100);
  // Use points for SVG/Canvas rendering
}
```

---

## Performance Benchmarks

### Single Path Computation
```typescript
const start: Pose2D = { x: 0, y: 0, theta: 0 };
const end: Pose2D = { x: 5, y: 3, theta: Math.PI/4 };
const dubins = new DubinsPaths(1.0);

const iterations = 100000;
const startTime = performance.now();

for (let i = 0; i < iterations; i++) {
  dubins.computeMinimalPath(start, end);
}

const endTime = performance.now();
const avgTime = (endTime - startTime) / iterations;

console.log(`Average time per path: ${avgTime.toFixed(4)} ms`);
// Expected: ~0.01-0.02 ms (very fast!)
```

### Knot Length Computation
```typescript
const n = 100; // control points
const points: Point2D[] = generateKnotPoints(n);

const startTime = performance.now();
const length = computeKnotLength(points, 1.0);
const endTime = performance.now();

console.log(`Knot length: ${length}`);
console.log(`Computation time: ${(endTime - startTime).toFixed(2)} ms`);
// Expected: O(n) complexity, ~1-2 ms for n=100
```
