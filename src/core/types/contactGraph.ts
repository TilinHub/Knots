import type { Point2D } from './cs';

/**
 * Disco en un grafo de contacto
 */
export interface ContactDisk {
  id: string;
  center: Point2D;
  radius: number;
  regionId: string; // ID de la región donde está el disco
  color?: string;
}

/**
 * Región cerrada en el diagrama
 */
export interface Region {
  id: string;
  boundary: Point2D[]; // Puntos que forman el perímetro
  disks: ContactDisk[];
  area?: number;
}

/**
 * Contacto entre dos discos
 */
export interface DiskContact {
  disk1: string;
  disk2: string;
  contactPoint: Point2D;
}

/**
 * Grafo de contacto completo
 */
export interface ContactGraph {
  regions: Region[];
  contacts: DiskContact[];
}
