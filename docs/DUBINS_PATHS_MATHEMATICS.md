# Mathematical Foundation of Dubins Paths for Knot Theory

## Table of Contents

1. [Introduction](#introduction)
2. [Tangent Bundle TR²](#tangent-bundle-tr%C2%B2)
3. [Bounded Curvature Paths](#bounded-curvature-paths)
4. [The Six Dubins Path Types](#the-six-dubins-path-types)
5. [Geometric Constructions](#geometric-constructions)
6. [Length Calculations](#length-calculations)
7. [Application to Knot Theory](#application-to-knot-theory)
8. [References](#references)

---

## Introduction

This document provides the complete mathematical foundation for using **Dubins paths** to measure the length of knot embeddings with bounded curvature constraints.

Based on the seminal work:
- **Dubins, L. E.** (1957). "On Curves of Minimal Length with a Constraint on Average Curvature, and with Prescribed Initial and Terminal Positions and Tangents"
- **Díaz, J. & Ayala, J.** (2020). "Census of Bounded Curvature Paths" [arXiv:2005.13210]

---

## Tangent Bundle TR²

### Definition

The **tangent bundle** of the Euclidean plane R² is denoted **TR²** and consists of pairs:

```
TR² = {(x, X) : x ∈ R², X ∈ T_x R²}
```

Where:
- `x = (x, y)` is a point in the plane R²
- `X` is a unit tangent vector at point `x`
- `T_x R²` is the tangent space at `x` (all vectors based at `x`)

### Representation

In practice, we represent elements of TR² as **poses**:

```typescript
interface Pose2D {
  position: Point2D;  // x ∈ R²
  theta: number;      // θ ∈ [0, 2π), direction of X
}
```

The angle `θ` fully determines the unit tangent vector:

```
X = (cos θ, sin θ)
```

### Projection

The natural projection `p: TR² → R²` is defined by:

```
p(x, X) = x
```

The fiber over a point `y ∈ R²` is:

```
p⁻¹(y) = {(y, X) : X ∈ T_y R²} ≅ S¹
```

Each fiber is a circle S¹ representing all possible tangent directions at that point.

---

## Bounded Curvature Paths

### Definition

**Definition 2.1** (from Díaz & Ayala): Given `(x, X), (y, Y) ∈ TR²`, a path `γ: [0, s] → R²` connecting these points is a **bounded curvature path** if:

1. `γ` is **C¹** (continuously differentiable) and **piecewise C²**
2. `γ` is **parametrized by arc length**: `||γ'(t)|| = 1` for all `t ∈ [0, s]`
3. **Endpoint conditions**:
   - `γ(0) = x` and `γ'(0) = X`
   - `γ(s) = y` and `γ'(s) = Y`
4. **Curvature bound**: `||γ''(t)|| ≤ κ` for all `t` when defined

### Curvature Constraint

The curvature `κ` is related to the **minimum turning radius** `r`:

```
κ = 1/r
```

**Physical interpretation**: A vehicle with turning radius `r` cannot follow a curve with curvature greater than `κ = 1/r`.

In our implementation, we normalize to `r = 1`, thus `κ = 1`.

### Space of Bounded Curvature Paths

For fixed endpoints `(x, X), (y, Y) ∈ TR²`, we denote:

```
Γ(x̄, ȳ) = {all bounded curvature paths from (x, X) to (y, Y)}
```

This space has rich topological structure:
- May contain **isolated points** (paths that cannot be deformed)
- May contain **homotopy classes** (families of equivalent paths)
- May contain **isotopy classes** (bounded regions trapping embedded paths)

---

## The Six Dubins Path Types

**Dubins' Theorem** (1957): The length-minimizing bounded curvature paths are composed of at most **three segments** from the set:

- **L**: Left circular arc (counterclockwise)
- **R**: Right circular arc (clockwise)
- **S**: Straight line segment

This gives **6 possible path types**:

### CSC Paths (Circle-Straight-Circle)

1. **LSL**: Left - Straight - Left
2. **RSR**: Right - Straight - Right
3. **LSR**: Left - Straight - Right
4. **RSL**: Right - Straight - Left

### CCC Paths (Circle-Circle-Circle)

5. **LRL**: Left - Right - Left
6. **RLR**: Right - Left - Right

---

## Geometric Constructions

### Adjacent Circles

Given a pose `(x, X) ∈ TR²` with `x = (x, y)` and `θ = ∠(X)`, we define:

#### Left Circle Center

The center of the circle tangent to the left of the trajectory:

```
C_L(x, θ) = (x - r sin θ, y + r cos θ)
```

**Geometric meaning**: Rotate the tangent vector 90° counterclockwise and move `r` units.

#### Right Circle Center

The center of the circle tangent to the right:

```
C_R(x, θ) = (x + r sin θ, y - r cos θ)
```

**Geometric meaning**: Rotate the tangent vector 90° clockwise and move `r` units.

### Tangent Lines

Given two circles with centers `c₁, c₂` and equal radii `r`:

#### External Tangent

**Condition**: `d(c₁, c₂) ≥ 2r`

The external tangent runs parallel to the line connecting centers:

```
θ_base = atan2(c₂.y - c₁.y, c₂.x - c₁.x)
θ_tangent = θ_base ± π/2
```

Tangent points:
```
p₁ = c₁ + r(±cos(θ_base + π/2), ±sin(θ_base + π/2))
p₂ = c₂ + r(±cos(θ_base + π/2), ±sin(θ_base + π/2))
```

#### Internal Tangent

**Condition**: `d(c₁, c₂) ≥ 2r`

The internal tangent crosses between the circles:

```
α = arcsin(2r / d)
θ_tangent = θ_base + α
```

Tangent points:
```
p₁ = c₁ + r × perpendicular(θ_tangent)
p₂ = c₂ - r × perpendicular(θ_tangent)
```

---

## Length Calculations

### Arc Length

For a circular arc with radius `r` and angular span `Δθ`:

```
L_arc = r × |Δθ|
```

#### Left Turn (counterclockwise)

```
Δθ_L = θ_end - θ_start
if Δθ_L < 0:
    Δθ_L += 2π

L_left = r × Δθ_L
```

#### Right Turn (clockwise)

```
Δθ_R = θ_start - θ_end
if Δθ_R < 0:
    Δθ_R += 2π

L_right = r × Δθ_R
```

### Straight Segment Length

```
L_straight = ||p₂ - p₁|| = √((x₂-x₁)² + (y₂-y₁)²)
```

### Total Path Length

For any Dubins path with segments `s₁, s₂, s₃`:

```
L_total = L(s₁) + L(s₂) + L(s₃)
```

---

## Detailed Construction Algorithms

### LSL Path Construction

**Input**: Start pose `(xₛ, θₛ)`, end pose `(xₑ, θₑ)`

**Steps**:

1. **Compute circle centers**:
   ```
   cₗₛ = C_L(xₛ, θₛ)
   cₗₑ = C_L(xₑ, θₑ)
   ```

2. **Check feasibility**:
   ```
   d = ||cₗₑ - cₗₛ||
   if d < 2r - ε:
       return null  // No LSL path exists
   ```

3. **Find external tangent**:
   ```
   θ_base = atan2(cₗₑ.y - cₗₛ.y, cₗₑ.x - cₗₛ.x)
   θ_tangent = θ_base + π/2
   
   p₁ = cₗₛ + r(cos θ_tangent, sin θ_tangent)
   p₂ = cₗₑ + r(cos θ_tangent, sin θ_tangent)
   ```

4. **Compute arc angles**:
   ```
   θ₁_start = atan2(xₛ.y - cₗₛ.y, xₛ.x - cₗₛ.x)
   θ₁_end = atan2(p₁.y - cₗₛ.y, p₁.x - cₗₛ.x)
   
   θ₂_start = atan2(p₂.y - cₗₑ.y, p₂.x - cₗₑ.x)
   θ₂_end = atan2(xₑ.y - cₗₑ.y, xₑ.x - cₗₑ.x)
   ```

5. **Calculate lengths**:
   ```
   L₁ = r × normalize_angle_ccw(θ₁_end - θ₁_start)
   Lₛ = ||p₂ - p₁||
   L₂ = r × normalize_angle_ccw(θ₂_end - θ₂_start)
   
   L_total = L₁ + Lₛ + L₂
   ```

### LRL Path Construction

**Input**: Start pose `(xₛ, θₛ)`, end pose `(xₑ, θₑ)`

**Steps**:

1. **Compute left circle centers**:
   ```
   cₗₛ = C_L(xₛ, θₛ)
   cₗₑ = C_L(xₑ, θₑ)
   ```

2. **Check feasibility**:
   ```
   d = ||cₗₑ - cₗₛ||
   if d > 4r:
       return null  // Circles too far apart
   ```

3. **Find middle circle center** (right-turning):
   
   The middle circle `cᴹ` must satisfy:
   - `||cᴹ - cₗₛ|| = 2r` (tangent to first circle)
   - `||cᴹ - cₗₑ|| = 2r` (tangent to second circle)
   
   **Solution using triangle geometry**:
   
   ```
   // Midpoint between circles
   m = (cₗₛ + cₗₑ) / 2
   
   // Distance from midpoint to middle circle
   h = √(4r² - (d/2)²)
   
   // Perpendicular direction
   θ_perp = atan2(cₗₑ.y - cₗₛ.y, cₗₑ.x - cₗₛ.x) + π/2
   
   // Middle circle center (choose + or - for different solutions)
   cᴹ = m + h(cos θ_perp, sin θ_perp)
   ```

4. **Find tangent points**:
   ```
   p₁ = point where cₗₛ and cᴹ are tangent
   p₂ = point where cᴹ and cₗₑ are tangent
   ```

5. **Calculate lengths**:
   ```
   L₁ = left arc from xₛ to p₁ on cₗₛ
   Lᴹ = right arc from p₁ to p₂ on cᴹ
   L₂ = left arc from p₂ to xₑ on cₗₑ
   
   L_total = L₁ + Lᴹ + L₂
   ```

---

## Application to Knot Theory

### Knot Embedding as Control Points

A planar knot embedding is represented as:

```
K = {p₀, p₁, p₂, ..., pₙ} ⊂ R²
```

with `pₙ₊₁ = p₀` for closed curves.

### Converting to Poses in TR²

For each control point `pᵢ`, we estimate the tangent direction `θᵢ`:

#### Centered Difference Method

```
θᵢ = atan2(pᵢ₊₁.y - pᵢ₋₁.y, pᵢ₊₁.x - pᵢ₋₁.x)
```

#### Catmull-Rom Method

With tension parameter `τ ∈ [0, 1]`:

```
vᵢ = (1 - τ)(pᵢ₊₁ - pᵢ₋₁) / 2
θᵢ = atan2(vᵢ.y, vᵢ.x)
```

### Computing Total Knot Length

Given poses `(̄p₀, θ₀), ..., (̄pₙ, θₙ)`, compute:

```
L_knot = Σᵢ₌₀ⁿⁿ L_Dubins((̄pᵢ, θᵢ) → (̄pᵢ₊₁, θᵢ₊₁))
```

where `L_Dubins` is the length of the optimal Dubins path between consecutive poses.

### Example: Trefoil Knot

Parametric representation:

```
x(t) = sin(t) + 2sin(2t)
y(t) = cos(t) - 2cos(2t)
t ∈ [0, 2π]
```

Sample at `n` points:

```
tᵢ = 2πi / n,  i = 0, ..., n-1
pᵢ = (x(tᵢ), y(tᵢ))
```

Tangent vectors:

```
x'(t) = cos(t) + 4cos(2t)
y'(t) = -sin(t) + 4sin(2t)

θᵢ = atan2(y'(tᵢ), x'(tᵢ))
```

---

## Mathematical Properties

### Discontinuities in Length Function

**Theorem 2.3** (Díaz & Ayala): The length of minimal paths can be **discontinuous** as endpoints vary.

**Example**: Consider start `(0, 0, 0)` and end `(1, 1, θ)`:
- For `θ = π/2 - ε`: LSL path with length ≈ L₁
- For `θ = π/2`: Isolated point (special cc path)
- For `θ = π/2 + ε`: Different path with length ≈ L₂

Where `L₂ - L₁` can be arbitrarily large.

### Proximity Conditions

From the paper, endpoints are classified by proximity:

#### Condition A
```
d(C_L(start), C_L(end)) ≥ 4r  AND  d(C_R(start), C_R(end)) ≥ 4r
```
⇒ No bounded isotopy classes

#### Condition B
```
(d(C_L(start), C_L(end)) < 4r  AND  d(C_R(start), C_R(end)) ≥ 4r)
OR
(d(C_L(start), C_L(end)) ≥ 4r  AND  d(C_R(start), C_R(end)) < 4r)
```

#### Condition C
```
d(C_L(start), C_L(end)) < 4r  AND  d(C_R(start), C_R(end)) < 4r
AND no bounded isotopy class exists
```

#### Condition D
```
d(C_L(start), C_L(end)) < 4r  AND  d(C_R(start), C_R(end)) < 4r
AND bounded isotopy class exists
```

---

## Implementation Notes

### Numerical Stability

1. **Angle normalization**: Always normalize angles to `[0, 2π)` or `[-π, π)`

2. **Epsilon comparisons**: Use `ε = 10⁻⁶` for floating-point comparisons:
   ```
   if (abs(d - 2r) < ε):
       // Circles are tangent
   ```

3. **Arc length calculation**: Handle angle wrapping:
   ```typescript
   function normalizeAngleCCW(angle: number): number {
     while (angle < 0) angle += 2 * Math.PI;
     while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
     return angle;
   }
   ```

### Optimization

For knots with many control points:

1. **Cache circle centers**: Compute `C_L` and `C_R` once per pose
2. **Parallel computation**: Calculate Dubins paths independently
3. **Adaptive sampling**: Use more points in high-curvature regions

---

## References

1. **Dubins, L. E.** (1957). "On Curves of Minimal Length with a Constraint on Average Curvature, and with Prescribed Initial and Terminal Positions and Tangents". *American Journal of Mathematics*, 79(3), 497-516.

2. **Díaz, J., & Ayala, J.** (2020). "Census of Bounded Curvature Paths". *arXiv preprint arXiv:2005.13210*. Available at: https://arxiv.org/abs/2005.13210

3. **Graustein, W. C.** (1937). "On the total curvature of closed curves". *Annals of Mathematics*, 38(2), 289-296.

4. **Reeds, J. A., & Shepp, L. A.** (1990). "Optimal paths for a car that goes both forwards and backwards". *Pacific Journal of Mathematics*, 145(2), 367-393.

5. **Sussmann, H. J., & Tang, G.** (1991). "Shortest paths for the Reeds-Shepp car: a worked out example of the use of geometric techniques in nonlinear optimal control". *Report SYCON-91-10, Rutgers University*.

---

## Appendix: Formula Summary

### Circle Centers
```
C_L(x, y, θ) = (x - r sin θ, y + r cos θ)
C_R(x, y, θ) = (x + r sin θ, y - r cos θ)
```

### Arc Lengths
```
L_left = r × normalize_ccw(θ_end - θ_start)
L_right = r × normalize_cw(θ_start - θ_end)
```

### Path Type Selection

| Configuration | Available Paths |
|--------------|----------------|
| `d(C_L, C_L) ≥ 2r` and `d(C_R, C_R) ≥ 2r` | LSL, RSR, LSR, RSL |
| `d(C_L, C_L) < 4r` | LSL, LRL |
| `d(C_R, C_R) < 4r` | RSR, RLR |
| All conditions | All 6 paths possible |

---

*Last updated: January 2026*
*Implementation: See `src/core/math/DubinsPath.ts`*