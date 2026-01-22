/**
 * Tipos base para el sistema de diagramas CS
 * (combinación de segmentos rectos, arcos de círculo y discos)
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
  /** IDs de discos conectados (opcional) */
  connectedDisks?: string[];
}

/** Arco circular definido por centro, radio y ángulos */
export interface CSArc {
  id: string;
  kind: 'arc';
  center: Point2D;
  radius: number;        // Radio geométrico (para cálculos, longitud de arco, etc.)
  visualRadius: number;  // Radio visual (para renderizado SVG, puede ser diferente)
  startAngle: number;    // radianes (0 = derecha, π/2 = arriba)
  endAngle: number;      // radianes
  /** IDs de discos conectados (opcional) */
  connectedDisks?: string[];
}

/** Disco de contacto como elemento del diagrama */
export interface CSDisk {
  id: string;
  kind: 'disk';
  center: Point2D;
  radius: number;        // Radio geométrico (para cálculos, usar 1)
  visualRadius: number;  // Radio visual (para renderizado, puede ser grande ej. 40)
  label?: string;        // Etiqueta personalizada (R1, R2, etc.)
  color?: string;        // Color del disco
}

/** Bloque CS: puede ser segmento, arco o disco */
export type CSBlock = CSSegment | CSArc | CSDisk;

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
