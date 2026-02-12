# Core Module Architecture

This directory contains the pure business logic, geometry, algorithms, and models of the application.

## Strict Architectural Rules

1.  **NO UI Dependencies**: Code in `src/core` MUST NOT import from `react`, `react-dom`, `@mui`, or any UI-related library.
2.  **NO Feature Dependencies**: Code in `src/core` MUST NOT import from `src/features`.
3.  **Pure TypeScript**: Prefer pure functions and immutable data structures where possible.
4.  **Stability**: This layer is intended to be the stable foundation for the application.

## Structure

*   `geometry/`: Geometric primitives (Points, Segments, arcs), intersection logic, and hull algorithms.
*   `algorithms/`: Pathfinding, graph traversal.
*   `types/`: Domain entities (CSBlock, CSDisk).
*   `math/`: Mathematical utilities.
