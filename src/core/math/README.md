# math/

## Responsabilidad
Librería matemática base y primitiva para el proyecto Knots. Contiene representaciones puras, vectores, matrices y algoritmos no atados a la lógica del dominio directo.

## DubinsPath.ts vs `geometry/dubins/`
El archivo `DubinsPath.ts` es una implementación algorítmica y puramente teórica de Caminos Dubins basada en el artículo "Census of Bounded Curvature Paths" de Jean Díaz y José Ayala (2020). Utiliza orientación a objetos limpia para representar poses puras y segmentos abstractos (LSL, LSR, etc.).

**Nota de Arquitectura:** En producción para cálculos intensivos basados en los ContactGraph (discos con grosor variable y IDs fijos), se utiliza la implementación funcional adaptada en `src/core/geometry/dubins/`.
