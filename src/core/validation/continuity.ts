/**
 * Validación de continuidad posicional y tangencial para diagramas CS
 */

import type { CSBlock, ValidationResult, Point2D } from '../types/cs';

// Tolerancia para comparaciones numéricas (2px para snap y errores de redondeo)
const EPSILON = 2.0;

/**
 * Obtener el punto inicial de un bloque CS
 * Nota: Los discos no tienen puntos de inicio/fin (retorna su centro)
 */
export function getStartPoint(block: CSBlock): Point2D {
  if (block.kind === 'segment') {
    return block.p1;
  }
  if (block.kind === 'arc') {
    // Arco: punto inicial en startAngle
    return {
      x: block.center.x + block.radius * Math.cos(block.startAngle),
      y: block.center.y + block.radius * Math.sin(block.startAngle),
    };
  }
  // Disco: retornar centro (no tiene punto de inicio)
  return block.center;
}

/**
 * Obtener el punto final de un bloque CS
 * Nota: Los discos no tienen puntos de inicio/fin (retorna su centro)
 */
export function getEndPoint(block: CSBlock): Point2D {
  if (block.kind === 'segment') {
    return block.p2;
  }
  if (block.kind === 'arc') {
    // Arco: punto final en endAngle
    return {
      x: block.center.x + block.radius * Math.cos(block.endAngle),
      y: block.center.y + block.radius * Math.sin(block.endAngle),
    };
  }
  // Disco: retornar centro (no tiene punto final)
  return block.center;
}

/**
 * Calcular el vector tangente al inicio de un bloque
 */
export function getStartTangent(block: CSBlock): Point2D {
  if (block.kind === 'segment') {
    // Segmento: tangente = dirección normalizada
    const dx = block.p2.x - block.p1.x;
    const dy = block.p2.y - block.p1.y;
    const len = Math.hypot(dx, dy);
    return len > EPSILON ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
  }
  if (block.kind === 'arc') {
    // Arco: tangente perpendicular al radio en startAngle
    return {
      x: -Math.sin(block.startAngle),
      y: Math.cos(block.startAngle),
    };
  }
  // Disco: sin tangente definida
  return { x: 0, y: 0 };
}

/**
 * Calcular el vector tangente al final de un bloque
 */
export function getEndTangent(block: CSBlock): Point2D {
  if (block.kind === 'segment') {
    // Segmento: misma tangente en ambos extremos
    return getStartTangent(block);
  }
  if (block.kind === 'arc') {
    // Arco: tangente perpendicular al radio en endAngle
    return {
      x: -Math.sin(block.endAngle),
      y: Math.cos(block.endAngle),
    };
  }
  // Disco: sin tangente definida
  return { x: 0, y: 0 };
}

/**
 * Verificar si dos puntos son iguales (dentro de EPSILON)
 */
function pointsEqual(p1: Point2D, p2: Point2D): boolean {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y) < EPSILON;
}

/**
 * Verificar si dos vectores tangentes son paralelos (mismo sentido)
 */
function tangentsAlign(t1: Point2D, t2: Point2D): boolean {
  // Producto escalar debe ser cercano a 1 (vectores unitarios alineados)
  const dot = t1.x * t2.x + t1.y * t2.y;
  return Math.abs(dot - 1) < 0.1; // Tolerancia ~25 grados
}

/**
 * Encontrar cadenas continuas de bloques, independiente del orden
 * Algoritmo mejorado con mejor manejo de ciclos
 */
export function findContinuousChains(blocks: CSBlock[]): CSBlock[][] {
  if (blocks.length === 0) return [];
  if (blocks.length === 1) return [[blocks[0]]];

  const used = new Set<string>();
  const chains: CSBlock[][] = [];

  // Construir grafo de adyacencia
  const adjacency = new Map<string, Array<{ block: CSBlock, connectsTo: 'start' | 'end' }>>();
  
  for (const block of blocks) {
    adjacency.set(block.id, []);
  }

  // Encontrar todas las conexiones
  for (let i = 0; i < blocks.length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i === j) continue;
      
      const blockA = blocks[i];
      const blockB = blocks[j];
      
      const aStart = getStartPoint(blockA);
      const aEnd = getEndPoint(blockA);
      const bStart = getStartPoint(blockB);
      const bEnd = getEndPoint(blockB);

      // A.end conecta con B.start
      if (pointsEqual(aEnd, bStart)) {
        adjacency.get(blockA.id)?.push({ block: blockB, connectsTo: 'start' });
      }
      
      // A.start conecta con B.end
      if (pointsEqual(aStart, bEnd)) {
        adjacency.get(blockB.id)?.push({ block: blockA, connectsTo: 'start' });
      }
    }
  }

  // Construir cadenas siguiendo las conexiones
  for (const startBlock of blocks) {
    if (used.has(startBlock.id)) continue;

    const chain: CSBlock[] = [];
    const visited = new Set<string>();
    
    // DFS para encontrar toda la cadena conectada
    function dfs(block: CSBlock) {
      if (visited.has(block.id)) return;
      visited.add(block.id);
      chain.push(block);
      used.add(block.id);

      const neighbors = adjacency.get(block.id) || [];
      for (const { block: neighbor } of neighbors) {
        if (!visited.has(neighbor.id)) {
          dfs(neighbor);
        }
      }
    }

    dfs(startBlock);
    
    if (chain.length > 0) {
      // Reordenar la cadena para que sea secuencial
      const orderedChain = orderChain(chain);
      chains.push(orderedChain);
    }
  }

  // Ordenar por longitud (más larga primero)
  return chains.sort((a, b) => b.length - a.length);
}

/**
 * Reordenar una cadena de bloques para que sea secuencial
 */
function orderChain(blocks: CSBlock[]): CSBlock[] {
  if (blocks.length <= 1) return blocks;

  const used = new Set<string>();
  const ordered: CSBlock[] = [];

  // Empezar con el primer bloque
  let current = blocks[0];
  ordered.push(current);
  used.add(current.id);

  // Seguir la cadena
  while (ordered.length < blocks.length) {
    const currentEnd = getEndPoint(current);
    let found = false;

    // Buscar el siguiente bloque que conecta
    for (const candidate of blocks) {
      if (used.has(candidate.id)) continue;

      const candStart = getStartPoint(candidate);
      if (pointsEqual(currentEnd, candStart)) {
        ordered.push(candidate);
        used.add(candidate.id);
        current = candidate;
        found = true;
        break;
      }
    }

    if (!found) {
      // No se pudo continuar, agregar bloques restantes sin orden
      for (const block of blocks) {
        if (!used.has(block.id)) {
          ordered.push(block);
          used.add(block.id);
        }
      }
      break;
    }
  }

  return ordered;
}

/**
 * Validar continuidad de una cadena ordenada
 */
function validateChain(chain: CSBlock[]): { errors: string[], warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (chain.length === 1) {
    return { errors, warnings };
  }

  // Validar conexiones entre bloques consecutivos
  for (let i = 0; i < chain.length - 1; i++) {
    const current = chain[i];
    const next = chain[i + 1];

    const endPoint = getEndPoint(current);
    const startPoint = getStartPoint(next);

    // 1. Continuidad posicional
    if (!pointsEqual(endPoint, startPoint)) {
      const distance = Math.hypot(startPoint.x - endPoint.x, startPoint.y - endPoint.y);
      errors.push(
        `Discontinuidad entre ${current.id} y ${next.id}: ` +
        `distancia = ${distance.toFixed(2)} px`
      );
      continue;
    }

    // 2. Continuidad tangencial
    const endTangent = getEndTangent(current);
    const startTangent = getStartTangent(next);

    if (!tangentsAlign(endTangent, startTangent)) {
      warnings.push(
        `${current.id} → ${next.id}: tangentes no alineadas ` +
        `(puede no ser C¹)`
      );
    }
  }

  // Verificar si la cadena es cerrada
  const firstStart = getStartPoint(chain[0]);
  const lastEnd = getEndPoint(chain[chain.length - 1]);
  const isClosed = pointsEqual(firstStart, lastEnd);

  if (isClosed) {
    const lastTangent = getEndTangent(chain[chain.length - 1]);
    const firstTangent = getStartTangent(chain[0]);

    if (!tangentsAlign(lastTangent, firstTangent)) {
      warnings.push('Curva cerrada pero tangencia no continua en el cierre');
    }
  }

  return { errors, warnings };
}

/**
 * Validar continuidad de un diagrama CS
 */
export function validateContinuity(blocks: CSBlock[]): ValidationResult {
  if (blocks.length === 0) {
    return { valid: false, errors: ['Diagrama vacío'], warnings: [] };
  }

  // Encontrar cadenas continuas
  const chains = findContinuousChains(blocks);

  if (chains.length === 0) {
    return { valid: false, errors: ['No se encontraron cadenas continuas'], warnings: [] };
  }

  // Validar la cadena más larga
  const mainChain = chains[0];
  const { errors, warnings } = validateChain(mainChain);

  // Advertencias sobre bloques no conectados
  if (mainChain.length < blocks.length) {
    const unused = blocks.filter(b => !mainChain.includes(b));
    warnings.push(
      `${unused.length} bloque(s) no conectado(s): ${unused.map(b => b.id).join(', ')}`
    );
  }

  // Información sobre múltiples cadenas
  if (chains.length > 1) {
    warnings.push(
      `Se encontraron ${chains.length} cadenas separadas. ` +
      `Validando la más larga (${mainChain.length} bloques).`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calcular longitud de un bloque CS
 */
export function getBlockLength(block: CSBlock): number {
  if (block.kind === 'segment') {
    return Math.hypot(block.p2.x - block.p1.x, block.p2.y - block.p1.y);
  }
  if (block.kind === 'arc') {
    // Arco: longitud = radio * ángulo
    let angle = block.endAngle - block.startAngle;
    if (angle < 0) angle += 2 * Math.PI;
    return block.radius * angle;
  }
  // Disco: no tiene longitud
  return 0;
}
