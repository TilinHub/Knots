/**
 * Ejemplos ilustrativos de los 6 tipos de Dubins paths
 *
 * Estos ejemplos demuestran las condiciones geométricas necesarias
 * para cada tipo de path según la clasificación de Dubins (1957)
 */
import type { DubinsPath } from '../../../../src/core/math/DubinsPath';
import type { Pose2D } from '../../../../src/core/math/DubinsPath';

/**
 * Configuraciones de ejemplo que garantizan cada tipo de Dubins path
 */
export const DUBINS_EXAMPLES = {
  LSL: {
    description: 'Left-Straight-Left path',
    condition: 'Los círculos izquierdos no se intersectan',
    start: { position: { x: 0, y: 0 }, theta: 0 } as Pose2D,
    end: { position: { x: 10, y: 0 }, theta: 0 } as Pose2D,
  },
  RSR: {
    description: 'Right-Straight-Right path',
    condition: 'Los círculos derechos no se intersectan',
    start: { position: { x: 0, y: 0 }, theta: 0 } as Pose2D,
    end: { position: { x: 10, y: 0 }, theta: 0 } as Pose2D,
  },
  LSR: {
    description: 'Left-Straight-Right path',
    condition: 'Círculo izquierdo en inicio, círculo derecho en fin',
    start: { position: { x: 0, y: 0 }, theta: 0 } as Pose2D,
    end: { position: { x: 10, y: 5 }, theta: Math.PI / 4 } as Pose2D,
  },
  RSL: {
    description: 'Right-Straight-Left path',
    condition: 'Círculo derecho en inicio, círculo izquierdo en fin',
    start: { position: { x: 0, y: 0 }, theta: 0 } as Pose2D,
    end: { position: { x: 10, y: 5 }, theta: Math.PI / 4 } as Pose2D,
  },
  LRL: {
    description: 'Left-Right-Left path',
    condition: 'Tres arcos círculos con patrón LRL',
    start: { position: { x: 0, y: 0 }, theta: 0 } as Pose2D,
    end: { position: { x: 5, y: 3 }, theta: Math.PI / 6 } as Pose2D,
  },
  RLR: {
    description: 'Right-Left-Right path',
    condition: 'Tres arcos círculos con patrón RLR',
    start: { position: { x: 0, y: 0 }, theta: 0 } as Pose2D,
    end: { position: { x: 5, y: 3 }, theta: Math.PI / 6 } as Pose2D,
  },
};
