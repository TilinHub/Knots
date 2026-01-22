# Arquitectura del Proyecto Knots - Plataforma de Investigación de Nudos Matemáticos

## Descripción General

Knots es una plataforma web interactiva para el estudio riguroso de nudos matemáticos, combinando:
- Editor interactivo de diagramas de nudos
- Cálculos topológicos precisos
- Visualización de invariantes matemáticas
- Análisis de grafos de contacto
- Mediciones geométricas (Dubins paths)

## Stack Tecnológico

### Frontend
- **React 18** con TypeScript para componentes tipados
- **Vite** como bundler
- **SVG Canvas** para visualización de diagramas
- **D3.js** para grafos de contacto
- **Redux Toolkit** para estado global
- **TailwindCSS** para estilos

### Backend
- **FastAPI** (Python) para API REST
- **PostgreSQL** para persistencia
- **Redis** para caching
- **SymPy** para cálculos simbólicos
- **NetworkX** para teoría de grafos

## Estructura del Proyecto

```
src/
├── core/
│   ├── types/
│   │   ├── knot.ts              # Interfaces base (nudos, cruces, regiones, discos)
│   │   ├── contactGraph.ts      # Tipos para grafos de contacto
│   │   └── cs.ts                # Tipos de curvas CS (existentes)
│   ├── math/
│   │   ├── dubins.ts            # Calculador de Dubins paths
│   │   ├── reidemeister.ts      # Motor de movimientos de Reidemeister
│   │   ├── invariants.ts        # Cálculo de invariantes topológicos
│   │   └── geometry.ts          # Geometría computacional
│   ├── algorithms/
│   │   ├── contactGraphBuilder.ts  # Constructor de grafos de contacto
│   │   └── knotSimplification.ts   # Simplificación de diagramas
│   └── validation/
│       └── continuity.ts        # Validación de continuidad (existente)
├── features/
│   ├── editor/                  # Editor interactivo de nudos
│   ├── analysis/                # Panel de análisis de invariantes
│   └── visualization/           # Componentes de visualización
├── services/
│   ├── api.ts                   # Cliente API REST
│   └── knotCensus.ts            # Gestión del censo de nudos
└── utils/
    ├── math.ts                  # Utilidades matemáticas
    └── formatting.ts            # Formato de polinomios y expresiones
```

## Modelos de Datos

### Nudos Básicos

**Point2D / Point3D**: Representación de coordenadas
```typescript
interface Point2D { x: number; y: number; }
interface Point3D extends Point2D { z: number; }
```

**CurveEmbedding**: Parametrización de la envolvente
```typescript
interface CurveEmbedding {
  id: string;
  type: 'bezier' | 'spline' | 'parametric' | 'closed_path';
  controlPoints: Point3D[];
  arcLength: number;
  crossingCount: number;
}
```

**Crossing**: Cruce en un diagrama
```typescript
interface Crossing {
  id: string;
  position: Point3D;
  sign: 1 | -1;  // +1 derecha, -1 izquierda
  overStrand / underStrand;  // Información de sobre/sub-paso
  writhe: number;  // Contribución al writhe number
}
```

**KnotDiagram**: Diagrama planar completo
```typescript
interface KnotDiagram {
  id: string;
  embedding: CurveEmbedding;
  crossings: Crossing[];
  regions: Region[];
  reidemeisterMoves: ReidemeisterMove[];
  crossingNumber: number;
}
```

**Knot**: Nudo con invariantes
```typescript
interface Knot {
  id: string;
  name: string;  // ej: "Trefoil", "Figure-Eight"
  crossingNumber: number;
  genus: number;
  alexanderPolynomial?: string;
  jonesPolynomial?: string;
  diagrams: KnotDiagram[];
}
```

## Componentes Principales

### 1. DubinsPathCalculator (`src/core/math/dubins.ts`)
Implementa el algoritmo de L.E. Dubins (1957) para calcular caminos de curvatura mínima.

**Funcionalidad**:
- Calcula distancia de Dubins entre dos configuraciones (x, y, θ)
- Soporta 6 tipos de paths: LSL, LSR, RSL, RSR, RLR, LRL
- Mide largo de envolventes con restricción de curvatura

**Uso**:
```typescript
const calculator = new DubinsPathCalculator({ minRadius: 1 });
const length = calculator.computeLength(
  { x: 0, y: 0, theta: 0 },
  { x: 10, y: 5, theta: Math.PI/4 }
);
```

### 2. Reidemeister Engine (Próximo)
Aplica movimientos de Reidemeister para generar diagramas equivalentes.

### 3. Contact Graph Builder (Próximo)
Construye grafos de contacto entre discos en regiones.

## Invariantes Topológicos

El sistema calcula automáticamente:

- **Número de cruces**: Cantidad mínima de cruces en cualquier diagrama
- **Writhe number**: w(D) = Σ sign(c) para todos los cruces c
- **Género de Seifert**: g(K), base mínima de superficies orientables
- **Polinomio de Alexander**: Δ(t), invariante polinomial
- **Polinomio de Jones**: V(t), invariante cuántico
- **Número de desanudación**: mínimo de movimientos Reidemeister tipo I

## Flujo de Datos

```
Diagrama CS Planar
        ↓
[Extractor de Cruces]
        ↓
Crosses + Regions + Disks
        ↓
[Cálculo de Invariantes] ← [Base de datos de Nudos]
        ↓
[Validación de Continuidad]
        ↓
[Constructor de Grafo de Contacto]
        ↓
Representación Final
```

## API REST (Propuesta)

### Endpoints Base

```
GET  /api/knots                          # Listar nudos (con filtros)
GET  /api/knots/{knotId}                 # Obtener nudo específico
GET  /api/knots/{knotId}/diagrams        # Obtener diagramas
GET  /api/diagrams/{diagramId}/length    # Calcular largo (Dubins)
POST /api/diagrams/{diagramId}/variants  # Generar variantes
POST /api/diagrams/{diagramId}/invariants # Calcular invariantes
```

## Próximos Pasos

1. **Completar módulo Reidemeister** para generar variantes
2. **Implementar Contact Graph Builder** para análisis de discos
3. **Desarrollar paneles de visualización** en React
4. **Crear API endpoints** en FastAPI
5. **Integrar cálculo de invariantes** polinomiales
6. **Agregar censo de nudos** con datos estándar

## Referencias Académicas

- Lickorish: "An Introduction to Knot Theory" (1997)
- Dubins, L.E.: "On Curves of Minimal Length with a Constraint on Average Curvature" (1957)
- Kauffman: "Formal Knot Theory" (1983)
- Knot Atlas: http://katlas.math.toronto.edu/

## Contribución y Desarrollo

Este documento describe la arquitectura del proyecto Knots. Los contribuidores deben:
1. Mantener la estructura de carpetas
2. Seguir las interfaces TypeScript definidas
3. Incluir documentación en código
4. Escribir tests para módulos críticos
