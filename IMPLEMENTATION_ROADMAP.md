# Implementation Roadmap - Knots Project

## Fase 1: Foundation (Completada ✅)

### Modelos de Datos
- [x] Definir interfaces TypeScript para nudos, cruces, regiones
- [x] Crear tipos para puntos 2D/3D y vectores
- [x] Definir estructuras para diagramas plaares completos
- [x] Tipos para movimientos de Reidemeister

**Archivos creados:**
- `src/core/types/knot.ts` - Todas las interfaces base

### Cálculo de Dubins Paths
- [x] Implementar clase DubinsPathCalculator
- [x] Soportar 6 tipos de paths (LSL, LSR, RSL, RSR, RLR, LRL)
- [x] Métodos para cálculo de distancia de Dubins
- [x] Manejo de ángulos y normalización

**Archivos creados:**
- `src/core/math/dubins.ts` - Calculador completo

### Documentación
- [x] Crear documento de arquitectura general
- [x] Especificar stack tecnológico
- [x] Definir estructura del proyecto
- [x] Documentar modelos de datos

**Archivos creados:**
- `ARCHITECTURE.md` - Documentación completa
- `IMPLEMENTATION_ROADMAP.md` - Este archivo

## Fase 2: Core Mathematics (Próxima)

### Reidemeister Engine
- [ ] Implementar clase ReidemeisterEngine
- [ ] Método para aplicar movimiento tipo I (twist)
- [ ] Método para aplicar movimiento tipo II (poke)
- [ ] Método para aplicar movimiento tipo III (slide)
- [ ] Sistema de generación de variantes por BFS/DFS
- [ ] Validación de equivalencia de diagramas

**Archivo destino:** `src/core/math/reidemeister.ts`

**Est. de esfuerzo:** 8-10 horas

### Contact Graph Builder
- [ ] Clase ContactGraphBuilder
- [ ] Algoritmo de detección de intersecciones
- [ ] Cálculo de puntos de contacto entre discos
- [ ] Construcción de matriz de adyacencia
- [ ] Cálculo de número cromático

**Archivo destino:** `src/core/algorithms/contactGraphBuilder.ts`

**Est. de esfuerzo:** 6-8 horas

### Invariantes Topológicos
- [ ] Cálculo de writhe number
- [ ] Cálculo de número de cruces
- [ ] Integración con SymPy para polinomios de Alexander
- [ ] Integración con SnapPy para invariantes avanzados
- [ ] Caché de resultados en Redis

**Archivos destino:**
- `src/core/math/invariants.ts` (frontend)
- `backend/app/services/invariants.py` (backend)

**Est. de esfuerzo:** 10-12 horas

## Fase 3: Backend API

### FastAPI Application
- [ ] Setup de FastAPI + PostgreSQL
- [ ] Migraciones de base de datos
- [ ] Modelos SQLAlchemy para persistencia

**Archivo destino:** `backend/app/main.py`

### API Endpoints
- [ ] GET /api/knots - Listar nudos
- [ ] GET /api/knots/{id} - Detalle de nudo
- [ ] GET /api/knots/{id}/diagrams - Diagramas de nudo
- [ ] GET /api/diagrams/{id}/length - Cálculo de Dubins
- [ ] POST /api/diagrams/{id}/variants - Generar variantes
- [ ] POST /api/diagrams/{id}/invariants - Calcular invariantes
- [ ] GET /api/diagrams/{id}/contact-graph - Grafo de contacto

**Est. de esfuerzo:** 12-16 horas

## Fase 4: Frontend Components

### Componentes React
- [ ] KnotViewer - Visualización 3D de nudos
- [ ] DiagramEditor - Editor interactivo de diagramas
- [ ] InvariantsPanel - Panel de visualización de invariantes
- [ ] ContactGraphVisualization - Grafo de contacto con D3.js
- [ ] KnotCensus - Navegador de censo de nudos

**Archivos destino:** `src/features/`

**Est. de esfuerzo:** 20-24 horas

## Fase 5: Integración y Testing

### Testing
- [ ] Unit tests para DubinsPathCalculator
- [ ] Unit tests para ReidemeisterEngine
- [ ] Unit tests para ContactGraphBuilder
- [ ] Integration tests para API
- [ ] E2E tests con Cypress

**Est. de esfuerzo:** 16-20 horas

### Documentación de Usuario
- [ ] Guía de instalación
- [ ] Tutorial de uso básico
- [ ] Documentación de API
- [ ] Ejemplos de casos de uso

## Estimación de Tiempo

| Fase | Tareas | Horas | Estado |
|------|--------|-------|--------|
| 1 | Foundation | 8 | ✅ Completa |
| 2 | Core Math | 30-40 | ⏳ Próxima |
| 3 | Backend | 12-16 | ⏳ Luego |
| 4 | Frontend | 20-24 | ⏳ Luego |
| 5 | Testing | 16-20 | ⏳ Final |
| | **TOTAL** | **86-108** | **~6 semanas** |

## Dependencias Externas

- **SnapPy**: Para cálculo de invariantes avanzados
- **SymPy**: Para álgebra simbólica (polinomios)
- **NetworkX**: Para algoritmos de grafos
- **PostgreSQL 14+**: Base de datos principal
- **Redis**: Caché de resultados

## Notas de Implementación

1. **Performance**: El cálculo de invariantes puede ser costoso. Implementar caché agresivo.

2. **Precisión**: Usar `decimal.Decimal` para cálculos geométricos críticos.

3. **Validación**: Validar continuidad de diagramas antes de cualquier cálculo.

4. **Escalabilidad**: Diseñar API para permitir procesamiento asíncrono de variantes.

## Referencias

- Lickorish: "An Introduction to Knot Theory"
- Dubins, L.E.: "On Curves of Minimal Length with a Constraint on Average Curvature" (1957)
- Kauffman: "Formal Knot Theory"
- KnotAtlas: http://katlas.math.toronto.edu/
