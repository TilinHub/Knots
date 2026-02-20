import type { Region } from '../types/contactGraph';
import type { CSBlock, Point2D } from '../types/cs';

/**
 * Calcula el centroide de un polígono
 */
function calculateCentroid(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }

  return {
    x: sumX / points.length,
    y: sumY / points.length,
  };
}

/**
 * Calcula el área de un polígono usando la fórmula del área del polígono
 */
function calculatePolygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
}

/**
 * Calcula el radio máximo de un disco que cabe en una región
 */
function calculateMaxDiskRadius(center: Point2D, boundary: Point2D[]): number {
  let minDistance = Infinity;

  // Encontrar la distancia mínima desde el centro a cualquier punto del borde
  for (const point of boundary) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    minDistance = Math.min(minDistance, distance);
  }

  // Reducir el radio en un 20% para evitar tocar los bordes
  return minDistance * 0.8;
}

/**
 * Extrae puntos clave de los bloques CS
 */
function extractPointsFromBlocks(blocks: CSBlock[]): Point2D[] {
  const points: Point2D[] = [];

  for (const block of blocks) {
    if (block.kind === 'segment') {
      points.push(block.p1, block.p2);
    } else if (block.kind === 'arc') {
      // Para arcos, añadir puntos de inicio y fin
      const startX = block.center.x + block.radius * Math.cos(block.startAngle);
      const startY = block.center.y + block.radius * Math.sin(block.startAngle);
      const endX = block.center.x + block.radius * Math.cos(block.endAngle);
      const endY = block.center.y + block.radius * Math.sin(block.endAngle);

      points.push({ x: startX, y: startY }, { x: endX, y: endY });
    }
  }

  return points;
}

/**
 * Detecta regiones simples basadas en la geometría de los bloques
 * (Implementación simplificada - ideal para nudos simples)
 */
export function detectSimpleRegions(blocks: CSBlock[]): Region[] {
  if (blocks.length === 0) return [];

  const regions: Region[] = [];
  const points = extractPointsFromBlocks(blocks);

  if (points.length < 3) return [];

  // Para nudos simples como el trefoil, creamos regiones manualmente
  // basadas en los espacios entre los bloques

  // Calcular bounding box
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const width = maxX - minX;
  const height = maxY - minY;

  // Para el trefoil, crear 3 regiones simétricas
  if (blocks.length >= 3) {
    const numRegions = Math.min(blocks.length, 4);

    for (let i = 0; i < numRegions; i++) {
      const angle = (i * 2 * Math.PI) / numRegions;
      const distance = Math.min(width, height) * 0.3;

      const regionCenterX = centerX + Math.cos(angle) * distance;
      const regionCenterY = centerY + Math.sin(angle) * distance;

      // Crear boundary aproximado (círculo)
      const boundaryPoints: Point2D[] = [];
      const boundaryRadius = distance * 0.5;

      for (let j = 0; j < 8; j++) {
        const boundaryAngle = (j * 2 * Math.PI) / 8;
        boundaryPoints.push({
          x: regionCenterX + Math.cos(boundaryAngle) * boundaryRadius,
          y: regionCenterY + Math.sin(boundaryAngle) * boundaryRadius,
        });
      }

      regions.push({
        id: `region-${i + 1}`,
        boundary: boundaryPoints,
        disks: [],
        area: calculatePolygonArea(boundaryPoints),
      });
    }
  }

  return regions;
}

/**
 * Crea un disco de contacto para una región
 */
export function createContactDiskForRegion(region: Region): {
  center: Point2D;
  radius: number;
} {
  const center = calculateCentroid(region.boundary);
  const radius = calculateMaxDiskRadius(center, region.boundary);

  return { center, radius };
}

/**
 * Detecta regiones y crea discos de contacto automáticamente
 */
export function detectRegionsWithDisks(blocks: CSBlock[]): Region[] {
  const regions = detectSimpleRegions(blocks);

  // Crear un disco por cada región
  return regions.map((region) => {
    const { center, radius } = createContactDiskForRegion(region);

    return {
      ...region,
      disks: [
        {
          id: `disk-${region.id}`,
          center,
          radius,
          regionId: region.id,
          color: '#4A90E2', // Azul como en tu imagen
        },
      ],
    };
  });
}
