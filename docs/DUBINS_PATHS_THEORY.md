# Dubins Paths - Mathematical Foundation

## Introduction

This document provides a comprehensive mathematical foundation for Dubins paths as implemented in the Knots project, based on the seminal work:

> **"Census of Bounded Curvature Paths"**  
> Jean Díaz and José Ayala (2020)  
> arXiv:2005.13210v1 [math.MG]

## Historical Context

### Origins

- **Markov (1857)**: First considered optimization problems relating curvature bounds to railroad design
- **Dubins (1957)**: Rigorously introduced bounded curvature paths and characterized minimal length paths
- **Graustein & Whitney (1937)**: Proved not all planar closed curves are regularly homotopic

### Modern Applications

Bounded curvature paths model trajectories of:
- Wheeled vehicles (cars, robots)
- Unmanned Aerial Vehicles (UAVs/drones)
- Mathematical knot embeddings with geometric constraints
- Motion planning under turning radius constraints

## Mathematical Definition

### Tangent Bundle Formulation

Let **TR²** denote the tangent bundle of the Euclidean plane R². Elements in TR² are pairs **(x, X)** where:
- **x** ∈ R² is a point in the plane
- **X** ∈ TₓR² is a tangent vector at x

### Bounded Curvature Path

Given two endpoints **(x, X), (y, Y)** ∈ TR², a path **γ: [0, s] → R²** is a **bounded curvature path** if:

1. **Regularity**: γ is C¹ and piecewise C²
2. **Arc-length parametrization**: ||γ'(t)|| = 1 for all t ∈ [0, s]
3. **Endpoint conditions**: 
   - γ(0) = x, γ'(0) = X
   - γ(s) = y, γ'(s) = Y
4. **Curvature bound**: ||γ''(t)|| ≤ κ for all t where defined

Where **κ = 1/r** is the maximum curvature (r = minimum turning radius).

## Dubins' Characterization Theorem

**Theorem (Dubins, 1957)**: The length minimizer among all bounded curvature paths between (x, X) and (y, Y) is necessarily one of:

### CSC Paths (Circle-Straight-Circle)
1. **LSL**: Left arc - Straight - Left arc
2. **RSR**: Right arc - Straight - Right arc
3. **LSR**: Left arc - Straight - Right arc
4. **RSL**: Right arc - Straight - Left arc

### CCC Paths (Circle-Circle-Circle)
5. **LRL**: Left arc - Right arc - Left arc
6. **RLR**: Right arc - Left arc - Right arc

Where:
- **L** = arc of circle traveled to the left (counterclockwise)
- **R** = arc of circle traveled to the right (clockwise)
- **S** = straight line segment

## Geometric Construction

### Adjacent Circles

For a pose (x, X) ∈ TR² with κ = 1/r:

#### Left Circle C_L(x)
- **Center**: c_L(x) = x - r · sin(θ) **ê₁** + r · cos(θ) **ê₂**
- **Radius**: r
- **Tangent**: Circle is tangent to X, curves counterclockwise

#### Right Circle C_R(x)
- **Center**: c_R(x) = x + r · sin(θ) **ê₁** - r · cos(θ) **ê₂**
- **Radius**: r
- **Tangent**: Circle is tangent to X, curves clockwise

### Path Construction Algorithms

#### LSL Path Construction

1. Compute left circle centers: c_L(x), c_L(y)
2. Find external common tangent between circles
3. Path segments:
   - **Arc 1**: Travel counterclockwise on C_L(x) from x to tangent point p₁
   - **Straight**: Travel along tangent from p₁ to p₂
   - **Arc 2**: Travel counterclockwise on C_L(y) from p₂ to y

**Length Formula**:
```
L_LSL = r·α₁ + d(p₁, p₂) + r·α₂
```
where α₁, α₂ are the arc angles.

#### LRL Path Construction

**Geometric Constraint**: Distance between circle centers must satisfy:
```
d(c_L(x), c_L(y)) ≤ 4r
```

1. Compute left circle centers: c_L(x), c_L(y)
2. Find middle circle center c_M tangent to both endpoint circles
3. Using law of cosines:
   ```
   α = arccos(d/(4r))
   c_M = c_L(x) + 2r·(cos(θ + α), sin(θ + α))
   ```
4. Path segments:
   - **Arc 1**: Counterclockwise on C_L(x) to tangent point with middle circle
   - **Arc 2**: Clockwise on middle circle
   - **Arc 3**: Counterclockwise on C_L(y)

**Length Formula**:
```
L_LRL = r·α₁ + r·α₂ + r·α₃
```

## Proximity Conditions

The paper defines four proximity conditions based on distances between adjacent circles:

### Condition A
```
d(c_L(x), c_L(y)) ≥ 4r  AND  d(c_R(x), c_R(y)) ≥ 4r
```
- **Implication**: Only CSC paths possible, no CCC paths
- No bounded isotopy classes exist

### Condition B
```
[d(c_L(x), c_L(y)) < 4r  AND  d(c_R(x), c_R(y)) ≥ 4r]
OR
[d(c_L(x), c_L(y)) ≥ 4r  AND  d(c_R(x), c_R(y)) < 4r]
```
- **Implication**: Mixed configuration

### Condition C
```
d(c_L(x), c_L(y)) < 4r  AND  d(c_R(x), c_R(y)) < 4r
AND no bounded isotopy class Δ(x,y)
```

### Condition D
```
d(c_L(x), c_L(y)) < 4r  AND  d(c_R(x), c_R(y)) < 4r
AND bounded isotopy class Δ(x,y) exists
```
- **Implication**: "Trapped region" Ω ⊂ R² exists
- Embedded paths cannot escape Ω without violating curvature bound

## Critical Angles and Class Range

For knot embeddings, we vary the final direction Y_θ = e^(iθ) ∈ T_y R².

### Critical Angles ω₋ and ω₊

For a fixed final position y ∈ R²:
- **ω₋**: Smallest angle θ ∈ (-π, π) such that bounded isotopy class exists
- **ω₊**: Largest angle θ ∈ (-π, π) such that bounded isotopy class exists

### Class Range Function

```
Θ(y) = ω₊(y) - ω₋(y) ≥ 0
```

This function gives the angular range where the knot embedding admits bounded isotopy classes.

### Angular Formulae

From Section 6 of the paper:

#### Short Triangles (d(c_L(x), y) < 3r)

```
ω₋ = δ₁ + α₁ - π/2
ω₊ = δ₂ - α₂ + π/2
```

#### Long Triangles (d(c_L(x), y) ≥ 3r)

```
ω₋ = δ₃ - α₃ + π/2
ω₊ = δ₄ + α₄ - π/2
```

Where:
- **δᵢ**: Angle from circle center to final position
- **αᵢ**: Angle computed via law of cosines in auxiliary triangles

## Topological Transitions

### Type 1: CC Isolated Points

A **cc isolated point** is a concatenation of two circular arcs, each of length < π.

**Property**: Small perturbations in final direction cause:
- Transition from isolated point to bounded isotopy class
- OR transition to space without bounded isotopy class

**Mathematical significance**: These are critical values ω₋ or ω₊.

### Type 2: Distance Constraint d = 4r

When d(c_L(x), c_L(y)) = 4r exactly:
- Boundary between Condition A and other conditions
- Transition point in existence of CCC paths

## Discontinuity Phenomena

### Length Discontinuities

**Theorem 3.9 (Paper)**: Length variation of length minimizers can be discontinuous for arbitrarily close endpoints.

**Example** (Figure 1 in paper):
- Start: x = (0, 0), X = e^(2πi)
- End: y = (1, 1), Y_θ = e^(θi)

As θ varies near π/2:
- Sudden jumps in minimal path length occur
- Indicates existence of isolated points

### Homotopy Class Structure

**Theorem 4.4 (Paper)**: Certain paths in different homotopy classes of regular curves belong to the same homotopy class when restricted to bounded curvature paths.

## Application to Knot Embeddings

### Measuring Knot Length

For a knot represented by control points **{p₁, p₂, ..., pₙ}**:

1. Estimate tangent directions at each point
2. For consecutive points pᵢ and pᵢ₊₁:
   - Create poses: (pᵢ, θᵢ) and (pᵢ₊₁, θᵢ₊₁)
   - Compute minimal Dubins path
3. Total knot length:
   ```
   L_knot = Σ L_Dubins(pᵢ, pᵢ₊₁)
   ```

### Advantages for Knot Theory

1. **Geometric realism**: Models physical knots with thickness
2. **Smoothness guarantee**: C¹ continuity ensured
3. **Computational tractability**: Explicit formulas available
4. **Topological insights**: Discontinuities reveal knot structure

## Computational Complexity

### Per Path Computation
- **Time**: O(1) - closed form solutions
- **Space**: O(1)

### Minimal Path Selection
- **Time**: O(1) - evaluate 6 paths, select minimum
- **Space**: O(1)

### For n-point Knot
- **Time**: O(n) - linear in number of segments
- **Space**: O(n)

## References

1. Dubins, L.E. (1957). "On Curves of Minimal Length with a Constraint on Average Curvature, and with Prescribed Initial and Terminal Positions and Tangents." American Journal of Mathematics, 79(3), 497-516.

2. Díaz, J., & Ayala, J. (2020). "Census of Bounded Curvature Paths." arXiv:2005.13210v1 [math.MG].

3. Reeds, J.A., & Shepp, L.A. (1990). "Optimal paths for a car that goes both forwards and backwards." Pacific Journal of Mathematics, 145(2), 367-393.

4. Sussmann, H.J., & Tang, G. (1991). "Shortest paths for the Reeds-Shepp car: a worked out example of the use of geometric techniques in nonlinear optimal control." Report SYCON-91-10.

## Implementation Notes

### Numerical Stability

- Use atan2 for angle computations to handle all quadrants
- Epsilon tolerance (10⁻⁶) for geometric comparisons
- Normalize angles to [-π, π] range

### Edge Cases

1. **Degenerate configurations**: x = y (zero distance)
2. **Parallel tangents**: θ_x = θ_y ± π
3. **Circle tangency**: d = 2r or d = 4r exactly

### Optimization

- Lazy evaluation: Only compute requested path types
- Caching: Store adjacent circle centers
- Early termination: Return first valid path if only existence needed
