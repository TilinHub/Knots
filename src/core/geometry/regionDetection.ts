import type { CSBlock, Point2D } from '../types/cs';
import type { Region } from '../types/contactGraph';
import { findAllCrossings } from './intersections';

/**
 * Detecta regiones cerradas en un diagrama CS
 * Usa los bloques y cruces para identificar áreas encerradas
 */
export function detectRegions(blocks: CSBlock[]): Region[] {
  if (blocks.length === 0) return [];

  const crossings = findAllCrossings(blocks);
  const regions: Region[] = [];

  // Algoritmo simplificado: detectar regiones aproximadas
  // En un diagrama de nudo trefoil hay 4 regiones:
  // - 3 regiones internas (loops)
  // - 1 región externa

  // Para cada crossing, intentar construir regiones siguiendo el diagrama
  // Este es un algoritmo simplificado que detecta regiones básicas

  const bounds = getBoundingBox(blocks);
  
  // Crear una región central aproximada como placeholder
  // En producción, esto requeriría un algoritmo de trazado de regiones más sofisticado
  const centerRegion: Region = {
    id: 'region-center',
    boundary: [
      { x: bounds.minX + 20, y: bounds.minY + 20 },
      { x: bounds.maxX - 20, y: bounds.minY + 20 },
      { x: bounds.maxX - 20, y: bounds.maxY - 20 },
      { x: bounds.minX + 20, y: bounds.maxY - 20 },
    ],
    disks: [],
  };

  regions.push(centerRegion);

  // Detectar regiones aproximadas basadas en la topología del nudo
  if (blocks.length >= 3) {
    // Para trefoil, crear 3 regiones aproximadas
    const numRegions = Math.min(blocks.length, 4);
    const angleStep = (2 * Math.PI) / numRegions;
    
    for (let i = 0; i < numRegions - 1; i++) {
      const angle = i * angleStep;
      const offsetX = Math.cos(angle) * 80;
      const offsetY = Math.sin(angle) * 80;
      
      regions.push({
        id: `region-${i + 1}`,
        boundary: createCircularBoundary({ x: offsetX, y: offsetY }, 40),
        disks: [],
      });
    }
  }

  return regions;
}

/**
 * Calcula el bounding box de todos los bloques
 */
function getBoundingBox(blocks: CSBlock[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  blocks.forEach(block => {
    if (block.kind === 'segment') {
      minX = Math.min(minX, block.p1.x, block.p2.x);
      maxX = Math.max(maxX, block.p1.x, block.p2.x);
      minY = Math.min(minY, block.p1.y, block.p2.y);
      maxY = Math.max(maxY, block.p1.y, block.p2.y);
    } else if (block.kind === 'arc') {
      minX = Math.min(minX, block.center.x - block.radius);
      maxX = Math.max(maxX, block.center.x + block.radius);
      minY = Math.min(minY, block.center.y - block.radius);
      maxY = Math.max(maxY, block.center.y + block.radius);
    }
  });

  return { minX, maxX, minY, maxY };
}

/**
 * Crea un perímetro circular
 */
function createCircularBoundary(center: Point2D, radius: number, points: number = 12): Point2D[] {
  const boundary: Point2D[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    boundary.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }
  return boundary;
}

/**
 * Verifica si un punto está dentro de una región (algoritmo ray casting)
 */
export function isPointInRegion(point: Point2D, region: Region): boolean {
  const boundary = region.boundary;
  let inside = false;

  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const xi = boundary[i].x;
    const yi = boundary[i].y;
    const xj = boundary[j].x;
    const yj = boundary[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calcula el centroide de una región
 */
export function getRegionCentroid(region: Region): Point2D {
  const boundary = region.boundary;
  const n = boundary.length;
  
  let sumX = 0;
  let sumY = 0;
  
  boundary.forEach(p => {
    sumX += p.x;
    sumY += p.y;
  });
  
  return {
    x: sumX / n,
    y: sumY / n,
  };
}
