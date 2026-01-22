# Teoría Matemática de Dubins Paths

## Fundamentos Teóricos

### Definición

Un **Dubins path** es un camino de longitud mínima entre dos puntos en el **tangent bundle** TR² con curvatura acotada.

**Definición formal** (Díaz & Ayala, 2020):

Dados (x, X), (y, Y) ∈ TR², un camino γ : [0, s] → R² es un **bounded curvature path** si:

1. γ es C¹ (continuamente diferenciable) y piecewise C²
2. γ está parametrizado por longitud de arco: ||γ'(t)|| = 1 para todo t ∈ [0, s]
3. γ(0) = x, γ'(0) = X; γ(s) = y, γ'(s) = Y (condiciones de endpoints)
4. ||γ''(t)|| ≤ κ para todo t ∈ [0, s] cuando está definido, donde κ > 0 es constante

La curvatura κ está relacionada con el **radio mínimo de curvatura** r mediante:

```
κ = 1/r
```

Sin pérdida de generalidad, consideramos κ = 1 (equivalente a r = 1).

### Tangent Bundle TR²

El tangent bundle de R² se define como:

```
TR² = {(p, v) : p ∈ R², v ∈ T_p R²}
```

Un punto en TR² se denota como:
- **(x, X)** donde x = (x₁, x₂) es la posición en R²
- **X** es el vector tangente en x

En coordenadas, representamos una pose como:

```typescript
interface Pose2D {
  x: number;      // posición x
  y: number;      // posición y  
  theta: number;  // ángulo del vector tangente
}
```

## Teorema de Dubins (1957)

### Enunciado

**Teorema**: Los minimizadores de longitud en el espacio de bounded curvature paths son necesariamente concatenaciones de:

1. **CSC paths**: Circle-Straight-Circle
2. **CCC paths**: Circle-Circle-Circle

Más específicamente, existen **6 tipos** de Dubins paths:

#### Tipo CSC (4 configuraciones)

- **LSL**: Left-Straight-Left
- **RSR**: Right-Straight-Right
- **LSR**: Left-Straight-Right
- **RSL**: Right-Straight-Left

#### Tipo CCC (2 configuraciones)

- **LRL**: Left-Right-Left
- **RLR**: Right-Left-Right

Donde:
- **L** = arco circular a la izquierda (left)
- **R** = arco circular a la derecha (right)
- **S** = segmento recto (straight)

### Demostración (Sketch)

La demostración completa se encuentra en Dubins (1957). La idea central es:

1. Un camino de curvatura acotada puede descomponerse en arcos circulares de radio r y segmentos rectos
2. Por principio variacional, los minimizadores no pueden tener "zigzags" innecesarios
3. La clasificación exhaustiva muestra que solo 6 configuraciones son posibles

## Círculos Adyacentes

### Definición

Dada una pose (x, X) ∈ TR², definimos:

- **C_l(x)**: Círculo de radio r tangente a X, a la **izquierda** de la dirección de X
- **C_r(x)**: Círculo de radio r tangente a X, a la **derecha** de la dirección de X

### Cálculo de Centros

Los centros de los círculos adyacentes se calculan como (Ecuaciones 3.1-3.2 del paper):

**Centro del círculo izquierdo**:
```
c_l(x) = (x - r sin(θ), y + r cos(θ))
```

**Centro del círculo derecho**:
```
c_r(x) = (x + r sin(θ), y - r cos(θ))
```

Donde (x, y) es la posición y θ es el ángulo del vector tangente.

### Proximidad de Endpoints

La clasificación de Dubins paths depende de la **distancia entre centros de círculos adyacentes**:

#### Condiciones de Proximidad

Dadas poses (x, X) y (y, Y):

**(i)** d(c_l(x), c_l(y)) ≥ 4 **y** d(c_r(x), c_r(y)) ≥ 4

**(ii)** d(c_l(x), c_l(y)) < 4 **y** d(c_r(x), c_r(y)) ≥ 4

**(iii)** d(c_l(x), c_l(y)) ≥ 4 **y** d(c_r(x), c_r(y)) < 4

**(iv)** d(c_l(x), c_l(y)) < 4 **y** d(c_r(x), c_r(y)) < 4

Estas condiciones determinan qué tipos de paths son válidos:

- **LSL/RSR** requieren tangentes externas (condición i o ii/iii)
- **LSR/RSL** requieren tangentes internas: d ≥ 2r
- **LRL/RLR** requieren d ≤ 4r (los círculos deben estar suficientemente cerca)

## Cálculo de los 6 Tipos de Dubins Paths

### 1. LSL (Left-Straight-Left)

#### Geometría

```
     C_l(y)
       ●
      /|\
     / | \
    /  |  \
   L2  S   
  /    |    
 ●-----+-----●
C_l(x)       
     L1
```

#### Algoritmo

1. Calcular centros: c_l(x) y c_l(y)
2. Ángulo de la línea que conecta centros:
   ```
   θ = atan2(c_l(y).y - c_l(x).y, c_l(y).x - c_l(x).x)
   ```

3. Puntos de tangencia (tangente externa):
   ```
   p_start = c_l(x) + r(√2/2, √2/2)  // perpendicular a θ
   p_end   = c_l(y) + r(√2/2, √2/2)
   ```

4. Longitudes:
   - **Arco 1** (L): φ₁ = mod_2π(atan2(p_start - c_l(x)) - θ_start)
     - Longitud: L₁ = r × φ₁
   
   - **Segmento** (S): L_s = ||p_end - p_start||
   
   - **Arco 2** (L): φ₂ = mod_2π(θ_end - atan2(p_end - c_l(y)))
     - Longitud: L₂ = r × φ₂

5. **Longitud total**: L_total = L₁ + L_s + L₂

#### Condición de Validez

```
d(c_l(x), c_l(y)) > 0
```

### 2. RSR (Right-Straight-Right)

Simétrico a LSL, usando círculos derechos.

#### Algoritmo

1. Centros: c_r(x), c_r(y)
2. Tangente externa en dirección opuesta a LSL
3. Arcos en sentido horario (curvatura negativa)

### 3. LSR (Left-Straight-Right)

#### Geometría (Tangente Interna)

```
   C_l(x)          C_r(y)
     ●              ●
      \            /
       \          /
        L   S   R
         \      /
          \    /
           \  /
```

#### Algoritmo

1. Centros: c_l(x), c_r(y)
2. Distancia: d = ||c_r(y) - c_l(x)||
3. **Condición**: d ≥ 2r (para que exista tangente interna)

4. Ángulo y offset de tangente interna:
   ```
   θ = atan2(c_r(y).y - c_l(x).y, c_r(y).x - c_l(x).x)
   α = asin(2r / d)
   ```

5. Puntos de tangencia:
   ```
   p_start = c_l(x) + r × (⊥ dirección a θ + α)
   p_end   = c_r(y) + r × (⊥ dirección a θ + α)
   ```

6. Longitudes de arcos (similar a LSL/RSR)

#### Condición de Validez

```
d(c_l(x), c_r(y)) ≥ 2r
```

### 4. RSL (Right-Straight-Left)

Simétrico a LSR.

### 5. LRL (Left-Right-Left)

#### Geometría (Tres Círculos Tangentes)

```
  C_l(x)    C_r(mid)    C_l(y)
    ●--------●--------●
     \      / \      /
      L1   R   L2
```

#### Algoritmo

1. Centros inicial y final: c_l(x), c_l(y)
2. Distancia: d = ||c_l(y) - c_l(x)||
3. **Condición**: d ≤ 4r (los tres círculos deben poder tocarse)

4. Centro del círculo intermedio (derecho):
   ```
   θ = atan2(c_l(y).y - c_l(x).y, c_l(y).x - c_l(x).x)
   α = acos(d / (4r))
   
   c_r(mid) = c_l(x) + 2r × (cos(θ + α), sin(θ + α))
   ```

5. Puntos de tangencia entre círculos consecutivos
6. Tres arcos circulares: L (izq) → R (der) → L (izq)

#### Condición de Validez

```
0 < d(c_l(x), c_l(y)) ≤ 4r
```

### 6. RLR (Right-Left-Right)

Simétrico a LRL.

## Fórmulas Clave

### Normalización Angular

Para calcular longitudes de arcos, normalizamos ángulos a [0, 2π):

```typescript
function mod2Pi(angle: number): number {
  let result = angle % (2 * Math.PI);
  if (result < 0) result += 2 * Math.PI;
  return result;
}
```

### Longitud de Arco Circular

Dado un ángulo subtendido φ (en radianes):

```
L_arc = r × φ
```

Para curvatura κ = 1/r:

```
L_arc = φ / κ
```

### Longitud de Segmento Recto

```
L_straight = √((x₂ - x₁)² + (y₂ - y₁)²)
```

## Selección del Path Óptimo

### Algoritmo

1. Calcular los 6 tipos de Dubins paths
2. Filtrar los válidos (que satisfacen condiciones geométricas)
3. Seleccionar el de **mínima longitud total**:

```typescript
const optimal = paths
  .filter(p => p.isValid)
  .reduce((min, p) => 
    p.totalLength < min.totalLength ? p : min
  );
```

## Aplicación a Nudos

### Medición de Longitud de Envolvente

Dado un nudo con puntos de control P₀, P₁, ..., P_{n-1}:

1. Para cada par consecutivo (P_i, P_{i+1 mod n}):
   - Estimar vector tangente en cada punto
   - Construir poses (x_i, X_i) y (x_{i+1}, X_{i+1})
   - Calcular Dubins path óptimo
   - Acumular longitud

2. **Longitud total del nudo**:
   ```
   L_total = Σ_{i=0}^{n-1} L_dubins(P_i, P_{i+1})
   ```

### Estimación de Tangentes

Dada una secuencia de puntos, estimamos el ángulo tangente mediante:

```typescript
function estimateTangent(
  points: Point2D[], 
  index: number
): number {
  const n = points.length;
  const prev = points[(index - 1 + n) % n];
  const next = points[(index + 1) % n];
  
  // Vector promedio (diferencias centradas)
  const dx = (next.x - prev.x) / 2;
  const dy = (next.y - prev.y) / 2;
  
  return Math.atan2(dy, dx);
}
```

## Propiedades Topológicas (Díaz & Ayala, 2020)

### Espacios de Bounded Curvature Paths

El paper introduce el concepto de **espacios de bounded curvature paths**:

```
Γ(x, y) = {bounded curvature paths de x a y}
```

### Tipos de Componentes Conexas

Según el teorema 8.5 del paper, Γ(x, y) puede tener:

1. **Puntos aislados** (isolated points)
2. **Clases de homotopía** (homotopy classes)
3. **Clases de isotopía acotadas** (bounded isotopy classes)

### Regiones Atrapadas (Trapped Regions)

Para ciertos endpoints, existe una región acotada Ω ⊂ R² tal que:

- Todos los paths embebidos en Γ(x, y) están contenidos en Ω
- No pueden deformarse fuera de Ω sin violar la cota de curvatura

Esto es relevante para la teoría de nudos con curvatura acotada.

## Implementación Computacional

### Complejidad

- **Cálculo de un Dubins path**: O(1)
- **Cálculo de los 6 tipos**: O(1)
- **Longitud total de nudo con n puntos**: O(n)

### Precisión Numérica

Consideraciones:

1. Usar epsilon pequeño (e.g., 1e-6) para comparaciones de distancias
2. Normalizar ángulos consistentemente
3. Manejar casos degenerados:
   - Puntos coincidentes
   - Vectores tangentes paralelos
   - Distancias exactamente en límites (d = 2r, d = 4r)

### Testing

Casos de prueba importantes:

1. **Caso trivial**: x = y con mismo ángulo → L = 0
2. **Línea recta**: ángulos alineados, d > 2r → LSL o RSR puro
3. **U-turn**: ángulos opuestos → LRL o RLR necesario
4. **Casos límite**: d = 2r, d = 4r

## Referencias

1. **Dubins, L. E.** (1957). "On curves of minimal length with a constraint on average curvature, and with prescribed initial and terminal positions and tangents". *American Journal of Mathematics*, 79(3), 497-516.

2. **Díaz, J., & Ayala, J.** (2020). "Census of Bounded Curvature Paths". *arXiv preprint arXiv:2005.13210*.

3. **Dubins, L. E.** (1961). "On plane curves with curvature". *Pacific Journal of Mathematics*, 11(2), 471-481.

4. **Reeds, J. A., & Shepp, L. A.** (1990). "Optimal paths for a car that goes both forwards and backwards". *Pacific Journal of Mathematics*, 145(2), 367-393.

## Extensiones

### Reeds-Shepp Paths

Generalización que permite **movimiento hacia atrás**: 48 tipos de paths posibles.

### Bounded Curvature en Superficies

El paper extiende la teoría a:
- Plano hiperbólico H²
- Superficies de Riemann

### Aplicaciones

- **Robótica móvil**: Planificación de trayectorias
- **UAVs**: Vuelo con restricciones de curvatura
- **Teoría de nudos**: Longitud con curvatura acotada
- **Diseño de caminos**: Ferrocarriles, carreteras
