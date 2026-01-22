# Los 6 Caminos de Dubins - Referencia Matemática Completa

## Introducción

Este documento presenta una explicación matemática rigurosa de los **6 tipos de caminos de Dubins**, fundamentales para medir el largo de envolventes de nudos con curvatura acotada.

**Fuente**: "Census of Bounded Curvature Paths" - Jean Díaz & José Ayala (2020) [arXiv:2005.13210v1]

---

## Definición General

Un **camino de Dubins** entre dos poses (x, X) y (y, Y) en el plano es un camino de curvatura acotada que minimiza la longitud total.

### Restricciones

1. **Curvatura máxima**: κ = 1/r (donde r es el radio mínimo de giro)
2. **Continuidad**: C¹ (derivada continua)
3. **Parametrización por longitud de arco**: ||γ'(t)|| = 1
4. **Condiciones de frontera**: γ(0) = x, γ'(0) = X, γ(s) = y, γ'(s) = Y

### Teorema de Caracterización (Dubins, 1957)

El camino de longitud mínima es necesariamente uno de estos 6 tipos:

- **CSC** (Círculo-Recta-Círculo): LSL, RSR, LSR, RSL
- **CCC** (Círculo-Círculo-Círculo): LRL, RLR

Donde:
- **L** = arco a la izquierda (sentido antihorario)
- **R** = arco a la derecha (sentido horario)
- **S** = segmento recto

---

## 1. LSL (Left-Straight-Left)

### Descripción Geométrica

```
  Inicio ----L---○
                 |
                 | S (recta)
                 |
           ○---L---- Final
```

### Construcción

**Paso 1**: Calcular centros de círculos tangentes izquierdos

```typescript
c_L(start) = (x - r·sin(θ), y + r·cos(θ))
c_L(end)   = (x' - r·sin(θ'), y' + r·cos(θ'))
```

**Paso 2**: Verificar restricción geométrica

```
d(c_L(start), c_L(end)) >= 2r - ε
```

Si no se cumple, el camino LSL no existe.

**Paso 3**: Calcular tangente externa común

La tangente es perpendicular a la línea que une los centros:

```typescript
α = atan2(c_L(end).y - c_L(start).y, c_L(end).x - c_L(start).x)
α_perp = α + π/2

p₁ = c_L(start) + r·(cos(α_perp), sin(α_perp))
p₂ = c_L(end) + r·(cos(α_perp), sin(α_perp))
```

**Paso 4**: Calcular longitudes

```
L_arc1 = r · |θ_start - θ_p1|  (antihorario)
L_straight = ||p₂ - p₁||
L_arc2 = r · |θ_p2 - θ_end|  (antihorario)

L_total = L_arc1 + L_straight + L_arc2
```

### Condición de Optimalidad

LSL es óptimo cuando:
- Las poses inicial y final tienen orientaciones similares
- Ambas curvan hacia la izquierda naturalmente
- La distancia entre centros es grande

---

## 2. RSR (Right-Straight-Right)

### Descripción Geométrica

```
  ○---R---- Inicio
  |
  | S (recta)
  |
  Final ----R---○
```

### Construcción

**Simétrico a LSL**, usando círculos derechos:

```typescript
c_R(start) = (x + r·sin(θ), y - r·cos(θ))
c_R(end)   = (x' + r·sin(θ'), y' - r·cos(θ'))
```

**Tangente externa**:

```typescript
α_perp = α - π/2  // Perpendicular en dirección opuesta

p₁ = c_R(start) + r·(cos(α_perp), sin(α_perp))
p₂ = c_R(end) + r·(cos(α_perp), sin(α_perp))
```

**Longitud de arco** (sentido horario):

```
L_arc = r · (θ_start - θ_end)  // Restar en vez de sumar
if L_arc < 0: L_arc += 2π
```

### Propiedad Matemática

Para poses paralelas (θ_start = θ_end):

```
L_LSL(start, end) = L_RSR(start, end)
```

Por simetría.

---

## 3. LSR (Left-Straight-Right)

### Descripción Geométrica

```
  Inicio ----L---○
                  \
                   \ S (tangente interna)
                    \
                ○---R---- Final
```

### Construcción

**Paso 1**: Calcular centros

```typescript
c_L = c_L(start)  // Círculo izquierdo al inicio
c_R = c_R(end)    // Círculo derecho al final
```

**Paso 2**: Restricción geométrica

```
d(c_L, c_R) >= 2r
```

La tangente **interna** requiere que los círculos estén suficientemente separados.

**Paso 3**: Tangente interna

La tangente cruza entre los círculos:

```typescript
d = ||c_R - c_L||
α_base = atan2(c_R.y - c_L.y, c_R.x - c_L.x)

// Ángulo offset para tangente interna
α_offset = asin((2r) / d)

α_tangent = α_base + α_offset

p₁ = c_L + r·(cos(α_tangent + π/2), sin(α_tangent + π/2))
p₂ = c_R + r·(cos(α_tangent - π/2), sin(α_tangent - π/2))
```

**Derivación del offset**:

Considerar triángulo formado por c_L, c_R y punto de tangencia:

```
sin(α_offset) = (r + r) / d = 2r / d
```

### Condición de Optimalidad

LSR es óptimo cuando:
- Las orientaciones finales son opuestas
- Se requiere cambio de dirección de curvatura
- Configuración de "S" invertida

---

## 4. RSL (Right-Straight-Left)

### Descripción Geométrica

```
       ○---R---- Inicio
      /
     / S (tangente interna)
    /
  Final ----L---○
```

### Construcción

**Simétrico a LSR**:

```typescript
c_R = c_R(start)
c_L = c_L(end)

α_tangent = α_base - α_offset  // Offset negativo

p₁ = c_R + r·(cos(α_tangent - π/2), sin(α_tangent - π/2))
p₂ = c_L + r·(cos(α_tangent + π/2), sin(α_tangent + π/2))
```

---

## 5. LRL (Left-Right-Left)

### Descripción Geométrica

```
  Inicio ----L---○
                  \
                   R (círculo medio)
                  /
           ○---L---- Final
```

### Restricción Geométrica Fundamental

**Teorema**: Un camino LRL existe si y solo si:

```
d(c_L(start), c_L(end)) ≤ 4r
```

**Demostración**:

El círculo medio debe ser tangente externo a ambos círculos extremos. La configuración forma un triángulo con lados:

- c_L(start) a c_M: distancia = 2r
- c_M a c_L(end): distancia = 2r
- c_L(start) a c_L(end): distancia = d

Por desigualdad triangular:

```
d ≤ 2r + 2r = 4r
```

### Construcción del Círculo Medio

**Paso 1**: Ley de cosenos

En el triángulo formado por los tres centros:

```
cos(α) = d / (4r)
α = arccos(d / 4r)
```

**Paso 2**: Posición del centro medio

```typescript
θ_base = atan2(c_L(end).y - c_L(start).y, c_L(end).x - c_L(start).x)
θ_center = θ_base + α

c_M = c_L(start) + 2r·(cos(θ_center), sin(θ_center))
```

**Ilustración geométrica**:

```
     c_L(start)
         ●
        /|\
     2r/ | \2r
      /  |  \
     /   |d  \
    /  α |    \
   ●----+----●
  c_M        c_L(end)
```

**Paso 3**: Puntos de tangencia

Entre c_L(start) y c_M:

```typescript
t₁ = c_L(start) + (c_M - c_L(start)) · (r / 2r)
   = c_L(start) + (c_M - c_L(start)) / 2
```

Entre c_M y c_L(end):

```typescript
t₂ = c_M + (c_L(end) - c_M) / 2
```

**Paso 4**: Longitudes de arco

```typescript
// Arco 1: Antihorario en c_L(start)
L₁ = r · angle_ccw(start, t₁, c_L(start))

// Arco 2: Horario en c_M (inverso)
L₂ = r · angle_cw(t₁, t₂, c_M)

// Arco 3: Antihorario en c_L(end)
L₃ = r · angle_ccw(t₂, end, c_L(end))

L_total = L₁ + L₂ + L₃
```

### Caso Especial: d = 4r

Cuando d = 4r exactamente:

```
α = arccos(1) = 0
```

Los tres centros son colineales. Este es el **límite de existencia** del camino LRL.

### Condición de Optimalidad

LRL es óptimo cuando:
- d < 4r (poses cercanas)
- Las orientaciones favorecen curvatura izquierda
- Configuración compacta tipo "S"

---

## 6. RLR (Right-Left-Right)

### Descripción Geométrica

```
       ○---R---- Inicio
      /
     L (círculo medio)
      \
  Final ----R---○
```

### Restricción Geométrica

```
d(c_R(start), c_R(end)) ≤ 4r
```

### Construcción

**Simétrico a LRL**:

```typescript
α = arccos(d / 4r)
θ_base = atan2(c_R(end).y - c_R(start).y, c_R(end).x - c_R(start).x)

// Offset negativo para RLR
θ_center = θ_base - α

c_M = c_R(start) + 2r·(cos(θ_center), sin(θ_center))
```

**Longitudes**:

```typescript
// Arco 1: Horario en c_R(start)
L₁ = r · angle_cw(start, t₁, c_R(start))

// Arco 2: Antihorario en c_M (inverso)
L₂ = r · angle_ccw(t₁, t₂, c_M)

// Arco 3: Horario en c_R(end)
L₃ = r · angle_cw(t₂, end, c_R(end))
```

---

## Comparación de los 6 Caminos

### Tabla Resumen

| Tipo | Segmentos | Restricción | Uso Principal |
|------|-----------|---------------|---------------|
| **LSL** | L-S-L | d ≥ 2r | Poses paralelas, giro izquierdo |
| **RSR** | R-S-R | d ≥ 2r | Poses paralelas, giro derecho |
| **LSR** | L-S-R | d ≥ 2r | Cambio de curvatura, orientación opuesta |
| **RSL** | R-S-L | d ≥ 2r | Cambio de curvatura, orientación opuesta |
| **LRL** | L-R-L | d ≤ 4r | Poses cercanas, compacto |
| **RLR** | R-L-R | d ≤ 4r | Poses cercanas, compacto |

### Complejidad Computacional

| Operación | Complejidad |
|-----------|-------------|
| Calcular 1 camino | O(1) |
| Calcular 6 caminos | O(1) |
| Encontrar mínimo | O(1) |
| Nudo de n puntos | O(n) |

---

## Fórmulas Auxiliares

### Cálculo de Ángulo de Arco Antihorario

```typescript
function angle_ccw(start: Pose2D, end: Point2D, center: Point2D): number {
  const θ_start = atan2(start.y - center.y, start.x - center.x)
  const θ_end = atan2(end.y - center.y, end.x - center.x)
  
  let angle = θ_end - θ_start
  if (angle < 0) angle += 2π
  
  return angle
}
```

### Cálculo de Ángulo de Arco Horario

```typescript
function angle_cw(start: Pose2D, end: Point2D, center: Point2D): number {
  const θ_start = atan2(start.y - center.y, start.x - center.x)
  const θ_end = atan2(end.y - center.y, end.x - center.x)
  
  let angle = θ_start - θ_end
  if (angle < 0) angle += 2π
  
  return angle
}
```

### Distancia Euclidiana

```typescript
function distance(p1: Point2D, p2: Point2D): number {
  return Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2)
}
```

---

## Casos Especiales y Degenerados

### 1. Poses Idénticas (x = y, θ = θ')

```
L_minimal = 0
```

Camino trivial de longitud cero.

### 2. Tangentes Paralelas (θ = θ' ± π)

Según el paper, cuando las tangentes son paralelas con sentidos opuestos:

- No existe región atrapada Ω
- No hay clases de isotopía acotadas
- Posibles discontinuidades en la longitud

### 3. Tangencia de Círculos (d = 2r o d = 4r)

Casos límite:

- **d = 2r**: Transición entre CSC válido/inválido para tangentes internas
- **d = 4r**: Transición entre CCC válido/inválido

Requiere manejo cuidadoso de tolerancia numérica (ε = 10⁻⁶).

---

## Aplicación a Nudos Matemáticos

### Cálculo de Longitud de Envolvente

Para un nudo representado por puntos de control **P = {p₀, p₁, ..., pₙ₋₁}**:

```typescript
function knotLength(points: Point2D[], radius: number): number {
  const dubins = new DubinsPaths(radius)
  let totalLength = 0
  
  for (let i = 0; i < points.length; i++) {
    const curr = points[i]
    const next = points[(i + 1) % points.length]  // Cerrar el nudo
    
    // Estimar tangentes
    const θᵢ = estimateTangent(points, i)
    const θₙₑₓₜ = estimateTangent(points, (i + 1) % points.length)
    
    // Construir poses
    const start: Pose2D = { ...curr, theta: θᵢ }
    const end: Pose2D = { ...next, theta: θₙₑₓₜ }
    
    // Camino mínimo
    const path = dubins.computeMinimalPath(start, end)
    
    if (path) {
      totalLength += path.totalLength
    }
  }
  
  return totalLength
}
```

### Estimación de Tangentes

```typescript
function estimateTangent(points: Point2D[], index: number): number {
  const n = points.length
  const prev = points[(index - 1 + n) % n]
  const next = points[(index + 1) % n]
  
  // Vector promedio
  const dx = (next.x - prev.x) / 2
  const dy = (next.y - prev.y) / 2
  
  return Math.atan2(dy, dx)
}
```

### Ventajas para Teoría de Nudos

1. **Realismo geométrico**: Modela nudos físicos con grosor
2. **Suavidad garantizada**: Continuidad C¹
3. **Eficiencia computacional**: Fórmulas cerradas O(1)
4. **Insights topológicos**: Discontinuidades revelan estructura

---

## Condiciones de Proximidad (del Paper)

### Condición A: Lejos

```
d(c_L(x), c_L(y)) ≥ 4r  Y  d(c_R(x), c_R(y)) ≥ 4r
```

**Implicaciones**:
- Solo caminos CSC posibles
- LRL y RLR inválidos
- No hay clases de isotopía acotadas

### Condición D: Clase de Isotopía Acotada

```
d(c_L(x), c_L(y)) < 4r  Y  d(c_R(x), c_R(y)) < 4r
Y existe clase de isotopía acotada Δ(x,y)
```

**Implicaciones**:
- Existe región atrapada Ω ⊂ R²
- Caminos embebidos no pueden escapar Ω
- Tanto CSC como CCC pueden ser válidos

---

## Fenómeno de Discontinuidad

Según el Ejemplo 2.3(1) del paper:

```typescript
const start: Pose2D = { x: 0, y: 0, theta: 0 }
const y: Point2D = { x: 1, y: 1 }

// Variar θ cerca de π/2
for (let θ = π/2 - 0.1; θ <= π/2 + 0.1; θ += 0.01) {
  const end: Pose2D = { ...y, theta: θ }
  const path = dubins.computeMinimalPath(start, end)
  
  console.log(`θ = ${θ}, L = ${path?.totalLength}`)
}
```

**Observación**: Saltos súbitos en longitud revelan:
- Puntos aislados (cc isolated points)
- Transiciones entre clases de homotopía
- Cambios topológicos en el espacio de caminos

---

## Referencias Matemáticas

### Papers Fundamentales

1. **Dubins, L.E. (1957)**  
   "On Curves of Minimal Length with a Constraint on Average Curvature"  
   American Journal of Mathematics, 79(3), 497-516

2. **Díaz, J., & Ayala, J. (2020)**  
   "Census of Bounded Curvature Paths"  
   arXiv:2005.13210v1 [math.MG]

3. **Reeds, J.A., & Shepp, L.A. (1990)**  
   "Optimal paths for a car that goes both forwards and backwards"  
   Pacific Journal of Mathematics, 145(2), 367-393

### Teoremas Clave

- **Teorema de Caracterización de Dubins**: Existencia de solo 6 tipos
- **Teorema 3.9 (Paper)**: Discontinuidad en longitud de minimizadores
- **Teorema 5.4 (Paper)**: Existencia de clases de isotopía acotadas
- **Teorema 8.6 (Paper)**: Caracterización del conjunto B de endpoints

---

## Implementación en TypeScript

Ver archivo: `src/core/geometry/DubinsPaths.ts`

**Características**:
- Implementación completa de los 6 caminos
- Manejo robusto de casos límite
- Tests matemáticos exhaustivos
- Documentación inline detallada

**Tests**: `src/core/geometry/DubinsPaths.test.ts`

---

## Conclusiones

Los 6 caminos de Dubins proporcionan:

1. **Base teórica rigurosa** para medir envolventes de nudos
2. **Eficiencia computacional** con complejidad O(1) por segmento
3. **Insights topológicos** mediante fenómenos de discontinuidad
4. **Aplicabilidad práctica** en robótica y teoría de nudos

La implementación en este repositorio sigue fielmente la teoría del paper de Díaz & Ayala (2020), asegurando corrección matemática y precisión numérica.
