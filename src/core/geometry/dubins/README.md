# dubins/

## Responsabilidad
Implementación del motor geométrico de caminos Dubins y Bitangentes asimétricos, ligado a la lógica de dominio del proyecto (radios asimétricos, IDs de discos, colisiones estáticas).

## Diferencia con `core/math/DubinsPath.ts`
Mientras que `core/math/DubinsPath.ts` es una implementación OOP teórica de Dubins clásica basada en el paper de Díaz y Ayala (2020), este módulo (`core/geometry/dubins/`) contiene el código utilitario en producción y de uso intensivo para el cómputo de las cintas e intersecciones de nodos.

## Archivos Principales
- `dubins.ts`: Utilidades y calculadoras de caminos incluyendo variantes de bitangentes de discos de radios distintos.
- `index.ts`: Exporta todo el contenido.
