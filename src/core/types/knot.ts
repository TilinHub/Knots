/**
 * Tipos base para la teoria de nudos matematicos
 * Define estructuras de datos para nudos, cruces, regiones y discos
 */

// Puntos y vectores
export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

// Parametrizacion de curvas
export interface CurveEmbedding {
  id: string;
  type: 'bezier' | 'spline' | 'parametric' | 'closed_path';
  controlPoints: Point3D[];
  arcLength: number;
  crossingCount: number;
}

// Cruce en diagrama
export interface Crossing {
  id: string;
  position: Point3D;
  overStrand: {
    segmentId: string;
    parameter: number;
    direction: Vector3D;
  };
  underStrand: {
    segmentId: string;
    parameter: number;
    direction: Vector3D;
  };
  sign: 1 | -1;
  writhe: number;
  type: 'positive' | 'negative';
}

// Region generada por nudo
export interface Region {
  id: string;
  boundary: string[];
  edges: Edge[];
  area: number;
  isUnbounded: boolean;
  color?: string;
  disks: Disk[];
}

// Arista
export interface Edge {
  id: string;
  source: string;
  target: string;
  crossingId?: string;
}

// Disco en region
export interface Disk {
  id: string;
  regionId: string;
  center: Point2D;
  radius: number;
  contacts: string[];
  metadata?: {
    genus: number;
    attachmentPoints?: Point2D[];
  };
}

// Diagrama planar
export interface KnotDiagram {
  id: string;
  knotId: string;
  embedding: CurveEmbedding;
  crossings: Crossing[];
  regions: Region[];
  reidemeisterMoves: ReidemeisterMove[];
  isMinimal: boolean;
  crossingNumber: number;
}

// Movimiento Reidemeister
export interface ReidemeisterMove {
  id: string;
  type: 1 | 2 | 3;
  appliedAt: Date;
  affectedCrossings: string[];
  previousDiagram?: KnotDiagram;
}

// Nudo base
export interface Knot {
  id: string;
  name: string;
  alexanderPolynomial?: string;
  jonesPolynomial?: string;
  crossingNumber: number;
  genus: number;
  unknottingNumber: number;
  isChiral: boolean;
  diagrams: KnotDiagram[];
  metadata?: {
    discovered?: Date;
    references?: string[];
    notes?: string;
  };
}

// Grafo de contacto
export interface ContactGraph {
  id: string;
  diagramId: string;
  nodes: ContactNode[];
  edges: ContactEdge[];
  adjacencyMatrix: number[][];
  isConnected: boolean;
  chromaticNumber: number;
}

// Nodo contacto
export interface ContactNode {
  id: string;
  diskId: string;
  position: Point2D;
  degree: number;
}

// Arista contacto
export interface ContactEdge {
  id: string;
  source: string;
  target: string;
  contactType: 'tangent' | 'intersection' | 'overlap';
  contactPoint?: Point2D;
  angle?: number;
}

// Dubins paths
export interface DubinsConfig {
  minRadius: number;
  maxIterations?: number;
  tolerance?: number;
}

export interface DubinsPath {
  length: number;
  type: 'LSL' | 'LSR' | 'RSL' | 'RSR' | 'RLR' | 'LRL';
  segments: DubinsSegment[];
}

export interface DubinsSegment {
  type: 'L' | 'S' | 'R';
  length: number;
  radius?: number;
}

// Invariantes topologicos
export interface KnotInvariants {
  crossingNumber: number;
  writhe: number;
  genus: number;
  unknottingNumber?: number;
  polynomials?: {
    alexander?: string;
    jones?: string;
    kauffman?: string;
  };
  isChiral?: boolean;
}

// Censo de nudos
export interface KnotCensus {
  id: string;
  knotsByCategory: Map<number, Knot[]>;
  knotsByName: Map<string, Knot>;
  totalKnots: number;
  lastUpdated: Date;
}
