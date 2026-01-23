# Arquitectura del Proyecto Knots

Knots es una app web (React + TypeScript) para experimentar con geometría/topología de nudos y visualizaciones asociadas.

## Stack (actual)

- React + TypeScript (frontend)
- Vite (bundler)
- ESLint (lint)
- GitHub Actions (CI + Deploy a GitHub Pages)
- vis-network / vis-data (visualización de grafos)

## Estructura de carpetas (actual)

```
src/
  app/                 # Capa de aplicación (entry, wiring)
  core/                # Dominio: tipos, geometría, matemáticas
    math/              # Matemática pura (p.ej. Dubins)
  features/            # Features/pantallas (editor, gallery, dubins, ...)
  renderer/            # Renderers (SVG/Canvas) y utilidades de dibujo
  styles/              # Estilos globales

  main.tsx             # Entry React
  index.css            # Entry global CSS (importa styles/global.css)
```

## Convenciones

- **Core** no importa nada de UI: solo lógica, tipos y helpers puros.
- **Features** componen UI y usan core/renderer.
- Preferir imports desde `index.ts` (barrel exports) por carpeta.

## Módulo Dubins (fuente de verdad)

La implementación y tipos canónicos están en:

- `src/core/math/DubinsPath.ts`

El módulo público recomendado para consumo dentro del repo es:

- `src/math/dubins/`

## CI/Deploy

- `CI`: corre `lint`, `typecheck` y `build` en pushes/PRs.
- `Deploy`: construye y despliega a GitHub Pages al pushear a `main`.
