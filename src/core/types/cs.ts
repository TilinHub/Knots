/**
 * Tipos base para el sistema de diagramas CS
 * (combinación de segmentos rectos y arcos de círculo)
 */

/** Punto 2D en el plano cartesiano */
export interface Point2D {
  x: number;
  y: number;
}

/** Segmento recto entre dos puntos */
export interface CSSegment {
  id: string;
  kind: 'segment';
  p1: Point2D;
  p2: Point2D;
}

/** Arco circular definido por centro, radio y ángulos */
export interface CSArc {
  id: string;
  kind: 'arc';
  center: Point2D;
  radius: number;
  startAngle: number; // radianes (0 = derecha, π/2 = arriba)
  endAngle: number;   // radianes
}

/** Bloque CS: puede ser segmento o arco */
export type CSBlock = CSSegment | CSArc;

/** Diagrama CS completo */
export interface CSDiagram {
  blocks: CSBlock[];
  closed: boolean;      // ¿El diagrama forma un ciclo cerrado?
  valid: boolean;       // ¿Tiene continuidad tangencial entre bloques?
}

/** Resultado de validación de continuidad */
export interface ValidationResult {
  valid: boolean;
  errors: string[];     // Errores críticos (discontinuidades)
  warnings: string[];   // Advertencias (geometría cuestionable)
}

/** Información de un cruce (overlap) entre bloques */
export interface CrossPoint {
  id: string;
  position: Point2D;
  block1: string;  // ID del primer bloque
  block2: string;  // ID del segundo bloque
}
